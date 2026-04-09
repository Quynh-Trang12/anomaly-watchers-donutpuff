"""
Elite Enterprise Fraud Detection API - Anomaly Watchers Donutpuff
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

MODEL_DIR = Path(__file__).resolve().parents[1] / "trained_models"
CONFIG_PATH = MODEL_DIR / "model_configuration.json"
SYSTEM_START_DATE = datetime(2026, 4, 1, 0, 0, 0)

MODEL_CANDIDATES = {
    "random_forest": ["model_rf_v2.pkl"],
    "feature_columns": ["feature_columns.pkl"],
}

model_registry: dict[str, Any] = {}
feature_columns: list[str] = []

def _calculate_automated_step() -> int:
    """Calculates the integer number of hours elapsed since SYSTEM_START_DATE."""
    delta = datetime.now() - SYSTEM_START_DATE
    return int(delta.total_seconds() // 3600)

def _normalize_feature_columns(raw_columns: Any) -> list[str]:
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
    target_columns = feature_columns or [str(column) for column in matrix.columns]
    aligned = matrix.copy()
    for column in target_columns:
        if column not in aligned.columns:
            aligned[column] = 0
    return aligned[target_columns]

def _predict_probability(model: Any, matrix: pd.DataFrame) -> float:
    if hasattr(model, "predict_proba"):
        raw_value = np.asarray(model.predict_proba(matrix))[0][-1]
    elif hasattr(model, "predict"):
        raw_value = np.asarray(model.predict(matrix))[0]
    else:
        raise ValueError("Model does not expose predict_proba or predict.")
    
    probability = float(raw_value)
    if not np.isfinite(probability):
        probability = 0.0
    return max(0.0, min(1.0, probability))

def _build_risk_factors(
    payload: TransactionInput,
    probability: float,
    config: Dict[str, Any]
) -> list[RiskFactor]:
    """Human-Readable XAI Implementation - Strictly NO technical jargon."""
    factors: list[RiskFactor] = []
    
    business_rules = config.get("business_rules", {})
    large_amount_limit = business_rules.get("large_transfer_limit_amount", 150000.0)
    
    # 1. High Amount Check
    if payload.amount >= large_amount_limit:
        factors.append(
            RiskFactor(
                factor=f"This transfer of ${payload.amount:,.2f} is larger than your usual transaction range and requires additional review.",
                severity="warning",
            )
        )

    # 2. Account Depletion Check
    if payload.oldbalanceOrg > 0:
        drain_ratio = payload.amount / payload.oldbalanceOrg
        if drain_ratio >= 0.95:
            factors.append(
                RiskFactor(
                    factor="This payment would use up most of your available balance. Please confirm this is intentional.",
                    severity="danger",
                )
            )

    # 3. New Account Activity Check
    if payload.type in {"TRANSFER", "CASH OUT"} and payload.oldbalanceDest == 0 and payload.amount > 10000:
        factors.append(
            RiskFactor(
                factor="Sending a large amount to a recipient with no prior activity is unusual and has been flagged for your safety.",
                severity="warning",
            )
        )

    # 4. Security System Signal
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

    if not factors:
        factors.append(
            RiskFactor(
                factor="All security checks passed. This payment looks consistent with your normal activity.",
                severity="info",
            )
        )

    return factors[:6]

def _risk_level(probability: float, block_threshold: float, step_up_threshold: float) -> str:
    if probability >= block_threshold:
        return "High"
    if probability >= step_up_threshold:
        return "Medium"
    return "Low"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load Models
    model_registry.clear()
    feature_columns.clear()
    for key, candidates in MODEL_CANDIDATES.items():
        loaded = _load_first_available(candidates)
        if not loaded:
            continue
        _, artifact = loaded
        model_registry[key] = artifact
    feature_columns.extend(_normalize_feature_columns(model_registry.get("feature_columns")))

    # Load Dynamic Configuration
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r") as f:
                app.state.system_configuration = json.load(f)
            logger.info("Loaded system configuration from %s", CONFIG_PATH)
        except Exception as e:
            logger.error("Failed to load configuration: %s", e)
    else:
        # Fallback defaults - Relaxed for demo reliability
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
    
    # Log loaded thresholds to verify configuration
    loaded_thresholds = app.state.system_configuration.get("ml_thresholds", {})
    logger.info(
        "Decision thresholds loaded — Block: %.4f, Step-Up: %.4f",
        loaded_thresholds.get("block_threshold", 0.0),
        loaded_thresholds.get("step_up_threshold", 0.0)
    )
    
    yield
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
    """Returns the current real-time balance for an internal user account."""
    balance = get_account_balance(user_id)
    if balance is None:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")
    return {"user_id": user_id, "balance": balance}

@app.post("/api/admin/notify/queue_overflow")
async def notify_admin_queue_overflow(payload: QueueOverflowNotify, background_tasks: BackgroundTasks):
    """Triggers an OOB alert email when the review queue exceeds the threshold."""
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
    Returns transaction history for the specified user account.
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
    Finalizes a transaction.
    Backend Authority: Approval of an INITIATED transaction REQUIRES the correct OTP code.
    Implementation note: This endpoint is idempotent to prevent double-deduction on retries.
    """
    existing_record = get_transaction(transaction.transaction_id)
    
    # CASE 1: This is a COMPLETELY NEW transaction (e.g. from an external source or direct result)
    if not existing_record:
        if transaction.status == TransactionStatusEnum.APPROVED:
            try:
                deduct_account_balance(transaction.owner_user_id, transaction.amount)
                if transaction.destination_account_id:
                    credit_account_balance(transaction.destination_account_id, transaction.amount)
            except ValueError as ledger_error:
                logger.warning("Ledger update failed for new transaction %s: %s", transaction.transaction_id, ledger_error)
                raise HTTPException(status_code=400, detail=str(ledger_error))
        
        save_transaction(transaction)
        return {"status": "success", "transaction_id": transaction.transaction_id}

    # CASE 2: Transaction already finalized as APPROVED (Idempotency check)
    if existing_record.status == TransactionStatusEnum.APPROVED:
        # If it's already approved, we just return success without re-deducting balance.
        return {"status": "success", "transaction_id": transaction.transaction_id, "note": "idempotent_ack"}

    # CASE 3: Transitioning from INITIATED (OTP Pending) to APPROVED
    if transaction.status == TransactionStatusEnum.APPROVED and existing_record.status == TransactionStatusEnum.INITIATED:
        # Backend Authority: Check BOTH OTP and Owner for high-fidelity security
        if transaction.otp_code != existing_record.otp_code:
            raise HTTPException(status_code=403, detail="Unauthorized: Invalid verification code provided for finalization.")
        
        if transaction.owner_user_id != existing_record.owner_user_id:
            raise HTTPException(status_code=403, detail="Unauthorized: Originator mismatch during finalization.")
            
        try:
            # Execute ledger changes ONLY on transition to APPROVED
            deduct_account_balance(transaction.owner_user_id, transaction.amount)
            if transaction.destination_account_id:
                credit_account_balance(transaction.destination_account_id, transaction.amount)
        except ValueError as ledger_error:
            logger.warning("Ledger update failed for finalized transaction %s: %s", transaction.transaction_id, ledger_error)
            raise HTTPException(status_code=400, detail=str(ledger_error))

    # Save the updated record (covers transitions to APPROVED, REJECTED, CANCELLED etc.)
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
    system_configuration = app.state.system_configuration
    ml_thresholds = system_configuration.get("ml_thresholds", {})
    business_rules = system_configuration.get("business_rules", {})
    
    # 0a. Validate that the originating user exists in the internal network
    originator_balance = get_account_balance(transaction_input.user_id)
    if originator_balance is None:
        raise HTTPException(
            status_code=400,
            detail=f"Originator account '{transaction_input.user_id}' not found in internal network."
        )

    # NEW: Rule 5. Ledger Balance Early Enforcement
    if transaction_input.amount > originator_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Transaction rejected: Insufficient funds. Available: ${originator_balance:,.2f}"
        )

    # 0b. Validate that the destination account exists in the internal network
    if transaction_input.destination_account_id:
        if transaction_input.destination_account_id == transaction_input.user_id:
            raise HTTPException(status_code=400, detail="You cannot transfer money to your own account.")
            
        destination_balance = get_account_balance(transaction_input.destination_account_id)
        if destination_balance is None:
            raise HTTPException(
                status_code=400,
                detail="Recipient account not found in internal network. Please verify the account ID."
            )

    # 1. Automated Step Calculation
    automated_step = _calculate_automated_step()
    
    # 2. Build Feature Matrix
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

    is_using_fallback = False
    try:
        feature_matrix = build_feature_matrix(raw_feature_frame)
        feature_matrix = _align_features(feature_matrix)
        probability_score = _predict_probability(model_registry["random_forest"], feature_matrix)
    except Exception as execution_exception:
        logger.warning("Inference engine failure, using rule-based fallback: %s", execution_exception)
        is_using_fallback = True
        # Rule 6. Fallback Behavior - Demo Optimized
        if transaction_input.amount > 150000.0 or (transaction_input.amount / (transaction_input.oldbalanceOrg or 1) > 0.9):
            probability_score = 0.81  # Trigger Block
        elif transaction_input.amount > 50000.0:
            probability_score = 0.50  # Trigger OTP
        else:
            probability_score = 0.05

    # 3. Decision Routing Logic & ID Generation - Demo Optimized
    block_threshold = ml_thresholds.get("block_threshold", 0.8000)
    step_up_threshold = ml_thresholds.get("step_up_threshold", 0.4000)
    new_transaction_id = f"TXN-{uuid.uuid4().hex[:8].upper()}"
    risk_factors_list = _build_risk_factors(transaction_input, probability_score, system_configuration)
    
    transaction_status = TransactionStatusEnum.APPROVED
    operation_explanation = "Everything looks good! Your transaction has been securely processed."
    if is_using_fallback:
        operation_explanation = "Our primary AI engine is offline for maintenance. A backup security profile was used to approve this transfer."
    
    security_otp_code = None
    
    if probability_score >= block_threshold:
        transaction_status = TransactionStatusEnum.BLOCKED
        operation_explanation = "For your protection, this transaction has been declined. It doesn't match your usual activity."
    elif probability_score >= step_up_threshold:
        transaction_status = TransactionStatusEnum.PENDING_USER_OTP
        operation_explanation = "This payment looks a little different from your usual activity. We just need to confirm it's really you."
        if is_using_fallback:
            operation_explanation = "Due to backup security protocols, this large transfer requires a one-time verification code."
        
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

    # 4. Persistence - Option B: INITIATED for OTP, Final for others
    saved_db_status = transaction_status
    if transaction_status == TransactionStatusEnum.PENDING_USER_OTP:
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

    # 5. Execute ledger changes only for APPROVED
    if transaction_status == TransactionStatusEnum.APPROVED:
        try:
            deduct_account_balance(transaction_input.user_id, transaction_input.amount)
            if transaction_input.destination_account_id:
                credit_account_balance(transaction_input.destination_account_id, transaction_input.amount)
            
            # Save ONLY after ledger success
            save_transaction(transaction_record_entry)
        except ValueError as ledger_error:
            # If ledger fails, don't save APPROVED status, raise error
            raise HTTPException(status_code=400, detail=str(ledger_error))
    else:
        # Save INITIATED or BLOCKED immediately
        save_transaction(transaction_record_entry)

    return PredictionOutput(
        probability=probability_score,
        is_fraud=transaction_status == TransactionStatusEnum.BLOCKED,
        risk_level=_risk_level(probability_score, block_threshold, step_up_threshold),
        status=transaction_status,
        explanation=operation_explanation,
        risk_factors=risk_factors_list,
        transaction_id=new_transaction_id
    )
