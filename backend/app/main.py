"""
FastAPI inference service for the current trained fraud models.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .preprocessing import build_feature_matrix
from .schemas import HealthResponse, PredictionOutput, RiskFactor, TransactionInput

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("anomaly_watchers.api")

MODEL_DIR = Path(__file__).resolve().parents[1] / "trained_models"

MODEL_CANDIDATES = {
    "random_forest": ["model_rf_v2.pkl", "model_rf.pkl"],
    "xgboost": ["model_xgboost_v2.pkl", "model_xgboost.pkl"],
    "feature_columns": ["feature_columns.pkl"],
}

model_registry: dict[str, Any] = {}
feature_columns: list[str] = []


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


def _predict_probability(model: Any, matrix: pd.DataFrame) -> float:
    if hasattr(model, "predict_proba"):
        raw_value = np.asarray(model.predict_proba(matrix))[0][-1]
    elif hasattr(model, "predict"):
        raw_value = np.asarray(model.predict(matrix))[0]
    else:
        raise ValueError("Model does not expose predict_proba or predict.")

    probability = float(raw_value)

    if not np.isfinite(probability):
        probability = 0.0

    return max(0.0, min(1.0, probability))


def _build_risk_factors(
    payload: TransactionInput,
    scores: dict[str, float],
) -> list[RiskFactor]:
    factors: list[RiskFactor] = []

    amount_to_balance = payload.amount / max(payload.oldbalanceOrg, 1.0)

    if payload.amount >= 150000:
        factors.append(
            RiskFactor(
                factor=f"High transaction amount detected at {payload.amount:,.2f}.",
                severity="warning",
            )
        )

    if payload.type in {"TRANSFER", "CASH OUT"} and amount_to_balance >= 0.9:
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
        payload.type != "CASH IN"
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
        payload.type in {"TRANSFER", "CASH OUT"}
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


def _risk_level(probability: float) -> str:
    if probability >= 0.75:
        return "High"
    if probability >= 0.4:
        return "Medium"
    return "Low"


@asynccontextmanager
async def lifespan(app: FastAPI):
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
        [key for key in ("random_forest", "xgboost") if key in model_registry],
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


@app.get("/", response_model=HealthResponse)
async def root_health() -> HealthResponse:
    loaded_models = [
        key for key in ("random_forest", "xgboost") if key in model_registry
    ]

    return HealthResponse(
        status="ok" if loaded_models else "degraded",
        models_loaded=loaded_models,
        feature_count=len(feature_columns),
    )


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return await root_health()


@app.post("/predict/primary", response_model=PredictionOutput)
async def predict_primary(payload: TransactionInput) -> PredictionOutput:
    available_models = {
        key: model_registry[key]
        for key in ("random_forest", "xgboost")
        if key in model_registry
    }

    if not available_models:
        raise HTTPException(
            status_code=503,
            detail="No compatible trained models could be loaded from backend/trained_models.",
        )

    raw_frame = pd.DataFrame(
        [
            {
                "step": payload.step,
                "type": payload.type,
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

    try:
        feature_matrix = build_feature_matrix(raw_frame)
        feature_matrix = _align_features(feature_matrix)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not preprocess the transaction payload: {exc}",
        ) from exc

    scores: dict[str, float] = {}
    for model_name, model in available_models.items():
        try:
            scores[model_name] = _predict_probability(model, feature_matrix)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Prediction failed for %s: %s", model_name, exc)

    if not scores:
        raise HTTPException(
            status_code=503,
            detail="Models were found, but none returned a usable probability.",
        )

    probability = float(np.mean(list(scores.values())))
    risk_level = _risk_level(probability)
    risk_factors = _build_risk_factors(payload, scores)

    if probability >= 0.5:
        explanation = (
            "The ensemble detected suspicious balance behaviour or a high-risk "
            "transaction profile."
        )
    else:
        explanation = (
            "The ensemble did not detect a strong fraud signal for this payload."
        )

    return PredictionOutput(
        probability=probability,
        is_fraud=probability >= 0.5,
        risk_level=risk_level,  # type: ignore[arg-type]
        explanation=explanation,
        risk_factors=risk_factors,
        models_used=list(scores.keys()),
        model_scores=scores,
    )
