from datetime import datetime
import uuid
from typing import List, Dict, Optional
from .schemas import TransactionRecord, TransactionStatusEnum, AuditLogEntry

# In-memory database for simulation
# In a production environment, this would be SQLAlchemy or Motor
transactions_db: Dict[str, TransactionRecord] = {}
audit_logs: List[AuditLogEntry] = []

# Internal account registry — simulates a real banking ledger
internal_account_registry: Dict[str, float] = {
    "user_1": 450000.00,
    "user_2": 15000.00,
    "user_3": 250000.00,
    "user_4": 75000.00,
}

def get_account_balance(user_id: str) -> Optional[float]:
    """Returns the current balance for a registered internal account, or None if not found."""
    return internal_account_registry.get(user_id)

def deduct_account_balance(user_id: str, amount: float) -> float:
    """Deducts the transaction amount from the originator's balance. Raises ValueError if insufficient funds."""
    if user_id not in internal_account_registry:
        raise ValueError(f"Account '{user_id}' not found in the internal network.")
    if internal_account_registry[user_id] < amount:
        raise ValueError(f"Insufficient funds for account '{user_id}'.")
    internal_account_registry[user_id] -= amount
    return internal_account_registry[user_id]

def save_transaction(transaction: TransactionRecord):
    transactions_db[transaction.transaction_id] = transaction

def get_transaction(transaction_id: str) -> Optional[TransactionRecord]:
    return transactions_db.get(transaction_id)

def get_user_transactions(user_id: str) -> List[TransactionRecord]:
    return [t for t in transactions_db.values() if t.owner_user_id == user_id]

def get_all_transactions() -> List[TransactionRecord]:
    return list(transactions_db.values())

def update_transaction_status(transaction_id: str, status: TransactionStatusEnum, admin_id: Optional[str] = None):
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
