"""
AnomalyWatchers-DonutPuff — FastAPI Backend
============================================
COS30049 Assignment 3: Full-Stack Fraud Detection API

Architecture:
    - Models loaded ONCE at startup via ``@app.on_event("startup")``.
    - Prediction endpoints are ``async def`` for non-blocking I/O.
    - Hybrid detection: ML probability ensembled with heuristic rules.
    - Structured XAI: returns typed ``RiskFactor`` objects for frontend display.

Endpoints:
    GET  /                    → health check
    POST /predict/primary     → Paysim (Rupak Roy) model
    POST /predict/secondary   → Sparkov (Kartik2112) model
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .schemas import PredictionOutput, RiskFactor, TransactionInput, CreditCardInput

# ---------------------------------------------------------------------------
# Logging (Rule 8)
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("anomaly_watchers.api")

# ---------------------------------------------------------------------------
# Constants (Rule 5)
# ---------------------------------------------------------------------------
MODEL_DIR = Path("backend") / "models"

FEATURE_COLUMNS: List[str] = [
    "type",
    "amount",
    "oldbalanceOrg",
    "newbalanceOrig",
    "errorBalanceOrg",
    "errorBalanceDest",
]

# Risk-level thresholds
HIGH_RISK_THRESHOLD: float = 0.8
MEDIUM_RISK_THRESHOLD: float = 0.4

# Heuristic thresholds
HIGH_VALUE_AMOUNT: float = 150_000.0
BALANCE_ERROR_EPSILON: float = 0.01

# ---------------------------------------------------------------------------
# Global model registry — populated at startup, read-only thereafter
# ---------------------------------------------------------------------------
_models: Dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Lifespan (modern replacement for on_event)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models into memory once at application startup."""
    logger.info("Loading models from %s ...", MODEL_DIR)

    artifact_map = {
        "primary": "model_primary.pkl",
        "encoder": "label_encoder_type.pkl",
        "logistic": "model_logistic.pkl",
        "isolation_forest": "model_isolation_forest.pkl",
        "secondary_rf": "model_secondary_rf.pkl",
    }

    for key, filename in artifact_map.items():
        path = MODEL_DIR / filename
        if path.exists():
            _models[key] = joblib.load(path)
            logger.info("   ✓ Loaded %s", filename)
        else:
            logger.warning("   ✗ Missing %s — endpoint will return 503", filename)

    logger.info("Models loaded: %s", list(_models.keys()))
    yield
    logger.info("Shutting down — releasing model references")
    _models.clear()


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AnomalyWatchers Fraud Detection API",
    version="2.0.0",
    description="Tri-model fraud detection with XAI explainability",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
@app.get("/")
async def health_check() -> Dict[str, Any]:
    """Return API status and list of loaded model keys."""
    return {"status": "ok", "models_loaded": list(_models.keys())}


