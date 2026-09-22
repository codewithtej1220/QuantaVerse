from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.clock import as_utc, today, utcnow
from app.core.curriculum import (
    BADGE_BY_ID,
    CHALLENGE_BY_SLUG,
    CHALLENGE_POINTS,
    MAX_POINTS,
    MODULE_BY_BADGE,
    MODULE_BY_SLUG,
    MODULES,
    SKILL_AXES,
    head_start,
    starting_priors,
    TOTAL_CHALLENGES,
    TOTAL_LESSONS,
    TRACK_LABEL,
    Module,
    mastery_for,
    module_units,
)
from app.db.models import EarnedBadge, ExerciseAttempt, LessonCompletion, User
from app.models.auth import StudentProfile
from app.models.progress import (
    AttemptRecord,
    BadgeState,
    ChallengeProgress,
    Mastery,
    ModuleProgress,
    ProgressStats,
    SkillGap,
    SkillPoint,
    UpNext,
)
from app.services import own_modules

ACTIVITY_WEEKS = 12
ACTIVITY_CAP = 4
COHORT_LABEL = "Open cohort · self-paced"


class UnknownModuleError(ValueError):
    pass


class UnknownChallengeError(ValueError):
    pass


@dataclass
class Snapshot:
    modules: list[ModuleProgress]
    stats: ProgressStats
    mastery: Mastery
    skills: list[SkillPoint]
    badges: list[BadgeState]
    up_next: UpNext | None
    fresh_badges: list[BadgeState]


def taught_modules(user: User) -> list[str]:
    """The modules a professor teaches, in curriculum order."""
    if user.role != "professor":
        return []
    slugs = {row.module_slug for row in user.teaching}
    return [module.slug for module in MODULES if module.slug in slugs]


def profile_of(user: User) -> StudentProfile:
    return StudentProfile(
        id=user.id,
        email=user.email,
        handle=user.handle,
        display_name=user.display_name,
        institution=user.institution,
        cohort=COHORT_LABEL,
        created_at=as_utc(user.created_at),
        last_login_at=as_utc(user.last_login_at),
        math_level=user.math_level,
        code_level=user.code_level,
        role=user.role or "student",
        teaches=taught_modules(user),
    )


def resolve_module(slug: str) -> Module:
    module = MODULE_BY_SLUG.get(slug)
    if module is None:
        raise UnknownModuleError(f"no module called {slug!r} — see GET /api/catalog")
    return module


def resolve_challenge_module(slug: str) -> Module:
    module = MODULE_BY_SLUG.get(slug)
    if module is None or module.challenge is None:
        raise UnknownChallengeError(
            f"no graded circuit lab called {slug!r} — see GET /api/catalog"
        )
    return module


def _lessons_of(session: Session, user: User) -> list[LessonCompletion]:
    return list(
        session.scalars(
            select(LessonCompletion)
            .where(LessonCompletion.user_id == user.id)
            .order_by(LessonCompletion.completed_at)
        )
    )


def _attempts_of(session: Session, user: User) -> list[ExerciseAttempt]:
    return list(
        session.scalars(
            select(ExerciseAttempt)
            .where(ExerciseAttempt.user_id == user.id)
            .order_by(ExerciseAttempt.created_at)
        )
    )


def _earned_of(session: Session, user: User) -> dict[str, datetime]:
    rows = session.scalars(select(EarnedBadge).where(EarnedBadge.user_id == user.id))
    return {row.badge_id: row.earned_at for row in rows}


def _challenge_progress(
    module: Module, attempts: list[ExerciseAttempt]
) -> ChallengeProgress | None:
    if module.challenge is None:
        return None

    mine = [item for item in attempts if item.challenge_slug == module.challenge.slug]
    wins = [item for item in mine if item.passed]
    return ChallengeProgress(
        slug=module.challenge.slug,
        title=module.challenge.title,
        qubits=module.challenge.qubits,
        attempts=len(mine),
        passed=bool(wins),
        best_score=round(max((item.score for item in mine), default=0.0), 4),
        success_rate=round(len(wins) / len(mine), 4) if mine else 0.0,
        first_passed_at=as_utc(min((item.created_at for item in wins), default=None)),
        last_attempt_at=as_utc(max((item.created_at for item in mine), default=None)),
    )


