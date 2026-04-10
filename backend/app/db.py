"""
In-memory data store for AnomalyWatchers.
In production this would be replaced by a proper RDBMS + Redis layer.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from .schemas import AuditLogEntry, TransactionRecord, TransactionStatusEnum

logger = logging.getLogger("anomaly_watchers.db")

# ─── Account Registries ──────────────────────────────────────────────────────

internal_account_registry: Dict[str, float] = {
    "user_1":  450000.00, "user_2":  15000.00, "user_3":  250000.00,
    "user_4":  75000.00,  "user_5":  32000.00,  "user_6":  180000.00,
    "user_7":  9500.00,   "user_8":  62000.00,  "user_9":  120000.00,
    "user_10": 5000.00,   "user_11": 88000.00,  "user_12": 43000.00,
    "user_13": 215000.00, "user_14": 7200.00,   "user_15": 310000.00,
    "user_16": 55000.00,  "user_17": 19000.00,  "user_18": 140000.00,
    "user_19": 3800.00,   "user_20": 97000.00,
}

user_email_registry: Dict[str, str] = {
    "user_1":  "alice.chen@example.com",
    "user_2":  "bob.martinez@example.com",
    "user_3":  "carol.johnson@example.com",
    "user_4":  "david.kim@example.com",
    "user_5":  "emma.williams@example.com",
    "user_6":  "frank.nguyen@example.com",
    "user_7":  "grace.patel@example.com",
    "user_8":  "henry.okafor@example.com",
    "user_9":  "isabella.santos@example.com",
    "user_10": "james.liu@example.com",
    "user_11": "karen.muller@example.com",
    "user_12": "liam.adeyemi@example.com",
    "user_13": "mia.tanaka@example.com",
    "user_14": "noah.fernandez@example.com",
    "user_15": "olivia.hassan@example.com",
    "user_16": "paul.osei@example.com",
    "user_17": "quinn.ramirez@example.com",
    "user_18": "rachel.dubois@example.com",
    "user_19": "samuel.park@example.com",
    "user_20": "tina.kovac@example.com",
}

user_name_registry: Dict[str, str] = {
    "user_1":  "Alice Chen",
    "user_2":  "Bob Martinez",
    "user_3":  "Carol Johnson",
    "user_4":  "David Kim",
    "user_5":  "Emma Williams",
    "user_6":  "Frank Nguyen",
    "user_7":  "Grace Patel",
    "user_8":  "Henry Okafor",
    "user_9":  "Isabella Santos",
    "user_10": "James Liu",
    "user_11": "Karen Müller",
    "user_12": "Liam Adeyemi",
    "user_13": "Mia Tanaka",
    "user_14": "Noah Fernandez",
    "user_15": "Olivia Hassan",
    "user_16": "Paul Osei",
    "user_17": "Quinn Ramirez",
    "user_18": "Rachel Dubois",
    "user_19": "Samuel Park",
    "user_20": "Tina Kovač",
}

# ─── Transaction Store ───────────────────────────────────────────────────────

transactions_db: Dict[str, TransactionRecord] = {}
audit_logs:      List[AuditLogEntry]           = []

# ─── Account Freeze Subsystem ────────────────────────────────────────────────

# Maps user_id → {"frozen_at": datetime, "reason": str}
frozen_accounts: Dict[str, Dict[str, object]] = {}

# Maps user_id → list of datetime timestamps for failed OTP attempts
failed_otp_attempts: Dict[str, List[datetime]] = {}

# Mutable freeze config (admin-configurable at runtime)
freeze_config: Dict[str, int] = {
    "max_failed_otp_attempts":    3,
    "observation_window_minutes": 10,
}

# ─── Account Balance Helpers ─────────────────────────────────────────────────

def get_account_balance(user_id: str) -> Optional[float]:
    return internal_account_registry.get(user_id)

def get_user_email(user_id: str) -> Optional[str]:
    return user_email_registry.get(user_id)

def get_user_display_name(user_id: str) -> str:
    return user_name_registry.get(user_id, user_id)

def deduct_account_balance(user_id: str, amount: float) -> float:
    # Normalize
    uid = user_id.strip()
    if is_account_frozen(uid):
        logger.error(f"BLOCKED: Attempt to deduct from frozen account {uid}")
        raise ValueError(f"Security lockout: Account {uid} is frozen.")
    
    if uid not in internal_account_registry:
        raise ValueError(f"Account '{uid}' not found in the internal network.")
    if internal_account_registry[user_id] < amount:
        raise ValueError(f"Insufficient funds for account '{user_id}'.")
    internal_account_registry[user_id] -= amount
    return internal_account_registry[user_id]

def credit_account_balance(user_id: str, amount: float) -> float:
    if user_id not in internal_account_registry:
        raise ValueError(f"Recipient account '{user_id}' not found in the internal network.")
    internal_account_registry[user_id] += amount
    return internal_account_registry[user_id]

# ─── Transaction CRUD ────────────────────────────────────────────────────────

def save_transaction(transaction: TransactionRecord) -> None:
    transactions_db[transaction.transaction_id] = transaction

def get_transaction(transaction_id: str) -> Optional[TransactionRecord]:
    return transactions_db.get(transaction_id)

def get_user_transactions(user_id: str) -> List[TransactionRecord]:
    return [t for t in transactions_db.values() if t.owner_user_id == user_id]

def get_all_transactions() -> List[TransactionRecord]:
    return list(transactions_db.values())

def update_transaction_status(
    transaction_id: str,
    status: TransactionStatusEnum,
    admin_id: Optional[str] = None,
) -> None:
    if transaction_id not in transactions_db:
        return
    old_status = transactions_db[transaction_id].status
    transactions_db[transaction_id].status = status
    if admin_id:
        add_audit_log(
            admin_id=admin_id,
            action_type="STATUS_OVERRIDE",
            details=(
                f"Admin '{admin_id}' changed transaction #{transaction_id} "
                f"from {old_status} to {status}."
            ),
        )

# ─── Audit Log ───────────────────────────────────────────────────────────────

def add_audit_log(admin_id: str, action_type: str, details: str) -> None:
    audit_logs.append(
        AuditLogEntry(
            log_id=str(uuid.uuid4()),
            timestamp=datetime.now(),
            action_type=action_type,
            admin_id=admin_id,
            details=details,
        )
    )

def get_audit_logs() -> List[AuditLogEntry]:
    return audit_logs

# ─── Account Freeze Helpers ───────────────────────────────────────────────────

def freeze_account(user_id: str, reason: str) -> None:
    uid = user_id.strip()
    logger.info(f"FREEZING ACCOUNT: {uid} | Reason: {reason}")
    frozen_accounts[uid] = {"frozen_at": datetime.now(), "reason": reason}

def unfreeze_account(user_id: str) -> None:
    frozen_accounts.pop(user_id, None)

def is_account_frozen(user_id: str) -> bool:
    return user_id.strip() in frozen_accounts

def get_frozen_accounts() -> List[Dict[str, object]]:
    return [
        {"user_id": uid, "frozen_at": data["frozen_at"], "reason": data["reason"]}
        for uid, data in frozen_accounts.items()
    ]

def record_failed_otp(user_id: str) -> int:
    """Record a failed OTP attempt; return total failures within the observation window."""
    now              = datetime.now()
    window           = timedelta(minutes=freeze_config["observation_window_minutes"])
    
    # Ensure user has a list
    if user_id not in failed_otp_attempts:
        failed_otp_attempts[user_id] = []
        
    attempts = failed_otp_attempts[user_id]
    
    # Prune stale attempts (outside window)
    current_valid = [t for t in attempts if (now - t) < window]
    
    # Record new failure
    current_valid.append(now)
    failed_otp_attempts[user_id] = current_valid
    
    return len(current_valid)

def get_failed_otp_count(user_id: str) -> int:
    now    = datetime.now()
    window = timedelta(minutes=freeze_config["observation_window_minutes"])
    return sum(1 for t in failed_otp_attempts.get(user_id, []) if (now - t) < window)

def update_freeze_config(max_failed_otp_attempts: int, observation_window_minutes: int) -> None:
    freeze_config["max_failed_otp_attempts"]    = max_failed_otp_attempts
    freeze_config["observation_window_minutes"] = observation_window_minutes
