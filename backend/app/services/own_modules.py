from __future__ import annotations

import math
import re
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import as_utc
from app.core.curriculum import Challenge
from app.db.models import ClassMembership, ExerciseAttempt, LessonCompletion, OwnModule, User
from app.models.teaching import (
    LabStanding,
    OwnLessonView,
    OwnModuleCard,
    OwnModuleContent,
    OwnModuleView,
    Person,
)

"""
A professor's own modules, as something students take.

A module of the professor's own carries what a curriculum module does — lessons
with theory, a video, a practice task and a checkpoint quiz, notes, and a graded
lab — all of it written by them and every part of it optional.

Who sees one is decided the way everything a professor publishes is: the
professor, and the students they have accepted into any of their classes. It is
their course material, so it goes to their class and nowhere else. Anyone can
sign up as a professor, and a module that reached every student on the site
would make the course an open publishing platform for whoever registered.

These live apart from the teaching service so that the progress service can
ask about them — a lesson ticked or a lab passed on one of these is recorded
like any other — without the two importing each other.
"""

WORDS_PER_MINUTE = 200


@dataclass(frozen=True)
class Shape:
    """What the ranking needs of a module: its slug, lessons and lab."""

    slug: str
    lessons: int
    challenge: Challenge | None


def find(session: Session, slug: str) -> OwnModule | None:
    return session.scalar(select(OwnModule).where(OwnModule.slug == slug))


def content_of(module: OwnModule) -> OwnModuleContent:
    """The saved content, or an empty module with its name."""
    stored = module.content or {}
    return OwnModuleContent.model_validate(
        {"title": module.title, "summary": module.summary, **stored}
    )


def lesson_count(module: OwnModule) -> int:
    return len((module.content or {}).get("lessons") or [])


def challenge_of(module: OwnModule) -> Challenge | None:
    """The lab as the grader reads one, or None if the module has no lab."""
    lab = content_of(module).lab
    if lab is None:
        return None
    return Challenge(
        slug=module.slug,
        title=lab.title or f"{module.title} lab",
        qubits=lab.qubits,
        goal=lab.goal or "",
        mode=lab.mode,
        ops=tuple((op.gate, tuple(op.wires)) for op in lab.ops),
    )


def shape_of(module: OwnModule) -> Shape:
    return Shape(slug=module.slug, lessons=lesson_count(module), challenge=challenge_of(module))


def _professors_of(session: Session, viewer: User) -> set[int]:
    """Every professor who has accepted `viewer` into a class."""
    return set(
        session.scalars(
            select(ClassMembership.professor_id).where(
                ClassMembership.student_id == viewer.id,
                ClassMembership.status == "accepted",
            )
        )
    )


def can_view(session: Session, viewer: User | None, module: OwnModule) -> bool:
    if viewer is None:
        return False
    if module.professor_id == viewer.id:
        return True
    return module.professor_id in _professors_of(session, viewer)


def _move_ticks(session: Session, module: OwnModule, content: OwnModuleContent) -> None:
    """Carry students' ticks with their lessons through a reorder or a removal.

    A tick is stored against a lesson's position, so without this, a lesson
    added at the top would hand every student's ticks to the lesson above the
    one they finished. Each lesson the editor sends back says which position it
    was loaded from; one that says none is new, and a position no lesson claims
    was removed, taking its ticks with it.
    """
    before = lesson_count(module)
    moves: dict[int, int] = {}
    for index, lesson in enumerate(content.lessons):
        if lesson.origin is not None and lesson.origin < before and lesson.origin not in moves:
            moves[lesson.origin] = index
    if all(moves.get(index) == index for index in range(before)):
        return
    rows = list(
        session.scalars(select(LessonCompletion).where(LessonCompletion.module_slug == module.slug))
    )
    kept = [
        LessonCompletion(
            user_id=row.user_id,
            module_slug=module.slug,
            lesson_index=moves[row.lesson_index],
            seconds_spent=row.seconds_spent,
            completed_at=row.completed_at,
        )
        for row in rows
        if row.lesson_index in moves
    ]
    # Out and back in, rather than renumbered in place: a swap would briefly
    # hold two ticks at one position, which the table does not allow.
    for row in rows:
        session.delete(row)
    session.flush()
    session.add_all(kept)


def save(session: Session, module: OwnModule, content: OwnModuleContent) -> OwnModule:
    """Store the professor's content, giving an untitled lesson its place as a name."""
    _move_ticks(session, module, content)
    lessons = []
    for index, lesson in enumerate(content.lessons):
        data = lesson.model_dump(exclude={"origin"})
        data["title"] = lesson.title or f"Lesson {index + 1}"
        lessons.append(data)
    module.title = content.title
    module.summary = content.summary
    module.content = {
        "lessons": lessons,
        "lab": content.lab.model_dump() if content.lab else None,
    }
    session.commit()
    session.refresh(module)
    return module


