"""
Marking a circuit against a reference.

Two questions, because labs ask two different kinds of thing.

A *state* lab — "put q0 into |+⟩", "build the singlet" — is answered by the
state the circuit reaches from |0…0⟩, up to a global phase, and nothing else.
Any route there is a right answer: Y then H reaches |−⟩ exactly as well as X
then H does, and a grader that also demanded the same *operation* failed it for
disagreeing on inputs the task never mentions.

An *operation* lab — "build Deutsch–Jozsa", "run one Grover iteration" — is
answered by what the circuit does to every input, up to a global phase. Marked
on the state alone, a single X on the right wire "solved" Grover: it lands on
the marked item from |00⟩ without searching for anything.

Both are exact. The old bar was a fidelity of 0.99, which a circuit built from
code with a slightly wrong rotation could clear; every gate this course uses is
exact, so a right answer is right to within rounding and the tolerance below is
rounding, not leniency.

And the hints are read off the amplitudes rather than off gate counts. "The
target uses more H than your circuit does" was wrong whenever there was more
than one route, which for a state lab is always.
"""

from __future__ import annotations

import cmath
import math
from typing import Any, Literal

import numpy as np

from app.core.curriculum import Challenge
from app.models.circuit_ir import CircuitIR, GateOperation
from app.services.adapters.qiskit_adapter import QiskitAdapter

Mode = Literal["state", "operation"]

#: The operator is a 4ⁿ-entry matrix; past this it is not worth building.
MAX_UNITARY_QUBITS = 8
#: Rounding, not leniency: see the module docstring.
TOLERANCE = 1e-6
PASS_MARK = 1 - TOLERANCE

adapter = QiskitAdapter()


# --------------------------------------------------------------------------- #
# the reference                                                                #
# --------------------------------------------------------------------------- #


def reference_ir(challenge: Challenge) -> CircuitIR:
    """
    The lab's own circuit, packed into time steps the way the board packs it.

    A gate goes in the first step every wire it spans is free, so the reference
    has the same depth as the circuit a learner would draw from the same list.
    """
    level = [0] * challenge.qubits
    timeline: list[dict[str, Any]] = []
    for gate, wires in challenge.ops:
        low, high = min(wires), max(wires)
        step = max(level[low : high + 1])
        for wire in range(low, high + 1):
            level[wire] = step + 1
        if gate in ("cnot", "cx"):
            timeline.append(
                {"gate": "cx", "control": wires[0], "targets": [wires[1]], "step": step}
            )
        else:
            timeline.append({"gate": gate, "targets": [wires[0]], "step": step})
    return CircuitIR(qubits=challenge.qubits, timeline=timeline)


# --------------------------------------------------------------------------- #
# reading circuits                                                             #
# --------------------------------------------------------------------------- #


def _bare(ir: CircuitIR) -> Any:
    return adapter.build_circuit(ir, with_measurements=False)


def _widen(ir: CircuitIR, qubits: int) -> CircuitIR:
    """
    The same circuit on a wider register, the new wires left idle.

    A register one wire wider than the lab's is not a wrong answer if the extra
    wire is never disturbed, and one narrower is only wrong if the task needed
    the wire it lacks — so both are compared on the wider of the two, and the
    comparison itself decides.
    """
    if ir.qubits >= qubits:
        return ir
    return ir.model_copy(update={"qubits": qubits})


def _state(ir: CircuitIR) -> np.ndarray:
    from qiskit.quantum_info import Statevector

    return np.asarray(Statevector.from_instruction(_bare(ir)).data, dtype=complex)


def _operator(ir: CircuitIR) -> np.ndarray:
    from qiskit.quantum_info import Operator

    return np.asarray(Operator(_bare(ir)).data, dtype=complex)


def _early_measurement(ir: CircuitIR) -> tuple[int, int, GateOperation] | None:
    """
    The first gate that acts on a qubit after that qubit has been measured.

    Neither comparison below can see this — they build the circuit without its
    measurements — and it matters: measure q0 between the H and the CNOT and
    the "Bell pair" is two classically correlated bits, not an entangled pair.
    """
    worst: tuple[int, int, GateOperation] | None = None
    ordered = ir.ordered_timeline()
    for measurement in ir.measurements:
        if measurement.step is None:
            continue
        for wire in measurement.targets:
            later = next(
                (op for op in ordered if wire in op.wires and op.step > measurement.step),
                None,
            )
            if later is not None and (worst is None or later.step < worst[2].step):
                worst = (wire, measurement.step, later)
    return worst


