from __future__ import annotations

import time
from typing import Any, Callable, Sequence

from app.models.circuit_ir import CircuitIR
from app.services.adapters.base import AdapterError, BaseAdapter

GateCall = Callable[[Any, Sequence[int], Sequence[float]], None]

DISPATCH: dict[str, GateCall] = {
    "id": lambda qc, w, p: qc.id(w[0]),
    "h": lambda qc, w, p: qc.h(w[0]),
    "x": lambda qc, w, p: qc.x(w[0]),
    "y": lambda qc, w, p: qc.y(w[0]),
    "z": lambda qc, w, p: qc.z(w[0]),
    "s": lambda qc, w, p: qc.s(w[0]),
    "sdg": lambda qc, w, p: qc.sdg(w[0]),
    "t": lambda qc, w, p: qc.t(w[0]),
    "tdg": lambda qc, w, p: qc.tdg(w[0]),
    "sx": lambda qc, w, p: qc.sx(w[0]),
    "rx": lambda qc, w, p: qc.rx(p[0], w[0]),
    "ry": lambda qc, w, p: qc.ry(p[0], w[0]),
    "rz": lambda qc, w, p: qc.rz(p[0], w[0]),
    "p": lambda qc, w, p: qc.p(p[0], w[0]),
    "u": lambda qc, w, p: qc.u(p[0], p[1], p[2], w[0]),
    "cx": lambda qc, w, p: qc.cx(w[0], w[1]),
    "cy": lambda qc, w, p: qc.cy(w[0], w[1]),
    "cz": lambda qc, w, p: qc.cz(w[0], w[1]),
    "ch": lambda qc, w, p: qc.ch(w[0], w[1]),
    "swap": lambda qc, w, p: qc.swap(w[0], w[1]),
    "crx": lambda qc, w, p: qc.crx(p[0], w[0], w[1]),
    "cry": lambda qc, w, p: qc.cry(p[0], w[0], w[1]),
    "crz": lambda qc, w, p: qc.crz(p[0], w[0], w[1]),
    "cp": lambda qc, w, p: qc.cp(p[0], w[0], w[1]),
    "ccx": lambda qc, w, p: qc.ccx(w[0], w[1], w[2]),
    "cswap": lambda qc, w, p: qc.cswap(w[0], w[1], w[2]),
}


def _stable_seed(ir: CircuitIR, shots: int) -> int:
    seed = (shots * 7919 + ir.qubits * 104_729 + len(ir.timeline) * 31) % 2_147_483_647
    for index, operation in enumerate(ir.ordered_timeline()):
        seed = (seed * 33 + ord(operation.gate[0]) + sum(operation.wires) + index) % 2_147_483_647
    return seed or 1


class QiskitAdapter(BaseAdapter):
    name = "qiskit"
    framework = "Qiskit + Aer"

    def version(self) -> str:
        try:
            import qiskit

            return f"qiskit {qiskit.__version__}"
        except Exception:
            return "qiskit unavailable"

    def build_circuit(self, ir: CircuitIR, with_measurements: bool = True) -> Any:
        try:
            from qiskit import QuantumCircuit
        except ImportError as error:
            raise AdapterError(f"qiskit is not installed: {error}", self.name) from error

        clbits = ir.clbits if (with_measurements and ir.is_measured) else 0
        circuit = QuantumCircuit(ir.qubits, clbits) if clbits else QuantumCircuit(ir.qubits)

        for operation in ir.ordered_timeline():
            call = DISPATCH.get(operation.gate)
            if call is None:
                raise AdapterError(f"gate '{operation.gate}' has no qiskit mapping", self.name)
            try:
                call(circuit, operation.wires, operation.params)
            except Exception as error:
                raise AdapterError(
                    f"could not apply {operation.label} on {operation.wires}: {error}",
                    self.name,
                ) from error

        if with_measurements and ir.is_measured:
            for measurement in ir.measurements:
                for qubit, clbit in zip(measurement.targets, measurement.clbits):
                    circuit.measure(qubit, clbit)
        return circuit

    def statevector(self, ir: CircuitIR) -> list[complex]:
        circuit = self.build_circuit(ir, with_measurements=False)
        try:
            from qiskit_aer import AerSimulator

            simulator = AerSimulator(method="statevector")
            probe = circuit.copy()
            probe.save_statevector()
            from qiskit import transpile

            job = simulator.run(transpile(probe, simulator), shots=1)
            raw = job.result().get_statevector()
            return self.clean_amplitudes(raw)
        except Exception:
            from qiskit.quantum_info import Statevector

            return self.clean_amplitudes(Statevector.from_instruction(circuit).data)

    def simulate(self, ir: CircuitIR, shots: int = 1024) -> dict[str, Any]:
        started = time.perf_counter()
        amplitudes = self.statevector(ir)
        labels = ir.basis_labels()
        seed = _stable_seed(ir, shots)

        if ir.is_measured:
            histogram = self._run_shots(ir, shots, seed)
        else:
            histogram = self.sample_histogram(
                self.probabilities_from(amplitudes), labels, shots, seed
            )

        return self.response(ir, shots, amplitudes, histogram, started)

    def _run_shots(self, ir: CircuitIR, shots: int, seed: int) -> dict[str, int]:
        try:
            from qiskit import transpile
            from qiskit_aer import AerSimulator

            circuit = self.build_circuit(ir, with_measurements=True)
            simulator = AerSimulator()
            job = simulator.run(
                transpile(circuit, simulator), shots=shots, seed_simulator=seed
            )
            raw = job.result().get_counts()
            counts = {
                str(key).replace(" ", ""): int(value) for key, value in raw.items()
            }
            return dict(sorted(counts.items()))
        except AdapterError:
            raise
        except Exception as error:
            raise AdapterError(f"aer sampling failed: {error}", self.name) from error

    def unitary(self, ir: CircuitIR) -> Any:
        from qiskit.quantum_info import Operator

        return Operator(self.build_circuit(ir, with_measurements=False))
