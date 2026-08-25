from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import TokenError, decode_access_token
from app.db.models import User
from app.db.session import get_session

bearer_scheme = HTTPBearer(auto_error=False, description="QuantaVerse access token")

UNAUTHORISED_HEADERS = {"WWW-Authenticate": "Bearer"}

DatabaseSession = Annotated[Session, Depends(get_session)]
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]


def _reject(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers=UNAUTHORISED_HEADERS,
    )


def _load(session: Session, token: str) -> User:
    try:
        claims = decode_access_token(token)
    except TokenError as error:
        raise _reject(error.message) from error

    try:
        user_id = int(claims["sub"])
    except (KeyError, TypeError, ValueError) as error:
        raise _reject("that token has no account on it") from error

    user = session.get(User, user_id)
    if user is None:
        raise _reject("that account no longer exists")
    if not user.is_active:
        raise _reject("that account has been deactivated")
    return user


def current_user(session: DatabaseSession, credentials: Credentials) -> User:
    if credentials is None or not credentials.credentials:
        raise _reject("sign in to use this endpoint")
    return _load(session, credentials.credentials)


def optional_user(session: DatabaseSession, credentials: Credentials) -> User | None:
    if credentials is None or not credentials.credentials:
        return None
    try:
        return _load(session, credentials.credentials)
    except HTTPException:
        return None


def client_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


def access_jti(credentials: Credentials) -> str | None:
    if credentials is None or not credentials.credentials:
        return None
    try:
        return decode_access_token(credentials.credentials).get("jti")
    except TokenError:
        return None


CurrentUser = Annotated[User, Depends(current_user)]
OptionalUser = Annotated[User | None, Depends(optional_user)]
ClientAgent = Annotated[str | None, Depends(client_agent)]
AccessJti = Annotated[str | None, Depends(access_jti)]
