from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    email: EmailStr
    password: str = Field(min_length=10, max_length=72)
    display_name: str = Field(min_length=2, max_length=80)
    institution: str | None = Field(default=None, max_length=160)

    @field_validator("display_name", "institution")
    @classmethod
    def _tidy(cls, value: str | None) -> str | None:
        if value is None:
            return None
        collapsed = " ".join(value.split())
        return collapsed or None


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class TokenPair(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: str
    refresh_expires_in: int


class RefreshRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    refresh_token: str = Field(min_length=16, max_length=256)


class LogoutRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    refresh_token: str | None = Field(default=None, max_length=256)
    everywhere: bool = False


class PasswordChangeRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=10, max_length=72)


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    display_name: str | None = Field(default=None, min_length=2, max_length=80)
    institution: str | None = Field(default=None, max_length=160)

    @field_validator("display_name", "institution")
    @classmethod
    def _tidy(cls, value: str | None) -> str | None:
        if value is None:
            return None
        collapsed = " ".join(value.split())
        return collapsed or None


class StudentProfile(BaseModel):
    id: int
    email: EmailStr
    handle: str
    display_name: str
    institution: str | None
    cohort: str
    created_at: datetime
    last_login_at: datetime | None
    # None until the two sign-up questions are answered. The client uses that
    # to decide whether to ask; it must not treat it as "answered zero".
    math_level: int | None = None
    code_level: int | None = None


class OnboardingRequest(BaseModel):
    """The two questions asked once, after sign-up."""

    math_level: int = Field(ge=0, le=2)
    code_level: int = Field(ge=0, le=2)


class AuthResponse(BaseModel):
    user: StudentProfile
    tokens: TokenPair


class SessionInfo(BaseModel):
    id: int
    created_at: datetime
    last_used_at: datetime
    expires_at: datetime
    user_agent: str | None
    current: bool


class MessageResponse(BaseModel):
    detail: str