# ---------------------------------------------------------------------------
# Heuristic Engine (XAI)
# ---------------------------------------------------------------------------
def _compute_heuristics(
    data: TransactionInput,
    error_balance_org: float,
) -> tuple[float, List[RiskFactor]]:
    """
    Rule-based fraud heuristics that complement the ML model.

    Returns the maximum heuristic probability and a list of
    :class:`RiskFactor` objects for the frontend XAI display.

    Args:
        data: Validated transaction input.
        error_balance_org: Computed balance-error feature.

    Returns:
        Tuple of (heuristic_probability, risk_factors).
    """
    h_prob: float = 0.0
    factors: List[RiskFactor] = []

    # Rule 1: Forced overdraft — newbalanceOrig should never be negative
    if data.newbalanceOrig < 0:
        h_prob = max(h_prob, 0.99)
        factors.append(
            RiskFactor(
                factor="Illegal Overdraft: Sender balance went negative, indicating a forced withdrawal",
                severity="danger",
            )
        )

    # Rule 2: Complete balance drain
    if (
        data.newbalanceOrig == 0
        and data.amount > 0
        and data.amount >= data.oldbalanceOrg
    ):
        h_prob = max(h_prob, 0.95)
        factors.append(
            RiskFactor(
                factor=f"Balance Drain: Full account emptied ({data.oldbalanceOrg:,.2f} → 0)",
                severity="danger",
            )
        )

    # Rule 3: Balance-error anomaly (math inconsistency)
    # Only evaluate balance drop inconsistencies for outgoing types
    if data.type.replace("_", " ").upper() in [
        "CASH OUT",
        "TRANSFER",
        "DEBIT",
        "PAYMENT",
    ]:
        if abs(error_balance_org) > BALANCE_ERROR_EPSILON:
            h_prob = max(h_prob, 0.85)
            factors.append(
                RiskFactor(
                    factor=f"Balance Discrepancy: Error of {error_balance_org:,.2f} detected (expected ≈ 0)",
                    severity="warning",
                )
            )

    # Rule 4: High-value transaction
    if data.amount > HIGH_VALUE_AMOUNT:
        h_prob = max(h_prob, 0.70)
        factors.append(
            RiskFactor(
                factor=f"High Amount: {data.amount:,.2f} exceeds {HIGH_VALUE_AMOUNT:,.0f} threshold",
                severity="warning",
            )
        )

    # Rule 5: Amount > old balance ratio (suspicious overdraw attempt)
    if data.oldbalanceOrg > 0:
        ratio = data.amount / data.oldbalanceOrg
        if ratio > 0.9:
            h_prob = max(h_prob, 0.60)
            factors.append(
                RiskFactor(
                    factor=f"High Amount-to-Balance Ratio: {ratio:.1%} of available balance",
                    severity="warning",
                )
            )

    return h_prob, factors


# ---------------------------------------------------------------------------
# Primary Prediction Endpoint (Paysim / Rupak Roy)
# ---------------------------------------------------------------------------
@app.post("/predict/primary", response_model=PredictionOutput)
async def predict_primary(data: TransactionInput) -> PredictionOutput:
    """
    Run fraud detection on a Paysim-schema transaction.

    Combines XGBoost ML probability with heuristic rules.
    Returns structured XAI factors for the frontend.

    Args:
        data: Validated :class:`TransactionInput`.

    Returns:
        :class:`PredictionOutput` with probability, decision, and XAI factors.

    Raises:
        HTTPException 503: If the primary model is not loaded.
    """
    if "primary" not in _models:
        raise HTTPException(
            status_code=503,
            detail="Primary model not loaded. Run `python scripts/train_models.py` first.",
        )

    # Feature engineering — must mirror the training pipeline exactly
    try:
        type_encoded = int(_models["encoder"].transform([data.type])[0])
    except (ValueError, KeyError):
        # Unknown type (e.g. DEBIT, PAYMENT not in encoder) — default to 0
        type_encoded = 0

    tx_type = data.type.replace("_", " ").upper()

    # Balance error math depends on transaction direction
    if tx_type == "CASH IN":
        # Money enters Origin: new should be old + amount
        error_balance_org = data.newbalanceOrig - data.amount - data.oldbalanceOrg
        error_balance_dest = data.oldbalanceDest + data.amount - data.newbalanceDest
    else:
        # Money leaves Origin: new should be old - amount
        error_balance_org = data.newbalanceOrig + data.amount - data.oldbalanceOrg
        error_balance_dest = data.oldbalanceDest + data.amount - data.newbalanceDest

    features = pd.DataFrame(
        [
            {
                "type": type_encoded,
                "amount": data.amount,
                "oldbalanceOrg": data.oldbalanceOrg,
                "newbalanceOrig": data.newbalanceOrig,
                "errorBalanceOrg": error_balance_org,
                "errorBalanceDest": error_balance_dest,
            }
        ]
    )[FEATURE_COLUMNS]

    logger.debug("Prediction features:\n%s", features.to_string())

    # ML prediction with safe fallback for unexpected float behavior
    try:
        raw_prob = _models["primary"].predict_proba(features.values)[0][1]
        ml_prob = float(raw_prob)
        if np.isnan(ml_prob):
            ml_prob = 0.0
    except Exception as e:
        logger.error("XGBoost prediction failed: %s", e)
        ml_prob = 0.0

    # Heuristic overlay
    h_prob, risk_factors = _compute_heuristics(data, error_balance_org)

    # Add ML-specific factor if ML score is elevated (clamp ml_prob to 0-1 for display)
    if ml_prob > 0.5:
        risk_factors.insert(
            0,
            RiskFactor(
                factor=f"AI Model: XGBoost detected suspicious pattern (confidence: {min(1.0, ml_prob):.1%})",
                severity="danger" if ml_prob > 0.8 else "warning",
            ),
        )

    # Ensemble: take the max of ML and heuristic scores, strictly clamped to [0.0, 1.0]
    final_prob = max(0.0, min(1.0, float(max(ml_prob, h_prob))))
    is_fraud = final_prob > 0.5

    # Risk level classification
    if final_prob > HIGH_RISK_THRESHOLD:
        risk_level = "High"
    elif final_prob > MEDIUM_RISK_THRESHOLD:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    # Generate human-readable summary
    if is_fraud:
        factor_summaries = [f.factor for f in risk_factors[:3]]
        explanation = f"Risk Factors: {'; '.join(factor_summaries)}."
    else:
        explanation = "Transaction parameters are consistent with legitimate behavior."
        if not risk_factors:
            risk_factors.append(
                RiskFactor(
                    factor="All checks passed — no anomalies detected",
                    severity="info",
                )
            )

    logger.info(
        "Predict | type=%s amount=%.2f | ML=%.4f heuristic=%.4f → %s (%s)",
        data.type,
        data.amount,
        ml_prob,
        h_prob,
        risk_level,
        "FRAUD" if is_fraud else "LEGIT",
    )

    return PredictionOutput(
        probability=float(final_prob),
        is_fraud=is_fraud,
        risk_level=risk_level,
        explanation=explanation,
        risk_factors=risk_factors,
    )


