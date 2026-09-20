from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.core.clock import utcnow


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    handle: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(120), nullable=False)
    institution: Mapped[str | None] = mapped_column(String(160), nullable=True)

    # --- the directory card -------------------------------------------------
    # What the research hub lists a person under. `role` is deliberately a
    # plain string rather than an enum: it is displayed and filtered on.
    # "student" and "mentor" are self-described on the hub card. "professor" is
    # not: it is chosen at registration, on the Professor tab, and cannot be
    # set from the hub card — a professor reads the progress of the students
    # they accept and publishes notes to them.
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="student")
    headline: Mapped[str | None] = mapped_column(String(140), nullable=True)
    # Free text, comma separated. Searched, and shown as chips.
    interests: Mapped[str | None] = mapped_column(String(240), nullable=True)
    open_to_mentoring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # A seeded example profile, not a person. Marked in the database rather
    # than inferred from a name prefix so the directory can label it plainly
    # and nobody mistakes a fixture for a real academic.
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # A profile picture, as a URL. Nullable, and nothing in the product requires
    # one: a member without a picture gets their initials, which reads better
    # than a grid of identical placeholder silhouettes.
    avatar_url: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # --- the expanded profile ----------------------------------------------
    # What the directory row reveals when somebody opens it. All nullable: a
    # student who has filled in nothing still has a perfectly good card, and the
    # panel simply shows fewer sections rather than a grid of empty labels.
    position: Mapped[str | None] = mapped_column(String(120), nullable=True)
    education: Mapped[str | None] = mapped_column(String(320), nullable=True)
    focus: Mapped[str | None] = mapped_column(String(700), nullable=True)
    mentoring: Mapped[str | None] = mapped_column(String(700), nullable=True)
    availability: Mapped[str | None] = mapped_column(String(180), nullable=True)

    # --- the starting point -------------------------------------------------
    # Two questions asked once, at sign-up: how familiar the learner is with the
    # maths and physics, and how much programming they have done. Nullable
    # because an account made before this existed has not answered, and "has not
    # answered" has to stay distinct from "answered: none of it" — the first
    # should be asked, the second should not be asked again.
    math_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    code_level: Mapped[int | None] = mapped_column(Integer, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utcnow, onupdate=utcnow
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    sessions: Mapped[list["AuthSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    lessons: Mapped[list["LessonCompletion"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    attempts: Mapped[list["ExerciseAttempt"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    badges: Mapped[list["EarnedBadge"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    sent_requests: Mapped[list["Connection"]] = relationship(
        back_populates="requester",
        foreign_keys="Connection.requester_id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    received_requests: Mapped[list["Connection"]] = relationship(
        back_populates="addressee",
        foreign_keys="Connection.addressee_id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    notes: Mapped[list["ModuleNote"]] = relationship(
        back_populates="uploader", cascade="all, delete-orphan", passive_deletes=True
    )
    teaching: Mapped[list["TeachingAssignment"]] = relationship(
        back_populates="professor", cascade="all, delete-orphan", passive_deletes=True
    )


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    user_agent: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    last_used_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    replaced_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    access_jti: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)

    user: Mapped[User] = relationship(back_populates="sessions")

    @property
    def active(self) -> bool:
        return self.revoked_at is None and self.expires_at > utcnow()


class LessonCompletion(Base):
    __tablename__ = "lesson_completions"
    __table_args__ = (
        UniqueConstraint("user_id", "module_slug", "lesson_index", name="uq_lesson_once"),
        Index("ix_lesson_user_module", "user_id", "module_slug"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    module_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    lesson_index: Mapped[int] = mapped_column(Integer, nullable=False)
    seconds_spent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)

    user: Mapped[User] = relationship(back_populates="lessons")


class ExerciseAttempt(Base):
    __tablename__ = "exercise_attempts"
    __table_args__ = (
        Index("ix_attempt_user_challenge", "user_id", "challenge_slug"),
        Index("ix_attempt_user_time", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    challenge_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    state_fidelity: Mapped[float | None] = mapped_column(Float, nullable=True)
    unitary_fidelity: Mapped[float | None] = mapped_column(Float, nullable=True)
    gates: Mapped[int | None] = mapped_column(Integer, nullable=True)
    depth: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(String(24), nullable=False, default="grader")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utcnow, index=True
    )

    user: Mapped[User] = relationship(back_populates="attempts")


class EarnedBadge(Base):
    __tablename__ = "earned_badges"
    __table_args__ = (UniqueConstraint("user_id", "badge_id", name="uq_badge_once"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    badge_id: Mapped[str] = mapped_column(String(64), nullable=False)
    earned_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)

    user: Mapped[User] = relationship(back_populates="badges")


class Connection(Base):
    """
    One person asking to be connected to another.

    Modelled as a single directed row rather than a pair, the way every
    professional network does it: the direction is what lets the addressee see
    "so-and-so wants to connect" and the requester see "waiting on them". Once
    the status is `accepted` the row is read symmetrically — both sides are
    connected — and the direction survives only as a record of who asked.

    The unique constraint is on the ordered pair, so A→B and B→A can both
    exist. That is intentional: two people asking each other independently is a
    real thing that happens, and the service resolves it by accepting both
    rather than failing one of them on a constraint the user cannot see.
    """

    __tablename__ = "connections"
    __table_args__ = (
        UniqueConstraint("requester_id", "addressee_id", name="uq_connection_pair"),
        CheckConstraint("requester_id <> addressee_id", name="ck_connection_not_self"),
        Index("ix_connection_addressee_status", "addressee_id", "status"),
        Index("ix_connection_requester_status", "requester_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    requester_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    addressee_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # "pending" | "accepted" | "declined". A declined row is kept rather
    # than deleted so a second ask can be rate-limited against it, and so
    # the requester is not told outright that they were turned down.
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    requester: Mapped[User] = relationship(
        back_populates="sent_requests", foreign_keys=[requester_id]
    )
    addressee: Mapped[User] = relationship(
        back_populates="received_requests", foreign_keys=[addressee_id]
    )


class ModuleNote(Base):
    """
    A PDF of notes a professor uploaded for one module.

    The file itself lives on disk under `stored_name`, a random name chosen
    here: never the uploader's filename, which is kept only to be shown back.
    A path built from user input is a path somebody will eventually aim at
    `../../`, and a random hex name leaves nothing to aim.

    `sha256` is what stops the same file being uploaded twice by one person
    for one module, which is the usual result of a slow connection and an
    impatient second click.
    """

    __tablename__ = "module_notes"
    __table_args__ = (
        Index("ix_note_module_time", "module_slug", "created_at"),
        Index("ix_note_uploader_module", "uploader_id", "module_slug"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    module_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    uploader_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(140), nullable=False)
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)
    original_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    stored_name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    # Counted from the file where that is cheap and reliable, and otherwise
    # left empty rather than guessed.
    pages: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)

    uploader: Mapped[User] = relationship(back_populates="notes")


class OwnModule(Base):
    """A module a professor adds themselves, outside the site's curriculum.

    The eight modules are the course; this is the rest of a real syllabus — a
    week of lectures, a seminar, a paper the class is reading — which the
    professor names and puts their own notes under. It has no lessons and no
    lab, because nothing on the site teaches it, so it carries a title, an
    optional line about it, and whatever files they upload.

    The slug is derived from the title but kept unique across the table, so a
    note row can go on pointing at a module by slug whichever kind it is.
    """

    __tablename__ = "own_modules"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_own_module_slug"),
        Index("ix_own_module_professor", "professor_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    professor_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    slug: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)

    professor: Mapped[User] = relationship()


class TeachingAssignment(Base):
    """A module a professor teaches: where their notes go and whose class a
    student can ask to join."""

    __tablename__ = "teaching_assignments"
    __table_args__ = (
        UniqueConstraint("professor_id", "module_slug", name="uq_teaches_once"),
        Index("ix_teaching_module", "module_slug"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    professor_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    module_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)

    professor: Mapped[User] = relationship(back_populates="teaching")


class ClassMembership(Base):
    """
    A student's place in one professor's class for one module.

    It starts as the student's request and becomes membership when the
    professor accepts it, which is also the student's consent: accepting is
    what lets the professor see that student's progress on the module. Nothing
    before acceptance is visible to the professor beyond the request itself.

    One row per student, professor and module. A declined request keeps its row
    so asking again reopens it rather than piling up duplicates.
    """

    __tablename__ = "class_memberships"
    __table_args__ = (
        UniqueConstraint(
            "student_id", "professor_id", "module_slug", name="uq_membership_once"
        ),
        CheckConstraint("student_id <> professor_id", name="ck_membership_not_self"),
        Index("ix_membership_professor_status", "professor_id", "status"),
        Index("ix_membership_student", "student_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    professor_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    module_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    # "pending" | "accepted" | "declined"
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    student: Mapped[User] = relationship(foreign_keys=[student_id])
    professor: Mapped[User] = relationship(foreign_keys=[professor_id])
