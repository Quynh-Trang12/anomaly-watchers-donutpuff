"""
Pydantic schemas for the Fraud Simulator API.

Enforces strict validation against the Rupak Roy (Paysim) dataset schema.
All boundary constraints use ``Field(...)`` with documented limits to
guarantee contract enforcement at the API boundary (Rule 3).
"""

from __future__ import annotations

from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Domain Enums
# ---------------------------------------------------------------------------
class TransactionTypeEnum(str, Enum):
    """Valid transaction types in the Paysim simulation."""

    CASH_IN = "CASH IN"
    CASH_OUT = "CASH OUT"
    DEBIT = "DEBIT"
    PAYMENT = "PAYMENT"
    TRANSFER = "TRANSFER"


class RiskLevel(str, Enum):
    """Tri-level risk classification."""

    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


# ---------------------------------------------------------------------------
# Request Schemas
# ---------------------------------------------------------------------------
class TransactionInput(BaseModel):
    """
    Input schema for the primary (Paysim) prediction endpoint.

    Mirrors the columns of the Rupak Roy dataset exactly:
    ``step, type, amount, nameOrig, oldbalanceOrg, newbalanceOrig,
    nameDest, oldbalanceDest, newbalanceDest``.
    """

    step: int = Field(
        default=1, ge=1, description="Time-step (1 step = 1 hour in Paysim)"
    )
    type: str = Field(
        ..., description="Transaction type (CASH_OUT, TRANSFER, PAYMENT, etc.)"
    )
    amount: float = Field(
        ..., ge=0, description="Transaction amount in simulated currency"
    )
    oldbalanceOrg: float = Field(
        ..., ge=0, description="Sender balance before transaction"
    )
    newbalanceOrig: float = Field(..., description="Sender balance after transaction")
    oldbalanceDest: float = Field(
        default=0, ge=0, description="Recipient balance before transaction"
    )
    newbalanceDest: float = Field(
        default=0, ge=0, description="Recipient balance after transaction"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "step": 1,
                    "type": "TRANSFER",
                    "amount": 50000.0,
                    "oldbalanceOrg": 50000.0,
                    "newbalanceOrig": 0.0,
                    "oldbalanceDest": 0.0,
                    "newbalanceDest": 50000.0,
                }
            ]
        }
    }


class CreditCardInput(BaseModel):
    """
    Input schema for the secondary (Kartik2112) prediction endpoint.

    Uses geospatial + demographic features from the Sparkov dataset.
    """

    amt: float = Field(..., ge=0, description="Transaction amount (USD)")
    lat: float = Field(..., ge=-90, le=90, description="Cardholder latitude")
    long: float = Field(..., ge=-180, le=180, description="Cardholder longitude")
    merch_lat: float = Field(..., ge=-90, le=90, description="Merchant latitude")
    merch_long: float = Field(..., ge=-180, le=180, description="Merchant longitude")
    dob: str = Field(..., description="Cardholder date of birth (YYYY-MM-DD)")
    city_pop: int = Field(..., ge=0, description="City population")


# ---------------------------------------------------------------------------
# Response Schemas
# ---------------------------------------------------------------------------
class RiskFactor(BaseModel):
    """A single explainability factor returned by the XAI engine."""

    factor: str = Field(..., description="Human-readable risk factor description")
    severity: Literal["info", "warning", "danger"] = Field(
        default="info", description="Visual severity level"
    )


class PredictionOutput(BaseModel):
    """
    Unified response schema for all prediction endpoints.

    Includes:
      - ``probability``: raw ML model output (0–1)
      - ``is_fraud``: binary classification at threshold
      - ``risk_level``: Low / Medium / High
      - ``explanation``: human-readable summary
      - ``risk_factors``: structured XAI factors for the frontend
    """

    probability: float = Field(..., ge=0, le=1, description="Fraud probability (0-1)")
    is_fraud: bool = Field(..., description="Binary fraud classification")
    risk_level: str = Field(..., description="Low | Medium | High")
    explanation: Optional[str] = Field(
        default=None, description="Human-readable summary"
    )
    risk_factors: List[RiskFactor] = Field(
        default_factory=list,
        description="Structured risk factors for XAI display",
    )
