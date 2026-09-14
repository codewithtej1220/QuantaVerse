from __future__ import annotations

from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.models.circuit_ir import CircuitIR


class SimulationRequest(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    circuit: CircuitIR = Field(validation_alias=AliasChoices("circuit", "ir", "circuit_ir"))
    backend: str = "qiskit"
    shots: int = Field(default=1024, ge=1, le=100_000)


class Amplitude(BaseModel):
    re: float
    im: float


class SimulationResponse(BaseModel):
    backend: str
    framework_version: str
    qubits: int
    clbits: int
    shots: int
    depth: int
    gate_counts: dict[str, int]
    labels: list[str]
    statevector: list[Amplitude] | None
    probabilities: list[float]
    histogram: dict[str, int]
    measured_qubits: list[int]
    duration_ms: float
    truncated: bool = False
    status: Literal["ok", "stub"] = "ok"
    note: str | None = None


class GradeRequest(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    #: Only consulted when no challenge is named. For a lab the server marks
    #: against its own reference, whatever arrives here.
    target: CircuitIR | None = None
    submission: CircuitIR = Field(
        validation_alias=AliasChoices("submission", "candidate", "user")
    )
    #: Kept so older clients still validate. Marking is exact — within rounding
    #: — so there is no bar for a client to move.
    threshold: float = Field(default=0.99, ge=0.0, le=1.0)
    #: "state" or "operation", for a free comparison. A lab has its own.
    mode: Literal["state", "operation"] | None = None
    challenge_slug: str | None = Field(
        default=None,
        max_length=64,
        validation_alias=AliasChoices("challenge_slug", "challengeSlug", "challenge"),
    )


class GradeCheck(BaseModel):
    check: str
    passed: bool
    score: float
    threshold: float
    detail: str
    #: What the check is called on the page.
    label: str = ""
    #: False for a check shown for information, which cannot fail the grade.
    required: bool = True


class GradeResponse(BaseModel):
    passed: bool
    checks: list[GradeCheck]
    hint: str | None = None
    #: How it was marked: "state" or "operation".
    mode: str | None = None
    recorded: bool = False
    earned_badges: list[str] = Field(default_factory=list)


class SandboxRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    code: str = Field(min_length=1, max_length=20_000)
    variable: str | None = None


class SandboxResponse(BaseModel):
    ok: bool
    circuit: CircuitIR | None = None
    variable: str | None = None
    stdout: str = ""
    error: str | None = None
    error_type: str | None = None
    duration_ms: float = 0.0
    diagram: str | None = None


class TutorMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class TutorRequest(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    prompt: str = Field(min_length=1, max_length=4_000)
    circuit: CircuitIR | None = Field(
        default=None, validation_alias=AliasChoices("circuit", "ir", "circuit_ir")
    )
    lesson_id: str | None = Field(
        default=None, validation_alias=AliasChoices("lesson_id", "lessonId", "lesson")
    )
    #: The graded lab on screen, if any, so the tutor answers about that task.
    challenge_slug: str | None = Field(
        default=None,
        max_length=64,
        validation_alias=AliasChoices("challenge_slug", "challengeSlug", "challenge"),
    )
    history: list[TutorMessage] = Field(default_factory=list, max_length=12)
    backend: str = "qiskit"


class HealthResponse(BaseModel):
    status: str
    version: str
    backends: dict[str, Any]
    tutor: dict[str, Any]
    accounts: dict[str, Any] = Field(default_factory=dict)