def _module_rows(
    lessons: list[LessonCompletion],
    attempts: list[ExerciseAttempt],
    earned: dict[str, datetime],
    open_from_the_start: int = 1,
) -> list[ModuleProgress]:
    by_module: dict[str, list[LessonCompletion]] = defaultdict(list)
    for lesson in lessons:
        by_module[lesson.module_slug].append(lesson)

    rows: list[ModuleProgress] = []
    unlocked = True

    for index, module in enumerate(MODULES):
        mine = [
            lesson
            for lesson in by_module.get(module.slug, [])
            if 0 <= lesson.lesson_index < module.lessons
        ]
        indexes = sorted({lesson.lesson_index for lesson in mine})
        challenge = _challenge_progress(module, attempts)

        done = len(indexes) + (1 if challenge and challenge.passed else 0)
        units = module_units(module)
        percent = round((done / units) * 100) if units else 0

        stamps = [lesson.completed_at for lesson in mine]
        if challenge and challenge.last_attempt_at:
            stamps.append(challenge.last_attempt_at.replace(tzinfo=None))

        # Open either because the module before it is finished, or because
        # the learner said at sign-up that they have the background for it.
        open_now = unlocked or index < open_from_the_start

        if percent >= 100:
            state = "mastered"
        elif not open_now:
            state = "locked"
        elif done:
            state = "active"
        else:
            state = "available"

        rows.append(
            ModuleProgress(
                slug=module.slug,
                ket=module.ket,
                title=module.title,
                track=module.track,
                track_label=TRACK_LABEL.get(module.track, module.track),
                lessons=module.lessons,
                minutes=module.minutes,
                lessons_completed=len(indexes),
                completed_lessons=indexes,
                percent=percent,
                state=state,
                badge_id=module.badge.id,
                badge=module.badge.name,
                badge_earned=module.badge.id in earned,
                challenge=challenge,
                started_at=as_utc(min(stamps)) if stamps else None,
                completed_at=as_utc(max(stamps)) if stamps and percent >= 100 else None,
            )
        )

        unlocked = percent >= 100

    return rows


def _skill_points(rows: list[ModuleProgress]) -> list[SkillPoint]:
    percent_by_slug = {row.slug: row.percent for row in rows}
    points: list[SkillPoint] = []

    for axis in SKILL_AXES:
        weighted = 0.0
        total = 0.0
        for module in MODULES:
            for key, weight in module.skills:
                if key == axis.key:
                    weighted += weight * percent_by_slug.get(module.slug, 0)
                    total += weight
        points.append(
            SkillPoint(
                key=axis.key,
                label=axis.label,
                short=axis.short,
                value=round(weighted / total) if total else 0,
                cohort=axis.cohort,
            )
        )

    return points


def _activity_days(
    lessons: list[LessonCompletion], attempts: list[ExerciseAttempt]
) -> dict[date, int]:
    counts: dict[date, int] = defaultdict(int)
    for lesson in lessons:
        counts[lesson.completed_at.date()] += 1
    for attempt in attempts:
        counts[attempt.created_at.date()] += 1
    return counts


def _streak(days: dict[date, int]) -> int:
    if not days:
        return 0

    anchor = today()
    if anchor not in days:
        anchor = anchor - timedelta(days=1)
        if anchor not in days:
            return 0

    run = 0
    cursor = anchor
    while cursor in days:
        run += 1
        cursor -= timedelta(days=1)
    return run


def activity_series(
    lessons: list[LessonCompletion],
    attempts: list[ExerciseAttempt],
    weeks: int = ACTIVITY_WEEKS,
) -> list[int]:
    counts = _activity_days(lessons, attempts)
    end = today()
    start = end - timedelta(days=end.weekday()) - timedelta(weeks=weeks - 1)
    return [
        min(ACTIVITY_CAP, counts.get(start + timedelta(days=offset), 0))
        for offset in range(weeks * 7)
    ]


def _badge_states(earned: dict[str, datetime]) -> list[BadgeState]:
    return [
        BadgeState(
            id=module.badge.id,
            name=module.badge.name,
            detail=module.badge.detail,
            ket=module.ket,
            module_slug=module.slug,
            earned=module.badge.id in earned,
            earned_at=as_utc(earned.get(module.badge.id)),
        )
        for module in MODULES
    ]


