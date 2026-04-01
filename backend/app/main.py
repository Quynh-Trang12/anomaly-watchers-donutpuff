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
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
    "feature_columns": ["feature_columns.pkl"],
}

model_registry: dict[str, Any] = {}
feature_columns: list[str] = []


def _transaction_type_value(raw_type: Any) -> str:
    if hasattr(raw_type, "value"):
        return str(raw_type.value)
    return str(raw_type)


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


def _align_to_columns(matrix: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    aligned = matrix.copy()

    for column in columns:
        if column not in aligned.columns:
            aligned[column] = 0

    return aligned[columns]


def _predict_probability(model: Any, matrix: Any) -> float:
    if hasattr(model, "predict_proba"):
        raw_output = np.asarray(model.predict_proba(matrix))
        raw_value = raw_output[0][-1] if raw_output.ndim > 1 else raw_output[0]
    elif hasattr(model, "predict"):
        raw_output = np.asarray(model.predict(matrix))
        raw_value = raw_output[0][-1] if raw_output.ndim > 1 else raw_output[0]
    else:
        raise ValueError("Model does not expose predict_proba or predict.")

    probability = float(raw_value)

    if not np.isfinite(probability):
        probability = 0.0

    return max(0.0, min(1.0, probability))


def _predict_with_fallbacks(model: Any, matrix: pd.DataFrame) -> float:
    candidates: list[Any] = []

    if hasattr(model, "feature_names_in_"):
        model_columns = [str(column) for column in model.feature_names_in_]
        candidates.append(_align_to_columns(matrix, model_columns))

    candidates.append(_align_features(matrix))
    candidates.append(matrix.drop(columns=["is_fraud"], errors="ignore"))

    seen_signatures: set[tuple[Any, ...]] = set()

    for candidate in candidates:
        if isinstance(candidate, pd.DataFrame):
            signature = tuple(candidate.columns)
        else:
            signature = ("ndarray", np.asarray(candidate).shape)

        if signature in seen_signatures:
            continue
        seen_signatures.add(signature)

        try:
            return _predict_probability(model, candidate)
        except Exception:
            if isinstance(candidate, pd.DataFrame):
                try:
                    return _predict_probability(model, candidate.to_numpy())
                except Exception:
                    continue

    raise ValueError("All feature alignment strategies failed for this model.")


def _build_risk_factors(
    payload: TransactionInput,
    scores: dict[str, float],
) -> list[RiskFactor]:
    factors: list[RiskFactor] = []
    transaction_type = _transaction_type_value(payload.type)

    amount_to_balance = payload.amount / max(payload.oldbalanceOrg, 1.0)

    if payload.amount >= 150000:
        factors.append(
            RiskFactor(
                factor=f"High transaction amount detected at {payload.amount:,.2f}.",
                severity="warning",
            )
        )

    if transaction_type in {"TRANSFER", "CASH OUT"} and amount_to_balance >= 0.9:
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
        transaction_type != "CASH IN"
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
        transaction_type in {"TRANSFER", "CASH OUT"}
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


def _heuristic_probability(payload: TransactionInput) -> float:
    transaction_type = _transaction_type_value(payload.type)
    amount_to_balance = payload.amount / max(payload.oldbalanceOrg, 1.0)
    probability = 0.08

    if payload.amount >= 150000:
        probability += 0.22

    if transaction_type in {"TRANSFER", "CASH OUT"}:
        probability += 0.12

    if amount_to_balance >= 0.9:
        probability += 0.26
    elif amount_to_balance >= 0.5:
        probability += 0.12

    if (
        transaction_type != "CASH IN"
        and payload.newbalanceOrig == 0
        and payload.amount > 0
    ):
        probability += 0.18

    if (
        transaction_type in {"TRANSFER", "CASH OUT"}
        and payload.oldbalanceDest == 0
        and payload.amount >= 50000
    ):
        probability += 0.14

    return max(0.0, min(0.99, probability))


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
        [key for key in ("random_forest",) if key in model_registry],
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


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    logger.exception("Unhandled API error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.get("/", response_model=HealthResponse)
async def root_health() -> HealthResponse:
    loaded_models = [key for key in ("random_forest",) if key in model_registry]

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
        for key in ("random_forest",)
        if key in model_registry
    }

    if not available_models:
        raise HTTPException(
            status_code=503,
            detail="No compatible trained models could be loaded from backend/trained_models.",
        )

    try:
        raw_frame = pd.DataFrame(
            [
                {
                    "step": payload.step,
                    "type": _transaction_type_value(payload.type),
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

        feature_matrix = build_feature_matrix(raw_frame)
        scores: dict[str, float] = {}

        for model_name, model in available_models.items():
            try:
                scores[model_name] = _predict_with_fallbacks(model, feature_matrix)
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.warning("Prediction failed for %s: %s", model_name, exc)

        if scores:
            probability = float(np.mean(list(scores.values())))
            explanation = (
                "The fraud detector identified suspicious balance behaviour or a high-risk "
                "transaction profile."
                if probability >= 0.5
                else "The fraud detector did not detect a strong fraud signal for this payload."
            )
        else:
            probability = _heuristic_probability(payload)
            explanation = (
                "The saved models could not score this payload, so a conservative "
                "heuristic fallback was used based on transaction size and balance behaviour."
            )

        risk_level = _risk_level(probability)
        risk_factors = _build_risk_factors(payload, scores)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Primary prediction failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return PredictionOutput(
        probability=probability,
        is_fraud=probability >= 0.5,
        risk_level=risk_level,  # type: ignore[arg-type]
        explanation=explanation,
        risk_factors=risk_factors,
        models_used=list(scores.keys()),
        model_scores=scores,
    )
