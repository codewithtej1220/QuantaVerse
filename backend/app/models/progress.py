from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.auth import StudentProfile


class LessonMarkRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    module_slug: str = Field(min_length=1, max_length=64)
    lesson_index: int = Field(ge=0, le=63)
    seconds_spent: int = Field(default=0, ge=0, le=86_400)


class AttemptRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    challenge_slug: str = Field(min_length=1, max_length=64)
    passed: bool
    score: float = Field(default=0.0, ge=0.0, le=1.0)
    state_fidelity: float | None = Field(default=None, ge=0.0, le=1.0)
    unitary_fidelity: float | None = Field(default=None, ge=0.0, le=1.0)
    gates: int | None = Field(default=None, ge=0, le=512)
    depth: int | None = Field(default=None, ge=0, le=512)


class ChallengeProgress(BaseModel):
    slug: str
    title: str
    qubits: int
    attempts: int
    passed: bool
    best_score: float
    success_rate: float
    first_passed_at: datetime | None
    last_attempt_at: datetime | None


class ModuleProgress(BaseModel):
    slug: str
    ket: str
    title: str
    track: str
    track_label: str
    lessons: int
    minutes: int
    lessons_completed: int
    completed_lessons: list[int]
    percent: int
    state: str
    badge_id: str
    badge: str
    badge_earned: bool
    challenge: ChallengeProgress | None
    started_at: datetime | None
    completed_at: datetime | None


class SkillPoint(BaseModel):
    key: str
    label: str
    short: str
    value: int
    cohort: int


class BadgeState(BaseModel):
    id: str
    name: str
    detail: str
    ket: str
    module_slug: str
    earned: bool
    earned_at: datetime | None


class Mastery(BaseModel):
    level: int
    title: str
    next_title: str | None
    percent: int
    points: int
    points_max: int


class ProgressStats(BaseModel):
    lessons_completed: int
    lessons_total: int
    modules_completed: int
    modules_total: int
    challenges_passed: int
    challenges_total: int
    attempts: int
    attempts_passed: int
    success_rate: float
    percent_complete: int
    minutes_logged: int
    badges_earned: int
    streak_days: int
    active_days: int
    first_activity_at: datetime | None
    last_activity_at: datetime | None


class UpNext(BaseModel):
    module_slug: str
    ket: str
    title: str
    percent: int
    reason: str
    lesson_index: int | None
    challenge_slug: str | None
    weakest_skill: str | None


class ProgressResponse(BaseModel):
    stats: ProgressStats
    mastery: Mastery
    modules: list[ModuleProgress]
    skills: list[SkillPoint]
    badges: list[BadgeState]
    up_next: UpNext | None


class AttemptRecord(BaseModel):
    id: int
    challenge_slug: str
    challenge_title: str
    passed: bool
    score: float
    state_fidelity: float | None
    unitary_fidelity: float | None
    created_at: datetime


class ExerciseReport(BaseModel):
    challenges: list[ChallengeProgress]
    recent: list[AttemptRecord]
    attempts: int
    attempts_passed: int
    success_rate: float


class LessonMarkResponse(BaseModel):
    module: ModuleProgress
    stats: ProgressStats
    mastery: Mastery
    earned_badges: list[BadgeState]
    already_recorded: bool


class AttemptResponse(BaseModel):
    attempt: AttemptRecord
    challenge: ChallengeProgress
    module: ModuleProgress | None
    stats: ProgressStats
    mastery: Mastery
    earned_badges: list[BadgeState]


class DashboardResponse(BaseModel):
    profile: StudentProfile
    stats: ProgressStats
    mastery: Mastery
    modules: list[ModuleProgress]
    skills: list[SkillPoint]
    badges: list[BadgeState]
    activity: list[int]
    activity_weeks: int
    recent_attempts: list[AttemptRecord]
    up_next: UpNext | None


class CatalogModule(BaseModel):
    slug: str
    ket: str
    title: str
    track: str
    track_label: str
    lessons: int
    minutes: int
    badge_id: str
    badge: str
    challenge_slug: str | None


class CatalogResponse(BaseModel):
    modules: list[CatalogModule]
    skills: list[SkillPoint]
    lessons_total: int
    minutes_total: int
    challenges_total: int
    mastery_levels: list[dict[str, object]]
