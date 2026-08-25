from __future__ import annotations

from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.clock import as_utc, utcnow
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    dummy_verify,
    handle_from_email,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    normalise_email,
    validate_password,
    verify_password,
)
from app.db.models import AuthSession, User
from app.models.auth import SessionInfo, TokenPair


class EmailTakenError(Exception):
    def __init__(self, email: str) -> None:
        super().__init__(email)
        self.email = email


class CredentialsError(Exception):
    pass


class InactiveAccountError(Exception):
    pass


class RefreshError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def unique_handle(session: Session, email: str) -> str:
    base = handle_from_email(email)
    candidate = base
    suffix = 2
    while session.scalars(select(User.id).where(User.handle == candidate)).first():
        candidate = f"{base[:20]}.{suffix}"
        suffix += 1
    return candidate


def find_by_email(session: Session, email: str) -> User | None:
    return session.scalars(
        select(User).where(User.email == normalise_email(email))
    ).first()


def create_user(
    session: Session,
    *,
    email: str,
    password: str,
    display_name: str,
    institution: str | None = None,
) -> User:
    address = normalise_email(email)
    validate_password(password, email=address)

    if find_by_email(session, address) is not None:
        raise EmailTakenError(address)

    user = User(
        email=address,
        handle=unique_handle(session, address),
        display_name=display_name.strip(),
        password_hash=hash_password(password),
        institution=institution,
    )
    session.add(user)
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise EmailTakenError(address) from error

    session.refresh(user)
    return user


def authenticate(session: Session, *, email: str, password: str) -> User:
    user = find_by_email(session, email)
    if user is None:
        dummy_verify()
        raise CredentialsError()
    if not verify_password(password, user.password_hash):
        raise CredentialsError()
    if not user.is_active:
        raise InactiveAccountError()

    user.last_login_at = utcnow()
    session.commit()
    return user


def change_password(session: Session, user: User, *, current: str, replacement: str) -> None:
    if not verify_password(current, user.password_hash):
        raise CredentialsError()

    validate_password(replacement, email=user.email)
    user.password_hash = hash_password(replacement)
    session.commit()


def prune_sessions(session: Session, user: User) -> None:
    settings = get_settings()
    now = utcnow()

    session.execute(
        delete(AuthSession).where(
            AuthSession.user_id == user.id, AuthSession.expires_at <= now
        )
    )

    live = list(
        session.scalars(
            select(AuthSession)
            .where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
            .order_by(AuthSession.last_used_at.desc())
        )
    )
    for stale in live[settings.max_sessions_per_user :]:
        stale.revoked_at = now

    session.commit()


def issue_tokens(session: Session, user: User, *, user_agent: str | None = None) -> TokenPair:
    settings = get_settings()
    raw, digest = new_refresh_token()
    access, expires_in, jti = create_access_token(user.id, handle=user.handle)
    lifetime = timedelta(days=settings.refresh_token_days)
    record = AuthSession(
        user_id=user.id,
        token_hash=digest,
        user_agent=(user_agent or "")[:200] or None,
        expires_at=utcnow() + lifetime,
        access_jti=jti,
    )
    session.add(record)
    session.commit()
    prune_sessions(session, user)

    return TokenPair(
        access_token=access,
        expires_in=expires_in,
        refresh_token=raw,
        refresh_expires_in=int(lifetime.total_seconds()),
    )


def rotate_refresh(
    session: Session, raw_token: str, *, user_agent: str | None = None
) -> tuple[User, TokenPair]:
    digest = hash_refresh_token(raw_token)
    record = session.scalars(
        select(AuthSession).where(AuthSession.token_hash == digest)
    ).first()

    if record is None:
        raise RefreshError("that refresh token is not on file — sign in again")

    now = utcnow()

    if record.revoked_at is not None:
        revoke_all(session, record.user_id)
        raise RefreshError(
            "that refresh token was already used, so every session for this account was signed out"
        )

    if record.expires_at <= now:
        record.revoked_at = now
        session.commit()
        raise RefreshError("that refresh token has expired — sign in again")

    user = session.get(User, record.user_id)
    if user is None or not user.is_active:
        record.revoked_at = now
        session.commit()
        raise RefreshError("that account is no longer active")

    raw, replacement = new_refresh_token()
    settings = get_settings()
    lifetime = timedelta(days=settings.refresh_token_days)
    access, expires_in, jti = create_access_token(user.id, handle=user.handle)

    record.revoked_at = now
    record.replaced_by = replacement
    session.add(
        AuthSession(
            user_id=user.id,
            token_hash=replacement,
            user_agent=(user_agent or record.user_agent or "")[:200] or None,
            expires_at=now + lifetime,
            access_jti=jti,
        )
    )
    session.commit()

    return user, TokenPair(
        access_token=access,
        expires_in=expires_in,
        refresh_token=raw,
        refresh_expires_in=int(lifetime.total_seconds()),
    )


def revoke_one(session: Session, user: User, raw_token: str) -> bool:
    digest = hash_refresh_token(raw_token)
    record = session.scalars(
        select(AuthSession).where(
            AuthSession.token_hash == digest,
            AuthSession.user_id == user.id,
            AuthSession.revoked_at.is_(None),
        )
    ).first()

    if record is None:
        return False

    record.revoked_at = utcnow()
    session.commit()
    return True


def revoke_all(session: Session, user_id: int) -> int:
    now = utcnow()
    live = list(
        session.scalars(
            select(AuthSession).where(
                AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None)
            )
        )
    )
    for record in live:
        record.revoked_at = now
    session.commit()
    return len(live)


def list_sessions(
    session: Session, user: User, *, current_jti: str | None = None
) -> list[SessionInfo]:
    rows = session.scalars(
        select(AuthSession)
        .where(
            AuthSession.user_id == user.id,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > utcnow(),
        )
        .order_by(AuthSession.last_used_at.desc())
    )
    return [
        SessionInfo(
            id=row.id,
            created_at=as_utc(row.created_at),
            last_used_at=as_utc(row.last_used_at),
            expires_at=as_utc(row.expires_at),
            user_agent=row.user_agent,
            current=bool(current_jti and row.access_jti == current_jti),
        )
        for row in rows
    ]
