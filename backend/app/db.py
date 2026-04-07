"""Lightweight sqlite3 helpers for app transaction persistence."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Optional

DB_PATH = Path(__file__).resolve().parents[1] / "data" / "app.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                email TEXT,
                password_hash TEXT,
                role TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                transaction_type TEXT NOT NULL,
                amount REAL NOT NULL,
                probability REAL,
                risk_score REAL NOT NULL,
                risk_level TEXT,
                decision TEXT NOT NULL,
                status TEXT,
                reason TEXT,
                created_at TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'web',
                requires_review INTEGER NOT NULL DEFAULT 0,
                raw_json TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_transactions_user_id
                ON transactions(user_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_created_at
                ON transactions(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_transactions_source
                ON transactions(source);
            """
        )


def transaction_count() -> int:
    with _connect() as conn:
        row = conn.execute("SELECT COUNT(1) AS count FROM transactions").fetchone()
    return int(row["count"] if row else 0)


def _password_hash_for_db(user: dict[str, Any]) -> str:
    salt = str(user.get("passwordSalt") or "").strip()
    digest = str(user.get("passwordHash") or "").strip()
    if salt and digest:
        return f"{salt}${digest}"
    return digest


def upsert_users(users: list[dict[str, Any]]) -> None:
    with _connect() as conn:
        for user in users:
            user_id = str(user.get("id") or "").strip()
            username = str(user.get("username") or "").strip()
            if not user_id or not username:
                continue

            conn.execute(
                """
                INSERT INTO users (id, username, email, password_hash, role)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    username = excluded.username,
                    email = excluded.email,
                    password_hash = excluded.password_hash,
                    role = excluded.role
                """,
                (
                    user_id,
                    username,
                    str(user.get("email") or "").strip() or None,
                    _password_hash_for_db(user) or None,
                    str(user.get("role") or "user").strip() or "user",
                ),
            )


def _risk_level_from_score(risk_score: float) -> str:
    if risk_score >= 70:
        return "High"
    if risk_score >= 35:
        return "Medium"
    return "Low"


def _probability_for_db(record: dict[str, Any]) -> float:
    model_scores = record.get("modelScores")
    if isinstance(model_scores, dict):
        for key in ("random_forest", "primary"):
            value = model_scores.get(key)
            if isinstance(value, (int, float)):
                return max(0.0, min(1.0, float(value)))

    risk_score = float(record.get("riskScore") or 0.0)
    return max(0.0, min(1.0, risk_score / 100.0))


def _reason_for_db(record: dict[str, Any]) -> str:
    reasons = record.get("reasons")
    if isinstance(reasons, list):
        cleaned = [str(item).strip() for item in reasons if str(item).strip()]
        return " | ".join(cleaned)
    if isinstance(reasons, str):
        return reasons.strip()
    return ""


def _requires_review(record: dict[str, Any]) -> int:
    review_state = str(record.get("reviewState") or "").upper()
    decision = str(record.get("decision") or "").upper()
    status = str(record.get("status") or "").lower()
    if review_state == "PENDING_ADMIN_REVIEW":
        return 1
    if decision == "PENDING_ADMIN_REVIEW":
        return 1
    if status == "pending_review":
        return 1
    return 0


def upsert_transactions(records: list[dict[str, Any]]) -> None:
    with _connect() as conn:
        for record in records:
            tx_id = str(record.get("id") or "").strip()
            owner_id = str(record.get("ownerId") or "").strip()
            tx_type = str(record.get("type") or "").strip()
            if not tx_id or not owner_id or not tx_type:
                continue

            # Ensure legacy owner references do not fail FK checks during migration.
            conn.execute(
                """
                INSERT OR IGNORE INTO users (id, username, email, password_hash, role)
                VALUES (?, ?, NULL, NULL, 'user')
                """,
                (owner_id, f"user_{owner_id}"),
            )

            risk_score = float(record.get("riskScore") or 0.0)
            probability = _probability_for_db(record)
            risk_level = str(record.get("backendRiskLevel") or "").strip()
            if not risk_level:
                risk_level = _risk_level_from_score(risk_score)

            conn.execute(
                """
                INSERT INTO transactions (
                    id,
                    user_id,
                    transaction_type,
                    amount,
                    probability,
                    risk_score,
                    risk_level,
                    decision,
                    status,
                    reason,
                    created_at,
                    source,
                    requires_review,
                    raw_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    user_id = excluded.user_id,
                    transaction_type = excluded.transaction_type,
                    amount = excluded.amount,
                    probability = excluded.probability,
                    risk_score = excluded.risk_score,
                    risk_level = excluded.risk_level,
                    decision = excluded.decision,
                    status = excluded.status,
                    reason = excluded.reason,
                    created_at = excluded.created_at,
                    source = excluded.source,
                    requires_review = excluded.requires_review,
                    raw_json = excluded.raw_json
                """,
                (
                    tx_id,
                    owner_id,
                    tx_type,
                    float(record.get("amount") or 0.0),
                    probability,
                    risk_score,
                    risk_level,
                    str(record.get("decision") or "").strip(),
                    str(record.get("status") or "").strip() or None,
                    _reason_for_db(record) or None,
                    str(record.get("createdAt") or "").strip(),
                    str(record.get("source") or "web").strip() or "web",
                    _requires_review(record),
                    json.dumps(record, ensure_ascii=True),
                ),
            )


def fetch_transactions(owner_id: Optional[str] = None) -> list[dict[str, Any]]:
    query = "SELECT raw_json FROM transactions"
    params: tuple[Any, ...] = ()

    if owner_id is not None:
        query += " WHERE user_id = ?"
        params = (owner_id,)

    query += " ORDER BY created_at DESC"

    with _connect() as conn:
        rows = conn.execute(query, params).fetchall()

    records: list[dict[str, Any]] = []
    for row in rows:
        raw_payload = row["raw_json"]
        if not raw_payload:
            continue
        try:
            payload = json.loads(raw_payload)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            records.append(payload)
    return records
