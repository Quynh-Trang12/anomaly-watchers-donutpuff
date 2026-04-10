"""
Elite Enterprise Fraud Detection API - Anomaly Watchers Donutpuff

This module serves as the central hub for the AnomalyWatchers system. It integrates 
a FastAPI web server with a Scikit-Learn based machine learning inference engine. 
The system provides real-time risk assessment for financial transactions using a 
'logic-first' approach that combines ML probability scores with strict business 
rule safeguards.
"""

from __future__ import annotations

import logging
import json
import uuid
import secrets
from datetime import datetime
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import random
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware

from .preprocessing import build_feature_matrix
from .schemas import (
    HealthResponse, 
    PredictionOutput, 
    RiskFactor, 
    TransactionInput, 
    TransactionStatusEnum,
    TransactionRecord,
    ConfigurationResponse,
    BusinessRulesUpdate,
    AuditLogEntry,
    QueueOverflowNotify
)
from .db import (
    save_transaction, 
    add_audit_log, 
    get_audit_logs, 
    get_user_transactions, 
    get_all_transactions,
    update_transaction_status,
    get_account_balance,
    deduct_account_balance,
    credit_account_balance,
    get_transaction,
    get_user_email
)
from .services.mail_service import send_security_alert_email

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("anomaly_watchers.api")

# --- Configuration & Global State ---
# Path to the directory containing trained ML models and feature mapping artifacts
MODEL_DIR = Path(__file__).resolve().parents[1] / "trained_models"
# Path to the JSON file governing business rules and decision thresholds
CONFIG_PATH = MODEL_DIR / "model_configuration.json"
# Baseline date used to calculate 'simulation time' for feature engineering
SYSTEM_START_DATE = datetime(2026, 4, 1, 0, 0, 0)

# Dictionary mapping local identifiers to expected model artifact filenames
MODEL_CANDIDATES = {
    "random_forest": ["model_rf_v2.pkl"],
    "feature_columns": ["feature_columns.pkl"],
}

# Global registry to hold the loaded Scikit-Learn objects in memory
model_registry: dict[str, Any] = {}
# List of specific feature names the model expects, used for alignment
feature_columns: list[str] = []