# --------------------------------------------------------------------------- #
# words for numbers                                                            #
# --------------------------------------------------------------------------- #


def _label(index: int, qubits: int) -> str:
    return format(index, f"0{qubits}b")


def _fixed(value: float, digits: int) -> str:
    """
    Rounded half up, the same way the page rounds.

    Python's own formatting rounds an exact half to even and JavaScript's rounds
    it up, so 0.03125 printed as 0.0312 here and 0.0313 in the browser — the same
    grade, reported two ways.
    """
    # Settle the float noise first: the same fidelity computed by numpy and by
    # the browser can differ in its last bits, which is enough to land either
    # side of a half.
    settled = round(value, 9)
    factor = 10**digits
    return f"{math.floor(settled * factor + 0.5) / factor:.{digits}f}"


def _number(value: float) -> str:
    text = _fixed(abs(value), 2).rstrip("0").rstrip(".")
    return text or "0"


def _phase_text(factor: complex) -> str:
    """A unit phase as a reader would write it: +1, −1, +i, −i, or e^(iπ/4)."""
    angle = cmath.phase(factor)
    quarters = angle / (math.pi / 4)
    nearest = round(quarters)
    if abs(quarters - nearest) < 1e-4:
        eighth = nearest % 8
        named = {0: "+1", 2: "+i", 4: "−1", 6: "−i"}
        if eighth in named:
            return named[eighth]
        numerator = {1: "π/4", 3: "3π/4", 5: "5π/4", 7: "7π/4"}[eighth]
        return f"e^(i{numerator})"
    return f"e^(i{_fixed(angle, 2)})"


def _ket(vector: np.ndarray, qubits: int, limit: int = 4) -> str:
    """A state in a line of text, its global phase removed so it reads cleanly."""
    support = [index for index, value in enumerate(vector) if abs(value) > TOLERANCE]
    if not support:
        return "nothing"
    if len(support) == 1:
        return f"|{_label(support[0], qubits)}⟩"

    anchor = vector[support[0]]
    vector = vector * (abs(anchor) / anchor)

    parts: list[str] = []
    for index in support[:limit]:
        value = vector[index]
        magnitude = _number(abs(value))
        phase = _phase_text(value / abs(value))
        basis = f"|{_label(index, qubits)}⟩"
        if phase in ("+1", "−1"):
            sign, body = phase[0], f"{magnitude}{basis}"
        elif phase in ("+i", "−i"):
            sign, body = phase[0], f"{magnitude}i{basis}"
        else:
            sign, body = "+", f"{magnitude}·{phase}{basis}"
        if not parts:
            parts.append(body if sign == "+" else f"−{body}")
        else:
            parts.append(f"{sign} {body}")
    if len(support) > limit:
        parts.append("+ …")
    return " ".join(parts)


def _chance(probability: float) -> str:
    if probability < TOLERANCE:
        return "never"
    if probability > 1 - TOLERANCE:
        return "every time"
    return f"{_fixed(probability * 100, 0)}% of the time"


def _wires(indexes: list[int]) -> str:
    names = [f"q{index}" for index in indexes]
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def _first_near(values: np.ndarray, peak: float) -> int:
    """The lowest index within rounding of the peak — a stable argmax."""
    return next(index for index, value in enumerate(values) if value >= peak - TOLERANCE)


def _marginal_one(probabilities: np.ndarray, wire: int) -> float:
    return float(
        sum(value for index, value in enumerate(probabilities) if (index >> wire) & 1)
    )


def _purities(vector: np.ndarray, qubits: int) -> list[float]:
    """Each qubit's purity alone: 1 for a state of its own, ½ for maximally mixed."""
    tensor = vector.reshape([2] * qubits)
    values: list[float] = []
    for wire in range(qubits):
        # Little-endian: qubit q is the q-th bit from the right, which is axis n-1-q.
        axis = qubits - 1 - wire
        moved = np.moveaxis(tensor, axis, 0).reshape(2, -1)
        reduced = moved @ moved.conj().T
        values.append(float(np.real(np.trace(reduced @ reduced))))
    return values


# --------------------------------------------------------------------------- #
# the two comparisons                                                          #
# --------------------------------------------------------------------------- #


