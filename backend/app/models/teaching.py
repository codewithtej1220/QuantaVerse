from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

"""
Wire shapes for professors and their classes.

A professor sees a student's name, handle and institution — the same things
the research hub shows any member — and, only once they have accepted that
student into a class, the student's progress on that one module. Never an
e-mail address, and never progress on modules outside the class.
"""

MembershipStatus = Literal["pending", "accepted", "declined"]


class Person(BaseModel):
    id: int
    handle: str
    display_name: str
    institution: str | None = None
    position: str | None = None
    avatar_url: str | None = None


class LabStanding(BaseModel):
    title: str
    passed: bool
    best_score: float
    attempts: int
    first_passed_at: datetime | None = None


class ClassStudent(BaseModel):
    """One row of a module's leaderboard."""

    membership_id: int
    rank: int
    student: Person
    # Lessons finished plus the lab, as a share of the module: the same figure
    # the student's own dashboard shows for it.
    percent: int
    lessons_completed: int
    lessons_total: int
    lab: LabStanding | None = None
    last_active: datetime | None = None
    joined_at: datetime | None = None


class ClassRequest(BaseModel):
    id: int
    module_slug: str
    module_title: str
    student: Person
    note: str | None = None
    created_at: datetime


class TaughtModule(BaseModel):
    slug: str
    title: str
    ket: str
    lessons: int
    lab_title: str | None = None
    students: list[ClassStudent]
    pending: int
    notes: int


class ModuleChoice(BaseModel):
    slug: str
    title: str
    ket: str


class ProfessorTotals(BaseModel):
    students: int
    requests: int
    notes: int


class ProfessorDashboard(BaseModel):
    professor: Person
    modules: list[TaughtModule]
    requests: list[ClassRequest]
    catalogue: list[ModuleChoice]
    totals: ProfessorTotals


class TeachingUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    modules: list[str] = Field(max_length=16)


class JoinRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    professor_id: int
    note: str | None = Field(default=None, max_length=300)


class Membership(BaseModel):
    id: int
    status: MembershipStatus
    note: str | None = None
    created_at: datetime
    responded_at: datetime | None = None


class ModuleProfessor(BaseModel):
    professor: Person
    # How many students are in their class for this module.
    students: int
    # The viewer's own request or place in this class, if they have one.
    membership: Membership | None = None


class ModuleClasses(BaseModel):
    module_slug: str
    professors: list[ModuleProfessor]
    # Whether the viewer teaches this module themselves.
    you_teach: bool = False