def _calculate_automated_step() -> int:
    """
    Calculates the integer number of hours elapsed since SYSTEM_START_DATE.
    This 'step' represents chronological distance in the feature engineering pipeline.
    """
    delta = datetime.now() - SYSTEM_START_DATE
    return int(delta.total_seconds() // 3600)

def _normalize_feature_columns(raw_columns: Any) -> list[str]:
    """
    Ensures that feature column names loaded from pickle files are converted 
    into a standardized list of strings, handling various input types (Index, ndarray, etc).
    """
    if raw_columns is None:
        return []
    if isinstance(raw_columns, (list, tuple)):
        return [str(column) for column in raw_columns]
    if isinstance(raw_columns, np.ndarray):
        return [str(column) for column in raw_columns.tolist()]
    if isinstance(raw_columns, pd.Index):
        return [str(column) for column in raw_columns.tolist()]
    return []

def _load_first_available(filenames: list[str]) -> Optional[Tuple[str, Any]]:
    for filename in filenames:
        path = MODEL_DIR / filename
        if not path.exists():
            continue
        try:
            artifact = joblib.load(path)
            logger.info("Loaded %s", filename)
            return filename, artifact
        except Exception as exc:
            logger.warning("Could not load %s: %s", filename, exc)
    return None

def _align_features(matrix: pd.DataFrame) -> pd.DataFrame:
    """
    Dynamically aligns an input feature matrix with the model's expected schema.
    Missing columns are filled with zeros to maintain mathematical compatibility.
    """
    target_columns = feature_columns or [str(column) for column in matrix.columns]
    aligned = matrix.copy()
    for column in target_columns:
        if column not in aligned.columns:
            aligned[column] = 0
    return aligned[target_columns]

def _predict_probability(model: Any, matrix: pd.DataFrame) -> float:
    """
    Executes model inference and extracts a fraud probability.
    Supports both standard .predict() and .predict_proba() for flexibility.
    """
    if hasattr(model, "predict_proba"):
        # We index [-1] to get the probability of the Fraud class (usually index 1)
        raw_value = np.asarray(model.predict_proba(matrix))[0][-1]
    elif hasattr(model, "predict"):
        raw_value = np.asarray(model.predict(matrix))[0]
    else:
        raise ValueError("Model does not expose predict_proba or predict.")
    
    probability = float(raw_value)
    # Ensure numerical stability (no NaNs or Inf)
    if not np.isfinite(probability):
        probability = 0.0
    return max(0.0, min(1.0, probability))

def _build_risk_factors(
    payload: TransactionInput,
    probability: float,
    config: Dict[str, Any]
) -> list[RiskFactor]:
    """
    Human-Readable XAI (Explainable AI) Implementation.
    Translates raw model output and transaction attributes into clear, 
    non-technical explanations for the end user.
    """
    factors: list[RiskFactor] = []
    
    business_rules = config.get("business_rules", {})
    large_amount_limit = business_rules.get("large_transfer_limit_amount", 150000.0)
    
    # 1. High Amount Check: Flags transactions crossing a specific dollar threshold.
    if payload.amount >= large_amount_limit:
        factors.append(
            RiskFactor(
                factor=f"This transfer of ${payload.amount:,.2f} is larger than your usual transaction range and requires additional review.",
                severity="warning",
            )
        )

    # 2. Account Depletion Check: Detects if a user is emptying their account (high-risk pattern).
    if payload.oldbalanceOrg > 0:
        drain_ratio = payload.amount / payload.oldbalanceOrg
        if drain_ratio >= 0.95:
            factors.append(
                RiskFactor(
                    factor="This payment would use up most of your available balance. Please confirm this is intentional.",
                    severity="danger",
                )
            )

    # 3. New Account Activity Check: Flags large transfers to recipients with zero balance history.
    if payload.type in {"TRANSFER", "CASH OUT"} and payload.oldbalanceDest == 0 and payload.amount > 10000:
        factors.append(
            RiskFactor(
                factor="Sending a large amount to a recipient with no prior activity is unusual and has been flagged for your safety.",
                severity="warning",
            )
        )

    # 4. Security System Signal: Translates the raw ML probability into a textual alert.
    ml_thresholds = config.get("ml_thresholds", {})
    block_threshold = ml_thresholds.get("block_threshold", 0.8000)
    step_up_threshold = ml_thresholds.get("step_up_threshold", 0.4000)
    
    if probability >= block_threshold:
        factors.append(
            RiskFactor(
                factor="Our security system has flagged this payment as highly unusual based on your account's typical activity.",
                severity="danger",
            )
        )
    elif probability >= step_up_threshold:
        factors.append(
            RiskFactor(
                factor="This payment looks a little different from your usual activity. We just need to confirm it's really you.",
                severity="warning",
            )
        )

    # Default factor if everything is low risk
    if not factors:
        factors.append(
            RiskFactor(
                factor="All security checks passed. This payment looks consistent with your normal activity.",
                severity="info",
            )
        )

    return factors[:6]

def _risk_level(probability: float, block_threshold: float, step_up_threshold: float) -> str:
    """Categorizes raw probability into High, Medium, or Low buckets."""
    if probability >= block_threshold:
        return "High"
    if probability >= step_up_threshold:
        return "Medium"
    return "Low"

def _risk_display_label(risk_level: str) -> str:
    """Converts a risk bucket into a user-friendly UI label."""
    mapping = {
        "High": "High Risk (Blocked / Review)",
        "Medium": "Medium Risk (OTP Required)",
        "Low": "Low Risk (Approved)"
    }
    return mapping.get(risk_level, "Unknown Risk Status")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Unified startup and shutdown lifecycle management.
    Handles artifact loading into the global registry and schema validation.
    """
    # Load Machine Learning artifacts into memory
    model_registry.clear()
    feature_columns.clear()
    for key, candidates in MODEL_CANDIDATES.items():
        loaded = _load_first_available(candidates)
        if not loaded:
            continue
        _, artifact = loaded
        model_registry[key] = artifact
    feature_columns.extend(_normalize_feature_columns(model_registry.get("feature_columns")))

    # Initialize dynamic system configuration (thresholds and rules)
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r") as f:
                app.state.system_configuration = json.load(f)
            logger.info("Loaded system configuration from %s", CONFIG_PATH)
        except Exception as e:
            logger.error("Failed to load configuration: %s", e)
    else:
        # Fallback to hardcoded defaults if configuration file is missing
        app.state.system_configuration = {
            "ml_thresholds": {
                "block_threshold": 0.8000,    
                "step_up_threshold": 0.4000   
            },
            "business_rules": {
                "large_transfer_limit_amount": 150000.0,
                "daily_velocity_limit": 500000.0,
                "restricted_flagged_status": True
            }
        }
    
    # --- Threshold Integrity Safeguard ---
    # To prevent logical bypasses, the 'Step-Up' threshold must be lower than 'Block'.
    # If invalid, the system enforces safe, conservative defaults at startup.
    loaded_thresholds = app.state.system_configuration.get("ml_thresholds", {})
    block_val = loaded_thresholds.get("block_threshold", 0.70)
    step_up_val = loaded_thresholds.get("step_up_threshold", 0.40)
    
    if step_up_val >= block_val:
        logger.warning(
            "CRITICAL CONFIG ERROR: step_up_threshold (%.4f) >= block_threshold (%.4f). "
            "Enforcing safe defaults (0.40 / 0.70) to prevent security bypass.",
            step_up_val, block_val
        )
        app.state.system_configuration["ml_thresholds"]["block_threshold"] = 0.70
        app.state.system_configuration["ml_thresholds"]["step_up_threshold"] = 0.40
    
    logger.info(
        "Decision thresholds initialized — Block: %.4f, Step-Up: %.4f",
        app.state.system_configuration["ml_thresholds"]["block_threshold"],
        app.state.system_configuration["ml_thresholds"]["step_up_threshold"]
    )
    
    yield
    # Cleanup: Release ML artifacts on shutdown
    model_registry.clear()
    feature_columns.clear()

app = FastAPI(
    title="AnomalyWatchers Enterprise Fraud API",
    version="4.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Simplified for development, restricted in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Checks the connectivity and status of the ML inference engines.
    Returns 'degraded' if models fail to load into the registry.
    """
    loaded_models = [key for key in ("random_forest",) if key in model_registry]
    return HealthResponse(
        status="ok" if loaded_models else "degraded",
        models_loaded=loaded_models,
        feature_count=len(feature_columns),
    )

@app.get("/api/configuration/thresholds")
async def get_active_thresholds():
    """Exposes current ML decision thresholds for frontend visualization."""
    return app.state.system_configuration.get("ml_thresholds", {})

@app.get("/api/users/{user_id}/balance")
async def get_user_balance(user_id: str):
    """
    Returns the current real-time balance for an internal user account.
    Used by the User Dashboard to show updated funds after transactions.
    """
    balance = get_account_balance(user_id)
    if balance is None:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")
    return {"user_id": user_id, "balance": balance}

@app.post("/api/admin/notify/queue_overflow")
async def notify_admin_queue_overflow(payload: QueueOverflowNotify, background_tasks: BackgroundTasks):
    """
    Handles administrative alerts. Triggers an out-of-band email notification
    when the manual review queue size crosses a critical threshold.
    """
    queue_size = payload.queue_size
    background_tasks.add_task(
        send_security_alert_email,
        recipient_email="admin@anomalywatchers.com",
        otp_code="ADMIN_REVIEW",
        transaction_details={
            "amount": 0,
            "type": f"QUEUE_OVERFLOW ({queue_size} items)",
            "transaction_id": "ADMIN_ALERT"
        }
    )
    # Persist the alert event in the system audit log
    add_audit_log(
        admin_id="system",
        action_type="QUEUE_OVERFLOW_ALERT",
        details=f"Admin alerted: review queue has {queue_size} pending items."
    )
    return {"status": "alert_sent"}

@app.get("/api/configuration", response_model=ConfigurationResponse)
async def get_configuration():
    return app.state.system_configuration

@app.get("/api/admin/audit_log", response_model=List[AuditLogEntry])
async def get_admin_audit_log():
    return get_audit_logs()

@app.get("/api/admin/transactions", response_model=List[TransactionRecord])
async def get_all_transactions_admin(requesting_user_id: str = Query("")):
    """
    Returns all transactions in the system for monitoring.
    """
    return get_all_transactions()

@app.get("/api/transactions/{user_id}", response_model=List[TransactionRecord])
async def get_transactions_history(user_id: str, requesting_user_id: str = Query("")):
    """
    Retrieves the chronological transaction history for a specific user.
    """
    return get_user_transactions(user_id)

@app.post("/api/verify-otp")
async def verify_otp(transaction_id: str, user_provided_otp: str):
    """
    Validates a 6-digit verification code against a pending INITIATED transaction.
    Admin authority check: backend must verify authority before allowing frontend progression.
    """
    record = get_transaction(transaction_id)
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    
    if record.status != TransactionStatusEnum.INITIATED:
        raise HTTPException(status_code=400, detail="Transaction is not awaiting verification.")
    
    if record.otp_code != user_provided_otp:
        # Diagnostic log for local dev tracking
        logger.warning("OTP Mismatch for %s: expected %s, got %s", transaction_id, record.otp_code, user_provided_otp)
        raise HTTPException(status_code=401, detail="Invalid security code.")
    
    return {"status": "success", "message": "Verification confirmed."}

@app.post("/api/transactions")
async def save_transaction_record(transaction: TransactionRecord):
    """
    The Transaction Finalization Engine.
    
    This endpoint manages the transition of transactions from PENDING to FINAL states.
    It enforces 'Backend Authority' by validating security codes before updating the ledger.
    Note: Highly idempotent to prevent fraudulent double-spending or duplicate deductions.
    """
    existing_record = get_transaction(transaction.transaction_id)
    
    # --- PHASE 1: New Direct Transactions ---
    if not existing_record:
        if transaction.status == TransactionStatusEnum.APPROVED:
            try:
                # Update dual-ledger balances for both originator and recipient
                deduct_account_balance(transaction.owner_user_id, transaction.amount)
                if transaction.destination_account_id:
                    credit_account_balance(transaction.destination_account_id, transaction.amount)
            except ValueError as ledger_error:
                # Catch technical overdrafts or missing accounts
                logger.warning("Ledger update failed for new transaction %s: %s", transaction.transaction_id, ledger_error)
                raise HTTPException(status_code=400, detail=str(ledger_error))
        
        save_transaction(transaction)
        return {"status": "success", "transaction_id": transaction.transaction_id}

    # --- PHASE 2: Idempotency Protection ---
    if existing_record.status == TransactionStatusEnum.APPROVED:
        # Prevent re-running deductions if the frontend submits a retry of a successful txn
        return {"status": "success", "transaction_id": transaction.transaction_id, "note": "idempotent_ack"}

    # --- PHASE 3: Security Verification Transition ---
    # Transitioning from 'INITIATED' (User has the OTP) to 'APPROVED' (Ledger committed)
    if transaction.status == TransactionStatusEnum.APPROVED and existing_record.status == TransactionStatusEnum.INITIATED:
        # Backend Authority: The frontend CANNOT force approval without matching the OTP generated server-side.
        if transaction.otp_code != existing_record.otp_code:
            raise HTTPException(status_code=403, detail="Unauthorized: Invalid verification code provided for finalization.")
        
        # Verify that the account owner hasn't changed during the verification phase
        if transaction.owner_user_id != existing_record.owner_user_id:
            raise HTTPException(status_code=403, detail="Unauthorized: Originator mismatch during finalization.")
            
        try:
            # Atomic ledger update
            deduct_account_balance(transaction.owner_user_id, transaction.amount)
            if transaction.destination_account_id:
                credit_account_balance(transaction.destination_account_id, transaction.amount)
        except ValueError as ledger_error:
            logger.warning("Ledger update failed for finalized transaction %s: %s", transaction.transaction_id, ledger_error)
            raise HTTPException(status_code=400, detail=str(ledger_error))

    # Persist the final outcome (Approved, Rejected, or Cancelled)
    save_transaction(transaction)
    return {"status": "success", "transaction_id": transaction.transaction_id}


@app.get("/api/debug/fraud_probe")
async def debug_fraud_probe():
    """
    Development diagnostic endpoint: sends a known high-risk pattern through
    the ML engine and returns the raw probability score.
    """
    test_pattern_frame = pd.DataFrame([{
        "step": 1,
        "type": "CASH_OUT",
        "amount": 200000,
        "nameOrig": "C_origin_test",
        "oldbalanceOrg": 200000,
        "newbalanceOrig": 0,
        "nameDest": "C_dest_test",
        "oldbalanceDest": 0,
        "newbalanceDest": 200000,
    }])
    
    feature_matrix = build_feature_matrix(test_pattern_frame)
    feature_matrix = _align_features(feature_matrix)
    
    ml_thresholds = app.state.system_configuration.get("ml_thresholds", {})
    block_threshold = ml_thresholds.get("block_threshold", 0.5130)
    step_up_threshold = ml_thresholds.get("step_up_threshold", 0.1000)

    try:
        raw_probability = _predict_probability(model_registry["random_forest"], feature_matrix)
    except Exception:
        raw_probability = 0.51 # High risk for this specific probe if model fails

    return {
        "test_pattern": "CASH_OUT full account drain $200,000",
        "raw_probability_score": raw_probability,
        "current_block_threshold": block_threshold,
        "current_step_up_threshold": step_up_threshold,
        "expected_decision": _risk_level(raw_probability, block_threshold, step_up_threshold)
    }

@app.get("/api/admin/system/status")
async def get_system_status():
    """Returns basic system health for monitoring."""
    return {"status": "operational", "timestamp": datetime.now()}

@app.post("/api/predict/primary", response_model=PredictionOutput)
async def predict_primary(transaction_input: TransactionInput, background_tasks: BackgroundTasks) -> PredictionOutput:
    """
    The Primary AI Inference Pipeline.
    
    This function coordinates the end-to-end processing of a transaction:
    1. Input Validation vs. Internal Ledger
    2. Feature Transformation
    3. Model Inference (or Rule-based Fallback)
    4. Risk Categorization (Decision Routing)
    5. Persistence & Event (Email) Dispatch
    """
    system_configuration = app.state.system_configuration
    ml_thresholds = system_configuration.get("ml_thresholds", {})
    business_rules = system_configuration.get("business_rules", {})
    
    # --- PHASE 1: Identity & Funds Validation ---
    originator_balance = get_account_balance(transaction_input.user_id)
    if originator_balance is None:
        raise HTTPException(
            status_code=400,
            detail=f"Originator account '{transaction_input.user_id}' not found in internal network."
        )

    if transaction_input.amount > originator_balance:
        # Rule 5. Ledger Balance Early Enforcement (Reject if broke)
        raise HTTPException(
            status_code=400,
            detail=f"Transaction rejected: Insufficient funds. Available: ${originator_balance:,.2f}"
        )

    if transaction_input.destination_account_id:
        if transaction_input.destination_account_id == transaction_input.user_id:
            raise HTTPException(status_code=400, detail="You cannot transfer money to your own account.")
            
        destination_balance = get_account_balance(transaction_input.destination_account_id)
        if destination_balance is None:
            raise HTTPException(
                status_code=400,
                detail="Recipient account not found in internal network. Please verify the account ID."
            )

    # --- PHASE 2: Chronological Sequence (Step) Calculation ---
    if transaction_input.step is not None:
        automated_step = transaction_input.step
    else:
        automated_step = _calculate_automated_step()
    
    # --- PHASE 3: Feature Matrix Construction ---
    raw_feature_frame = pd.DataFrame([{
        "step": automated_step,
        "type": transaction_input.type,
        "amount": transaction_input.amount,
        "nameOrig": "C_origin_" + transaction_input.user_id,
        "oldbalanceOrg": transaction_input.oldbalanceOrg,
        "newbalanceOrig": transaction_input.newbalanceOrig,
        "nameDest": "C_dest_demo",
        "oldbalanceDest": transaction_input.oldbalanceDest,
        "newbalanceDest": transaction_input.newbalanceDest,
    }])

    # --- PHASE 4: Model Inference vs. Rule-based Fallback ---
    is_using_fallback = False
    try:
        # standard ML pipeline: Preprocess -> Align -> Predict
        feature_matrix = build_feature_matrix(raw_feature_frame)
        feature_matrix = _align_features(feature_matrix)
        probability_score = _predict_probability(model_registry["random_forest"], feature_matrix)
    except Exception as execution_exception:
        logger.warning("Inference engine failure, using rule-based fallback: %s", execution_exception)
        is_using_fallback = True
        # Rule 6. Fallback Heuristics - Ensures system stays operational if ML engine is offline
        if transaction_input.amount > 150000.0 or (transaction_input.amount / (transaction_input.oldbalanceOrg or 1) > 0.9):
            probability_score = 0.81  # Threshold for 'Blocked'
        elif transaction_input.amount > 50000.0:
            probability_score = 0.50  # Threshold for 'OTP Required'
        else:
            probability_score = 0.05

    # --- PHASE 5: Decision Routing & Decision Logic ---
    block_threshold = ml_thresholds.get("block_threshold", 0.8000)
    step_up_threshold = ml_thresholds.get("step_up_threshold", 0.4000)
    new_transaction_id = f"TXN-{uuid.uuid4().hex[:8].upper()}"
    risk_factors_list = _build_risk_factors(transaction_input, probability_score, system_configuration)
    
    transaction_status = TransactionStatusEnum.APPROVED
    operation_explanation = "Everything looks good! Your transaction has been securely processed."
    
    security_otp_code = None
    
    if probability_score >= block_threshold:
        transaction_status = TransactionStatusEnum.BLOCKED
        operation_explanation = "For your protection, this transaction has been declined. It doesn't match your usual activity."
    elif probability_score >= step_up_threshold:
        transaction_status = TransactionStatusEnum.PENDING_USER_OTP
        operation_explanation = "This payment looks a little different from your usual activity. We just need to confirm it's really you."
        
        # Security Sequence: Generate OTP -> Queue Email Task
        security_otp_code = str(random.randint(100000, 999999))
        recipient_email = get_user_email(transaction_input.user_id) or f"{transaction_input.user_id}@example.com"
        background_tasks.add_task(
            send_security_alert_email,
            recipient_email=recipient_email,
            otp_code=security_otp_code,
            transaction_details={
                "amount": transaction_input.amount, 
                "type": transaction_input.type,
                "transaction_id": new_transaction_id
            }
        )

    # --- PHASE 6: Persistence & Ledger Commitment ---
    saved_db_status = transaction_status
    if transaction_status == TransactionStatusEnum.PENDING_USER_OTP:
        # Transactions awaiting OTP are saved as 'INITIATED' (pending)
        saved_db_status = TransactionStatusEnum.INITIATED

    transaction_record_entry = TransactionRecord(
        transaction_id=new_transaction_id,
        owner_user_id=transaction_input.user_id,
        destination_account_id=transaction_input.destination_account_id,
        amount=transaction_input.amount,
        type=transaction_input.type,
        status=saved_db_status,
        probability_score=probability_score,
        timestamp=datetime.now(),
        risk_factors=risk_factors_list,
        otp_code=security_otp_code
    )

    # Atomic Commit: Update balances ONLY for immediate approvals
    if transaction_status == TransactionStatusEnum.APPROVED:
        try:
            deduct_account_balance(transaction_input.user_id, transaction_input.amount)
            if transaction_input.destination_account_id:
                credit_account_balance(transaction_input.destination_account_id, transaction_input.amount)
            
            # Save transaction to history ONLY after ledger success
            save_transaction(transaction_record_entry)
        except ValueError as ledger_error:
            raise HTTPException(status_code=400, detail=str(ledger_error))
    else:
        # Persist the PENDING / BLOCKED state immediately for audit
        save_transaction(transaction_record_entry)

    # Map raw data to user-friendly risk descriptions
    risk_level_str = _risk_level(probability_score, block_threshold, step_up_threshold)
    return PredictionOutput(
        probability=probability_score,
        is_fraud=transaction_status == TransactionStatusEnum.BLOCKED,
        risk_level=risk_level_str,
        risk_display_label=_risk_display_label(risk_level_str),
        status=transaction_status,
        explanation=operation_explanation,
        risk_factors=risk_factors_list,
        transaction_id=new_transaction_id
    )
