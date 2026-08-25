from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import unicodedata
from datetime import timedelta
from typing import Any

import bcrypt
import jwt

from app.core.clock import epoch, utcnow
from app.core.config import get_settings

BCRYPT_ROUNDS = 12
BCRYPT_MAX_BYTES = 72
MIN_PASSWORD_LENGTH = 10
REFRESH_TOKEN_BYTES = 48
ISSUER = "quantaverse"
DUMMY_HASH = "$2b$12$bwihuOHsroGfluRVej2wzuvoaG6Y2txaP/B7SvQtQEbCuhb1plhce"


class TokenError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class PasswordError(ValueError):
    pass


def normalise_email(email: str) -> str:
    return email.strip().lower()


def handle_from_email(email: str) -> str:
    local = normalise_email(email).split("@")[0]
    folded = unicodedata.normalize("NFKD", local).encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^a-z0-9._-]+", ".", folded.lower()).strip("._-")
    collapsed = re.sub(r"\.{2,}", ".", cleaned)
    return collapsed[:24] or "learner"


def validate_password(password: str, *, email: str | None = None) -> str:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise PasswordError(
            f"a password needs at least {MIN_PASSWORD_LENGTH} characters"
        )
    if len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise PasswordError(
            f"that password is longer than bcrypt can hash — keep it under {BCRYPT_MAX_BYTES} bytes"
        )
    classes = sum(
        (
            any(character.islower() for character in password),
            any(character.isupper() for character in password),
            any(character.isdigit() for character in password),
            any(not character.isalnum() for character in password),
        )
    )
    if classes < 2:
        raise PasswordError(
            "mix at least two kinds of character — letters with digits or punctuation"
        )
    if email and password.strip().lower() == normalise_email(email).split("@")[0]:
        raise PasswordError("that password is just your email address")
    return password


def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    ).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except (ValueError, TypeError):
        return False


def dummy_verify() -> None:
    verify_password("quantaverse-timing-equaliser", DUMMY_HASH)


def create_access_token(user_id: int, *, handle: str) -> tuple[str, int, str]:
    settings = get_settings()
    issued = utcnow()
    expires = issued + timedelta(minutes=settings.access_token_minutes)
    jti = secrets.token_urlsafe(12)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "handle": handle,
        "typ": "access",
        "iss": ISSUER,
        "jti": jti,
        "iat": epoch(issued),
        "exp": epoch(expires),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, settings.access_token_minutes * 60, jti


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            issuer=ISSUER,
            options={"require": ["exp", "iat", "sub", "typ"]},
        )
    except jwt.ExpiredSignatureError as error:
        raise TokenError("that session has expired — sign in again") from error
    except jwt.InvalidTokenError as error:
        raise TokenError("that token is not valid for this service") from error

    if payload.get("typ") != "access":
        raise TokenError("that is not an access token")
    return payload


def new_refresh_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(REFRESH_TOKEN_BYTES)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.strip().encode("utf-8")).hexdigest()


def tokens_match(left: str, right: str) -> bool:
    return hmac.compare_digest(left, right)
