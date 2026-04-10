"""
Local In-Memory Data Store and Financial Ledger Management

This module simulates a persistent database for the AnomalyWatchers system. 
It manages three primary data domains:
1. Transactional storage for historical records.
2. An administrative audit log for tracking system events.
3. A synchronized financial ledger for managing user account balances.
"""

import logging
import uuid
from datetime import datetime
from typing import List, Dict, Optional
from .schemas import TransactionRecord, TransactionStatusEnum, AuditLogEntry

logger = logging.getLogger("anomaly_watchers.db")

# --- In-Memory State Containers ---

# Primary storage for transaction history. Key = UUID, Value = TransactionRecord.
transactions_db: Dict[str, TransactionRecord] = {}

# Chronological list of all system audit logs (alerts, overrides, etc).
audit_logs: List[AuditLogEntry] = []

# Internal Bank Ledger: Simulates a real banking core with pre-populated accounts.
internal_account_registry: Dict[str, float] = {
    "student_sam": 500.00,
    "student_lina": 1200.00,
    "intern_jake": 2200.00,
    "freelancer_amy": 8500.00,
    "freelancer_minh": 6200.00,
    "teacher_anna": 18000.00,
    "teacher_david": 22000.00,
    "engineer_khanh": 95000.00,
    "engineer_lucas": 120000.00,
    "doctor_emily": 250000.00,
    "doctor_huy": 300000.00,
    "smallbiz_oliver": 175000.00,
    "shop_owner_lan": 68000.00,
    "manager_sophia": 85000.00,
    "manager_quang": 92000.00,
    "retired_john": 40000.00,
    "retired_ba": 55000.00,
    "crypto_trader_neo": 500000.00,
    "influencer_mia": 150000.00,
    "unemployed_tom": 300.00,
}

# Email mapping for OTP delivery — maps mock user IDs to real email addresses
# Configure these email addresses for OTP testing with real email providers
user_email_registry: Dict[str, str] = {
    "user_1": "user_1@example.com",           # Change to your email for testing
    "user_2": "user_2@example.com",           # Change to your email for testing
    "user_3": "user_3@example.com",           # Change to your email for testing
    "user_4": "quynhtranglengoc@gmail.com",   # YOUR ACTUAL GMAIL ADDRESS
}

def get_account_balance(user_id: str) -> Optional[float]:
    """Returns the current balance for a registered internal account, or None if not found."""
    return internal_account_registry.get(user_id)

def get_user_email(user_id: str) -> Optional[str]:
    """Returns the email address for a registered user for OTP delivery."""
    return user_email_registry.get(user_id)

def deduct_account_balance(user_id: str, amount: float) -> float:
    """
    Safely deducts a transaction amount from a user's ledger balance.
    
    Validation:
    - Verifies account existence.
    - Enforces liquidity check (prevents negative balances).
    
    Returns:
        The updated balance after deduction.
    """
    if user_id not in internal_account_registry:
        raise ValueError(f"Account '{user_id}' not found in the internal network.")
    if internal_account_registry[user_id] < amount:
        raise ValueError(f"Insufficient funds for account '{user_id}'.")
    internal_account_registry[user_id] -= amount
    return internal_account_registry[user_id]

def credit_account_balance(user_id: str, amount: float) -> float:
    """
    Credits the transaction amount to the recipient's account balance.

    Args:
        user_id: The internal account identifier of the recipient.
        amount: The positive dollar amount to credit.

    Returns:
        The recipient's updated balance after crediting.

    Raises:
        ValueError: If the recipient account is not found in the internal registry.
    """
    if user_id not in internal_account_registry:
        raise ValueError(f"Recipient account '{user_id}' not found in the internal network.")
    internal_account_registry[user_id] += amount
    return internal_account_registry[user_id]

def save_transaction(transaction: TransactionRecord):
    transactions_db[transaction.transaction_id] = transaction

def get_transaction(transaction_id: str) -> Optional[TransactionRecord]:
    return transactions_db.get(transaction_id)

def get_user_transactions(user_id: str) -> List[TransactionRecord]:
    return [t for t in transactions_db.values() if (t.owner_user_id == user_id or t.destination_account_id == user_id) and t.status != TransactionStatusEnum.INITIATED]

def get_all_transactions() -> List[TransactionRecord]:
    """
    Retrieves all finalized transactions. 
    Exclude 'INITIATED' (pending OTP) to keep the audit view clean of incomplete attempts.
    """
    return [t for t in transactions_db.values() if t.status != TransactionStatusEnum.INITIATED]

def update_transaction_status(transaction_id: str, status: TransactionStatusEnum, admin_id: Optional[str] = None):
    """
    Manually overrides a transaction's status.
    Used for administrative remediation (e.g., manual approval/blocking).
    """
    if transaction_id in transactions_db:
        old_status = transactions_db[transaction_id].status
        transactions_db[transaction_id].status = status
        
        if admin_id:
            add_audit_log(
                admin_id=admin_id,
                action_type="STATUS_OVERRIDE",
                details=f"Admin {admin_id} changed transaction #{transaction_id} from {old_status} to {status}."
            )

def add_audit_log(admin_id: str, action_type: str, details: str):
    log_entry = AuditLogEntry(
        log_id=str(uuid.uuid4()),
        timestamp=datetime.now(),
        action_type=action_type,
        admin_id=admin_id,
        details=details
    )
    audit_logs.append(log_entry)

def get_audit_logs() -> List[AuditLogEntry]:
    return audit_logs
