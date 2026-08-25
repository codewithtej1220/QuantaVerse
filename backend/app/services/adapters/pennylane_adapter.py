from __future__ import annotations

import math
import time
from typing import Any, Callable, Sequence

from app.models.circuit_ir import CircuitIR
from app.services.adapters.base import AdapterError, BaseAdapter


def _build_dispatch() -> dict[str, Callable[[Sequence[int], Sequence[float]], Any]]:
    import pennylane as qml

    return {
        "id": lambda w, p: qml.Identity(wires=w[0]),
        "h": lambda w, p: qml.Hadamard(wires=w[0]),
        "x": lambda w, p: qml.PauliX(wires=w[0]),
        "y": lambda w, p: qml.PauliY(wires=w[0]),
        "z": lambda w, p: qml.PauliZ(wires=w[0]),
        "s": lambda w, p: qml.S(wires=w[0]),
        "sdg": lambda w, p: qml.PhaseShift(-math.pi / 2, wires=w[0]),
        "t": lambda w, p: qml.T(wires=w[0]),
        "tdg": lambda w, p: qml.PhaseShift(-math.pi / 4, wires=w[0]),
        "sx": lambda w, p: qml.SX(wires=w[0]),
        "rx": lambda w, p: qml.RX(p[0], wires=w[0]),
        "ry": lambda w, p: qml.RY(p[0], wires=w[0]),
        "rz": lambda w, p: qml.RZ(p[0], wires=w[0]),
        "p": lambda w, p: qml.PhaseShift(p[0], wires=w[0]),
        "u": lambda w, p: qml.U3(p[0], p[1], p[2], wires=w[0]),
        "cx": lambda w, p: qml.CNOT(wires=[w[0], w[1]]),
        "cy": lambda w, p: qml.CY(wires=[w[0], w[1]]),
        "cz": lambda w, p: qml.CZ(wires=[w[0], w[1]]),
        "ch": lambda w, p: qml.ctrl(qml.Hadamard(wires=w[1]), control=w[0]),
        "swap": lambda w, p: qml.SWAP(wires=[w[0], w[1]]),
        "crx": lambda w, p: qml.CRX(p[0], wires=[w[0], w[1]]),
        "cry": lambda w, p: qml.CRY(p[0], wires=[w[0], w[1]]),
        "crz": lambda w, p: qml.CRZ(p[0], wires=[w[0], w[1]]),
        "cp": lambda w, p: qml.ControlledPhaseShift(p[0], wires=[w[0], w[1]]),
        "ccx": lambda w, p: qml.Toffoli(wires=[w[0], w[1], w[2]]),
        "cswap": lambda w, p: qml.CSWAP(wires=[w[0], w[1], w[2]]),
    }


class PennyLaneAdapter(BaseAdapter):
    name = "pennylane"
    framework = "PennyLane default.qubit"

    def version(self) -> str:
        try:
            import pennylane as qml

            return f"pennylane {qml.__version__}"
        except Exception:
            return "pennylane unavailable"

    @staticmethod
    def _wire(index: int, qubits: int) -> int:
        return qubits - 1 - index

    def build_circuit(self, ir: CircuitIR, with_measurements: bool = False) -> Any:
        try:
            import pennylane as qml
        except ImportError as error:
            raise AdapterError(f"pennylane is not installed: {error}", self.name) from error

        dispatch = _build_dispatch()
        operations: list[Any] = []

        with qml.QueuingManager.stop_recording():
            for operation in ir.ordered_timeline():
                factory = dispatch.get(operation.gate)
                if factory is None:
                    raise AdapterError(
                        f"gate '{operation.gate}' has no pennylane mapping", self.name
                    )
                wires = [self._wire(wire, ir.qubits) for wire in operation.wires]
                try:
                    operations.append(factory(wires, operation.params))
                except Exception as error:
                    raise AdapterError(
                        f"could not apply {operation.label} on {operation.wires}: {error}",
                        self.name,
                    ) from error

            measurements: list[Any] = []
            if with_measurements:
                measurements.append(qml.counts(wires=list(range(ir.qubits))))
            else:
                measurements.append(qml.state())

            return qml.tape.QuantumScript(ops=operations, measurements=measurements)

    def _run(self, ir: CircuitIR, shots: int | None) -> Any:
        import pennylane as qml

        tape = self.build_circuit(ir, with_measurements=shots is not None)
        operations = list(tape.operations)
        modern = shots is not None and hasattr(qml, "set_shots")
        device = self._device(qml, ir.qubits, None if modern else shots)

        @qml.qnode(device)
        def program() -> Any:
            for operation in operations:
                qml.apply(operation)
            if shots is None:
                return qml.state()
            return qml.counts(wires=list(range(ir.qubits)))

        if modern:
            return qml.set_shots(program, shots=shots)()
        return program()

    @staticmethod
    def _device(qml: Any, wires: int, shots: int | None) -> Any:
        try:
            return qml.device("default.qubit", wires=wires, shots=shots, seed=42)
        except TypeError:
            return qml.device("default.qubit", wires=wires, shots=shots)

    def statevector(self, ir: CircuitIR) -> list[complex]:
        try:
            return self.clean_amplitudes(self._run(ir, None))
        except AdapterError:
            raise
        except Exception as error:
            raise AdapterError(f"pennylane state failed: {error}", self.name) from error

    def simulate(self, ir: CircuitIR, shots: int = 1024) -> dict[str, Any]:
        started = time.perf_counter()
        amplitudes = self.statevector(ir)
        note = None

        if ir.is_measured:
            try:
                raw = self._run(ir, shots)
                counts = {
                    str(key).replace(" ", ""): int(value) for key, value in dict(raw).items()
                }
                histogram = self.marginalise(ir, dict(sorted(counts.items())))
            except Exception as error:
                note = f"pennylane sampler unavailable ({error}); counts drawn from exact probabilities"
                histogram = self.sample_histogram(
                    self.probabilities_from(amplitudes), ir.basis_labels(), shots, 20260825
                )
                histogram = self.marginalise(ir, histogram)
        else:
            histogram = self.sample_histogram(
                self.probabilities_from(amplitudes), ir.basis_labels(), shots, 20260825
            )

        return self.response(ir, shots, amplitudes, histogram, started, note=note)
