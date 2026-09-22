from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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
    # A module the professor wrote themselves. It has no class of its own to
    # join: it goes to the students of all their classes, and `students` is
    # those of them who have started it. `own_id` is what saves and deletes it.
    own: bool = False
    own_id: int | None = None
    summary: str | None = None
    # A module of their own, as they last saved it, for the editor to open on.
    content: OwnModuleContent | None = None


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


class OwnModuleRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = Field(min_length=2, max_length=120)
    summary: str | None = Field(default=None, max_length=300)


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


# ---------------------------------------------------------------------------
# A professor's own module, in full
#
# Everything a curriculum module carries, and every part of it optional: a
# module can be a single PDF, a set of lessons with no lab, or a lab on its
# own. The limits are there so one save cannot fill a disk, not to make anyone
# fill anything in.

#: The gates the sandbox's board and the grader both carry.
LAB_GATES = frozenset({"h", "x", "y", "z", "s", "t", "cx"})


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


class OwnQuestion(BaseModel):
    """One checkpoint question: the prompt, its options, which one is right."""

    model_config = ConfigDict(extra="ignore")

    prompt: str = Field(min_length=1, max_length=400)
    options: list[str] = Field(min_length=2, max_length=6)
    answer: int = Field(ge=0)
    because: str | None = Field(default=None, max_length=500)

    @field_validator("prompt")
    @classmethod
    def _prompt(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("a question needs its question")
        return stripped

    @field_validator("options")
    @classmethod
    def _options(cls, value: list[str]) -> list[str]:
        cleaned = [option.strip()[:200] for option in value]
        if any(not option for option in cleaned):
            raise ValueError("every option needs some text")
        return cleaned

    @field_validator("because")
    @classmethod
    def _because(cls, value: str | None) -> str | None:
        return _blank_to_none(value)

    @model_validator(mode="after")
    def _answer_in_range(self) -> OwnQuestion:
        if self.answer >= len(self.options):
            raise ValueError("the right answer has to be one of the options")
        return self


class OwnLesson(BaseModel):
    """A lesson as a professor writes it. Everything but its place is optional."""

    model_config = ConfigDict(extra="ignore")

    title: str = Field(default="", max_length=140)
    summary: str | None = Field(default=None, max_length=300)
    #: Paragraphs, separated by a blank line.
    body: str | None = Field(default=None, max_length=20_000)
    video_url: str | None = Field(default=None, max_length=500)
    practice: str | None = Field(default=None, max_length=600)
    quiz: list[OwnQuestion] = Field(default_factory=list, max_length=10)
    #: Where the lesson sat when the editor loaded it, so that moving or
    #: removing a lesson moves or removes students' ticks with it. Absent for
    #: a new lesson. Not stored — it only describes this one save.
    origin: int | None = Field(default=None, ge=0)

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator("summary", "body", "practice")
    @classmethod
    def _text(cls, value: str | None) -> str | None:
        return _blank_to_none(value)

    @field_validator("video_url")
    @classmethod
    def _video(cls, value: str | None) -> str | None:
        url = _blank_to_none(value)
        if url is not None and not url.lower().startswith(("https://", "http://")):
            raise ValueError("a video link has to start with https://")
        return url


class OwnLabOp(BaseModel):
    """One gate of the lab's answer circuit, in reading order."""

    model_config = ConfigDict(extra="ignore")

    gate: str
    wires: list[int] = Field(min_length=1, max_length=2)

    @model_validator(mode="after")
    def _shape(self) -> OwnLabOp:
        self.gate = self.gate.strip().lower()
        if self.gate == "cnot":
            self.gate = "cx"
        if self.gate not in LAB_GATES:
            raise ValueError(f"the lab board has no {self.gate!r} gate")
        wanted = 2 if self.gate == "cx" else 1
        if len(self.wires) != wanted or len(set(self.wires)) != len(self.wires):
            raise ValueError(
                "cx takes a control and a different target"
                if self.gate == "cx"
                else f"{self.gate} acts on one qubit"
            )
        return self


class OwnLab(BaseModel):
    """The graded build: a goal in words and the circuit it is marked against."""

    model_config = ConfigDict(extra="ignore")

    title: str = Field(default="", max_length=140)
    goal: str | None = Field(default=None, max_length=600)
    why: str | None = Field(default=None, max_length=600)
    qubits: int = Field(default=2, ge=1, le=4)
    mode: Literal["state", "operation"] = "state"
    ops: list[OwnLabOp] = Field(default_factory=list, max_length=40)

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator("goal", "why")
    @classmethod
    def _text(cls, value: str | None) -> str | None:
        return _blank_to_none(value)

    @model_validator(mode="after")
    def _circuit(self) -> OwnLab:
        if not self.ops:
            raise ValueError(
                "a lab needs its answer circuit — the grader marks students against it"
            )
        for op in self.ops:
            if any(wire < 0 or wire >= self.qubits for wire in op.wires):
                raise ValueError(f"the answer uses a qubit outside the lab's {self.qubits}")
        return self


class OwnModuleContent(BaseModel):
    """A whole module of the professor's own, saved in one go."""

    model_config = ConfigDict(extra="ignore")

    title: str = Field(min_length=2, max_length=120)
    summary: str | None = Field(default=None, max_length=300)
    lessons: list[OwnLesson] = Field(default_factory=list, max_length=30)
    lab: OwnLab | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("give the module a name")
        return cleaned

    @field_validator("summary")
    @classmethod
    def _summary(cls, value: str | None) -> str | None:
        return _blank_to_none(value)


class OwnLessonView(BaseModel):
    title: str
    summary: str | None = None
    body: list[str]
    video_url: str | None = None
    practice: str | None = None
    quiz: list[OwnQuestion]
    minutes: int


class OwnModuleView(BaseModel):
    """A professor's own module as a student takes it."""

    slug: str
    title: str
    summary: str | None = None
    professor: Person
    lessons: list[OwnLessonView]
    lab: OwnLab | None = None
    completed_lessons: list[int]
    lab_progress: LabStanding | None = None
    #: The viewer wrote it, so they see it as it will look and can edit it.
    owner: bool = False


class OwnModuleCard(BaseModel):
    """One line of the curriculum's "from your professors" shelf."""

    slug: str
    title: str
    summary: str | None = None
    professor: Person
    lessons: int
    has_lab: bool
    percent: int


TaughtModule.model_rebuild()
