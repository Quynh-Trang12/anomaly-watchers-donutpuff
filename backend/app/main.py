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

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, BackgroundTasks
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
    deduct_account_balance
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
                factor=f"This transfer of ${payload.amount:,.2f} is significantly higher than your typical transaction range.",
                severity="warning",
            )
        )

    # 2. Account Depletion Check
    if payload.oldbalanceOrg > 0:
        drain_ratio = payload.amount / payload.oldbalanceOrg
        if drain_ratio >= 0.95:
            drain_percentage = min(drain_ratio * 100, 100)
            factors.append(
                RiskFactor(
                    factor=f"This transfer of ${payload.amount:,.2f} will use up {drain_percentage:.0f}% of the money currently in your account.",
                    severity="danger",
                )
            )

    # 3. New Account Activity Check
    if payload.type in {"TRANSFER", "CASH OUT"} and payload.oldbalanceDest == 0 and payload.amount > 10000:
        factors.append(
            RiskFactor(
                factor="Sending a large sum to an account with no prior history can be a sign of unauthorized access.",
                severity="warning",
            )
        )

    # 4. ML Signal
    ml_thresholds = config.get("ml_thresholds", {})
    block_threshold = ml_thresholds.get("block_threshold", 0.5)
    step_up_threshold = ml_thresholds.get("step_up_threshold", 0.4)
    
    if probability >= block_threshold:
        factors.append(
            RiskFactor(
                factor="Our security system has detected activity that looks very different from your usual spending habits.",
                severity="danger",
            )
        )
    elif probability >= step_up_threshold:
        factors.append(
            RiskFactor(
                factor="We've noticed some unusual details in this request and need to double-check its security.",
                severity="warning",
            )
        )

    if not factors:
        factors.append(
            RiskFactor(
                factor="Standard security checks complete. Your transaction appears consistent with normal usage.",
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
            "ml_thresholds": {"block_threshold": 0.5130, "step_up_threshold": 0.10},
            "business_rules": {
                "large_transfer_limit_amount": 150000.0,
                "daily_velocity_limit": 500000.0,
                "restricted_flagged_status": True
            }
        }
    
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
async def get_all_transactions_admin():
    return get_all_transactions()

@app.get("/api/transactions/{user_id}", response_model=List[TransactionRecord])
async def get_transactions_history(user_id: str):
    return get_user_transactions(user_id)

@app.post("/api/transactions/{transaction_id}/action")
async def transaction_action(transaction_id: str, action: str, admin_id: str = "admin_1"):
    status = TransactionStatusEnum.APPROVED if action == "approve" else TransactionStatusEnum.BLOCKED
    update_transaction_status(transaction_id, status, admin_id=admin_id)
    return {"status": "success", "transaction_id": transaction_id, "new_status": status}

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
        destination_balance = get_account_balance(transaction_input.destination_account_id)
        if destination_balance is None:
            raise HTTPException(
                status_code=400,
                detail="Recipient account not found in internal network."
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
        raise HTTPException(status_code=400, detail=f"Inference Engine Error: {execution_exception}")

    # 3. Decision Routing Logic & ID Generation
    block_threshold = ml_thresholds.get("block_threshold", 0.5)
    step_up_threshold = ml_thresholds.get("step_up_threshold", 0.4)
    new_transaction_id = f"TXN-{uuid.uuid4().hex[:8].upper()}"
    risk_factors_list = _build_risk_factors(transaction_input, probability_score, system_configuration)
    large_transfer_limit = business_rules.get("large_transfer_limit_amount", 150000.0)
    
    transaction_status = TransactionStatusEnum.APPROVED
    operation_explanation = "Everything looks good! Your transaction has been securely processed."
    
    if probability_score >= block_threshold:
        transaction_status = TransactionStatusEnum.BLOCKED
        operation_explanation = "For your protection, this transaction has been declined. It doesn't match your usual activity."
    elif probability_score >= step_up_threshold:
        transaction_status = TransactionStatusEnum.PENDING_USER_OTP
        operation_explanation = "We just want to make sure it's really you. We've sent a 6-digit security code to your email."
        # Trigger OOB Authentication
        security_otp_code = secrets.token_hex(3).upper() # 6-digit hex code
        background_tasks.add_task(
            send_security_alert_email,
            recipient_email=f"{transaction_input.user_id}@example.com",
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
        amount=transaction_input.amount,
        type=transaction_input.type,
        status=transaction_status,
        probability_score=probability_score,
        timestamp=datetime.now(),
        risk_factors=risk_factors_list
    )
    save_transaction(transaction_record_entry)

    # 5. Deduct balance for APPROVED transactions
    if transaction_status == TransactionStatusEnum.APPROVED:
        try:
            deduct_account_balance(transaction_input.user_id, transaction_input.amount)
        except ValueError as deduction_error:
            # This handles the case where balance changed between validation and completion
            logger.warning("Balance deduction failed for %s: %s", transaction_input.user_id, deduction_error)
            # In a real system we would roll back the transaction record, but for this simulation we just log it.

    return PredictionOutput(
        probability=probability_score,
        is_fraud=transaction_status == TransactionStatusEnum.BLOCKED,
        risk_level=_risk_level(probability_score, block_threshold, step_up_threshold),
        status=transaction_status,
        explanation=operation_explanation,
        risk_factors=risk_factors_list,
        transaction_id=new_transaction_id
    )