def _coverage(module: Module, axis_key: str) -> float:
    """How much of one skill axis a module carries, as a share of its weight."""
    total = sum(weight for _key, weight in module.skills) or 1.0
    carried = sum(weight for key, weight in module.skills if key == axis_key)
    return carried / total


def _up_next(
    rows: list[ModuleProgress],
    skills: list[SkillPoint],
    priors: dict[str, float] | None = None,
) -> UpNext | None:
    """
    The module to open next, chosen by where the learner is weakest.

    This used to take `candidates[0]` — whichever unfinished module came first
    in curriculum order — and attach the weakest skill's name as a decoration.
    That is not a recommendation, it is a table of contents with a label on it:
    someone who has finished the algorithms track and never touched measurement
    was still pointed at whatever module happened to be next.

    Now the weakest axis picks the module: among the ones open to them, the one
    that carries the most of that axis wins, and the reason says so. Order is
    the tie-breaker, not the rule.

    A learner with no history has no gap — every axis reads zero — so they are
    sent to the start, which is the right answer and an honest one.
    """
    candidates = [row for row in rows if row.state == "active"] or [
        row for row in rows if row.state == "available"
    ]
    if not candidates:
        return None

    ranked = sorted(skills, key=lambda point: point.value)

    # Only the axes an open module can actually move. The weakest axis
    # overall is usually one that nothing available touches yet — it sits
    # behind a module still locked — and recommending against it produces a
    # diagnosis with no prescription: "Qiskit code is your weakest at 0%"
    # attached to a module carrying none of it.
    movable = [
        point
        for point in ranked
        if any(_coverage(MODULE_BY_SLUG[row.slug], point.key) > 0 for row in candidates)
    ]
    weakest = movable[0] if movable else (ranked[0] if ranked else None)

    # No signal yet: every axis at zero means nothing has been done, and the
    # sensible next step is the first module rather than an arbitrary one.
    has_signal = bool(ranked) and any(point.value > 0 for point in ranked)

    # Day one, and nothing measured yet. Without the sign-up answers there is
    # genuinely nothing to go on and the first module is the honest suggestion.
    # With them there is: the axes the learner did not claim are the ones worth
    # aiming at, so the ranking runs on what they said instead of on what they
    # have done. Their claim never overrides evidence — the moment a lab is
    # marked, `has_signal` is true and this is not consulted again.
    if not has_signal and priors and movable:
        weakest = min(movable, key=lambda point: (priors.get(point.key, 0.0), point.key))
        has_signal = True

    gap: SkillGap | None = None

    if weakest is not None and has_signal:
        def rank(candidate: ModuleProgress) -> tuple[float, int]:
            module = MODULE_BY_SLUG[candidate.slug]
            # Negative so more coverage sorts first; index keeps order as the
            # tie-break, so two equally relevant modules still read in sequence.
            return (-_coverage(module, weakest.key), module.index)

        row = min(candidates, key=rank)
        share = _coverage(MODULE_BY_SLUG[row.slug], weakest.key)
        gap = SkillGap(
            key=weakest.key,
            label=weakest.label,
            value=weakest.value,
            coverage=round(share * 100),
        )
    else:
        row = candidates[0]

    module = MODULE_BY_SLUG[row.slug]
    missing = [
        index for index in range(module.lessons) if index not in set(row.completed_lessons)
    ]
    challenge_left = bool(row.challenge and not row.challenge.passed)

    if missing:
        step = f"lesson {missing[0] + 1} of {module.lessons} is next"
    elif challenge_left:
        step = "every lesson is done, so the circuit lab is all that is left"
    else:
        step = "nothing left in this module"

    if gap is not None and gap.coverage > 0:
        reason = f"{gap.label.lower()} is your weakest axis at {gap.value}% — {step}"
    else:
        reason = step

    return UpNext(
        module_slug=row.slug,
        ket=row.ket,
        title=row.title,
        percent=row.percent,
        reason=reason,
        lesson_index=missing[0] if missing else None,
        challenge_slug=row.challenge.slug if challenge_left and row.challenge else None,
        weakest_skill=weakest.label if weakest else None,
        gap=gap,
        # The other axes worth working on. Drawn from the movable set for the
        # same reason: a list of things you cannot act on is not advice.
        weakest_axes=[
            SkillGap(
                key=point.key,
                label=point.label,
                value=point.value,
                coverage=round(_coverage(MODULE_BY_SLUG[row.slug], point.key) * 100),
            )
            for point in (movable or ranked)[:3]
        ],
    )


