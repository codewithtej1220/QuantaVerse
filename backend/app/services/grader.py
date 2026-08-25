from __future__ import annotations

from typing import Any

from app.models.circuit_ir import CircuitIR
from app.services.adapters.qiskit_adapter import QiskitAdapter

MAX_UNITARY_QUBITS = 8
adapter = QiskitAdapter()


def _bare(ir: CircuitIR) -> Any:
    return adapter.build_circuit(ir, with_measurements=False)


def _mismatch(target: CircuitIR, submission: CircuitIR) -> str | None:
    if target.qubits != submission.qubits:
        return (
            f"the target uses {target.qubits} qubit(s) but the submission uses "
            f"{submission.qubits}"
        )
    return None


def check_state_fidelity(
    target: CircuitIR, submission: CircuitIR, threshold: float = 0.99
) -> dict[str, Any]:
    problem = _mismatch(target, submission)
    if problem:
        return {
            "check": "state_fidelity",
            "passed": False,
            "score": 0.0,
            "threshold": threshold,
            "detail": problem,
        }

    from qiskit.quantum_info import Statevector, state_fidelity

    expected = Statevector.from_instruction(_bare(target))
    produced = Statevector.from_instruction(_bare(submission))
    score = float(state_fidelity(expected, produced, validate=False))
    passed = score >= threshold

    if passed:
        detail = f"final state matches the target to fidelity {score:.6f}"
    else:
        detail = (
            f"fidelity {score:.6f} is below the {threshold:.3f} bar; "
            "the amplitudes your circuit produces are not the ones the task asks for"
        )
    return {
        "check": "state_fidelity",
        "passed": passed,
        "score": round(score, 9),
        "threshold": threshold,
        "detail": detail,
    }


def check_unitary_equivalence(
    target: CircuitIR, submission: CircuitIR, threshold: float = 0.99
) -> dict[str, Any]:
    problem = _mismatch(target, submission)
    if problem:
        return {
            "check": "unitary_equivalence",
            "passed": False,
            "score": 0.0,
            "threshold": threshold,
            "detail": problem,
        }

    if target.qubits > MAX_UNITARY_QUBITS:
        return {
            "check": "unitary_equivalence",
            "passed": False,
            "score": 0.0,
            "threshold": threshold,
            "detail": (
                f"unitary comparison is capped at {MAX_UNITARY_QUBITS} qubits because the "
                f"matrix grows as 4^n; this circuit has {target.qubits}"
            ),
        }

    from qiskit.quantum_info import Operator, process_fidelity

    expected = Operator(_bare(target))
    produced = Operator(_bare(submission))
    equivalent = bool(expected.equiv(produced))

    try:
        score = float(abs(process_fidelity(expected, produced, require_cp=False, require_tp=False)))
    except Exception:
        score = 1.0 if equivalent else 0.0

    passed = equivalent and score >= threshold
    if passed:
        detail = "the whole operation matches the target, up to global phase"
    elif score >= threshold:
        detail = (
            f"process fidelity is {score:.6f} but the operators differ by more than a global "
            "phase, so the circuits disagree on some input states"
        )
    else:
        detail = (
            f"process fidelity {score:.6f} is below the {threshold:.3f} bar; the circuit does "
            "the right thing for |0...0> at best, not for every input"
        )
    return {
        "check": "unitary_equivalence",
        "passed": passed,
        "score": round(score, 9),
        "threshold": threshold,
        "detail": detail,
    }


def _hint(target: CircuitIR, submission: CircuitIR, checks: list[dict[str, Any]]) -> str | None:
    state = next(item for item in checks if item["check"] == "state_fidelity")
    unitary = next(item for item in checks if item["check"] == "unitary_equivalence")

    if state["passed"] and unitary["passed"]:
        return None
    if state["passed"] and not unitary["passed"]:
        return (
            "Your circuit reaches the right state from |0...0>, but it is not the same "
            "operation as the target. Look for a gate that happens to be invisible on this "
            "input, such as a Z on a qubit that is still in |0>."
        )

    expected = target.gate_counts()
    produced = submission.gate_counts()
    missing = [gate for gate in expected if produced.get(gate, 0) < expected[gate]]
    extra = [gate for gate in produced if produced[gate] > expected.get(gate, 0)]

    if missing:
        return f"The target uses more {missing[0].upper()} than your circuit does."
    if extra:
        return f"Your circuit has more {extra[0].upper()} than the target needs."
    if target.depth != submission.depth:
        return (
            f"Gate counts match but the depth does not: target {target.depth}, "
            f"yours {submission.depth}. Check the order the gates run in."
        )
    return "Same gates, wrong wires — check which qubit each gate lands on."


def grade(
    target: CircuitIR, submission: CircuitIR, threshold: float = 0.99
) -> dict[str, Any]:
    checks = [
        check_state_fidelity(target, submission, threshold),
        check_unitary_equivalence(target, submission, threshold),
    ]
    return {
        "passed": all(item["passed"] for item in checks),
        "checks": checks,
        "hint": _hint(target, submission, checks),
    }
