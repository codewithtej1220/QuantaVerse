from __future__ import annotations

import hashlib
import os
import secrets
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

APP_NAME = "QuantaVerse API"
APP_VERSION = "1.1.0"
TEAM = "Team Naturalz"

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATABASE_PATH = BACKEND_ROOT / "quantaverse.db"

load_dotenv(BACKEND_ROOT / ".env")

TRUTHY = {"1", "true", "yes", "on"}


def _split(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def _flag(raw: str, default: bool) -> bool:
    value = raw.strip().lower()
    if not value:
        return default
    return value in TRUTHY


def _signing_key(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


class Settings:
    def __init__(self) -> None:
        self.app_name = APP_NAME
        self.version = APP_VERSION
        self.team = TEAM
        self.host = os.getenv("QUANTAVERSE_HOST", "127.0.0.1")
        self.port = int(os.getenv("QUANTAVERSE_PORT", "8000"))
        self.allowed_origins = _split(os.getenv("QUANTAVERSE_ALLOWED_ORIGINS", "*")) or ["*"]
        self.default_backend = os.getenv("QUANTAVERSE_DEFAULT_BACKEND", "qiskit")
        self.default_shots = int(os.getenv("QUANTAVERSE_DEFAULT_SHOTS", "1024"))
        self.sandbox_timeout = float(os.getenv("QUANTAVERSE_SANDBOX_TIMEOUT", "5"))
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.openai_base_url = os.getenv("OPENAI_BASE_URL", "").strip() or None
        self.openai_model = os.getenv("QUANTAVERSE_TUTOR_MODEL", "gpt-4o-mini")
        self.openai_temperature = float(os.getenv("QUANTAVERSE_TUTOR_TEMPERATURE", "0.3"))
        self.openai_max_tokens = int(os.getenv("QUANTAVERSE_TUTOR_MAX_TOKENS", "700"))

        self.database_url = (
            os.getenv("QUANTAVERSE_DATABASE_URL", "").strip()
            or f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}"
        )
        self.database_echo = _flag(os.getenv("QUANTAVERSE_DATABASE_ECHO", ""), False)
        self.jwt_algorithm = "HS256"
        configured_secret = os.getenv("QUANTAVERSE_JWT_SECRET", "").strip()
        self.jwt_secret = _signing_key(configured_secret or secrets.token_urlsafe(48))
        self.jwt_secret_ephemeral = not configured_secret
        self.access_token_minutes = int(os.getenv("QUANTAVERSE_ACCESS_TOKEN_MINUTES", "30"))
        self.refresh_token_days = int(os.getenv("QUANTAVERSE_REFRESH_TOKEN_DAYS", "30"))
        self.max_sessions_per_user = int(os.getenv("QUANTAVERSE_MAX_SESSIONS", "10"))
        self.registration_open = _flag(os.getenv("QUANTAVERSE_REGISTRATION_OPEN", ""), True)

    @property
    def tutor_live(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def database_kind(self) -> str:
        return self.database_url.split(":", 1)[0].split("+", 1)[0]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