def _state_check(
    fidelity: float, qubits: int, *, required: bool
) -> dict[str, Any]:
    passed = fidelity >= PASS_MARK
    zeros = "0" * qubits
    if required:
        label = "Final state"
        detail = (
            "your circuit reaches exactly the target state, up to a global phase"
            if passed
            else f"your final state overlaps the target with fidelity {_fixed(fidelity, 4)}; "
            "a right answer overlaps it completely"
        )
    else:
        label = f"From |{zeros}⟩"
        detail = (
            f"run from |{zeros}⟩ it ends in the same state as the reference"
            if passed
            else f"run from |{zeros}⟩ it ends somewhere else (fidelity {_fixed(fidelity, 4)})"
        )
    return {
        "check": "state_fidelity",
        "label": label,
        "required": required,
        "passed": passed,
        "score": round(fidelity, 9),
        "threshold": PASS_MARK,
        "detail": detail,
    }


def _operation_check(score: float, qubits: int) -> dict[str, Any]:
    passed = score >= PASS_MARK
    inputs = 1 << qubits
    return {
        "check": "unitary_equivalence",
        "label": f"All {inputs} inputs",
        "required": True,
        "passed": passed,
        "score": round(score, 9),
        "threshold": PASS_MARK,
        "detail": (
            f"it does what the reference does to every one of the {inputs} inputs, "
            "up to a global phase"
            if passed
            else f"on at least one input it does something different "
            f"(process fidelity {_fixed(score, 4)})"
        ),
    }


def _measurement_check(early: tuple[int, int, GateOperation] | None) -> dict[str, Any]:
    if early is None:
        return {
            "check": "measurement_order",
            "label": "Measurements",
            "required": True,
            "passed": True,
            "score": 1.0,
            "threshold": 1.0,
            "detail": "nothing acts on a qubit after it has been measured",
        }
    wire, step, gate = early
    return {
        "check": "measurement_order",
        "label": "Measurements",
        "required": True,
        "passed": False,
        "score": 0.0,
        "threshold": 1.0,
        "detail": (
            f"q{wire} is measured at step {step + 1} and still used at step {gate.step + 1}"
        ),
    }


# --------------------------------------------------------------------------- #
# what to say                                                                  #
# --------------------------------------------------------------------------- #


def _state_hint(target: np.ndarray, produced: np.ndarray, qubits: int) -> str:
    """Why two states differ, from the most visible difference to the least."""
    expected = np.abs(target) ** 2
    actual = np.abs(produced) ** 2

    # Entanglement first: it is the difference no single-qubit fix can close.
    wanted = [q for q, value in enumerate(_purities(target, qubits)) if value < PASS_MARK]
    made = [q for q, value in enumerate(_purities(produced, qubits)) if value < PASS_MARK]
    if wanted and not made:
        return (
            f"The target is entangled — {_wires(wanted)} have no state of their own — "
            "but every qubit in yours still does. It takes a two-qubit gate."
        )
    if made and not wanted:
        return (
            f"Your circuit entangles {_wires(made)}, and the target leaves every qubit "
            "with a state of its own."
        )

    # One qubit reading wrong on its own is the clearest thing to point at.
    for wire in range(qubits):
        should = _marginal_one(expected, wire)
        does = _marginal_one(actual, wire)
        if abs(should - does) > TOLERANCE:
            return f"q{wire} should read 1 {_chance(should)}, but yours reads 1 {_chance(does)}."

    # Every qubit right alone, wrong together: a correlation. Ties go to the
    # lowest basis state, not to whichever one rounding happened to favour.
    gap = np.abs(expected - actual)
    if gap.max() > TOLERANCE:
        worst = _first_near(gap, gap.max())
        return (
            "Each qubit on its own reads right, but not the way they go together: "
            f"the target gives |{_label(worst, qubits)}⟩ {_chance(float(expected[worst]))} "
            f"and yours gives it {_chance(float(actual[worst]))}."
        )

    # Same histogram, different state: a relative phase.
    anchor = _first_near(expected, expected.max())
    for index in range(len(target)):
        if index == anchor or expected[index] < TOLERANCE:
            continue
        should = target[index] / target[anchor]
        does = produced[index] / produced[anchor]
        if abs(should - does) > TOLERANCE:
            return (
                "Every outcome already has the right probability, so what is wrong is a "
                f"phase the histogram cannot show: relative to |{_label(anchor, qubits)}⟩, "
                f"the |{_label(index, qubits)}⟩ amplitude should carry "
                f"{_phase_text(should / abs(should))} and yours carries "
                f"{_phase_text(does / abs(does))}. Compare them in the state read-out."
            )
    return "The two states differ by less than the read-out can show. Compare them term by term."


