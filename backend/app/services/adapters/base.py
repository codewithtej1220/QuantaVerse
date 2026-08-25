from __future__ import annotations

import bisect
import random
import time
from abc import ABC, abstractmethod
from typing import Any, Iterable, Sequence

from app.models.circuit_ir import CircuitIR

MAX_STATEVECTOR_RETURN = 1024
AMPLITUDE_EPSILON = 1e-12


class AdapterError(RuntimeError):
    def __init__(self, message: str, backend: str = "unknown") -> None:
        super().__init__(message)
        self.backend = backend
        self.message = message


class BaseAdapter(ABC):
    name: str = "base"
    framework: str = "base"

    @abstractmethod
    def build_circuit(self, ir: CircuitIR) -> Any:
        raise NotImplementedError

    @abstractmethod
    def simulate(self, ir: CircuitIR, shots: int = 1024) -> dict[str, Any]:
        raise NotImplementedError

    def version(self) -> str:
        return "unknown"

    def diagram(self, ir: CircuitIR) -> str | None:
        try:
            return str(self.build_circuit(ir))
        except Exception:
            return None

    @staticmethod
    def clean_amplitudes(raw: Iterable[Any]) -> list[complex]:
        return [complex(value) for value in raw]

    @staticmethod
    def probabilities_from(amplitudes: Sequence[complex]) -> list[float]:
        weights = [abs(value) ** 2 for value in amplitudes]
        total = sum(weights)
        if total <= AMPLITUDE_EPSILON:
            return [0.0 for _ in weights]
        return [weight / total for weight in weights]

    @staticmethod
    def pack_statevector(amplitudes: Sequence[complex]) -> list[dict[str, float]] | None:
        if len(amplitudes) > MAX_STATEVECTOR_RETURN:
            return None
        packed: list[dict[str, float]] = []
        for value in amplitudes:
            real = float(value.real)
            imaginary = float(value.imag)
            packed.append(
                {
                    "re": 0.0 if abs(real) < 1e-12 else round(real, 12),
                    "im": 0.0 if abs(imaginary) < 1e-12 else round(imaginary, 12),
                }
            )
        return packed

    @staticmethod
    def sample_histogram(
        probabilities: Sequence[float],
        labels: Sequence[str],
        shots: int,
        seed: int = 20260825,
    ) -> dict[str, int]:
        cumulative: list[float] = []
        running = 0.0
        for probability in probabilities:
            running += probability
            cumulative.append(running)
        if running <= AMPLITUDE_EPSILON:
            return {}
        cumulative = [value / running for value in cumulative]

        rng = random.Random(seed)
        counts: dict[str, int] = {}
        for _ in range(shots):
            index = bisect.bisect_left(cumulative, rng.random())
            if index >= len(labels):
                index = len(labels) - 1
            counts[labels[index]] = counts.get(labels[index], 0) + 1
        return dict(sorted(counts.items()))

    @staticmethod
    def clbit_map(ir: CircuitIR) -> list[int | None]:
        width = max(ir.clbits, 1)
        mapping: list[int | None] = [None] * width
        for measurement in ir.measurements:
            for qubit, clbit in zip(measurement.targets, measurement.clbits):
                if clbit < width:
                    mapping[clbit] = qubit
        return mapping

    @classmethod
    def marginalise(cls, ir: CircuitIR, full_counts: dict[str, int]) -> dict[str, int]:
        measured = ir.measured_qubits()
        if not measured or len(measured) == ir.qubits:
            return dict(sorted(full_counts.items()))

        mapping = cls.clbit_map(ir)
        reduced: dict[str, int] = {}
        for key, count in full_counts.items():
            bits = key[::-1]
            rendered = "".join(
                bits[qubit] if qubit is not None and qubit < len(bits) else "0"
                for qubit in reversed(mapping)
            )
            reduced[rendered] = reduced.get(rendered, 0) + count
        return dict(sorted(reduced.items()))

    @staticmethod
    def counts_from_rows(rows: Iterable[Sequence[int]], qubits: int) -> dict[str, int]:
        counts: dict[str, int] = {}
        for row in rows:
            key = "".join(str(int(row[index])) for index in reversed(range(qubits)))
            counts[key] = counts.get(key, 0) + 1
        return dict(sorted(counts.items()))

    def response(
        self,
        ir: CircuitIR,
        shots: int,
        amplitudes: Sequence[complex],
        histogram: dict[str, int],
        started: float,
        status: str = "ok",
        note: str | None = None,
    ) -> dict[str, Any]:
        probabilities = self.probabilities_from(amplitudes)
        packed = self.pack_statevector(amplitudes)
        return {
            "backend": self.name,
            "framework_version": self.version(),
            "qubits": ir.qubits,
            "clbits": ir.clbits,
            "shots": shots,
            "depth": ir.depth,
            "gate_counts": ir.gate_counts(),
            "labels": ir.basis_labels(),
            "statevector": packed,
            "probabilities": [round(value, 12) for value in probabilities],
            "histogram": histogram,
            "measured_qubits": ir.measured_qubits(),
            "duration_ms": round((time.perf_counter() - started) * 1000, 3),
            "truncated": packed is None,
            "status": status,
            "note": note,
        }
