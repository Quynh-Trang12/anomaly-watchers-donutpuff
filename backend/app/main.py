"""
FastAPI inference service for the current trained fraud models.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import threading
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import (
    fetch_transactions as fetch_transactions_db,
    init_db,
    transaction_count,
    upsert_transactions,
    upsert_users,
)
from .preprocessing import build_feature_matrix
from .schemas import (
    AuthUser,
    DashboardResponse,
    HealthResponse,
    LoginRequest,
    LoginResponse,
    NotificationResponse,
    OtpEmailRequest,
    PredictionOutput,
    RiskFactor,
    SignupRequest,
    TransactionCreate,
    TransactionInput,
    TransactionRecord,
    TransactionUpdate,
    UserConfirmationEmailRequest,
)
from .services.mail_service import (
    MailConfigurationError,
    MailSendError,
    send_email as send_app_email,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("anomaly_watchers.api")

MODEL_DIR = Path(__file__).resolve().parents[1] / "trained_models"
ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_FILE)

MODEL_CANDIDATES = {
    "random_forest": ["model_rf_v2.pkl", "model_rf.pkl"],
    "feature_columns": ["feature_columns.pkl"],
}

model_registry: dict[str, Any] = {}
feature_columns: list[str] = []

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
USERS_FILE = DATA_DIR / "users.json"
TRANSACTIONS_FILE = DATA_DIR / "transactions.json"
NOTIFICATION_LOG_FILE = DATA_DIR / "notification_log.json"
TOKEN_SECRET = os.getenv(
    "ANOMALY_WATCHERS_TOKEN_SECRET",
    "anomaly-watchers-dev-secret",
)
TOKEN_TTL_SECONDS = 8 * 60 * 60
PASSWORD_HASH_ITERATIONS = 120_000
APP_FRONTEND_URL = (os.getenv("APP_FRONTEND_URL") or "http://localhost:8080").rstrip("/")

_store_lock = threading.Lock()
_bearer = HTTPBearer(auto_error=False)

DEFAULT_USER_SEED: list[dict[str, str]] = []


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _b64_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _b64_decode(raw: str) -> bytes:
    padding = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(f"{raw}{padding}")


def _read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback

    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Failed to read %s: %s", path.name, exc)
        return fallback


def _write_json(path: Path, payload: Any) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=True, indent=2)


def _hash_password(password: str, salt_hex: Optional[str] = None) -> dict[str, str]:
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    )
    return {"salt": salt.hex(), "hash": digest.hex()}


def _verify_password(password: str, salt_hex: str, expected_hash: str) -> bool:
    computed = _hash_password(password, salt_hex=salt_hex)["hash"]
    return hmac.compare_digest(computed, expected_hash)


def _seed_default_users() -> None:
    seeded_users: list[dict[str, Any]] = []

    for seed in DEFAULT_USER_SEED:
        password_hash = _hash_password(seed["password"])
        seeded_users.append(
            {
                "id": seed["id"],
                "username": seed["username"],
                "passwordSalt": password_hash["salt"],
                "passwordHash": password_hash["hash"],
                "role": seed["role"],
                "displayName": seed.get("displayName") or seed["username"],
                "email": seed.get("email"),
            }
        )

    _write_json(USERS_FILE, seeded_users)


def _ensure_data_files() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not USERS_FILE.exists():
        _seed_default_users()

    if not TRANSACTIONS_FILE.exists():
        _write_json(TRANSACTIONS_FILE, [])

    if not NOTIFICATION_LOG_FILE.exists():
        _write_json(NOTIFICATION_LOG_FILE, [])

    init_db()
    _ensure_user_emails()

    users = _load_users()
    try:
        upsert_users(users)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Could not sync users to SQLite: %s", exc)

    # One-time migration path for existing JSON transactions into SQLite.
    try:
        if transaction_count() == 0:
            legacy_records = _read_json(TRANSACTIONS_FILE, [])
            if isinstance(legacy_records, list) and legacy_records:
                upsert_transactions(legacy_records)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Could not migrate JSON transactions to SQLite: %s", exc)


def _load_users() -> list[dict[str, Any]]:
    with _store_lock:
        users = _read_json(USERS_FILE, [])
    return users if isinstance(users, list) else []


def _load_transactions() -> list[dict[str, Any]]:
    try:
        records = fetch_transactions_db()
        return records if isinstance(records, list) else []
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("SQLite read failed, falling back to JSON transactions: %s", exc)
        with _store_lock:
            records = _read_json(TRANSACTIONS_FILE, [])
        return records if isinstance(records, list) else []


def _save_transactions(records: list[dict[str, Any]]) -> None:
    try:
        upsert_transactions(records)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Could not sync transactions to SQLite: %s", exc)

    with _store_lock:
        _write_json(TRANSACTIONS_FILE, records)


def _save_users(users: list[dict[str, Any]]) -> None:
    with _store_lock:
        _write_json(USERS_FILE, users)
    try:
        upsert_users(users)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Could not sync users to SQLite: %s", exc)


def _append_notification_log(entry: dict[str, Any]) -> None:
    with _store_lock:
        logs = _read_json(NOTIFICATION_LOG_FILE, [])
        if not isinstance(logs, list):
            logs = []
        logs.append(entry)
        _write_json(NOTIFICATION_LOG_FILE, logs)


def _resolve_user_email(user: dict[str, Any]) -> str:
    explicit_email = str(user.get("email") or "").strip()
    if "@" not in explicit_email:
        return ""

    local, _, domain = explicit_email.partition("@")
    if not local or not domain or "." not in domain:
        return ""

    return explicit_email


def _medium_risk_user_email(current_user: dict[str, Any]) -> str:
    explicit_email = _resolve_user_email(current_user)
    if explicit_email:
        return explicit_email

    # Defensive fallback: re-read from persisted user profile if in-memory payload misses email.
    current_user_id = str(current_user.get("id") or "").strip()
    if current_user_id:
        persisted_user = _find_user_by_id(current_user_id)
        if persisted_user:
            persisted_email = _resolve_user_email(persisted_user)
            if persisted_email:
                return persisted_email

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            "Current user email is not configured. "
            "Set a valid user email before Medium Risk confirmation/OTP flow."
        ),
    )


def _ensure_user_emails() -> None:
    users = _load_users()
    changed = False

    for user in users:
        normalized_email = _resolve_user_email(user)
        if str(user.get("email") or "") != normalized_email:
            user["email"] = normalized_email
            changed = True

    if changed:
        _save_users(users)


async def _send_email(
    recipient: str,
    subject: str,
    body: str,
) -> tuple[bool, str]:
    try:
        message_id = await send_app_email(
            recipient=recipient,
            subject=subject,
            body_text=body,
        )
    except MailConfigurationError as exc:
        detail = str(exc)
        _append_notification_log(
            {
                "sentAt": _now_iso(),
                "provider": "fastapi_mail",
                "status": "failed_config",
                "recipient": recipient,
                "subject": subject,
                "detail": detail,
            }
        )
        return False, detail
    except MailSendError as exc:
        detail = str(exc)
        _append_notification_log(
            {
                "sentAt": _now_iso(),
                "provider": "fastapi_mail",
                "status": "failed_send",
                "recipient": recipient,
                "subject": subject,
                "detail": detail,
            }
        )
        return False, detail

    _append_notification_log(
        {
            "sentAt": _now_iso(),
            "provider": "fastapi_mail",
            "status": "sent",
            "messageId": message_id,
            "recipient": recipient,
            "subject": subject,
        }
    )
    return True, "Email sent via FastAPI-Mail."


def _admin_users() -> list[dict[str, Any]]:
    return [user for user in _load_users() if str(user.get("role")) == "admin"]


def _pending_review_count() -> int:
    records = _load_transactions()
    return sum(
        1
        for item in records
        if str(item.get("reviewState") or "") == "PENDING_ADMIN_REVIEW"
        or str(item.get("decision") or "") == "PENDING_ADMIN_REVIEW"
    )


async def _send_admin_review_email() -> None:
    pending_count = _pending_review_count()
    if pending_count <= 0:
        return

    subject = f"[AnomalyWatchers] {pending_count} transaction(s) require admin review"
    body = (
        "There are "
        f"{pending_count} transaction(s) requiring manual review.\n\n"
        "Please open Admin -> Review Queue to triage pending items.\n"
        f"Review Queue: {APP_FRONTEND_URL}/admin\n"
    )

    admin_recipients = [_resolve_user_email(admin) for admin in _admin_users()]
    configured_admins = [
        item.strip()
        for item in str(os.getenv("ADMIN_REVIEW_EMAILS") or "").split(",")
        if item.strip()
    ]
    admin_recipients.extend(configured_admins)
    admin_recipients = [recipient for recipient in admin_recipients if recipient]
    admin_recipients = list(dict.fromkeys(admin_recipients))
    if not admin_recipients:
        logger.warning("No valid admin email configured for review queue notification.")
        return

    for recipient in admin_recipients:
        sent, detail = await _send_email(recipient=recipient, subject=subject, body=body)
        if not sent:
            logger.warning(
                "Admin review email could not be sent to %s: %s",
                recipient,
                detail,
            )


async def _send_user_under_review_email(
    current_user: dict[str, Any],
    record: dict[str, Any],
) -> None:
    recipient = _resolve_user_email(current_user)
    if not recipient:
        logger.warning("No valid user email configured for high-risk review notification.")
        return

    transaction_type = str(record.get("type") or "TRANSACTION")
    amount = float(record.get("amount") or 0.0)
    transaction_id = str(record.get("id") or "")

    subject = "[AnomalyWatchers] Your transaction is under admin review"
    body = (
        "A high-risk transaction was detected and has been placed in the Admin Review Queue.\n\n"
        f"Transaction ID: {transaction_id}\n"
        f"Type: {transaction_type}\n"
        f"Amount: {amount:,.2f}\n\n"
        "No further action is required from you at this stage.\n"
        "You can check the latest status in your transaction history.\n"
    )

    sent, detail = await _send_email(recipient=recipient, subject=subject, body=body)
    if not sent:
        logger.warning(
            "High-risk user notification email could not be sent to %s: %s",
            recipient,
            detail,
        )


def _find_user_by_username(username: str) -> Optional[dict[str, Any]]:
    lowered = username.strip().lower()
    for user in _load_users():
        if str(user.get("username", "")).lower() == lowered:
            return user
    return None


def _find_user_by_email(email: str) -> Optional[dict[str, Any]]:
    lowered = email.strip().lower()
    for user in _load_users():
        candidate = _resolve_user_email(user).lower()
        if candidate and candidate == lowered:
            return user
    return None


def _find_user_by_id(user_id: str) -> Optional[dict[str, Any]]:
    for user in _load_users():
        if user.get("id") == user_id:
            return user
    return None


def _issue_access_token(user: dict[str, Any]) -> str:
    payload = {
        "sub": user["id"],
        "username": user["username"],
        "role": user["role"],
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
        "iat": int(time.time()),
    }
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    payload_b64 = _b64_encode(payload_json.encode("utf-8"))
    signature = hmac.new(
        TOKEN_SECRET.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload_b64}.{signature}"


def _decode_access_token(token: str) -> Optional[dict[str, Any]]:
    try:
        payload_b64, signature = token.split(".", 1)
    except ValueError:
        return None

    expected_signature = hmac.new(
        TOKEN_SECRET.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_signature):
        return None

    try:
        payload = json.loads(_b64_decode(payload_b64).decode("utf-8"))
    except Exception:
        return None

    if not isinstance(payload, dict):
        return None

    expiry = payload.get("exp")
    if not isinstance(expiry, int) or expiry < int(time.time()):
        return None

    return payload


def _public_user_payload(user: dict[str, Any]) -> AuthUser:
    role = str(user.get("role", "user"))
    if role not in {"user", "admin"}:
        role = "user"

    user_email = _resolve_user_email(user) or None

    return AuthUser(
        id=str(user.get("id")),
        username=str(user.get("username")),
        role=role,  # type: ignore[arg-type]
        displayName=str(user.get("displayName") or user.get("username")),
        email=user_email,
    )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    token_payload = _decode_access_token(credentials.credentials)
    if token_payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    user_id = token_payload.get("sub")
    if not isinstance(user_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )

    user = _find_user_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
        )

    if user.get("role") != token_payload.get("role"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token role mismatch.",
        )

    return user


def require_admin(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required.",
        )
    return current_user


def _sorted_transactions(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        records,
        key=lambda item: str(item.get("createdAt", "")),
        reverse=True,
    )


def _dashboard_payload(records: list[dict[str, Any]]) -> DashboardResponse:
    total = len(records)
    approved = 0
    blocked = 0
    under_review = 0
    risk_sum = 0.0
    type_distribution: dict[str, int] = {}
    timeline_bucket: dict[str, int] = {}
    recent: list[dict[str, Any]] = []

    for item in _sorted_transactions(records):
        decision = str(item.get("decision") or "")
        status = str(item.get("status") or "")
        review_state = str(item.get("reviewState") or "")
        tx_type = str(item.get("type") or "UNKNOWN")
        risk_score = float(item.get("riskScore") or 0.0)
        created_at = str(item.get("createdAt") or "")

        if decision in {"APPROVE", "APPROVE_AFTER_STEPUP"}:
            approved += 1
        if decision in {"BLOCK", "BLOCK_STEPUP_FAILED"}:
            blocked += 1
        if (
            decision == "PENDING_ADMIN_REVIEW"
            or status == "pending_review"
            or review_state == "PENDING_ADMIN_REVIEW"
        ):
            under_review += 1

        risk_sum += risk_score
        type_distribution[tx_type] = type_distribution.get(tx_type, 0) + 1

        if created_at:
            day = created_at[:10]
            timeline_bucket[day] = timeline_bucket.get(day, 0) + 1

        if len(recent) < 10:
            recent.append(
                {
                    "id": str(item.get("id") or ""),
                    "type": tx_type,
                    "amount": float(item.get("amount") or 0.0),
                    "riskScore": risk_score,
                    "decision": decision,
                    "status": status or None,
                    "createdAt": created_at,
                    "ownerId": str(item.get("ownerId") or ""),
                    "ownerUsername": str(item.get("ownerUsername") or ""),
                }
            )

    timeline = [
        {"date": key, "count": timeline_bucket[key]}
        for key in sorted(timeline_bucket.keys())
    ]

    average_risk = (risk_sum / total) if total > 0 else 0.0
    return DashboardResponse(
        total_transactions=total,
        approved_count=approved,
        blocked_count=blocked,
        under_review_count=under_review,
        average_risk_score=round(average_risk, 2),
        type_distribution=type_distribution,
        timeline=timeline,
        recent_transactions=recent,
    )


def _transaction_type_value(raw_type: Any) -> str:
    if hasattr(raw_type, "value"):
        return str(raw_type.value)
    return str(raw_type)


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
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Could not load %s: %s", filename, exc)

    return None


def _align_features(matrix: pd.DataFrame) -> pd.DataFrame:
    target_columns = feature_columns or [str(column) for column in matrix.columns]
    aligned = matrix.copy()

    for column in target_columns:
        if column not in aligned.columns:
            aligned[column] = 0

    return aligned[target_columns]


def _align_to_columns(matrix: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    aligned = matrix.copy()

    for column in columns:
        if column not in aligned.columns:
            aligned[column] = 0

    return aligned[columns]


def _predict_probability(model: Any, matrix: Any) -> float:
    if hasattr(model, "predict_proba"):
        raw_output = np.asarray(model.predict_proba(matrix))
        raw_value = raw_output[0][-1] if raw_output.ndim > 1 else raw_output[0]
    elif hasattr(model, "predict"):
        raw_output = np.asarray(model.predict(matrix))
        raw_value = raw_output[0][-1] if raw_output.ndim > 1 else raw_output[0]
    else:
        raise ValueError("Model does not expose predict_proba or predict.")

    probability = float(raw_value)

    if not np.isfinite(probability):
        probability = 0.0

    return max(0.0, min(1.0, probability))


def _predict_with_fallbacks(model: Any, matrix: pd.DataFrame) -> float:
    candidates: list[Any] = []

    if hasattr(model, "feature_names_in_"):
        model_columns = [str(column) for column in model.feature_names_in_]
        candidates.append(_align_to_columns(matrix, model_columns))

    candidates.append(_align_features(matrix))
    candidates.append(matrix.drop(columns=["is_fraud"], errors="ignore"))

    seen_signatures: set[tuple[Any, ...]] = set()

    for candidate in candidates:
        if isinstance(candidate, pd.DataFrame):
            signature = tuple(candidate.columns)
        else:
            signature = ("ndarray", np.asarray(candidate).shape)

        if signature in seen_signatures:
            continue
        seen_signatures.add(signature)

        try:
            return _predict_probability(model, candidate)
        except Exception:
            if isinstance(candidate, pd.DataFrame):
                try:
                    return _predict_probability(model, candidate.to_numpy())
                except Exception:
                    continue

    raise ValueError("All feature alignment strategies failed for this model.")


def _build_risk_factors(
    payload: TransactionInput,
    scores: dict[str, float],
) -> list[RiskFactor]:
    factors: list[RiskFactor] = []
    transaction_type = _transaction_type_value(payload.type)

    amount_to_balance = payload.amount / max(payload.oldbalanceOrg, 1.0)

    if payload.amount >= 150000:
        factors.append(
            RiskFactor(
                factor=f"High transaction amount detected at {payload.amount:,.2f}.",
                severity="warning",
            )
        )

    if transaction_type in {"TRANSFER", "CASH OUT"} and amount_to_balance >= 0.9:
        factors.append(
            RiskFactor(
                factor=(
                    f"Outgoing transaction consumes {amount_to_balance:.0%} of the "
                    "origin balance."
                ),
                severity="danger" if amount_to_balance >= 1 else "warning",
            )
        )

    if (
        transaction_type != "CASH IN"
        and payload.newbalanceOrig == 0
        and payload.amount > 0
    ):
        factors.append(
            RiskFactor(
                factor="Origin account is drained to zero after the transaction.",
                severity="danger",
            )
        )

    if (
        transaction_type in {"TRANSFER", "CASH OUT"}
        and payload.oldbalanceDest == 0
        and payload.amount >= 50000
    ):
        factors.append(
            RiskFactor(
                factor="Destination account starts empty before receiving a large amount.",
                severity="warning",
            )
        )

    for model_name, score in scores.items():
        if score >= 0.8:
            severity = "danger"
        elif score >= 0.45:
            severity = "warning"
        else:
            continue

        pretty_name = model_name.replace("_", " ").title()
        factors.append(
            RiskFactor(
                factor=f"{pretty_name} flagged elevated fraud probability at {score:.1%}.",
                severity=severity,
            )
        )

    if not factors:
        factors.append(
            RiskFactor(
                factor="No major anomalies were surfaced by the available models.",
                severity="info",
            )
        )

    return factors[:6]


def _build_prediction_explanation(
    payload: TransactionInput,
    probability: float,
    risk_level: str,
    *,
    used_fallback: bool,
) -> str:
    transaction_type = _transaction_type_value(payload.type)
    amount_to_balance = payload.amount / max(payload.oldbalanceOrg, 1.0)
    hour = (max(payload.step, 1) - 1) % 24

    explanation_parts = [
        f"Random Forest estimated a {probability:.1%} fraud probability ({risk_level} risk)."
    ]

    if payload.amount >= 150000:
        explanation_parts.append(
            f"Amount {payload.amount:,.2f} is high for this transaction profile."
        )

    if transaction_type in {"TRANSFER", "CASH OUT"} and amount_to_balance >= 0.9:
        explanation_parts.append(
            f"Transfer size consumes about {amount_to_balance:.0%} of the sender balance."
        )
    elif amount_to_balance >= 0.5:
        explanation_parts.append(
            f"Transfer size consumes about {amount_to_balance:.0%} of the sender balance."
        )

    if (
        transaction_type != "CASH IN"
        and payload.newbalanceOrig == 0
        and payload.amount > 0
    ):
        explanation_parts.append(
            "Sender balance is fully drained to zero after this operation."
        )

    if (
        transaction_type in {"TRANSFER", "CASH OUT"}
        and payload.oldbalanceDest == 0
        and payload.amount >= 50000
    ):
        explanation_parts.append(
            "Destination account starts at zero before receiving a large transfer."
        )

    if hour in {0, 1, 2}:
        explanation_parts.append(
            f"Transaction time maps to midnight-hour activity ({hour:02d}:00)."
        )

    if used_fallback:
        explanation_parts.append(
            "Model output was unavailable, so conservative fallback scoring was applied."
        )

    if len(explanation_parts) == 1:
        explanation_parts.append(
            "No strong anomaly patterns were detected in amount, balance flow, or timing."
        )

    return " ".join(explanation_parts)


def _risk_level(probability: float) -> str:
    if probability >= 0.75:
        return "High"
    if probability >= 0.4:
        return "Medium"
    return "Low"


def _heuristic_probability(payload: TransactionInput) -> float:
    transaction_type = _transaction_type_value(payload.type)
    amount_to_balance = payload.amount / max(payload.oldbalanceOrg, 1.0)
    probability = 0.08

    if payload.amount >= 150000:
        probability += 0.22

    if transaction_type in {"TRANSFER", "CASH OUT"}:
        probability += 0.12

    if amount_to_balance >= 0.9:
        probability += 0.26
    elif amount_to_balance >= 0.5:
        probability += 0.12

    if (
        transaction_type != "CASH IN"
        and payload.newbalanceOrig == 0
        and payload.amount > 0
    ):
        probability += 0.18

    if (
        transaction_type in {"TRANSFER", "CASH OUT"}
        and payload.oldbalanceDest == 0
        and payload.amount >= 50000
    ):
        probability += 0.14

    return max(0.0, min(0.99, probability))


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ensure_data_files()
    model_registry.clear()
    feature_columns.clear()

    for key, candidates in MODEL_CANDIDATES.items():
        loaded = _load_first_available(candidates)
        if not loaded:
            continue

        _, artifact = loaded
        model_registry[key] = artifact

    feature_columns.extend(
        _normalize_feature_columns(model_registry.get("feature_columns"))
    )

    logger.info(
        "Backend ready with models: %s",
        [key for key in ("random_forest",) if key in model_registry],
    )
    yield
    model_registry.clear()
    feature_columns.clear()


app = FastAPI(
    title="AnomalyWatchers Fraud API",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    logger.exception("Unhandled API error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.get("/", response_model=HealthResponse)
async def root_health() -> HealthResponse:
    loaded_models = [key for key in ("random_forest",) if key in model_registry]

    return HealthResponse(
        status="ok" if loaded_models else "degraded",
        models_loaded=loaded_models,
        feature_count=len(feature_columns),
    )


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return await root_health()


@app.post("/auth/login", response_model=LoginResponse)
async def auth_login(payload: LoginRequest) -> LoginResponse:
    user = _find_user_by_username(payload.username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    password_salt = str(user.get("passwordSalt", ""))
    password_hash = str(user.get("passwordHash", ""))
    if not password_salt or not password_hash:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User credentials are not configured correctly.",
        )

    if not _verify_password(payload.password, password_salt, password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    return LoginResponse(
        access_token=_issue_access_token(user),
        user=_public_user_payload(user),
    )


@app.post("/auth/signup", response_model=LoginResponse)
async def auth_signup(payload: SignupRequest) -> LoginResponse:
    username = payload.username.strip()
    if _find_user_by_username(username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username is already taken.",
        )

    normalized_email = _resolve_user_email({"email": payload.email})
    if not normalized_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid email address.",
        )

    if _find_user_by_email(normalized_email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already in use.",
        )

    password_hash = _hash_password(payload.password)
    display_name = (payload.displayName or "").strip() or username
    new_user = {
        "id": f"user-{uuid.uuid4().hex[:8]}",
        "username": username,
        "passwordSalt": password_hash["salt"],
        "passwordHash": password_hash["hash"],
        "role": "user",
        "displayName": display_name,
        "email": normalized_email,
    }

    users = _load_users()
    users.append(new_user)
    _save_users(users)

    return LoginResponse(
        access_token=_issue_access_token(new_user),
        user=_public_user_payload(new_user),
    )


@app.get("/auth/me", response_model=AuthUser)
async def auth_me(current_user: dict[str, Any] = Depends(get_current_user)) -> AuthUser:
    return _public_user_payload(current_user)


@app.post("/notifications/user-confirmation", response_model=NotificationResponse)
async def send_user_confirmation_email(
    payload: UserConfirmationEmailRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> NotificationResponse:
    _ = payload
    recipient = _medium_risk_user_email(current_user)
    subject = "[AnomalyWatchers] Please confirm your transaction activity"
    body = (
        "Is this transaction being performed by you?\n\n"
        "If yes, open the app and choose 'Yes, this is me' to receive OTP.\n"
        "If no, choose 'No, this is not me' to block the transaction.\n\n"
        f"Verification page: {APP_FRONTEND_URL}/simulator\n"
    )

    sent, detail = await _send_email(
        recipient=recipient,
        subject=subject,
        body=body,
    )

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )

    return NotificationResponse(
        sent=True,
        provider="fastapi_mail",
        recipient=recipient,
        subject=subject,
        detail="User confirmation email sent via FastAPI-Mail.",
    )


@app.post("/notifications/user-otp", response_model=NotificationResponse)
async def send_user_otp_email(
    payload: OtpEmailRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> NotificationResponse:
    recipient = _medium_risk_user_email(current_user)
    subject = "[AnomalyWatchers] OTP verification code"
    body = (
        "Your one-time verification code is below.\n\n"
        f"OTP: {payload.otp_code}\n"
        f"Type: {payload.transaction_type}\n"
        f"Amount: {payload.amount:,.2f}\n\n"
        "Enter this code in the app to continue.\n"
        f"Verification page: {APP_FRONTEND_URL}/simulator\n\n"
        "If this transaction is not yours, do not proceed and contact support."
    )

    sent, detail = await _send_email(
        recipient=recipient,
        subject=subject,
        body=body,
    )

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )

    return NotificationResponse(
        sent=True,
        provider="fastapi_mail",
        recipient=recipient,
        subject=subject,
        detail="OTP email sent via FastAPI-Mail.",
    )


@app.post("/notifications/admin-review", response_model=NotificationResponse)
async def send_admin_review_notification(
    _: dict[str, Any] = Depends(require_admin),
) -> NotificationResponse:
    pending_count = _pending_review_count()
    subject = f"[AnomalyWatchers] {pending_count} transaction(s) require admin review"
    body = (
        f"There are {pending_count} transaction(s) requiring review.\n\n"
        "Open Admin -> Review Queue tab to review pending cases.\n"
        f"Review Queue: {APP_FRONTEND_URL}/admin\n"
    )

    admin_recipients = [_resolve_user_email(admin) for admin in _admin_users()]
    configured_admins = [
        item.strip()
        for item in str(os.getenv("ADMIN_REVIEW_EMAILS") or "").split(",")
        if item.strip()
    ]
    admin_recipients.extend(configured_admins)
    admin_recipients = [recipient for recipient in admin_recipients if recipient]
    admin_recipients = list(dict.fromkeys(admin_recipients))
    if not admin_recipients:
        return NotificationResponse(
            sent=False,
            provider="fastapi_mail",
            recipient="(no valid admin email configured)",
            subject=subject,
            detail="No valid admin email configured for review notification.",
        )

    first_admin_email = admin_recipients[0]
    sent_count = 0
    last_error = ""
    for recipient in admin_recipients:
        sent, detail = await _send_email(recipient=recipient, subject=subject, body=body)
        if sent:
            sent_count += 1
        else:
            last_error = detail

    if sent_count == 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=last_error or "Could not send admin review notification via FastAPI-Mail.",
        )

    return NotificationResponse(
        sent=True,
        provider="fastapi_mail",
        recipient=first_admin_email,
        subject=subject,
        detail=(
            f"Admin review notification dispatched via FastAPI-Mail "
            f"to {sent_count} admin recipient(s)."
        ),
    )


@app.post(
    "/transactions",
    response_model=TransactionRecord,
    status_code=status.HTTP_201_CREATED,
)
async def create_transaction(
    payload: TransactionCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> TransactionRecord:
    record = payload.model_dump()
    record["id"] = record.get("id") or str(uuid.uuid4())
    record["createdAt"] = record.get("createdAt") or _now_iso()
    record["type"] = _transaction_type_value(record.get("type"))
    record["ownerId"] = str(current_user.get("id"))
    record["ownerUsername"] = str(current_user.get("username"))

    decision = str(record.get("decision") or "")
    if decision == "PENDING_ADMIN_REVIEW":
        record["status"] = "pending_review"
        record["reviewState"] = "PENDING_ADMIN_REVIEW"
        if not isinstance(record.get("isFraud"), int):
            record["isFraud"] = 0
    elif decision in {"APPROVE", "APPROVE_AFTER_STEPUP"}:
        record["status"] = "approved"
        if not record.get("reviewState"):
            record["reviewState"] = None
    elif decision in {"BLOCK", "BLOCK_STEPUP_FAILED"}:
        record["status"] = "blocked"
        if not record.get("reviewState"):
            record["reviewState"] = None

    records = _load_transactions()
    records.append(record)
    _save_transactions(records)

    if record.get("reviewState") == "PENDING_ADMIN_REVIEW":
        await _send_admin_review_email()
        if str(record.get("backendRiskLevel") or "") == "High":
            await _send_user_under_review_email(current_user, record)

    return TransactionRecord(**record)


@app.get("/transactions/me", response_model=list[TransactionRecord])
async def get_my_transactions(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[TransactionRecord]:
    owner_id = str(current_user.get("id"))
    records = [
        item
        for item in _load_transactions()
        if str(item.get("ownerId")) == owner_id
    ]
    return [TransactionRecord(**item) for item in _sorted_transactions(records)]


@app.get("/transactions/all", response_model=list[TransactionRecord])
async def get_all_transactions(
    _: dict[str, Any] = Depends(require_admin),
) -> list[TransactionRecord]:
    return [TransactionRecord(**item) for item in _sorted_transactions(_load_transactions())]


@app.get("/dashboard/me", response_model=DashboardResponse)
async def get_my_dashboard(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> DashboardResponse:
    owner_id = str(current_user.get("id"))
    records = [
        item
        for item in _load_transactions()
        if str(item.get("ownerId")) == owner_id
    ]
    return _dashboard_payload(records)


@app.get("/dashboard/admin", response_model=DashboardResponse)
async def get_admin_dashboard(
    _: dict[str, Any] = Depends(require_admin),
) -> DashboardResponse:
    return _dashboard_payload(_load_transactions())


@app.patch("/transactions/{transaction_id}", response_model=TransactionRecord)
async def update_transaction_record(
    transaction_id: str,
    payload: TransactionUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> TransactionRecord:
    records = _load_transactions()
    index = next((i for i, item in enumerate(records) if item.get("id") == transaction_id), -1)
    if index == -1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.")

    target = records[index]
    is_admin = current_user.get("role") == "admin"
    is_owner = str(target.get("ownerId")) == str(current_user.get("id"))

    if not is_admin and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this transaction.",
        )

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        target[key] = value

    decision = str(target.get("decision") or "")
    if decision == "PENDING_ADMIN_REVIEW":
        target["status"] = "pending_review"
        target["reviewState"] = "PENDING_ADMIN_REVIEW"
    elif decision in {"APPROVE", "APPROVE_AFTER_STEPUP"}:
        target["status"] = "approved"
        if str(target.get("reviewState") or "").startswith("PENDING"):
            target["reviewState"] = "REVIEWED_APPROVED"
    elif decision in {"BLOCK", "BLOCK_STEPUP_FAILED"}:
        target["status"] = "blocked"
        if str(target.get("reviewState") or "").startswith("PENDING"):
            target["reviewState"] = "REVIEWED_BLOCKED"

    records[index] = target
    _save_transactions(records)
    return TransactionRecord(**target)


@app.post("/predict/primary", response_model=PredictionOutput)
async def predict_primary(payload: TransactionInput) -> PredictionOutput:
    available_models = {
        key: model_registry[key]
        for key in ("random_forest",)
        if key in model_registry
    }

    if not available_models:
        raise HTTPException(
            status_code=503,
            detail="No compatible trained models could be loaded from backend/trained_models.",
        )

    try:
        raw_frame = pd.DataFrame(
            [
                {
                    "step": payload.step,
                    "type": _transaction_type_value(payload.type),
                    "amount": payload.amount,
                    "nameOrig": "C_demo_origin",
                    "oldbalanceOrg": payload.oldbalanceOrg,
                    "newbalanceOrig": payload.newbalanceOrig,
                    "nameDest": "C_demo_destination",
                    "oldbalanceDest": payload.oldbalanceDest,
                    "newbalanceDest": payload.newbalanceDest,
                }
            ]
        )

        feature_matrix = build_feature_matrix(raw_frame)
        scores: dict[str, float] = {}

        for model_name, model in available_models.items():
            try:
                scores[model_name] = _predict_with_fallbacks(model, feature_matrix)
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.warning("Prediction failed for %s: %s", model_name, exc)

        if scores:
            probability = float(np.mean(list(scores.values())))
        else:
            probability = _heuristic_probability(payload)

        risk_level = _risk_level(probability)
        explanation = _build_prediction_explanation(
            payload,
            probability,
            risk_level,
            used_fallback=not bool(scores),
        )
        risk_factors = _build_risk_factors(payload, scores)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Primary prediction failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return PredictionOutput(
        probability=probability,
        is_fraud=probability >= 0.5,
        risk_level=risk_level,  # type: ignore[arg-type]
        explanation=explanation,
        risk_factors=risk_factors,
        models_used=list(scores.keys()),
        model_scores=scores,
    )