def _paragraphs(body: str | None) -> list[str]:
    if not body:
        return []
    return [" ".join(part.split()) for part in re.split(r"\n\s*\n", body) if part.strip()]


def _minutes(body: list[str], video: str | None, quiz: int) -> int:
    words = sum(len(paragraph.split()) for paragraph in body)
    reading = math.ceil(words / WORDS_PER_MINUTE) if words else 0
    # A video's length is not known from its link; call it the length of a
    # short lecture segment, which is what these usually are.
    return max(3, reading + (8 if video else 0) + quiz)


def _person(user: User) -> Person:
    return Person(
        id=user.id,
        handle=user.handle,
        display_name=user.display_name,
        institution=user.institution,
        position=user.position,
        avatar_url=user.avatar_url,
    )


def _completed(session: Session, viewer: User, module: OwnModule) -> list[int]:
    total = lesson_count(module)
    return sorted(
        index
        for index in session.scalars(
            select(LessonCompletion.lesson_index).where(
                LessonCompletion.user_id == viewer.id,
                LessonCompletion.module_slug == module.slug,
            )
        )
        if 0 <= index < total
    )


def _lab_progress(session: Session, viewer: User, module: OwnModule) -> LabStanding | None:
    challenge = challenge_of(module)
    if challenge is None:
        return None
    attempts = list(
        session.execute(
            select(ExerciseAttempt.passed, ExerciseAttempt.score, ExerciseAttempt.created_at).where(
                ExerciseAttempt.user_id == viewer.id,
                ExerciseAttempt.challenge_slug == module.slug,
            )
        )
    )
    passes = [created for passed, _score, created in attempts if passed]
    return LabStanding(
        title=challenge.title,
        passed=bool(passes),
        best_score=round(max((float(score or 0) for _p, score, _c in attempts), default=0.0), 4),
        attempts=len(attempts),
        first_passed_at=as_utc(min(passes)) if passes else None,
    )


def view(session: Session, viewer: User, module: OwnModule) -> OwnModuleView:
    content = content_of(module)
    lessons = []
    for lesson in content.lessons:
        body = _paragraphs(lesson.body)
        lessons.append(
            OwnLessonView(
                title=lesson.title,
                summary=lesson.summary,
                body=body,
                video_url=lesson.video_url,
                practice=lesson.practice,
                quiz=lesson.quiz,
                minutes=_minutes(body, lesson.video_url, len(lesson.quiz)),
            )
        )
    return OwnModuleView(
        slug=module.slug,
        title=module.title,
        summary=module.summary,
        professor=_person(module.professor),
        lessons=lessons,
        lab=content.lab,
        completed_lessons=_completed(session, viewer, module),
        lab_progress=_lab_progress(session, viewer, module),
        owner=module.professor_id == viewer.id,
    )


def _percent(session: Session, viewer: User, module: OwnModule) -> int:
    units = lesson_count(module) + (1 if challenge_of(module) else 0)
    if not units:
        return 0
    done = len(_completed(session, viewer, module))
    lab = _lab_progress(session, viewer, module)
    return round(((done + (1 if lab and lab.passed else 0)) / units) * 100)


def visible_to(session: Session, viewer: User) -> list[OwnModule]:
    """The own modules this viewer can take: their professors', and their own."""
    owners = _professors_of(session, viewer) | {viewer.id}
    return list(
        session.scalars(
            select(OwnModule)
            .where(OwnModule.professor_id.in_(owners))
            .order_by(OwnModule.created_at, OwnModule.id)
        )
    )


def cards_for(session: Session, viewer: User) -> list[OwnModuleCard]:
    cards = []
    for module in visible_to(session, viewer):
        # A heading with nothing under it is not a module a student can take.
        if not lesson_count(module) and challenge_of(module) is None:
            continue
        cards.append(
            OwnModuleCard(
                slug=module.slug,
                title=module.title,
                summary=module.summary,
                professor=_person(module.professor),
                lessons=lesson_count(module),
                has_lab=challenge_of(module) is not None,
                percent=_percent(session, viewer, module),
            )
        )
    return cards


def students_with_progress(session: Session, module: OwnModule) -> set[int]:
    """Students who have ticked a lesson or tried the lab on this module."""
    started = set(
        session.scalars(
            select(LessonCompletion.user_id).where(LessonCompletion.module_slug == module.slug)
        )
    )
    started |= set(
        session.scalars(
            select(ExerciseAttempt.user_id).where(ExerciseAttempt.challenge_slug == module.slug)
        )
    )
    return started
