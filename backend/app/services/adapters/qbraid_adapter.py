from __future__ import annotations

import time
from typing import Any

from app.models.circuit_ir import CircuitIR
from app.services.adapters.base import BaseAdapter

STUB_NOTE = (
    "qBraid is a stub: no credentials are configured and no remote device was contacted. "
    "The statevector and histogram below are mock data shaped like a real response so the "
    "client can be built against this backend today. Switch to qiskit, cirq or pennylane "
    "for real simulation."
)

MOCK_DEVICES = [
    {"id": "aws_sv1", "provider": "AWS Braket", "qubits": 34, "status": "offline (stub)"},
    {"id": "ibm_kyiv", "provider": "IBM Quantum", "qubits": 127, "status": "offline (stub)"},
    {"id": "ionq_aria", "provider": "IonQ", "qubits": 25, "status": "offline (stub)"},
]


class QBraidAdapter(BaseAdapter):
    name = "qbraid"
    framework = "qBraid (stub)"

    def version(self) -> str:
        return "qbraid stub 0.1"

    def available(self) -> bool:
        return False

    def devices(self) -> list[dict[str, Any]]:
        return [dict(device) for device in MOCK_DEVICES]

    def build_circuit(self, ir: CircuitIR) -> dict[str, Any]:
        return {
            "provider": "qbraid",
            "device": MOCK_DEVICES[0]["id"],
            "qubits": ir.qubits,
            "clbits": ir.clbits,
            "depth": ir.depth,
            "instructions": [
                {
                    "gate": operation.gate,
                    "wires": operation.wires,
                    "params": operation.params,
                    "step": operation.step,
                }
                for operation in ir.ordered_timeline()
            ],
            "measurements": [
                {"targets": item.targets, "clbits": item.clbits} for item in ir.measurements
            ],
            "submitted": False,
        }

    def _mock_amplitudes(self, ir: CircuitIR) -> list[complex]:
        import math

        dimension = ir.dimension
        weight = 1.0 / math.sqrt(dimension)
        return [complex(weight, 0.0) for _ in range(dimension)]

    def simulate(self, ir: CircuitIR, shots: int = 1024) -> dict[str, Any]:
        started = time.perf_counter()
        amplitudes = self._mock_amplitudes(ir)
        histogram = self.sample_histogram(
            self.probabilities_from(amplitudes), ir.basis_labels(), shots, 424242
        )
        if ir.is_measured:
            histogram = self.marginalise(ir, histogram)

        return self.response(
            ir,
            shots,
            amplitudes,
            histogram,
            started,
            status="stub",
            note=STUB_NOTE,
        )
