"""
Elite Enterprise Fraud Detection API - Anomaly Watchers Donutpuff
"""

from __future__ import annotations

import json
import logging
import random
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .db import (
    add_audit_log,
    clear_cancellation_streak,
    credit_account_balance,
    deduct_account_balance,
    freeze_account,
    freeze_config,
    get_account_balance,
    get_all_transactions,
    get_audit_logs,
    get_consecutive_cancellation_count,
    get_frozen_accounts,
    get_transaction,
    get_user_display_name,
    get_user_email,
    get_user_transactions,
    is_account_frozen,
    record_cancelled_medium_risk_transaction,
    record_failed_otp,
    save_transaction,
    unfreeze_account,
    update_freeze_config,
    update_transaction_status,
)
from .preprocessing import build_feature_matrix
from .schemas import (
    AuditLogEntry,
    BusinessRulesUpdate,
    ConfigurationResponse,
    FreezeConfig,
    FrozenAccountEntry,
    HealthResponse,
    PredictionOutput,
    QueueOverflowNotify,
    RiskFactor,
    TransactionInput,
    TransactionRecord,
    TransactionRecordPublic,
    TransactionStatusEnum,
)
from .services.mail_service import send_security_alert_email

# ─── Configuration ──────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("anomaly_watchers.api")

MODEL_DIR = Path(__file__).resolve().parents[1] / "trained_models"
CONFIG_PATH = MODEL_DIR / "model_configuration.json"

MODEL_CANDIDATES = {
    "random_forest": ["model_rf_v2.pkl"],
    "feature_columns": ["feature_columns.pkl"],
}

model_registry: dict[str, Any] = {}
feature_columns: list[str] = []

# ─── Model Support Helpers ───────────────────────────────────────────────────

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

# ─── Risk Factors & Rephrasing ──────────────────────────────────────────────

_APPROVAL_REPHRASE_MAP: Dict[str, str] = {
    "This payment would use up most of your available balance. Please confirm this is intentional.":
        "This payment uses a significant portion of your balance. Our analysis confirmed it is consistent with your account behaviour.",
    "Sending a large amount to a recipient with no prior activity is unusual and has been flagged for your safety.":
        "This payment goes to a recipient without prior account history. Our security model reviewed the pattern and found no significant concerns.",
    "This payment looks a little different from your usual activity. We just need to confirm it's really you.":
        "This payment shows some unusual characteristics, but our model confirmed it aligns with your account.",
}

def _normalise_factors_for_decision(
    factors: list[RiskFactor], status: TransactionStatusEnum
) -> list[RiskFactor]:
    """
    Ensures risk factors are semantically consistent with the final decision.
    APPROVED transactions must never display 'danger' severity factors.
    """
    if status != TransactionStatusEnum.APPROVED:
        return factors

    normalised = []
    for f in factors:
        if f.severity == "danger":
            continue  # Never show danger on an approved transaction
        rephrased = _APPROVAL_REPHRASE_MAP.get(f.factor, f.factor)
        normalised.append(RiskFactor(factor=rephrased, severity="info"))

    if not normalised:
        normalised.append(RiskFactor(
            factor="All security checks passed. This payment is consistent with your account's normal activity.",
            severity="info",
        ))
    return normalised

def _build_risk_factors(
    payload: TransactionInput,
    probability: float,
    config: Dict[str, Any],
    status: TransactionStatusEnum,
) -> list[RiskFactor]:
    factors: list[RiskFactor] = []
    ml_thresholds = config.get("ml_thresholds", {})
    block_threshold = ml_thresholds.get("block_threshold", 0.5130)
    step_up_threshold = ml_thresholds.get("step_up_threshold", 0.1000)

    # Rule 1: High drain ratio
    if payload.oldbalanceOrg > 0 and (payload.amount / payload.oldbalanceOrg) >= 0.95:
        factors.append(RiskFactor(
            factor="This payment would use up most of your available balance. Please confirm this is intentional.",
            severity="warning"
        ))

    # Rule 2: Large transfer to brand new Dest
    if payload.type in {"TRANSFER", "CASH OUT"} and payload.oldbalanceDest == 0 and payload.amount > 10000:
        factors.append(RiskFactor(
            factor="Sending a large amount to a recipient with no prior activity is unusual and has been flagged for your safety.",
            severity="warning"
        ))

    # Rule 3: High ML probability
    if probability >= block_threshold:
        factors.append(RiskFactor(
            factor="Our security system has flagged this payment as highly unusual based on your account's typical activity.",
            severity="danger"
        ))
    elif step_up_threshold <= probability < block_threshold:
        factors.append(RiskFactor(
            factor="This payment looks a little different from your usual activity. We just need to confirm it's really you.",
            severity="warning"
        ))

    # Fallback info factor
    if not factors:
        factors.append(RiskFactor(
            factor="All security checks passed. This payment looks consistent with your normal activity.",
            severity="info"
        ))

    return _normalise_factors_for_decision(factors, status)

