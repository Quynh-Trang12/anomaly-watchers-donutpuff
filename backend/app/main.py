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

    # 4. Security System Signal (No hardcoded threshold numbers in decision logic names)
    ml_thresholds = config.get("ml_thresholds", {})
    block_threshold = ml_thresholds.get("block_threshold", 0.5130)
    step_up_threshold = ml_thresholds.get("step_up_threshold", 0.1000)
    
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
        # Fallback defaults
        app.state.system_configuration = {
            "ml_thresholds": {
                "block_threshold": 0.5130,    # Maximizes F1-Score on PR curve
                "step_up_threshold": 0.1000   # Maximizes Recall at 90% Precision
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

@app.put("/api/configuration")
async def update_configuration(update: BusinessRulesUpdate):
    # Update in-memory state
    app.state.system_configuration["business_rules"] = update.model_dump()
    
    # Persist to disk
    try:
        with open(CONFIG_PATH, "w") as f:
            json.dump(app.state.system_configuration, f, indent=4)
        
        add_audit_log(
            admin_id="system_admin",
            action_type="CONFIG_UPDATE",
            details=f"Business rules updated: {update.model_dump()}"
        )
        return {"status": "success", "message": "Configuration updated and persisted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/audit_log", response_model=List[AuditLogEntry])
async def get_admin_audit_log():
    return get_audit_logs()

@app.get("/api/admin/transactions", response_model=List[TransactionRecord])
async def get_all_transactions_admin(requesting_user_id: str = Query("")):
    """
    Returns all transactions in the system.
    ADMIN-ONLY: Only users with 'admin' prefix can access this endpoint.
    """
    # In a production system, this would use JWT token validation.
    # For this simulation, we enforce admin-only access via the requesting_user_id param.
    is_admin_request = requesting_user_id.startswith("admin")
    if not is_admin_request:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Only admins can view all transactions."
        )
    return get_all_transactions()

@app.get("/api/transactions/{user_id}", response_model=List[TransactionRecord])
async def get_transactions_history(user_id: str, requesting_user_id: str = Query("")):
    """
    Returns transaction history for the specified user account.
    For security, users may only access their own transaction history.
    Admins (identified by the 'admin' prefix) may access any account.
    """
    # In a production system, this would use JWT token validation.
    # For this simulation, we enforce user isolation via the requesting_user_id param.
    is_admin_request = requesting_user_id.startswith("admin")
    if not is_admin_request and requesting_user_id and requesting_user_id != user_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied. You may only view your own transaction history."
        )
    return get_user_transactions(user_id)

@app.post("/api/transactions/{transaction_id}/action")
async def transaction_action(transaction_id: str, action: str, admin_id: str = "admin_1"):
    """
    Manual override for transactions in PENDING_ADMIN_REVIEW.
    Approving a transaction here triggers the definitive ledger update.
    """
    status = TransactionStatusEnum.APPROVED if action == "approve" else TransactionStatusEnum.BLOCKED
    
    # Execute ledger changes if approved
    if status == TransactionStatusEnum.APPROVED:
        txn = get_transaction(transaction_id)
        if txn:
            try:
                deduct_account_balance(txn.owner_user_id, txn.amount)
                if txn.destination_account_id:
                    credit_account_balance(txn.destination_account_id, txn.amount)
            except ValueError as ledger_error:
                logger.warning("Admin approval ledger update failed: %s", ledger_error)
                raise HTTPException(status_code=400, detail=str(ledger_error))

    update_transaction_status(transaction_id, status, admin_id=admin_id)
    return {
        "status": "success", 
        "transaction_id": transaction_id, 
        "new_status": status,
        "message": f"Transaction has been manually {'released' if action == 'approve' else 'blocked'} by administration."
    }

@app.get("/api/debug/fraud_probe")
async def debug_fraud_probe():
    """
    Development diagnostic endpoint: sends a known high-risk pattern through
    the ML engine and returns the raw probability score.
    """
    test_frame = pd.DataFrame([{
        "step": 1,
        "type": "CASH OUT",
        "amount": 200000.0,
        "nameOrig": "C_origin_user_1",
        "oldbalanceOrg": 200000.0,
        "newbalanceOrig": 0.0,
        "nameDest": "C_dest_demo",
        "oldbalanceDest": 0.0,
        "newbalanceDest": 0.0,
    }])
    feature_matrix = build_feature_matrix(test_frame)
    feature_matrix = _align_features(feature_matrix)
    raw_probability = _predict_probability(model_registry["random_forest"], feature_matrix)
    
    ml_thresholds = app.state.system_configuration.get("ml_thresholds", {})
    block_threshold = ml_thresholds.get("block_threshold", 0.5130)
    
    return {
        "test_pattern": "CASH_OUT full account drain $200,000",
        "raw_probability_score": raw_probability,
        "current_block_threshold": block_threshold,
        "expected_decision": "BLOCKED" if raw_probability >= block_threshold else "REVIEW"
    }