def _stats(
    rows: list[ModuleProgress],
    lessons: list[LessonCompletion],
    attempts: list[ExerciseAttempt],
    earned: dict[str, datetime],
) -> ProgressStats:
    lessons_completed = sum(row.lessons_completed for row in rows)
    challenges_passed = sum(
        1 for row in rows if row.challenge is not None and row.challenge.passed
    )
    passed_attempts = sum(1 for attempt in attempts if attempt.passed)
    units_total = TOTAL_LESSONS + TOTAL_CHALLENGES
    units_done = lessons_completed + challenges_passed
    stamps = [lesson.completed_at for lesson in lessons] + [
        attempt.created_at for attempt in attempts
    ]
    days = _activity_days(lessons, attempts)

    return ProgressStats(
        lessons_completed=lessons_completed,
        lessons_total=TOTAL_LESSONS,
        modules_completed=sum(1 for row in rows if row.percent >= 100),
        modules_total=len(MODULES),
        challenges_passed=challenges_passed,
        challenges_total=TOTAL_CHALLENGES,
        attempts=len(attempts),
        attempts_passed=passed_attempts,
        success_rate=round(passed_attempts / len(attempts), 4) if attempts else 0.0,
        percent_complete=round((units_done / units_total) * 100) if units_total else 0,
        minutes_logged=round(sum(lesson.seconds_spent for lesson in lessons) / 60),
        badges_earned=len(earned),
        streak_days=_streak(days),
        active_days=len(days),
        first_activity_at=as_utc(min(stamps)) if stamps else None,
        last_activity_at=as_utc(max(stamps)) if stamps else None,
    )


def _points(rows: list[ModuleProgress]) -> int:
    lessons = sum(row.lessons_completed for row in rows)
    passed = sum(1 for row in rows if row.challenge is not None and row.challenge.passed)
    return lessons + passed * CHALLENGE_POINTS


def _mastery(rows: list[ModuleProgress]) -> Mastery:
    points = _points(rows)
    level, title, next_title, percent = mastery_for(points)
    return Mastery(
        level=level,
        title=title,
        next_title=next_title,
        percent=percent,
        points=points,
        points_max=MAX_POINTS,
    )


def award_badges(
    session: Session, user: User, rows: list[ModuleProgress], earned: dict[str, datetime]
) -> list[str]:
    fresh: list[str] = []
    stamp = utcnow()

    for row in rows:
        if row.percent >= 100 and row.badge_id not in earned:
            session.add(
                EarnedBadge(user_id=user.id, badge_id=row.badge_id, earned_at=stamp)
            )
            earned[row.badge_id] = stamp
            fresh.append(row.badge_id)

    if fresh:
        session.commit()
    return fresh


def build_snapshot(session: Session, user: User, *, award: bool = False) -> Snapshot:
    lessons = _lessons_of(session, user)
    attempts = _attempts_of(session, user)
    earned = _earned_of(session, user)

    opening = head_start(user.math_level, user.code_level)
    rows = _module_rows(lessons, attempts, earned, opening)
    fresh: list[str] = []
    if award:
        fresh = award_badges(session, user, rows, earned)
        if fresh:
            rows = _module_rows(lessons, attempts, earned, opening)

    skills = _skill_points(rows)
    return Snapshot(
        modules=rows,
        stats=_stats(rows, lessons, attempts, earned),
        mastery=_mastery(rows),
        skills=skills,
        badges=_badge_states(earned),
        up_next=_up_next(rows, skills, starting_priors(user.math_level, user.code_level)),
        fresh_badges=badge_states_for(fresh, earned),
    )


def activity_for(session: Session, user: User, weeks: int = ACTIVITY_WEEKS) -> list[int]:
    return activity_series(_lessons_of(session, user), _attempts_of(session, user), weeks)


def attempt_record(attempt: ExerciseAttempt, title: str | None = None) -> AttemptRecord:
    challenge = CHALLENGE_BY_SLUG.get(attempt.challenge_slug)
    return AttemptRecord(
        id=attempt.id,
        challenge_slug=attempt.challenge_slug,
        challenge_title=title or (challenge.title if challenge else attempt.challenge_slug),
        passed=attempt.passed,
        score=round(attempt.score, 4),
        state_fidelity=attempt.state_fidelity,
        unitary_fidelity=attempt.unitary_fidelity,
        created_at=as_utc(attempt.created_at),
    )


