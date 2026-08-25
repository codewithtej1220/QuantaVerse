from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DatabaseSession
from app.core.curriculum import (
    MASTERY_LEVELS,
    MODULES,
    SKILL_AXES,
    TOTAL_CHALLENGES,
    TOTAL_LESSONS,
    TOTAL_MINUTES,
    TRACK_LABEL,
)
from app.models.progress import (
    AttemptRequest,
    AttemptResponse,
    CatalogModule,
    CatalogResponse,
    DashboardResponse,
    ExerciseReport,
    LessonMarkRequest,
    LessonMarkResponse,
    ModuleProgress,
    ProgressResponse,
    SkillPoint,
)
from app.services import progress as service

router = APIRouter(prefix="/api", tags=["progress"])


def _module_or_404(snapshot: service.Snapshot, slug: str) -> ModuleProgress:
    for row in snapshot.modules:
        if row.slug == slug:
            return row
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"no module {slug!r}")


@router.get("/catalog", response_model=CatalogResponse)
def catalog() -> CatalogResponse:
    return CatalogResponse(
        modules=[
            CatalogModule(
                slug=module.slug,
                ket=module.ket,
                title=module.title,
                track=module.track,
                track_label=TRACK_LABEL.get(module.track, module.track),
                lessons=module.lessons,
                minutes=module.minutes,
                badge_id=module.badge.id,
                badge=module.badge.name,
                challenge_slug=module.challenge.slug if module.challenge else None,
            )
            for module in MODULES
        ],
        skills=[
            SkillPoint(
                key=axis.key,
                label=axis.label,
                short=axis.short,
                value=0,
                cohort=axis.cohort,
            )
            for axis in SKILL_AXES
        ],
        lessons_total=TOTAL_LESSONS,
        minutes_total=TOTAL_MINUTES,
        challenges_total=TOTAL_CHALLENGES,
        mastery_levels=[
            {"level": level, "title": title, "points": points}
            for level, title, points in MASTERY_LEVELS
        ],
    )


@router.get("/progress", response_model=ProgressResponse)
def read_progress(user: CurrentUser, session: DatabaseSession) -> ProgressResponse:
    snapshot = service.build_snapshot(session, user, award=True)
    return ProgressResponse(
        stats=snapshot.stats,
        mastery=snapshot.mastery,
        modules=snapshot.modules,
        skills=snapshot.skills,
        badges=snapshot.badges,
        up_next=snapshot.up_next,
    )


@router.post(
    "/progress/lessons",
    response_model=LessonMarkResponse,
    status_code=status.HTTP_201_CREATED,
)
def mark_lesson(
    payload: LessonMarkRequest, user: CurrentUser, session: DatabaseSession
) -> LessonMarkResponse:
    try:
        created, _ = service.mark_lesson(
            session,
            user,
            payload.module_slug,
            payload.lesson_index,
            payload.seconds_spent,
        )
    except service.UnknownModuleError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error

    snapshot = service.build_snapshot(session, user, award=True)

    return LessonMarkResponse(
        module=_module_or_404(snapshot, payload.module_slug),
        stats=snapshot.stats,
        mastery=snapshot.mastery,
        earned_badges=snapshot.fresh_badges,
        already_recorded=not created,
    )


@router.delete("/progress/lessons/{module_slug}/{lesson_index}", status_code=status.HTTP_200_OK)
def unmark_lesson(
    module_slug: str, lesson_index: int, user: CurrentUser, session: DatabaseSession
) -> dict[str, object]:
    try:
        removed = service.unmark_lesson(session, user, module_slug, lesson_index)
    except service.UnknownModuleError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error

    snapshot = service.build_snapshot(session, user)
    return {
        "removed": removed,
        "module": _module_or_404(snapshot, module_slug),
        "stats": snapshot.stats,
    }


@router.get("/progress/exercises", response_model=ExerciseReport)
def read_exercises(
    user: CurrentUser,
    session: DatabaseSession,
    limit: int = Query(default=20, ge=1, le=100),
) -> ExerciseReport:
    snapshot = service.build_snapshot(session, user)
    challenges = [row.challenge for row in snapshot.modules if row.challenge is not None]
    return ExerciseReport(
        challenges=challenges,
        recent=service.recent_attempts(session, user, limit),
        attempts=snapshot.stats.attempts,
        attempts_passed=snapshot.stats.attempts_passed,
        success_rate=snapshot.stats.success_rate,
    )


@router.post(
    "/progress/exercises",
    response_model=AttemptResponse,
    status_code=status.HTTP_201_CREATED,
)
def log_attempt(
    payload: AttemptRequest, user: CurrentUser, session: DatabaseSession
) -> AttemptResponse:
    try:
        attempt = service.record_attempt(
            session,
            user,
            payload.challenge_slug,
            passed=payload.passed,
            score=payload.score,
            state_fidelity=payload.state_fidelity,
            unitary_fidelity=payload.unitary_fidelity,
            gates=payload.gates,
            depth=payload.depth,
            source="client",
        )
    except service.UnknownChallengeError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error

    snapshot = service.build_snapshot(session, user, award=True)
    owner = service.resolve_challenge_module(payload.challenge_slug)
    module = _module_or_404(snapshot, owner.slug)

    if module.challenge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{payload.challenge_slug!r} has no graded circuit lab",
        )

    return AttemptResponse(
        attempt=service.attempt_record(attempt),
        challenge=module.challenge,
        module=module,
        stats=snapshot.stats,
        mastery=snapshot.mastery,
        earned_badges=snapshot.fresh_badges,
    )


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(
    user: CurrentUser,
    session: DatabaseSession,
    weeks: int = Query(default=service.ACTIVITY_WEEKS, ge=1, le=52),
) -> DashboardResponse:
    snapshot = service.build_snapshot(session, user, award=True)

    return DashboardResponse(
        profile=service.profile_of(user),
        stats=snapshot.stats,
        mastery=snapshot.mastery,
        modules=snapshot.modules,
        skills=snapshot.skills,
        badges=snapshot.badges,
        activity=service.activity_for(session, user, weeks),
        activity_weeks=weeks,
        recent_attempts=service.recent_attempts(session, user, 8),
        up_next=snapshot.up_next,
    )