@app.get("/api/security/freeze")
async def freeze_account(id: str):
    """
    Emergency account freeze endpoint triggered from OOB email security alerts.
    """
    update_transaction_status(id, TransactionStatusEnum.BLOCKED, admin_id="SYSTEM_AUTO_FREEZE")
    add_audit_log(
        admin_id="system",
        action_type="ACCOUNT_FREEZE",
        details=f"Emergency account freeze triggered for transaction {id}."
    )
    return {
        "status": "success", 
        "message": "Security protocols engaged. Account activity has been suspended and our team is investigating."
    }

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

    try:
        feature_matrix = build_feature_matrix(raw_feature_frame)
        feature_matrix = _align_features(feature_matrix)
        probability_score = _predict_probability(model_registry["random_forest"], feature_matrix)
    except Exception as execution_exception:
        logger.error("Inference Engine Error: %s", execution_exception)
        raise HTTPException(status_code=503, detail="Security analysis engine is temporarily unavailable.")

    # 3. Decision Routing Logic & ID Generation
    block_threshold = ml_thresholds.get("block_threshold", 0.5130)
    step_up_threshold = ml_thresholds.get("step_up_threshold", 0.1000)
    new_transaction_id = f"TXN-{uuid.uuid4().hex[:8].upper()}"
    risk_factors_list = _build_risk_factors(transaction_input, probability_score, system_configuration)
    large_transfer_limit = business_rules.get("large_transfer_limit_amount", 150000.0)
    
    transaction_status = TransactionStatusEnum.APPROVED
    operation_explanation = "Everything looks good! Your transaction has been securely processed."
    security_otp_code = None  # Will be set if OTP needed
    
    if probability_score >= block_threshold:
        transaction_status = TransactionStatusEnum.BLOCKED
        operation_explanation = "For your protection, this transaction has been declined. It doesn't match your usual activity."
    elif probability_score >= step_up_threshold:
        transaction_status = TransactionStatusEnum.PENDING_USER_OTP
        operation_explanation = "This payment looks a little different from your usual activity. We just need to confirm it's really you. We've sent a 6-digit security code to your email."
        # Generate a 6-digit numeric OTP — compatible with the numeric OTP input component
        security_otp_code = str(random.randint(100000, 999999))
        # Get the actual email address configured for this user
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
    elif transaction_input.amount > large_transfer_limit:
        transaction_status = TransactionStatusEnum.PENDING_ADMIN_REVIEW
        operation_explanation = "Since this is a larger amount than usual, our security team is doing a quick manual check before we release the funds."
        add_audit_log(
            admin_id="system",
            action_type="REVIEW_QUEUED",
            details=f"Large transfer of ${transaction_input.amount:,.2f} initiated by {transaction_input.user_id}."
        )

    # 4. Persistence
    transaction_record_entry = TransactionRecord(
        transaction_id=new_transaction_id,
        owner_user_id=transaction_input.user_id,
        destination_account_id=transaction_input.destination_account_id,
        amount=transaction_input.amount,
        type=transaction_input.type,
        status=transaction_status,
        probability_score=probability_score,
        timestamp=datetime.now(),
        risk_factors=risk_factors_list,
        otp_code=security_otp_code  # Store OTP if needed for verification
    )
    save_transaction(transaction_record_entry)

    # 5. Execute ledger changes for APPROVED transactions (Bidirectional)
    if transaction_status == TransactionStatusEnum.APPROVED:
        try:
            deduct_account_balance(transaction_input.user_id, transaction_input.amount)
            if transaction_input.destination_account_id:
                credit_account_balance(transaction_input.destination_account_id, transaction_input.amount)
        except ValueError as ledger_error:
            logger.warning("Ledger update failed for %s: %s", transaction_input.user_id, ledger_error)
            # In a real system we would roll back the transaction record.

    return PredictionOutput(
        probability=probability_score,
        is_fraud=transaction_status == TransactionStatusEnum.BLOCKED,
        risk_level=_risk_level(probability_score, block_threshold, step_up_threshold),
        status=transaction_status,
        explanation=operation_explanation,
        risk_factors=risk_factors_list,
        transaction_id=new_transaction_id
    )

@app.post("/api/verify-otp")
async def verify_otp(transaction_id: str, user_provided_otp: str):
    """
    Verify the user-provided OTP against the stored OTP and update transaction status.
    Returns success if OTP matches, otherwise returns error.
    """
    transaction = get_transaction(transaction_id)
    
    if not transaction:
        raise HTTPException(status_code=404, detail=f"Transaction {transaction_id} not found.")
    
    if transaction.status != TransactionStatusEnum.PENDING_USER_OTP:
        raise HTTPException(
            status_code=400,
            detail=f"Transaction {transaction_id} is not pending OTP verification (current status: {transaction.status})."
        )
    
    if not transaction.otp_code:
        raise HTTPException(status_code=400, detail="No OTP stored for this transaction.")
    
    if user_provided_otp != transaction.otp_code:
        logger.warning(f"OTP verification failed for transaction {transaction_id}: incorrect code provided")
        raise HTTPException(status_code=401, detail="Incorrect security code. Please check and try again.")
    
    # OTP is correct - update transaction to APPROVED and execute ledger
    logger.info(f"OTP verification succeeded for transaction {transaction_id}")
    update_transaction_status(transaction_id, TransactionStatusEnum.APPROVED)
    
    # Execute ledger changes (Bidirectional)
    try:
        deduct_account_balance(transaction.owner_user_id, transaction.amount)
        if transaction.destination_account_id:
            credit_account_balance(transaction.destination_account_id, transaction.amount)
    except ValueError as ledger_error:
        logger.error(f"Ledger update failed for OTP verification on {transaction_id}: {ledger_error}")
        raise HTTPException(status_code=400, detail=f"Transaction processing failed: {str(ledger_error)}")
    
    return {
        "status": "success",
        "message": "Security verification complete. Your transaction has been approved.",
        "transaction_id": transaction_id
    }
