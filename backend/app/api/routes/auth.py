from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.deps import AccessJti, ClientAgent, CurrentUser, DatabaseSession
from app.core.config import get_settings
from app.core.security import PasswordError
from app.models.auth import (
    AuthResponse,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    PasswordChangeRequest,
    ProfileUpdate,
    RefreshRequest,
    RegisterRequest,
    SessionInfo,
    StudentProfile,
)
from app.services import accounts
from app.services.progress import profile_of

router = APIRouter(prefix="/api/auth", tags=["accounts"])


@router.post(
    "/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED
)
def register(
    payload: RegisterRequest, session: DatabaseSession, user_agent: ClientAgent
) -> AuthResponse:
    settings = get_settings()
    if not settings.registration_open:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="registration is closed on this instance",
        )

    try:
        user = accounts.create_user(
            session,
            email=str(payload.email),
            password=payload.password,
            display_name=payload.display_name,
            institution=payload.institution,
        )
    except PasswordError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
    except accounts.EmailTakenError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="that email already has an account — sign in instead",
        ) from error

    tokens = accounts.issue_tokens(session, user, user_agent=user_agent)
    return AuthResponse(user=profile_of(user), tokens=tokens)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest, session: DatabaseSession, user_agent: ClientAgent
) -> AuthResponse:
    try:
        user = accounts.authenticate(
            session, email=str(payload.email), password=payload.password
        )
    except accounts.CredentialsError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="that email and password do not match an account",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
    except accounts.InactiveAccountError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="that account is deactivated"
        ) from error

    tokens = accounts.issue_tokens(session, user, user_agent=user_agent)
    return AuthResponse(user=profile_of(user), tokens=tokens)


@router.post("/refresh", response_model=AuthResponse)
def refresh(
    payload: RefreshRequest, session: DatabaseSession, user_agent: ClientAgent
) -> AuthResponse:
    try:
        user, tokens = accounts.rotate_refresh(
            session, payload.refresh_token, user_agent=user_agent
        )
    except accounts.RefreshError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error.message,
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    return AuthResponse(user=profile_of(user), tokens=tokens)


@router.post("/logout", response_model=MessageResponse)
def logout(
    payload: LogoutRequest, user: CurrentUser, session: DatabaseSession
) -> MessageResponse:
    if payload.everywhere:
        count = accounts.revoke_all(session, user.id)
        noun = "session" if count == 1 else "sessions"
        return MessageResponse(detail=f"signed out of {count} {noun}")

    if payload.refresh_token and accounts.revoke_one(session, user, payload.refresh_token):
        return MessageResponse(detail="signed out of this session")

    return MessageResponse(
        detail="that session was already closed — the access token expires on its own"
    )


@router.get("/me", response_model=StudentProfile)
def me(user: CurrentUser) -> StudentProfile:
    return profile_of(user)


@router.patch("/me", response_model=StudentProfile)
def update_me(
    payload: ProfileUpdate, user: CurrentUser, session: DatabaseSession
) -> StudentProfile:
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.institution is not None:
        user.institution = payload.institution
    session.commit()
    return profile_of(user)


@router.post("/password", response_model=AuthResponse)
def change_password(
    payload: PasswordChangeRequest,
    user: CurrentUser,
    session: DatabaseSession,
    user_agent: ClientAgent,
) -> AuthResponse:
    try:
        accounts.change_password(
            session,
            user,
            current=payload.current_password,
            replacement=payload.new_password,
        )
    except accounts.CredentialsError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="that is not your current password",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
    except PasswordError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error

    accounts.revoke_all(session, user.id)
    tokens = accounts.issue_tokens(session, user, user_agent=user_agent)
    return AuthResponse(user=profile_of(user), tokens=tokens)


@router.get("/sessions", response_model=list[SessionInfo])
def sessions(user: CurrentUser, session: DatabaseSession, jti: AccessJti) -> list[SessionInfo]:
    return accounts.list_sessions(session, user, current_jti=jti)