def _operation_hint(target: np.ndarray, produced: np.ndarray, qubits: int) -> str | None:
    """Which inputs the two circuits disagree on, starting from the one the algorithm runs."""
    inputs = range(len(target))
    failing = [
        index
        for index in inputs
        if abs(np.vdot(target[:, index], produced[:, index])) ** 2 < PASS_MARK
    ]
    if failing:
        first = failing[0]
        example = (
            f"Run from |{_label(first, qubits)}⟩, the reference ends in "
            f"{_ket(target[:, first], qubits)} and yours ends in "
            f"{_ket(produced[:, first], qubits)}."
        )
        # A circuit right on exactly the inputs where one qubit starts at 0 is
        # the classic shortcut — it treats that qubit as if it could only ever be
        # |0⟩, which is what "not really querying the oracle" looks like.
        passing = [index for index in inputs if index not in failing]
        if passing:
            for wire in range(qubits):
                if all((index >> wire) & 1 for index in failing) and not any(
                    (index >> wire) & 1 for index in passing
                ):
                    return (
                        f"It matches the reference whenever q{wire} starts in |0⟩ and "
                        f"never when q{wire} starts in |1⟩, so q{wire} is being treated as "
                        f"if it could only ever be |0⟩. {example}"
                    )
        return example

    # Every input lands on the right state: the disagreement is between them.
    base = np.vdot(target[:, 0], produced[:, 0])
    for index in range(1, len(target)):
        here = np.vdot(target[:, index], produced[:, index])
        if abs(here - base) > TOLERANCE:
            return (
                "Every input ends in the right state, but not with the right phase between "
                f"them: compared with |{_label(0, qubits)}⟩, yours gives "
                f"|{_label(index, qubits)}⟩ an extra factor of {_phase_text(here / base)}. "
                "No single run can show that, and it is exactly what the algorithm uses."
            )
    return None


# --------------------------------------------------------------------------- #
# the grade                                                                    #
# --------------------------------------------------------------------------- #


def grade(target: CircuitIR, submission: CircuitIR, mode: Mode = "operation") -> dict[str, Any]:
    qubits = max(target.qubits, submission.qubits)
    wide_target = _widen(target, qubits)
    wide_submission = _widen(submission, qubits)

    expected_state = _state(wide_target)
    produced_state = _state(wide_submission)
    fidelity = float(abs(np.vdot(expected_state, produced_state)) ** 2)

    checks: list[dict[str, Any]] = []
    expected_operator: np.ndarray | None = None
    produced_operator: np.ndarray | None = None

    if mode == "state":
        checks.append(_state_check(fidelity, qubits, required=True))
    else:
        checks.append(_state_check(fidelity, qubits, required=False))
        if qubits > MAX_UNITARY_QUBITS:
            checks.append(
                {
                    "check": "unitary_equivalence",
                    "label": "Every input",
                    "required": True,
                    "passed": False,
                    "score": 0.0,
                    "threshold": PASS_MARK,
                    "detail": (
                        f"comparing whole operations stops at {MAX_UNITARY_QUBITS} qubits, "
                        f"because the matrix grows as 4ⁿ; this register has {qubits}"
                    ),
                }
            )
        else:
            expected_operator = _operator(wide_target)
            produced_operator = _operator(wide_submission)
            dimension = 1 << qubits
            trace = np.trace(expected_operator.conj().T @ produced_operator)
            score = float(abs(trace) ** 2 / dimension**2)
            checks.append(_operation_check(min(1.0, score), qubits))

    early = _early_measurement(submission)
    if early is not None or any(item.step is not None for item in submission.measurements):
        checks.append(_measurement_check(early))

    passed = all(item["passed"] for item in checks if item["required"])

    hint: str | None = None
    if not passed:
        if early is not None:
            wire, step, gate = early
            hint = (
                f"q{wire} is measured at step {step + 1}, and the {gate.label} at step "
                f"{gate.step + 1} still acts on it. A measurement collapses the qubit to a "
                "definite bit, so nothing after it is building the state the lab asks for — "
                "move the measurement to the end."
            )
        else:
            if mode == "state":
                hint = _state_hint(expected_state, produced_state, qubits)
            elif expected_operator is not None and produced_operator is not None:
                hint = _operation_hint(expected_operator, produced_operator, qubits)
            if submission.qubits < target.qubits:
                register = (
                    f"The lab needs a {target.qubits}-qubit register and yours has "
                    f"{submission.qubits}."
                )
                hint = f"{register} {hint}" if hint else register

    return {"passed": passed, "checks": checks, "hint": hint, "mode": mode}
