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
