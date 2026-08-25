from __future__ import annotations

import math
import time
from typing import Any, Callable, Sequence

from app.models.circuit_ir import CircuitIR
from app.services.adapters.base import AdapterError, BaseAdapter


def _u_matrix(theta: float, phi: float, lam: float) -> Any:
    import numpy as np

    half = theta / 2.0
    return np.array(
        [
            [math.cos(half), -np.exp(1j * lam) * math.sin(half)],
            [np.exp(1j * phi) * math.sin(half), np.exp(1j * (phi + lam)) * math.cos(half)],
        ],
        dtype=complex,
    )


def _build_dispatch() -> dict[str, Callable[[Sequence[float]], Any]]:
    import cirq

    return {
        "id": lambda p: cirq.I,
        "h": lambda p: cirq.H,
        "x": lambda p: cirq.X,
        "y": lambda p: cirq.Y,
        "z": lambda p: cirq.Z,
        "s": lambda p: cirq.S,
        "sdg": lambda p: cirq.S**-1,
        "t": lambda p: cirq.T,
        "tdg": lambda p: cirq.T**-1,
        "sx": lambda p: cirq.X**0.5,
        "rx": lambda p: cirq.rx(p[0]),
        "ry": lambda p: cirq.ry(p[0]),
        "rz": lambda p: cirq.rz(p[0]),
        "p": lambda p: cirq.ZPowGate(exponent=p[0] / math.pi),
        "u": lambda p: cirq.MatrixGate(_u_matrix(p[0], p[1], p[2])),
        "cx": lambda p: cirq.CNOT,
        "cy": lambda p: cirq.Y.controlled(),
        "cz": lambda p: cirq.CZ,
        "ch": lambda p: cirq.H.controlled(),
        "swap": lambda p: cirq.SWAP,
        "crx": lambda p: cirq.rx(p[0]).controlled(),
        "cry": lambda p: cirq.ry(p[0]).controlled(),
        "crz": lambda p: cirq.rz(p[0]).controlled(),
        "cp": lambda p: cirq.CZPowGate(exponent=p[0] / math.pi),
        "ccx": lambda p: cirq.TOFFOLI,
        "cswap": lambda p: cirq.CSWAP,
    }


class CirqAdapter(BaseAdapter):
    name = "cirq"
    framework = "Cirq"

    def version(self) -> str:
        try:
            import cirq

            return f"cirq {cirq.__version__}"
        except Exception:
            return "cirq unavailable"

    def build_circuit(self, ir: CircuitIR, with_measurements: bool = False) -> Any:
        try:
            import cirq
        except ImportError as error:
            raise AdapterError(f"cirq is not installed: {error}", self.name) from error

        dispatch = _build_dispatch()
        line = cirq.LineQubit.range(ir.qubits)
        circuit = cirq.Circuit()
        touched: set[int] = set()

        for operation in ir.ordered_timeline():
            factory = dispatch.get(operation.gate)
            if factory is None:
                raise AdapterError(f"gate '{operation.gate}' has no cirq mapping", self.name)
            try:
                gate = factory(operation.params)
                circuit.append(gate.on(*[line[wire] for wire in operation.wires]))
            except Exception as error:
                raise AdapterError(
                    f"could not apply {operation.label} on {operation.wires}: {error}",
                    self.name,
                ) from error
            touched.update(operation.wires)

        idle = [line[index] for index in range(ir.qubits) if index not in touched]
        if idle:
            circuit.append([cirq.I(qubit) for qubit in idle])

        if with_measurements:
            circuit.append(cirq.measure(*line, key="quantaverse"))
        return circuit

    def _order(self, ir: CircuitIR) -> list[Any]:
        import cirq

        return list(reversed(cirq.LineQubit.range(ir.qubits)))

    def statevector(self, ir: CircuitIR) -> list[complex]:
        import cirq

        circuit = self.build_circuit(ir, with_measurements=False)
        result = cirq.Simulator(seed=7).simulate(circuit, qubit_order=self._order(ir))
        return self.clean_amplitudes(result.final_state_vector)

    def simulate(self, ir: CircuitIR, shots: int = 1024) -> dict[str, Any]:
        started = time.perf_counter()
        amplitudes = self.statevector(ir)

        if ir.is_measured:
            histogram = self.marginalise(ir, self._run_shots(ir, shots))
        else:
            histogram = self.sample_histogram(
                self.probabilities_from(amplitudes), ir.basis_labels(), shots, 20260825
            )

        return self.response(ir, shots, amplitudes, histogram, started)

    def _run_shots(self, ir: CircuitIR, shots: int) -> dict[str, int]:
        import cirq

        try:
            circuit = self.build_circuit(ir, with_measurements=True)
            result = cirq.Simulator(seed=11).run(circuit, repetitions=shots)
            rows = result.measurements["quantaverse"]
            return self.counts_from_rows(rows, ir.qubits)
        except AdapterError:
            raise
        except Exception as error:
            raise AdapterError(f"cirq sampling failed: {error}", self.name) from error
