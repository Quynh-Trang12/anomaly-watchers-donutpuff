"""
Schemas shared by the FastAPI fraud inference service.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class TransactionTypeEnum(str, Enum):
    PAYMENT = "PAYMENT"
    TRANSFER = "TRANSFER"
    CASH_OUT = "CASH OUT"
    CASH_IN = "CASH IN"
    DEBIT = "DEBIT"


class TransactionStatusEnum(str, Enum):
    APPROVED = "APPROVED"
    BLOCKED = "BLOCKED"
    PENDING_USER_OTP = "PENDING_USER_OTP"
    PENDING_ADMIN_REVIEW = "PENDING_ADMIN_REVIEW"


class TransactionInput(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    type: TransactionTypeEnum
    amount: float = Field(..., ge=0)
    oldbalanceOrg: float = Field(..., ge=0)
    newbalanceOrig: float
    oldbalanceDest: float = Field(default=0, ge=0)
    newbalanceDest: float = Field(default=0, ge=0)
    user_id: str = Field(default="user_123")
    destination_account_id: str = Field(default="")


class RiskFactor(BaseModel):
    factor: str
    severity: Literal["info", "warning", "danger"] = "info"


class PredictionOutput(BaseModel):
    probability: float = Field(..., ge=0, le=1)
    is_fraud: bool
    risk_level: Literal["Low", "Medium", "High"]
    status: TransactionStatusEnum
    explanation: Optional[str] = None
    risk_factors: List[RiskFactor] = Field(default_factory=list)
    transaction_id: str


class TransactionRecord(BaseModel):
    transaction_id: str
    owner_user_id: str
    destination_account_id: Optional[str] = None
    amount: float
    type: str
    status: TransactionStatusEnum
    probability_score: float
    timestamp: datetime
    risk_factors: List[RiskFactor]
    otp_code: Optional[str] = None  # Stores OTP for PENDING_USER_OTP transactions


class BusinessRulesUpdate(BaseModel):
    large_transfer_limit_amount: float
    daily_velocity_limit: float
    restricted_flagged_status: bool


class ConfigurationResponse(BaseModel):
    ml_thresholds: Dict[str, float]
    business_rules: BusinessRulesUpdate


class AuditLogEntry(BaseModel):
    log_id: str
    timestamp: datetime
    action_type: str
    admin_id: str
    details: str


class HealthResponse(BaseModel):
    status: str
    models_loaded: List[str] = Field(default_factory=list)
    feature_count: int = 0


class QueueOverflowNotify(BaseModel):
    queue_size: int
