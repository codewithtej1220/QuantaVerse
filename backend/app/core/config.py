from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()

APP_NAME = "QuantaVerse API"
APP_VERSION = "1.0.0"
TEAM = "Team Naturalz"


def _split(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


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

    @property
    def tutor_live(self) -> bool:
        return bool(self.openai_api_key)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
