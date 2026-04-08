from datetime import datetime
import uuid
from typing import List, Dict, Optional
from .schemas import TransactionRecord, TransactionStatusEnum, AuditLogEntry

# In-memory database for simulation
# In a production environment, this would be SQLAlchemy or Motor
transactions_db: Dict[str, TransactionRecord] = {}
audit_logs: List[AuditLogEntry] = []

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