def recent_attempts(session: Session, user: User, limit: int = 8) -> list[AttemptRecord]:
    rows = session.scalars(
        select(ExerciseAttempt)
        .where(ExerciseAttempt.user_id == user.id)
        .order_by(ExerciseAttempt.created_at.desc(), ExerciseAttempt.id.desc())
        .limit(limit)
    )
    rows = list(rows)
    # A professor's own lab is not in the curriculum's table; name it the way
    # its page does rather than by its slug.
    titles: dict[str, str] = {}
    for slug in {row.challenge_slug for row in rows} - CHALLENGE_BY_SLUG.keys():
        own = own_modules.find(session, slug)
        lab = own_modules.challenge_of(own) if own is not None else None
        if lab is not None:
            titles[slug] = lab.title
    return [attempt_record(row, titles.get(row.challenge_slug)) for row in rows]


def mark_lesson(
    session: Session, user: User, module_slug: str, lesson_index: int, seconds: int = 0
) -> tuple[bool, LessonCompletion]:
    module = resolve_module(module_slug)
    if lesson_index >= module.lessons:
        raise UnknownModuleError(
            f"{module.title} has {module.lessons} lessons, so there is no lesson {lesson_index + 1}"
        )

    existing = session.scalars(
        select(LessonCompletion).where(
            LessonCompletion.user_id == user.id,
            LessonCompletion.module_slug == module.slug,
            LessonCompletion.lesson_index == lesson_index,
        )
    ).first()

    if existing is not None:
        if seconds:
            existing.seconds_spent += seconds
            session.commit()
        return False, existing

    record = LessonCompletion(
        user_id=user.id,
        module_slug=module.slug,
        lesson_index=lesson_index,
        seconds_spent=seconds,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return True, record


def unmark_lesson(session: Session, user: User, module_slug: str, lesson_index: int) -> bool:
    module = resolve_module(module_slug)
    result = session.execute(
        delete(LessonCompletion).where(
            LessonCompletion.user_id == user.id,
            LessonCompletion.module_slug == module.slug,
            LessonCompletion.lesson_index == lesson_index,
        )
    )
    session.commit()
    return bool(result.rowcount)


def record_attempt(
    session: Session,
    user: User,
    challenge_slug: str,
    *,
    passed: bool,
    score: float,
    state_fidelity: float | None = None,
    unitary_fidelity: float | None = None,
    gates: int | None = None,
    depth: int | None = None,
    source: str = "grader",
) -> ExerciseAttempt:
    module = MODULE_BY_SLUG.get(challenge_slug)
    if module is not None and module.challenge is not None:
        slug = module.challenge.slug
    else:
        # A professor's own lab, filed like any other — but only by somebody
        # the module is published to.
        own = own_modules.find(session, challenge_slug)
        if (
            own is None
            or own_modules.challenge_of(own) is None
            or not own_modules.can_view(session, user, own)
        ):
            resolve_challenge_module(challenge_slug)  # raises the curriculum's own error
            raise UnknownChallengeError(f"no graded circuit lab called {challenge_slug!r}")
        slug = own.slug
    attempt = ExerciseAttempt(
        user_id=user.id,
        challenge_slug=slug,
        passed=passed,
        score=max(0.0, min(1.0, score)),
        state_fidelity=state_fidelity,
        unitary_fidelity=unitary_fidelity,
        gates=gates,
        depth=depth,
        source=source,
    )
    session.add(attempt)
    session.commit()
    session.refresh(attempt)
    return attempt


def badge_states_for(ids: list[str], earned: dict[str, datetime]) -> list[BadgeState]:
    states: list[BadgeState] = []
    for badge_id in ids:
        badge = BADGE_BY_ID.get(badge_id)
        module = MODULE_BY_BADGE.get(badge_id)
        if badge is None or module is None:
            continue
        states.append(
            BadgeState(
                id=badge.id,
                name=badge.name,
                detail=badge.detail,
                ket=module.ket,
                module_slug=module.slug,
                earned=True,
                earned_at=as_utc(earned.get(badge_id)),
            )
        )
    return states