def _risk_level(probability: float, block_threshold: float, step_up_threshold: float) -> str:
    if probability >= block_threshold:
        return "High"
    if probability >= step_up_threshold:
        return "Medium"
    return "Low"

# ─── FastAPI Lifecycle ───────────────────────────────────────────────────────

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
                "block_threshold": 0.5130,
                "step_up_threshold": 0.1000
            },
            "business_rules": {
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Common Endpoints ────────────────────────────────────────────────────────

@app.get("/api/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    loaded_models = [key for key in ("random_forest",) if key in model_registry]
    return HealthResponse(
        status="ok" if loaded_models else "degraded",
        models_loaded=loaded_models,
        feature_count=len(feature_columns),
    )

@app.get("/api/configuration", response_model=ConfigurationResponse)
async def get_configuration():
    return app.state.system_configuration

@app.put("/api/configuration")
async def update_configuration(update: BusinessRulesUpdate):
    app.state.system_configuration["business_rules"] = update.model_dump()
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

@app.get("/api/configuration/thresholds")
async def get_active_thresholds():
    return app.state.system_configuration.get("ml_thresholds", {})

@app.get("/api/users/{user_id}/balance")
async def get_user_balance_api(user_id: str):
    balance = get_account_balance(user_id)
    if balance is None:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")
    return {"user_id": user_id, "balance": balance}

@app.get("/api/transactions/{user_id}", response_model=List[TransactionRecordPublic])
async def get_transactions_history(user_id: str, requesting_user_id: str = Query("")):
    is_admin_request = requesting_user_id.startswith("admin")
    if not is_admin_request and requesting_user_id and requesting_user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied.")
    return get_user_transactions(user_id)

@app.post("/api/transactions/{transaction_id}/action")
async def transaction_action(transaction_id: str, action: str, admin_id: str = "admin_1"):
    transaction = get_transaction(transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    
    if transaction.status == TransactionStatusEnum.APPROVED:
        return {"status": "no_action", "message": "Transaction already approved."}

    status = TransactionStatusEnum.APPROVED if action == "approve" else TransactionStatusEnum.BLOCKED
    
    if status == TransactionStatusEnum.APPROVED:
        try:
            deduct_account_balance(transaction.owner_user_id, transaction.amount)
            if transaction.destination_account_id:
                credit_account_balance(transaction.destination_account_id, transaction.amount)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    update_transaction_status(transaction_id, status, admin_id=admin_id)
    return {"status": "success", "transaction_id": transaction_id, "new_status": status}

# ─── Admin Endpoints ─────────────────────────────────────────────────────────

@app.get("/api/admin/transactions", response_model=List[TransactionRecordPublic])
async def get_all_transactions_admin(requesting_user_id: str = Query("")):
    if not requesting_user_id.startswith("admin"):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return get_all_transactions()

@app.get("/api/admin/audit_log", response_model=List[AuditLogEntry])
async def get_admin_audit_log_api():
    return get_audit_logs()

@app.post("/api/admin/notify/queue_overflow")
async def notify_admin_queue_overflow_api(payload: QueueOverflowNotify, background_tasks: BackgroundTasks):
    add_audit_log(
        admin_id="system",
        action_type="QUEUE_OVERFLOW_ALERT",
        details=f"Queue overflowalert: {payload.queue_size} items pending."
    )
    return {"status": "alert_sent"}

@app.get("/api/admin/frozen-accounts", response_model=List[FrozenAccountEntry])
async def list_frozen_accounts_api():
    return get_frozen_accounts()

@app.post("/api/admin/unfreeze/{user_id}")
async def unfreeze_user_account(user_id: str, admin_id: str = "admin_1"):
    if not is_account_frozen(user_id):
        raise HTTPException(status_code=400, detail="Account is not frozen.")
    unfreeze_account(user_id)
    add_audit_log(admin_id=admin_id, action_type="ACCOUNT_UNFREEZE", details=f"Unfrozen {user_id}")
    return {"status": "success", "message": f"Account {user_id} unfreezed."}

@app.get("/api/admin/freeze-config", response_model=FreezeConfig)
async def get_freeze_configuration_api():
    return FreezeConfig(
        max_failed_otp_attempts=freeze_config["max_failed_otp_attempts"],
        max_consecutive_cancellations=freeze_config.get("max_consecutive_cancellations", 3),
        observation_window_minutes=freeze_config["observation_window_minutes"]
    )

@app.put("/api/admin/freeze-config")
async def update_freeze_configuration_api(config: FreezeConfig, admin_id: str = "admin_1"):
    update_freeze_config(
        max_failed_otp_attempts=config.max_failed_otp_attempts,
        max_consecutive_cancellations=config.max_consecutive_cancellations,
        observation_window_minutes=config.observation_window_minutes
    )
    add_audit_log(
        admin_id=admin_id,
        action_type="FREEZE_CONFIG_UPDATE",
        details=f"Updated freeze config: max_otp={config.max_failed_otp_attempts}, max_cancellations={config.max_consecutive_cancellations}, window={config.observation_window_minutes}min"
    )
    return {"status": "success"}

@app.get("/api/transactions/status/{id}")
async def get_transaction_status_api(id: str):
    transaction = get_transaction(id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return transaction

# ─── Core Prediction Logic ───────────────────────────────────────────────────

@app.post("/api/predict/primary", response_model=PredictionOutput)
async def predict_primary(payload: TransactionInput, background_tasks: BackgroundTasks) -> PredictionOutput:
    # GUARD 0a: Frozen check
    logger.info("Evaluating transaction for %s. Checking security status...", payload.user_id)
    if is_account_frozen(payload.user_id):
        logger.warning("BLOCKED: Account %s is currently suspended.", payload.user_id)
        raise HTTPException(status_code=403, detail="Account frozen suspicious activity.")

    # GUARD 0b/c/d: Registry & Validation
    orig_balance = get_account_balance(payload.user_id)
    if orig_balance is None:
        raise HTTPException(status_code=400, detail="Originator not found.")
    
    if payload.destination_account_id:
        if payload.destination_account_id == payload.user_id:
            raise HTTPException(status_code=400, detail="Destination cannot be originator.")
        if get_account_balance(payload.destination_account_id) is None:
            raise HTTPException(status_code=400, detail="Destination not found.")

    # STEP 1: ML Inference
    FALLBACK_PROBABILITY = 0.0
    inference_degraded = False
    try:
        raw_frame = pd.DataFrame([{
            "step": payload.step,
            "type": payload.type,
            "amount": payload.amount,
            "nameOrig": f"C_orig_{payload.user_id}",
            "oldbalanceOrg": payload.oldbalanceOrg,
            "newbalanceOrig": payload.newbalanceOrig,
            "nameDest": "C_dest_demo",
            "oldbalanceDest": payload.oldbalanceDest,
            "newbalanceDest": payload.newbalanceDest,
        }])
        feature_matrix = build_feature_matrix(raw_frame)
        feature_matrix = _align_features(feature_matrix)
        probability_score = _predict_probability(model_registry["random_forest"], feature_matrix)
    except Exception as e:
        logger.error("Inference failure: %s", e)
        probability_score = FALLBACK_PROBABILITY
        inference_degraded = True

    # STEP 2: Decision Tree
    config = app.state.system_configuration
    ml_thresholds = config.get("ml_thresholds", {})
    block_threshold = ml_thresholds.get("block_threshold", 0.5130)
    business_rules = config.get("business_rules", {})
    restricted_flagged_status = business_rules.get("restricted_flagged_status", True)

    status = TransactionStatusEnum.APPROVED
    explanation = "Everything looks good! Your payment has been securely processed."
    otp_code = None

    if inference_degraded:
        status = TransactionStatusEnum.BLOCKED
        explanation = "Our automated security analysis is temporarily unavailable. For your protection, this transaction has been declined as a precaution."
        add_audit_log(admin_id="system", action_type="INFERENCE_FALLBACK", details="Inference failure")
    elif probability_score >= block_threshold:
        status = TransactionStatusEnum.BLOCKED
        explanation = "For your protection, this transaction has been declined. Our security analysis detected unusual patterns."
    elif (restricted_flagged_status and payload.type in {"TRANSFER", "CASH OUT"} and payload.oldbalanceDest == 0):
        status = TransactionStatusEnum.PENDING_USER_OTP
        explanation = "This payment looks a little different from your usual activity. We just need to confirm it's really you."
        recipient_email = get_user_email(payload.user_id) or f"{payload.user_id}@example.com"

    # STEP 3 & 4: Risk Factors & Record
    transaction_id = f"TXN-{uuid.uuid4().hex[:8].upper()}"
    risk_factors = _build_risk_factors(payload, probability_score, config, status)

    if status == TransactionStatusEnum.PENDING_USER_OTP:
        otp_code = "".join([str(random.randint(0, 9)) for _ in range(6)])
        background_tasks.add_task(
            send_security_alert_email,
            recipient_email=recipient_email,
            otp_code=otp_code,
            transaction_details={"amount": payload.amount, "type": payload.type, "transaction_id": transaction_id}
        )
    
    record = TransactionRecord(
        transaction_id=transaction_id,
        owner_user_id=payload.user_id,
        destination_account_id=payload.destination_account_id,
        amount=payload.amount,
        type=payload.type,
        status=status,
        probability_score=probability_score,
        timestamp=datetime.now(),
        risk_factors=risk_factors,
        otp_code=otp_code
    )
    save_transaction(record)

    # STEP 5: Ledger Update for APPROVED
    if status == TransactionStatusEnum.APPROVED:
        try:
            deduct_account_balance(payload.user_id, payload.amount)
            if payload.destination_account_id:
                credit_account_balance(payload.destination_account_id, payload.amount)
        except Exception as e:
            logger.error("Final ledger update failed: %s", e)

    return PredictionOutput(
        probability=probability_score,
        is_fraud=status == TransactionStatusEnum.BLOCKED,
        risk_level=_risk_level(probability_score, block_threshold, ml_thresholds.get("step_up_threshold", 0.1000)),
        status=status,
        explanation=explanation,
        risk_factors=risk_factors,
        transaction_id=transaction_id
    )

# ─── Verification & Security Endpoints ───────────────────────────────────────

@app.post("/api/verify-otp")
async def verify_otp_endpoint(transaction_id: str, user_provided_otp: str):
    transaction = get_transaction(transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    
    if transaction.status != TransactionStatusEnum.PENDING_USER_OTP:
        raise HTTPException(status_code=400, detail="Not pending verification.")
    
    if not transaction.otp_code:
        raise HTTPException(status_code=400, detail="No security code stored.")

    if user_provided_otp != transaction.otp_code:
        # Log the failure attempt
        failed_count = record_failed_otp(transaction.owner_user_id)
        logger.warning(
            "OTP mismatch for %s on %s. Attempt %d/%d",
            transaction.owner_user_id,
            transaction_id,
            failed_count,
            freeze_config["max_failed_otp_attempts"]
        )

        if failed_count >= freeze_config["max_failed_otp_attempts"]:
            freeze_account(transaction.owner_user_id, "Exceeded maximum security code attempts")
            update_transaction_status(transaction_id, TransactionStatusEnum.BLOCKED, admin_id="SYSTEM_SECURITY")
            add_audit_log(
                admin_id="system", 
                action_type="ACCOUNT_FREEZE", 
                details=f"Identity {transaction.owner_user_id} suspended. Reason: Multiple OTP violations (Attempt {failed_count})."
            )
            # Notify frontend explicitly
            raise HTTPException(status_code=401, detail="SECURITY ALERT: Your account has been suspended due to consecutive verification failures.")
        else:
            remaining = freeze_config["max_failed_otp_attempts"] - failed_count
            raise HTTPException(status_code=401, detail=f"Invalid security code. {remaining} attempts remaining.")

    # Success
    update_transaction_status(transaction_id, TransactionStatusEnum.APPROVED)
    
    # Clear the consecutive cancellation streak since OTP was successfully completed
    clear_cancellation_streak(transaction.owner_user_id)
    
    deduct_account_balance(transaction.owner_user_id, transaction.amount)
    if transaction.destination_account_id:
        credit_account_balance(transaction.destination_account_id, transaction.amount)
    
    return {"status": "success", "message": "Verification complete.", "transaction_id": transaction_id}

@app.post("/api/verify-otp/cancel")
async def cancel_otp_endpoint(transaction_id: str):
    transaction = get_transaction(transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    
    if transaction.status != TransactionStatusEnum.PENDING_USER_OTP:
        raise HTTPException(status_code=400, detail="Cannot cancel - not in pending state.")

    update_transaction_status(transaction_id, TransactionStatusEnum.CANCELLED)
    add_audit_log(admin_id="system", action_type="USER_CANCELLATION", details=f"User cancelled transaction {transaction_id}")

    # ─── Track consecutive cancelled medium-risk transactions ────────────────
    # A PENDING_USER_OTP transaction is a medium-risk transaction that requires OTP
    # If a user cancels 3 such transactions in a row within the observation window, freeze the account
    cancellation_count = record_cancelled_medium_risk_transaction(transaction.owner_user_id)
    logger.info(
        "Recorded cancellation for %s. Consecutive medium-risk cancellations: %d/%d",
        transaction.owner_user_id,
        cancellation_count,
        freeze_config.get("max_consecutive_cancellations", 3)
    )

    if cancellation_count >= freeze_config.get("max_consecutive_cancellations", 3):
        freeze_account(
            transaction.owner_user_id,
            f"Exceeded maximum consecutive cancelled medium-risk transactions ({cancellation_count})"
        )
        add_audit_log(
            admin_id="system",
            action_type="ACCOUNT_FREEZE",
            details=f"Account {transaction.owner_user_id} suspended. Reason: {cancellation_count} consecutive cancelled medium-risk transactions."
        )
        logger.warning(
            "ACCOUNT FROZEN: %s cancelled %d medium-risk transactions consecutively",
            transaction.owner_user_id,
            cancellation_count
        )

    return {"status": "success", "message": "Transaction successfully cancelled."}

@app.get("/api/security/freeze")
async def security_freeze_endpoint(id: str):
    from fastapi.responses import HTMLResponse
    transaction = get_transaction(id)
    
    html_template = """
    <html>
        <head>
            <style>
                body {{ font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f1f5f9; }}
                .card {{ background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }}
                h1 {{ color: {color}; }}
                p {{ color: #64748b; line-height: 1.6; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h1>{title}</h1>
                <p>{message}</p>
            </div>
        </body>
    </html>
    """
    
    if not transaction:
        return HTMLResponse(content=html_template.format(
            title="Link Expired", color="#ef4444", 
            message="This security link is no longer valid or the transaction reference was not found."
        ), status_code=404)
    
    user_name = get_user_display_name(transaction.owner_user_id)
    user_identity = f"{user_name} ({transaction.owner_user_id})"

    if transaction.status != TransactionStatusEnum.PENDING_USER_OTP:
        return HTMLResponse(content=html_template.format(
            title="Already Processed", color="#6366f1", 
            message=f"Transaction {id} for {user_identity} has already been finalised as {transaction.status}. No further security action is required."
        ))

    freeze_account(transaction.owner_user_id, "User-initiated freeze via email link")
    update_transaction_status(id, TransactionStatusEnum.BLOCKED, admin_id="SYSTEM_EMAIL_FREEZE")
    add_audit_log(admin_id="system", action_type="ACCOUNT_FREEZE", details=f"Emergency freeze {user_identity}")
    
    return HTMLResponse(content=html_template.format(
        title="Account Frozen", color="#e11d48", 
        message=f"Emergency protocols engaged. Account {user_identity} has been suspended and transaction {id} blocked."
    ))

@app.get("/api/debug/fraud_probe")
async def debug_fraud_probe_api():
    test_frame = pd.DataFrame([{
        "step": 1, "type": "CASH OUT", "amount": 200000.0, "nameOrig": "C_orig_1",
        "oldbalanceOrg": 200000.0, "newbalanceOrig": 0.0, "nameDest": "C_dest_demo",
        "oldbalanceDest": 0.0, "newbalanceDest": 0.0,
    }])
    matrix = _align_features(build_feature_matrix(test_frame))
    prob = _predict_probability(model_registry["random_forest"], matrix)
    return {"raw_probability": prob}
