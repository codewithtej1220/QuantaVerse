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

    target: CircuitIR
    submission: CircuitIR = Field(
        validation_alias=AliasChoices("submission", "candidate", "user")
    )
    threshold: float = Field(default=0.99, ge=0.0, le=1.0)


class GradeCheck(BaseModel):
    check: str
    passed: bool
    score: float
    threshold: float
    detail: str


class GradeResponse(BaseModel):
    passed: bool
    checks: list[GradeCheck]
    hint: str | None = None


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
    history: list[TutorMessage] = Field(default_factory=list, max_length=12)
    backend: str = "qiskit"


class HealthResponse(BaseModel):
    status: str
    version: str
    backends: dict[str, Any]
    tutor: dict[str, Any]
