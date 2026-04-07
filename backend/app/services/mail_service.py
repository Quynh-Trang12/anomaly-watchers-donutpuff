"""FastAPI-Mail integration for localhost-friendly transactional email sending."""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from typing import Optional

try:  # pragma: no cover - import guard for environments without dependency
    from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
except Exception:  # pragma: no cover - handled at runtime with configuration error
    ConnectionConfig = None  # type: ignore[assignment]
    FastMail = None  # type: ignore[assignment]
    MessageSchema = None  # type: ignore[assignment]
    MessageType = None  # type: ignore[assignment]

logger = logging.getLogger("anomaly_watchers.mail")


class MailConfigurationError(RuntimeError):
    """Raised when local/test mail configuration is incomplete."""


class MailSendError(RuntimeError):
    """Raised when configured mail provider rejects or fails to send."""


@dataclass
class MailRuntimeConfig:
    username: str
    password: str
    sender: str
    sender_name: str
    server: str
    port: int
    starttls: bool
    ssl_tls: bool
    use_credentials: bool
    validate_certs: bool
    provider_label: str


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _load_runtime_config() -> MailRuntimeConfig:
    sender = (
        os.getenv("MAIL_FROM")
        or os.getenv("GMAIL_SENDER_EMAIL")
        or "alerts@anomalywatchers.dev"
    ).strip()
    server = (os.getenv("MAIL_SERVER") or "127.0.0.1").strip()
    port_value = (os.getenv("MAIL_PORT") or "").strip()

    try:
        port = int(port_value) if port_value else 1025
    except ValueError as exc:
        raise MailConfigurationError(
            "MAIL_PORT must be a valid integer."
        ) from exc

    use_credentials = _env_bool("MAIL_USE_CREDENTIALS", False)
    username = (os.getenv("MAIL_USERNAME") or "").strip()
    password = (os.getenv("MAIL_PASSWORD") or "").strip()

    if use_credentials and (not username or not password):
        raise MailConfigurationError(
            "MAIL_USE_CREDENTIALS is enabled but MAIL_USERNAME/MAIL_PASSWORD are missing."
        )

    if not use_credentials:
        # FastAPI-Mail still expects string values for username/password.
        username = username or "mailhog"
        password = password or "mailhog"

    sender_name = (os.getenv("MAIL_FROM_NAME") or "AnomalyWatchers").strip()
    provider_label = (os.getenv("MAIL_PROVIDER") or "fastapi_mail").strip()

    return MailRuntimeConfig(
        username=username,
        password=password,
        sender=sender,
        sender_name=sender_name,
        server=server,
        port=port,
        starttls=_env_bool("MAIL_STARTTLS", True),
        ssl_tls=_env_bool("MAIL_SSL_TLS", False),
        use_credentials=use_credentials,
        validate_certs=_env_bool("MAIL_VALIDATE_CERTS", False),
        provider_label=provider_label,
    )


def _build_connection(config: MailRuntimeConfig):
    if ConnectionConfig is None:
        raise MailConfigurationError(
            "fastapi-mail is not installed. Install backend requirements first."
        )

    return ConnectionConfig(
        MAIL_USERNAME=config.username,
        MAIL_PASSWORD=config.password,
        MAIL_FROM=config.sender,
        MAIL_PORT=config.port,
        MAIL_SERVER=config.server,
        MAIL_FROM_NAME=config.sender_name,
        MAIL_STARTTLS=config.starttls,
        MAIL_SSL_TLS=config.ssl_tls,
        USE_CREDENTIALS=config.use_credentials,
        VALIDATE_CERTS=config.validate_certs,
    )


async def send_email(
    recipient: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
) -> str:
    """Send a single transactional email through FastAPI-Mail."""
    target = recipient.strip()
    if "@" not in target:
        raise MailSendError("Recipient email is invalid.")

    config = _load_runtime_config()
    connection = _build_connection(config)

    assert MessageSchema is not None and MessageType is not None and FastMail is not None
    message = MessageSchema(
        subject=subject,
        recipients=[target],
        body=body_html if body_html else body_text,
        subtype=MessageType.html if body_html else MessageType.plain,
    )

    try:
        mailer = FastMail(connection)
        await mailer.send_message(message)
    except Exception as exc:
        logger.error("FastAPI-Mail send failed: %s", exc)
        raise MailSendError(
            f"Could not send email via FastAPI-Mail provider: {exc}"
        ) from exc

    return f"{config.provider_label}-{int(time.time() * 1000)}"
