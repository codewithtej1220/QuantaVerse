from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

"""
Wire shapes for the research hub.

Everything here is deliberately narrower than the database row. A directory
listing is public to signed-in members, so it carries a handle and a headline
and never an email address — a hub where browsing people hands out their inbox
is a spam list, not a directory.
"""

Role = Literal["student", "mentor"]
Status = Literal["pending", "accepted", "declined"]
"""How the viewer stands with a person, from the viewer's side of the row."""
Standing = Literal["none", "self", "connected", "awaiting_them", "awaiting_you", "declined"]


def _tidy(value: str | None) -> str | None:
    if value is None:
        return None
    collapsed = " ".join(value.split())
    return collapsed or None


class PersonCard(BaseModel):
    """One row of the directory."""

    id: int
    handle: str
    display_name: str
    role: Role
    institution: str | None = None
    headline: str | None = None
    interests: list[str] = Field(default_factory=list)
    open_to_mentoring: bool = False
    # The expanded profile, shown when a row is opened. Optional throughout —
    # a card with none of it set still renders, just shorter.
    position: str | None = None
    education: str | None = None
    focus: str | None = None
    mentoring: str | None = None
    availability: str | None = None
    # A seeded example profile so a fresh install has a directory to browse.
    # Surfaced so the UI can say so on the card — a fixture that looks like a
    # real academic is the one thing this feature must not ship.
    is_demo: bool = False
    # Where the card's picture lives, if it has one. The client falls back to
    # initials, so absent is an ordinary state rather than a broken one.
    avatar_url: str | None = None
    # Seniority in the directory, and the only timestamp a stranger sees.
    joined_at: datetime
    # How the person asking stands with this one, so the card can render its
    # own button without the client cross-referencing two lists.
    standing: Standing = "none"
    # The connection row behind a non-"none" standing, for accept/withdraw.
    connection_id: int | None = None
    # Only ever filled for people the viewer is connected to. Progress is
    # private until you are.
    modules_completed: int | None = None
    badges_earned: int | None = None


class DirectoryResponse(BaseModel):
    people: list[PersonCard]
    total: int
    # Echoed back so the client can tell a stale response from a current one.
    query: str | None = None
    role: Role | None = None


class ConnectRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    handle: str = Field(min_length=1, max_length=32)
    note: str | None = Field(default=None, max_length=500)

    @field_validator("note")
    @classmethod
    def _clean_note(cls, value: str | None) -> str | None:
        return _tidy(value)


class ConnectionRecord(BaseModel):
    id: int
    status: Status
    note: str | None = None
    created_at: datetime
    responded_at: datetime | None = None
    # True when the viewer is the one who asked.
    outgoing: bool
    # The other party — never the viewer, so a client never has to work out
    # which of two ids is "them".
    person: PersonCard


class NetworkResponse(BaseModel):
    """Everything the hub's own page needs, in one round trip."""

    connections: list[ConnectionRecord]
    incoming: list[ConnectionRecord]
    outgoing: list[ConnectionRecord]
    # Shown on the nav badge.
    pending_incoming: int


class ProfileCard(BaseModel):
    """The viewer's own directory card, as they can edit it."""

    model_config = ConfigDict(extra="ignore")

    role: Role | None = None
    headline: str | None = Field(default=None, max_length=140)
    interests: str | None = Field(default=None, max_length=240)
    open_to_mentoring: bool | None = None

    @field_validator("headline", "interests")
    @classmethod
    def _clean(cls, value: str | None) -> str | None:
        return _tidy(value)
