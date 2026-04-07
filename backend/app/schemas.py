"""
Schemas shared by the FastAPI fraud inference service.
"""

from __future__ import annotations

from enum import Enum
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class TransactionTypeEnum(str, Enum):
    PAYMENT = "PAYMENT"
    TRANSFER = "TRANSFER"
    CASH_OUT = "CASH OUT"
    CASH_IN = "CASH IN"
    DEBIT = "DEBIT"


class TransactionInput(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    step: int = Field(default=1, ge=1)
    type: TransactionTypeEnum
    amount: float = Field(..., ge=0)
    oldbalanceOrg: float = Field(..., ge=0)
    newbalanceOrig: float
    oldbalanceDest: float = Field(default=0, ge=0)
    newbalanceDest: float = Field(default=0, ge=0)


class RiskFactor(BaseModel):
    factor: str
    severity: Literal["info", "warning", "danger"] = "info"


class PredictionOutput(BaseModel):
    probability: float = Field(..., ge=0, le=1)
    is_fraud: bool
    risk_level: Literal["Low", "Medium", "High"]
    explanation: Optional[str] = None
    risk_factors: List[RiskFactor] = Field(default_factory=list)
    models_used: List[str] = Field(default_factory=list)
    model_scores: Dict[str, float] = Field(default_factory=dict)


class HealthResponse(BaseModel):
    status: str
    models_loaded: List[str] = Field(default_factory=list)
    feature_count: int = 0


class UserRoleEnum(str, Enum):
    USER = "user"
    ADMIN = "admin"


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=3, max_length=128)


class SignupRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)
    email: str = Field(..., min_length=6, max_length=254)
    displayName: Optional[str] = Field(default=None, min_length=1, max_length=80)


class AuthUser(BaseModel):
    id: str
    username: str
    role: Literal["user", "admin"]
    displayName: Optional[str] = None
    email: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: AuthUser


class TransactionRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    id: str
    step: int = Field(..., ge=1)
    type: TransactionTypeEnum
    amount: float = Field(..., ge=0)
    nameOrig: str
    oldbalanceOrg: float = Field(..., ge=0)
    newbalanceOrig: float
    nameDest: str
    oldbalanceDest: float = Field(default=0, ge=0)
    newbalanceDest: float = Field(default=0, ge=0)
    isFraud: int = Field(..., ge=0, le=1)
    isFlaggedFraud: int = Field(..., ge=0, le=1)
    riskScore: float = Field(..., ge=0, le=100)
    decision: Literal[
        "APPROVE",
        "STEP_UP",
        "BLOCK",
        "APPROVE_AFTER_STEPUP",
        "BLOCK_STEPUP_FAILED",
        "PENDING_ADMIN_REVIEW",
    ]
    status: Optional[Literal["approved", "blocked", "pending_review"]] = None
    reviewState: Optional[
        Literal["PENDING_ADMIN_REVIEW", "REVIEWED_APPROVED", "REVIEWED_BLOCKED"]
    ] = None
    reasons: List[str] = Field(default_factory=list)
    backendRiskLevel: Optional[Literal["Low", "Medium", "High"]] = None
    backendExplanation: Optional[str] = None
    modelScores: Dict[str, float] = Field(default_factory=dict)
    modelsUsed: List[str] = Field(default_factory=list)
    createdAt: str
    ownerId: str
    ownerUsername: str


class TransactionCreate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    id: Optional[str] = None
    step: int = Field(..., ge=1)
    type: TransactionTypeEnum
    amount: float = Field(..., ge=0)
    nameOrig: str
    oldbalanceOrg: float = Field(..., ge=0)
    newbalanceOrig: float
    nameDest: str
    oldbalanceDest: float = Field(default=0, ge=0)
    newbalanceDest: float = Field(default=0, ge=0)
    isFraud: int = Field(..., ge=0, le=1)
    isFlaggedFraud: int = Field(..., ge=0, le=1)
    riskScore: float = Field(..., ge=0, le=100)
    decision: Literal[
        "APPROVE",
        "STEP_UP",
        "BLOCK",
        "APPROVE_AFTER_STEPUP",
        "BLOCK_STEPUP_FAILED",
        "PENDING_ADMIN_REVIEW",
    ]
    status: Optional[Literal["approved", "blocked", "pending_review"]] = None
    reviewState: Optional[
        Literal["PENDING_ADMIN_REVIEW", "REVIEWED_APPROVED", "REVIEWED_BLOCKED"]
    ] = None
    reasons: List[str] = Field(default_factory=list)
    backendRiskLevel: Optional[Literal["Low", "Medium", "High"]] = None
    backendExplanation: Optional[str] = None
    modelScores: Dict[str, float] = Field(default_factory=dict)
    modelsUsed: List[str] = Field(default_factory=list)
    createdAt: Optional[str] = None


class TransactionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Optional[
        Literal[
            "APPROVE",
            "STEP_UP",
            "BLOCK",
            "APPROVE_AFTER_STEPUP",
            "BLOCK_STEPUP_FAILED",
            "PENDING_ADMIN_REVIEW",
        ]
    ] = None
    status: Optional[Literal["approved", "blocked", "pending_review"]] = None
    reviewState: Optional[
        Literal["PENDING_ADMIN_REVIEW", "REVIEWED_APPROVED", "REVIEWED_BLOCKED"]
    ] = None
    isFraud: Optional[int] = Field(default=None, ge=0, le=1)
    riskScore: Optional[float] = Field(default=None, ge=0, le=100)
    reasons: Optional[List[str]] = None
    backendRiskLevel: Optional[Literal["Low", "Medium", "High"]] = None
    backendExplanation: Optional[str] = None


class UserConfirmationEmailRequest(BaseModel):
    amount: float = Field(..., ge=0)
    transaction_type: str = Field(..., min_length=1, max_length=40)
    recipient_account: str = Field(..., min_length=1, max_length=128)


class OtpEmailRequest(BaseModel):
    otp_code: str = Field(..., min_length=4, max_length=12)
    amount: float = Field(..., ge=0)
    transaction_type: str = Field(..., min_length=1, max_length=40)


class NotificationResponse(BaseModel):
    sent: bool
    provider: Literal["fastapi_mail"] = "fastapi_mail"
    recipient: str
    subject: str
    detail: str


class DashboardTimelinePoint(BaseModel):
    date: str
    count: int = Field(..., ge=0)


class DashboardRecentTransaction(BaseModel):
    id: str
    type: str
    amount: float = Field(..., ge=0)
    riskScore: float = Field(..., ge=0, le=100)
    decision: str
    status: Optional[str] = None
    createdAt: str
    ownerId: str
    ownerUsername: str


class DashboardResponse(BaseModel):
    total_transactions: int = Field(..., ge=0)
    approved_count: int = Field(..., ge=0)
    blocked_count: int = Field(..., ge=0)
    under_review_count: int = Field(..., ge=0)
    average_risk_score: float = Field(..., ge=0, le=100)
    type_distribution: Dict[str, int] = Field(default_factory=dict)
    timeline: List[DashboardTimelinePoint] = Field(default_factory=list)
    recent_transactions: List[DashboardRecentTransaction] = Field(default_factory=list)
