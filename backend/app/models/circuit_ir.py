from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_QUBITS = 12
MAX_CLBITS = 12
MAX_OPERATIONS = 512

GATE_ALIASES: dict[str, str] = {
    "hadamard": "h",
    "not": "x",
    "paulix": "x",
    "pauliy": "y",
    "pauliz": "z",
    "sdag": "sdg",
    "sdagger": "sdg",
    "tdag": "tdg",
    "tdagger": "tdg",
    "phase": "p",
    "u1": "p",
    "cnot": "cx",
    "cnot10": "cx",
    "ccnot": "ccx",
    "toffoli": "ccx",
    "fredkin": "cswap",
    "i": "id",
    "identity": "id",
    "sqrtx": "sx",
    "v": "sx",
}

GATE_ARITY: dict[str, int] = {
    "id": 1,
    "h": 1,
    "x": 1,
    "y": 1,
    "z": 1,
    "s": 1,
    "sdg": 1,
    "t": 1,
    "tdg": 1,
    "sx": 1,
    "rx": 1,
    "ry": 1,
    "rz": 1,
    "p": 1,
    "u": 1,
    "cx": 2,
    "cy": 2,
    "cz": 2,
    "ch": 2,
    "swap": 2,
    "crx": 2,
    "cry": 2,
    "crz": 2,
    "cp": 2,
    "ccx": 3,
    "cswap": 3,
}

GATE_PARAMS: dict[str, int] = {
    "rx": 1,
    "ry": 1,
    "rz": 1,
    "p": 1,
    "crx": 1,
    "cry": 1,
    "crz": 1,
    "cp": 1,
    "u": 3,
}

SUPPORTED_GATES: tuple[str, ...] = tuple(sorted(GATE_ARITY))


def canonical_gate_name(raw: str) -> str:
    key = raw.strip().lower().replace("-", "").replace("_", "")
    return GATE_ALIASES.get(key, key)


class GateOperation(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    gate: str
    targets: list[int] = Field(default_factory=list)
    control: int | None = None
    params: list[float] = Field(default_factory=list)
    step: int = Field(default=0, ge=0)

    @field_validator("gate", mode="before")
    @classmethod
    def _normalise_gate(cls, value: Any) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("gate must be a non-empty string")
        name = canonical_gate_name(value)
        if name not in GATE_ARITY:
            raise ValueError(
                f"unsupported gate '{value}'. supported: {', '.join(SUPPORTED_GATES)}"
            )
        return name

    @field_validator("targets", mode="before")
    @classmethod
    def _coerce_targets(cls, value: Any) -> list[int]:
        if value is None:
            return []
        if isinstance(value, int):
            return [value]
        return list(value)

    @field_validator("params", mode="before")
    @classmethod
    def _coerce_params(cls, value: Any) -> list[float]:
        if value is None:
            return []
        if isinstance(value, (int, float)):
            return [float(value)]
        return [float(item) for item in value]

    @model_validator(mode="after")
    def _validate_shape(self) -> GateOperation:
        arity = GATE_ARITY[self.gate]
        wires = self.wires

        if len(wires) != arity:
            raise ValueError(
                f"gate '{self.gate}' acts on {arity} qubit(s) but {len(wires)} were given"
            )
        if any(wire < 0 for wire in wires):
            raise ValueError("qubit indices must be non-negative")
        if len(set(wires)) != len(wires):
            raise ValueError(f"gate '{self.gate}' repeats a qubit: {wires}")

        expected = GATE_PARAMS.get(self.gate, 0)
        if len(self.params) < expected:
            raise ValueError(
                f"gate '{self.gate}' needs {expected} parameter(s), got {len(self.params)}"
            )
        if expected == 0 and self.params:
            object.__setattr__(self, "params", [])
        elif len(self.params) > expected:
            object.__setattr__(self, "params", self.params[:expected])
        return self

    @property
    def wires(self) -> list[int]:
        if self.control is None:
            return list(self.targets)
        return [self.control, *self.targets]

    @property
    def arity(self) -> int:
        return GATE_ARITY[self.gate]

    @property
    def label(self) -> str:
        if not self.params:
            return self.gate.upper()
        rendered = ", ".join(f"{value:.4g}" for value in self.params)
        return f"{self.gate.upper()}({rendered})"


class Measurement(BaseModel):
    model_config = ConfigDict(extra="ignore")

    targets: list[int] = Field(default_factory=list)
    clbits: list[int] = Field(default_factory=list)
    #: The time step the measurement sits at, when the client knows it. Left out,
    #: a measurement is taken to come after every gate — which is how the
    #: simulators run it, and how most clients only ever send one.
    step: int | None = Field(default=None, ge=0)

    @field_validator("targets", "clbits", mode="before")
    @classmethod
    def _coerce(cls, value: Any) -> list[int]:
        if value is None:
            return []
        if isinstance(value, int):
            return [value]
        return list(value)

    @model_validator(mode="after")
    def _pair_up(self) -> Measurement:
        if not self.targets:
            raise ValueError("a measurement needs at least one target qubit")
        if any(index < 0 for index in self.targets):
            raise ValueError("qubit indices must be non-negative")
        if not self.clbits:
            object.__setattr__(self, "clbits", list(self.targets))
        if len(self.clbits) != len(self.targets):
            raise ValueError("targets and clbits must be the same length")
        if any(index < 0 for index in self.clbits):
            raise ValueError("classical bit indices must be non-negative")
        return self


class CircuitIR(BaseModel):
    model_config = ConfigDict(extra="ignore")

    qubits: int = Field(default=2, ge=1, le=MAX_QUBITS)
    clbits: int = Field(default=0, ge=0, le=MAX_CLBITS)
    timeline: list[GateOperation] = Field(default_factory=list)
    measurements: list[Measurement] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_register(self) -> CircuitIR:
        if len(self.timeline) > MAX_OPERATIONS:
            raise ValueError(f"a circuit may hold at most {MAX_OPERATIONS} operations")

        for operation in self.timeline:
            for wire in operation.wires:
                if wire >= self.qubits:
                    raise ValueError(
                        f"gate '{operation.gate}' uses qubit {wire} "
                        f"but the register only has {self.qubits}"
                    )

        for measurement in self.measurements:
            for wire in measurement.targets:
                if wire >= self.qubits:
                    raise ValueError(
                        f"measurement uses qubit {wire} "
                        f"but the register only has {self.qubits}"
                    )

        needed = 0
        for measurement in self.measurements:
            needed = max(needed, max(measurement.clbits) + 1)
        if needed > MAX_CLBITS:
            raise ValueError(f"a circuit may hold at most {MAX_CLBITS} classical bits")
        if needed > self.clbits:
            object.__setattr__(self, "clbits", needed)
        return self

    @property
    def dimension(self) -> int:
        return 1 << self.qubits

    @property
    def depth(self) -> int:
        if not self.timeline:
            return 0
        return max(operation.step for operation in self.timeline) + 1

    @property
    def is_measured(self) -> bool:
        return bool(self.measurements)

    def ordered_timeline(self) -> list[GateOperation]:
        return sorted(self.timeline, key=lambda item: (item.step, min(item.wires)))

    def measured_qubits(self) -> list[int]:
        seen: list[int] = []
        for measurement in self.measurements:
            for wire in measurement.targets:
                if wire not in seen:
                    seen.append(wire)
        return sorted(seen)

    def gate_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for operation in self.timeline:
            counts[operation.gate] = counts.get(operation.gate, 0) + 1
        return dict(sorted(counts.items()))

    def basis_labels(self) -> list[str]:
        return [format(index, f"0{self.qubits}b") for index in range(self.dimension)]
