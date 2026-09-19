from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.clock import as_utc, utcnow
from app.core.curriculum import MODULE_BY_SLUG, MODULES, Module, module_units
from app.db.models import (
    ClassMembership,
    ExerciseAttempt,
    LessonCompletion,
    ModuleNote,
    TeachingAssignment,
    User,
)
from app.models.teaching import (
    ClassRequest,
    ClassStudent,
    LabStanding,
    Membership,
    ModuleChoice,
    ModuleClasses,
    ModuleProfessor,
    Person,
    ProfessorDashboard,
    ProfessorTotals,
    TaughtModule,
)
from app.services.progress import taught_modules

"""
Professors, the modules they teach, and the students in their classes.

A class is one professor and one module. A student asks to join it and the
professor accepts or declines; acceptance is what lets the professor see that
student's progress on the module, and nothing else of it. The ranking a
professor sees is therefore always of students who chose to be ranked.

Anyone can sign up as a professor, the way anyone can sign up as a student.
What keeps that safe is the consent above: a professor sees a student's work
only after that student asks to join the class and is accepted, and the notes
a professor uploads are shown only to the students in that class.
"""

# A student's requests still waiting at once, across every module.
MAX_PENDING_REQUESTS = 10


class TeachingError(Exception):
    """Something the person asking can fix, phrased for them."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


def is_professor(user: User) -> bool:
    return user.role == "professor" and bool(user.is_active)


def clean_modules(slugs: list[str]) -> list[str]:
    """Known module slugs, deduplicated, in curriculum order."""
    unknown = [slug for slug in slugs if slug not in MODULE_BY_SLUG]
    if unknown:
        raise TeachingError(f"there is no module called {unknown[0]!r}", status=422)
    wanted = set(slugs)
    return [module.slug for module in MODULES if module.slug in wanted]


def person(user: User) -> Person:
    return Person(
        id=user.id,
        handle=user.handle,
        display_name=user.display_name,
        institution=user.institution,
        position=user.position,
        avatar_url=user.avatar_url,
    )


def teaches(session: Session, professor: User, module_slug: str) -> bool:
    if not is_professor(professor):
        return False
    count = session.scalar(
        select(func.count())
        .select_from(TeachingAssignment)
        .where(
            TeachingAssignment.professor_id == professor.id,
            TeachingAssignment.module_slug == module_slug,
        )
    )
    return bool(count)


def set_modules(session: Session, professor: User, slugs: list[str]) -> list[str]:
    if not is_professor(professor):
        raise TeachingError("only professors teach modules", status=403)
    wanted = clean_modules(slugs)
    current = {row.module_slug: row for row in professor.teaching}
    for slug, row in current.items():
        if slug not in wanted:
            session.delete(row)
    for slug in wanted:
        if slug not in current:
            session.add(TeachingAssignment(professor_id=professor.id, module_slug=slug))
    session.commit()
    session.refresh(professor)
    return wanted


def make_professor(session: Session, user: User) -> User:
    """Make a freshly registered account a professor's.

    Nothing else is set here: the modules they teach are picked on the teaching
    dashboard, which opens on that choice while there is none.
    """
    if user.role != "professor":
        user.role = "professor"
        session.commit()
    return user


# ---------------------------------------------------------------------------
# The professor's view


def _standings(session: Session, module: Module, rows: list[ClassMembership]) -> list[ClassStudent]:
    """
    The students of one class, best first.

    Ranked by the share of the module done (lessons plus the lab), then by the
    lab's best score, then by who passed the lab first — the tie-break a
    teacher would reach for — and finally by name so the order is stable.
    """
    if not rows:
        return []
    ids = [row.student_id for row in rows]

    lessons: dict[int, set[int]] = defaultdict(set)
    stamps: dict[int, list[datetime]] = defaultdict(list)
    for user_id, index, completed_at in session.execute(
        select(
            LessonCompletion.user_id, LessonCompletion.lesson_index, LessonCompletion.completed_at
        ).where(LessonCompletion.user_id.in_(ids), LessonCompletion.module_slug == module.slug)
    ):
        if 0 <= index < module.lessons:
            lessons[user_id].add(index)
            stamps[user_id].append(completed_at)

    attempts: dict[int, list[tuple[bool, float, datetime]]] = defaultdict(list)
    if module.challenge is not None:
        for user_id, passed, score, created_at in session.execute(
            select(
                ExerciseAttempt.user_id,
                ExerciseAttempt.passed,
                ExerciseAttempt.score,
                ExerciseAttempt.created_at,
            ).where(
                ExerciseAttempt.user_id.in_(ids),
                ExerciseAttempt.challenge_slug == module.challenge.slug,
            )
        ):
            attempts[user_id].append((bool(passed), float(score or 0.0), created_at))
            stamps[user_id].append(created_at)

    units = module_units(module)
    scored = []
    for row in rows:
        mine = attempts[row.student_id]
        passed = any(item[0] for item in mine)
        best = max((item[1] for item in mine), default=0.0)
        first_pass = min((item[2] for item in mine if item[0]), default=None)
        done_lessons = len(lessons[row.student_id])
        percent = round(((done_lessons + (1 if passed else 0)) / units) * 100) if units else 0
        lab = (
            LabStanding(
                title=module.challenge.title,
                passed=passed,
                best_score=round(best, 4),
                attempts=len(mine),
                first_passed_at=as_utc(first_pass),
            )
            if module.challenge is not None
            else None
        )
        last = max(stamps[row.student_id], default=None)
        scored.append((row, percent, best, first_pass, done_lessons, lab, last))

    scored.sort(
        key=lambda item: (
            -item[1],
            -item[2],
            item[3] or datetime.max,
            -item[4],
            item[0].student.display_name.lower(),
        )
    )
    return [
        ClassStudent(
            membership_id=row.id,
            rank=place,
            student=person(row.student),
            percent=percent,
            lessons_completed=done_lessons,
            lessons_total=module.lessons,
            lab=lab,
            last_active=as_utc(last),
            joined_at=as_utc(row.responded_at),
        )
        for place, (row, percent, _best, _first, done_lessons, lab, last) in enumerate(
            scored, start=1
        )
    ]


def dashboard(session: Session, professor: User) -> ProfessorDashboard:
    if not is_professor(professor):
        raise TeachingError("this page is for professors", status=403)

    slugs = taught_modules(professor)
    rows = session.scalars(
        select(ClassMembership)
        .where(ClassMembership.professor_id == professor.id)
        .options(selectinload(ClassMembership.student))
    ).all()

    accepted: dict[str, list[ClassMembership]] = defaultdict(list)
    pending: list[ClassMembership] = []
    for row in rows:
        # A class on a module the professor has stopped teaching is kept, not
        # deleted — it comes back if they take the module on again — but it is
        # not shown, and its requests wait rather than being answered for them.
        if row.module_slug not in slugs or not row.student.is_active:
            continue
        if row.status == "accepted":
            accepted[row.module_slug].append(row)
        elif row.status == "pending":
            pending.append(row)

    notes = dict(
        session.execute(
            select(ModuleNote.module_slug, func.count())
            .where(ModuleNote.uploader_id == professor.id)
            .group_by(ModuleNote.module_slug)
        ).all()
    )

    modules = []
    for slug in slugs:
        module = MODULE_BY_SLUG[slug]
        modules.append(
            TaughtModule(
                slug=slug,
                title=module.title,
                ket=module.ket,
                lessons=module.lessons,
                lab_title=module.challenge.title if module.challenge else None,
                students=_standings(session, module, accepted[slug]),
                pending=sum(1 for row in pending if row.module_slug == slug),
                notes=int(notes.get(slug, 0)),
            )
        )

    # Oldest first: the student who has waited longest is answered first.
    pending.sort(key=lambda row: row.created_at)
    requests = [
        ClassRequest(
            id=row.id,
            module_slug=row.module_slug,
            module_title=MODULE_BY_SLUG[row.module_slug].title,
            student=person(row.student),
            note=row.note,
            created_at=as_utc(row.created_at),
        )
        for row in pending
    ]

    return ProfessorDashboard(
        professor=person(professor),
        modules=modules,
        requests=requests,
        catalogue=[ModuleChoice(slug=m.slug, title=m.title, ket=m.ket) for m in MODULES],
        totals=ProfessorTotals(
            students=len({row.student_id for group in accepted.values() for row in group}),
            requests=len(requests),
            notes=sum(int(notes.get(slug, 0)) for slug in slugs),
        ),
    )


def _professors_row(session: Session, professor: User, membership_id: int) -> ClassMembership:
    if not is_professor(professor):
        raise TeachingError("only professors answer class requests", status=403)
    row = session.get(ClassMembership, membership_id)
    if row is None or row.professor_id != professor.id:
        # The same answer as a missing row, so ids cannot be probed.
        raise TeachingError("no such request", status=404)
    return row


def respond(session: Session, professor: User, membership_id: int, *, accept: bool) -> None:
    row = _professors_row(session, professor, membership_id)
    if row.status != "pending":
        raise TeachingError(f"that request was already {row.status}", status=409)
    row.status = "accepted" if accept else "declined"
    row.responded_at = utcnow()
    session.commit()


def remove_student(session: Session, professor: User, membership_id: int) -> None:
    row = _professors_row(session, professor, membership_id)
    if row.status != "accepted":
        raise TeachingError("that student is not in your class", status=409)
    session.delete(row)
    session.commit()


# ---------------------------------------------------------------------------
# The student's view


def _membership(row: ClassMembership) -> Membership:
    return Membership(
        id=row.id,
        status=row.status,  # type: ignore[arg-type]
        note=row.note,
        created_at=as_utc(row.created_at),
        responded_at=as_utc(row.responded_at),
    )


def _module(slug: str) -> Module:
    module = MODULE_BY_SLUG.get(slug)
    if module is None:
        raise TeachingError("there is no module with that name", status=404)
    return module


def module_classes(session: Session, viewer: User, module_slug: str) -> ModuleClasses:
    _module(module_slug)
    assignments = session.scalars(
        select(TeachingAssignment)
        .where(TeachingAssignment.module_slug == module_slug)
        .options(selectinload(TeachingAssignment.professor))
    ).all()
    professors = [row.professor for row in assignments if is_professor(row.professor)]
    ids = [professor.id for professor in professors]

    counts: dict[int, int] = {}
    if ids:
        counts = dict(
            session.execute(
                select(ClassMembership.professor_id, func.count())
                .where(
                    ClassMembership.professor_id.in_(ids),
                    ClassMembership.module_slug == module_slug,
                    ClassMembership.status == "accepted",
                )
                .group_by(ClassMembership.professor_id)
            ).all()
        )
    mine = {
        row.professor_id: row
        for row in session.scalars(
            select(ClassMembership).where(
                ClassMembership.student_id == viewer.id,
                ClassMembership.module_slug == module_slug,
            )
        )
    }

    entries = [
        ModuleProfessor(
            professor=person(professor),
            students=int(counts.get(professor.id, 0)),
            membership=_membership(mine[professor.id]) if professor.id in mine else None,
        )
        for professor in sorted(professors, key=lambda item: item.display_name.lower())
        if professor.id != viewer.id
    ]
    return ModuleClasses(module_slug=module_slug, professors=entries, you_teach=viewer.id in ids)


def request_join(
    session: Session, student: User, module_slug: str, *, professor_id: int, note: str | None
) -> None:
    _module(module_slug)
    professor = session.get(User, professor_id)
    if professor is None or not teaches(session, professor, module_slug):
        raise TeachingError("that professor does not teach this module", status=404)
    if professor.id == student.id:
        raise TeachingError("that is your own class", status=400)

    clean_note = " ".join((note or "").split())[:300] or None
    row = session.scalars(
        select(ClassMembership).where(
            ClassMembership.student_id == student.id,
            ClassMembership.professor_id == professor.id,
            ClassMembership.module_slug == module_slug,
        )
    ).first()
    if row is not None and row.status == "accepted":
        raise TeachingError("you are already in this class", status=409)
    if row is not None and row.status == "pending":
        raise TeachingError("your request is already waiting for them", status=409)

    waiting = int(
        session.scalar(
            select(func.count())
            .select_from(ClassMembership)
            .where(ClassMembership.student_id == student.id, ClassMembership.status == "pending")
        )
        or 0
    )
    if waiting >= MAX_PENDING_REQUESTS:
        raise TeachingError(
            f"you have {waiting} class requests waiting — give those a chance first", status=429
        )

    if row is None:
        session.add(
            ClassMembership(
                student_id=student.id,
                professor_id=professor.id,
                module_slug=module_slug,
                status="pending",
                note=clean_note,
            )
        )
    else:
        # Declined once. Asking again reopens the same row rather than adding
        # a second one.
        row.status = "pending"
        row.note = clean_note
        row.created_at = utcnow()
        row.responded_at = None
    session.commit()


def leave(session: Session, student: User, membership_id: int) -> str:
    """Withdraw a request, or leave a class. Returns the module it was for."""
    row = session.get(ClassMembership, membership_id)
    if row is None or row.student_id != student.id:
        raise TeachingError("no such request", status=404)
    module_slug = row.module_slug
    session.delete(row)
    session.commit()
    return module_slug