# ---------------------------------------------------------------------------
# Secondary Prediction Endpoint (Kartik2112 / Sparkov)
# ---------------------------------------------------------------------------
def _haversine(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Haversine formula for great-circle distance in km."""
    lon1, lat1, lon2, lat2 = map(np.radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return float(6371 * 2 * np.arcsin(np.sqrt(a)))


@app.post("/predict/secondary", response_model=PredictionOutput)
async def predict_secondary(data: CreditCardInput) -> PredictionOutput:
    """
    Run fraud detection on a Kartik2112-schema credit card transaction.

    Args:
        data: Validated :class:`CreditCardInput`.

    Returns:
        :class:`PredictionOutput`.

    Raises:
        HTTPException 503: If the secondary model is not loaded.
    """
    if "secondary_rf" not in _models:
        raise HTTPException(
            status_code=503,
            detail="Secondary model not loaded. Run `python scripts/train_models.py` first.",
        )

    dist = _haversine(data.long, data.lat, data.merch_long, data.merch_lat)

    try:
        dob_parsed = pd.to_datetime(data.dob)
        age = 2025 - dob_parsed.year
    except (ValueError, TypeError):
        age = 30  # safe default

    features = pd.DataFrame(
        [
            {
                "amt": data.amt,
                "dist_to_merch": dist,
                "age": age,
                "city_pop": data.city_pop,
            }
        ]
    )

    try:
        pred = int(_models["secondary_rf"].predict(features)[0])
        raw_prob = _models["secondary_rf"].predict_proba(features)[0][1]
        prob = max(0.0, min(1.0, float(raw_prob)))
        if np.isnan(prob):
            prob = 0.0
    except Exception as e:
        logger.error("Secondary RF prediction failed: %s", e)
        pred = 0
        prob = 0.0

    risk_factors: List[RiskFactor] = []
    if dist > 100:
        risk_factors.append(
            RiskFactor(
                factor=f"Distance anomaly: {dist:.1f} km from merchant",
                severity="warning",
            )
        )

    if prob > HIGH_RISK_THRESHOLD:
        risk_level = "High"
    elif prob > MEDIUM_RISK_THRESHOLD:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    return PredictionOutput(
        probability=prob,
        is_fraud=bool(pred),
        risk_level=risk_level,
        explanation=f"Distance to merchant: {dist:.2f} km",
        risk_factors=risk_factors,
    )
