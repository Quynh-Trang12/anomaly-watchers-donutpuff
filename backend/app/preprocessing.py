"""
Data preprocessing pipeline for the Anomaly Watchers Donutpuff backend.
Handles feature engineering, normalization, and categorical encoding.
"""

from __future__ import annotations

import pandas as pd  # type: ignore
import numpy as np  # type: ignore


def rename_to_snake_case(df: pd.DataFrame) -> pd.DataFrame:
    COLUMN_MAP = {
        "step": "step",
        "type": "transaction_type",
        "amount": "transaction_amount",
        "nameOrig": "originator_id",
        "oldbalanceOrg": "originator_old_balance",
        "newbalanceOrig": "originator_new_balance",
        "nameDest": "destination_id",
        "oldbalanceDest": "destination_old_balance",
        "newbalanceDest": "destination_new_balance",
        "isFraud": "is_fraud",
        "isFlaggedFraud": "is_flagged_fraud",
    }
    return df.rename(columns=COLUMN_MAP)


def drop_post_transaction_leaks(df: pd.DataFrame) -> pd.DataFrame:
    LEAKED_COLUMNS = [
        "originator_new_balance",
        "destination_new_balance",
        "is_flagged_fraud",
    ]
    return df.drop(columns=[c for c in LEAKED_COLUMNS if c in df.columns])


def engineer_financial_ratios(df):
    """Construct ratio features expressing transaction magnitude relative to account balances."""
    df = df.copy()

    # 1. Amount to Destination Ratio (Detecting Mule Inflows)
    df["amount_to_destination_ratio"] = df["transaction_amount"] / (
        df["destination_old_balance"] + 1.0
    )

    # 2. Account Drain Ratio (Detecting Account Takeovers)
    df["account_drain_ratio"] = df["transaction_amount"] / (
        df["originator_old_balance"] + 1.0
    )
    return df


def apply_logarithmic_transforms(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["log_transaction_amount"] = np.log1p(df["transaction_amount"])
    return df


def apply_cyclical_time_encoding(df: pd.DataFrame) -> pd.DataFrame:
    HOURS_IN_DAY = 24
    df = df.copy()
    df["time_hour_sin"] = np.sin(2 * np.pi * df["step"] / HOURS_IN_DAY)
    df["time_hour_cos"] = np.cos(2 * np.pi * df["step"] / HOURS_IN_DAY)
    return df


RAW_COLUMNS_TO_DROP = ["transaction_amount", "step"]


def drop_redundant_raw_columns(df):
    """Remove original raw columns superseded by engineered features."""
    return df.drop(columns=RAW_COLUMNS_TO_DROP)


def encode_categoricals_and_drop_identifiers(df: pd.DataFrame) -> pd.DataFrame:
    DUMMY_RENAME = {
        "transaction_type_CASH_OUT": "is_type_cash_out",
        "transaction_type_DEBIT": "is_type_debit",
        "transaction_type_PAYMENT": "is_type_payment",
        "transaction_type_TRANSFER": "is_type_transfer",
    }

    if "transaction_type" in df.columns:
        df = pd.get_dummies(df, columns=["transaction_type"], dtype=int)

    if "transaction_type_CASH_IN" in df.columns:
        df = df.drop(columns=["transaction_type_CASH_IN"])

    df = df.rename(columns=DUMMY_RENAME)
    df = df.drop(columns=["originator_id", "destination_id"], errors="ignore")

    # Defense against missing dummies in streaming chunks or single API payloads
    for col in DUMMY_RENAME.values():
        if col not in df.columns:
            df[col] = 0

    # Standardize column order
    expected_order = [
        "originator_old_balance",
        "destination_old_balance",
        "is_fraud",
        "amount_to_destination_ratio",
        "account_drain_ratio",
        "log_transaction_amount",
        "time_hour_sin",
        "time_hour_cos",
        "is_type_cash_out",
        "is_type_debit",
        "is_type_payment",
        "is_type_transfer",
    ]

    # If training data (has target), put it at the front. If API inference, ignore it.
    if "is_fraud" in df.columns:
        expected_order.insert(0, "is_fraud")

    return df[expected_order]


def build_feature_matrix(df_raw: pd.DataFrame) -> pd.DataFrame:
    """
    Master pipeline execution function.
    Ingests raw PaySim data and outputs the hardened 12-feature matrix.
    """
    return (
        df_raw.copy()
        .pipe(rename_to_snake_case)
        .pipe(drop_post_transaction_leaks)
        .pipe(engineer_financial_ratios)
        .pipe(apply_logarithmic_transforms)
        .pipe(apply_cyclical_time_encoding)
        .pipe(drop_redundant_raw_columns)
        .pipe(encode_categoricals_and_drop_identifiers)
    )
