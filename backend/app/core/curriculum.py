from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SkillAxis:
    key: str
    label: str
    short: str
    cohort: int


@dataclass(frozen=True)
class Badge:
    id: str
    name: str
    detail: str


@dataclass(frozen=True)
class Challenge:
    """
    One graded build, and the circuit it is marked against.

    The reference lives here, on the server, and nowhere a client can edit it.
    The grade endpoint used to take the target from the request along with the
    submission, which meant the one number a badge rests on was chosen by the
    browser: send the same circuit as both and anything passed.

    `mode` is what the task is actually asking for. A lab that says "reach this
    state" is marked on the state, so every route to it counts; a lab that says
    "build this algorithm" is marked on the whole operation, input by input, so
    a shortcut that only happens to land on the answer from |0…0⟩ does not.
    Marking a state task as an operation failed correct answers — Y then H does
    reach |−⟩ — and marking an algorithm as a state passed circuits that never
    ran the algorithm at all.
    """

    slug: str
    title: str
    qubits: int
    goal: str
    mode: str
    #: The reference circuit in reading order: (gate, wires), controls first.
    ops: tuple[tuple[str, tuple[int, ...]], ...]


@dataclass(frozen=True)
class Module:
    index: int
    slug: str
    ket: str
    title: str
    track: str
    lessons: int
    minutes: int
    badge: Badge
    challenge: Challenge | None
    skills: tuple[tuple[str, float], ...]


SKILL_AXES: tuple[SkillAxis, ...] = (
    SkillAxis("superposition", "Superposition", "SUP", 71),
    SkillAxis("entanglement", "Entanglement", "ENT", 55),
    SkillAxis("gate-algebra", "Gate algebra", "GAT", 62),
    SkillAxis("circuit-design", "Circuit design", "CIR", 58),
    SkillAxis("measurement", "Measurement", "MEA", 69),
    SkillAxis("algorithms", "Algorithms", "ALG", 44),
    SkillAxis("qiskit-code", "Qiskit code", "QIS", 48),
    SkillAxis("complexity", "Complexity", "CPX", 39),
)

# --- where a newcomer starts -------------------------------------------------
# What the two sign-up questions buy, and what they deliberately do not.
#
# They do not grant progress. Nothing below touches XP, mastery, a badge or a
# skill score, because a claim is not a measurement and this codebase does not
# show anybody a number they did not earn — that was the whole complaint against
# the fixture learner it replaced.
#
# What they buy is a starting point: how many modules are open on the first day,
# and which axis the first recommendation aims at while there is still no
# evidence to aim it with. Both are suggestions the learner can ignore; the lock
# was always an ordering hint rather than a paywall.

#: Axes a maths and physics background actually helps with.
MATH_AXES: tuple[str, ...] = (
    "superposition",
    "entanglement",
    "gate-algebra",
    "measurement",
    "complexity",
)
#: Axes a programming background actually helps with.
CODE_AXES: tuple[str, ...] = ("qiskit-code", "circuit-design", "algorithms")

#: Highest answer index each question accepts. Three answers: 0, 1, 2.
MAX_LEVEL = 2


def starting_priors(
    math_level: int | None, code_level: int | None
) -> dict[str, float]:
    """
    Claimed confidence per axis, 0..1, from the two answers.

    Used only to order a first suggestion. An axis nobody claims stays at zero,
    which is what makes it the one worth aiming at.
    """
    if math_level is None and code_level is None:
        return {}

    maths = (math_level or 0) / MAX_LEVEL
    code = (code_level or 0) / MAX_LEVEL
    priors = {axis.key: 0.0 for axis in SKILL_AXES}
    for key in MATH_AXES:
        priors[key] = max(priors.get(key, 0.0), maths)
    for key in CODE_AXES:
        priors[key] = max(priors.get(key, 0.0), code)
    return priors


def head_start(math_level: int | None, code_level: int | None) -> int:
    """
    How many modules stand open on day one.

    The track is gated in sequence — a module opens when the one before it is
    finished — which is right for somebody meeting linear algebra and Python at
    the same time, and insulting to somebody who has written Qiskit. One module
    for everybody, and one more for each level of background claimed.
    """
    return 1 + (math_level or 0) + (code_level or 0)


TRACK_LABEL: dict[str, str] = {
    "foundations": "Foundations",
    "algorithms": "Algorithms",
    "hardware": "Hardware & Code",
}

MODULES: tuple[Module, ...] = (
    Module(
        index=0,
        slug="qubit-and-superposition",
        ket="|000⟩",
        title="The Qubit & Superposition",
        track="foundations",
        lessons=6,
        minutes=55,
        badge=Badge(
            "first-superposition",
            "First Superposition",
            "Put a qubit in an equal superposition and read the histogram.",
        ),
        challenge=Challenge(
            slug="qubit-and-superposition",
            title="One qubit, two places",
            qubits=2,
            goal="Put q0 into the equal superposition |+⟩ = (|0⟩ + |1⟩)/√2, and leave q1 in |0⟩.",
            mode="state",
            ops=(("h", (0,)),),
        ),
        skills=(("superposition", 1.0), ("gate-algebra", 0.3), ("measurement", 0.2)),
    ),
    Module(
        index=1,
        slug="measurement-and-probability",
        ket="|001⟩",
        title="Measurement & Probability",
        track="foundations",
        lessons=5,
        minutes=45,
        badge=Badge(
            "thousand-shots",
            "Thousand Shots",
            "Ran 1,024 shots and matched the predicted distribution within 2%.",
        ),
        challenge=None,
        skills=(("measurement", 1.0), ("superposition", 0.3), ("complexity", 0.1)),
    ),
    Module(
        index=2,
        slug="single-qubit-gates",
        ket="|010⟩",
        title="Single-Qubit Gates",
        track="foundations",
        lessons=7,
        minutes=70,
        badge=Badge(
            "rotation-fluent",
            "Rotation Fluent",
            "Reached any point on the Bloch sphere in three gates or fewer.",
        ),
        challenge=Challenge(
            slug="single-qubit-gates",
            title="Point it at −Y",
            qubits=2,
            goal=(
                "Turn q0 from |0⟩ into (|0⟩ − i|1⟩)/√2, the state at the −Y pole of the "
                "Bloch sphere, and leave q1 in |0⟩."
            ),
            mode="state",
            ops=(("h", (0,)), ("s", (0,)), ("z", (0,))),
        ),
        skills=(("gate-algebra", 1.0), ("superposition", 0.4), ("circuit-design", 0.3)),
    ),
    Module(
        index=3,
        slug="quantum-entanglement",
        ket="|011⟩",
        title="Quantum Entanglement",
        track="foundations",
        lessons=6,
        minutes=65,
        badge=Badge(
            "bell-pair",
            "Bell Pair",
            "Built all four Bell states from scratch without a hint.",
        ),
        challenge=Challenge(
            slug="quantum-entanglement",
            title="The singlet",
            qubits=2,
            goal=(
                "Build the singlet (|01⟩ − |10⟩)/√2: the two qubits always measure opposite, "
                "and the two branches carry opposite signs."
            ),
            mode="state",
            ops=(("x", (0,)), ("h", (0,)), ("cnot", (0, 1)), ("x", (1,))),
        ),
        skills=(("entanglement", 1.0), ("circuit-design", 0.5), ("measurement", 0.3)),
    ),
    Module(
        index=4,
        slug="circuits-with-qiskit",
        ket="|100⟩",
        title="Circuits with Qiskit",
        track="hardware",
        lessons=8,
        minutes=85,
        badge=Badge(
            "transpiler-reader",
            "Transpiler Reader",
            "Explain why the transpiler rewrote your circuit.",
        ),
        challenge=Challenge(
            slug="circuits-with-qiskit",
            title="Four in a row, with a twist",
            qubits=4,
            goal=(
                "Put all four qubits into (|0000⟩ − |1111⟩)/√2: they always agree when "
                "measured, and the all-ones branch carries a minus sign."
            ),
            mode="state",
            ops=(
                ("h", (0,)),
                ("z", (0,)),
                ("cnot", (0, 1)),
                ("cnot", (1, 2)),
                ("cnot", (2, 3)),
            ),
        ),
        skills=(("qiskit-code", 1.0), ("circuit-design", 0.7), ("gate-algebra", 0.3)),
    ),
    Module(
        index=5,
        slug="deutsch-jozsa",
        ket="|101⟩",
        title="The Deutsch–Jozsa Algorithm",
        track="algorithms",
        lessons=5,
        minutes=60,
        badge=Badge(
            "one-query-oracle",
            "One-Query Oracle",
            "Solve Deutsch–Jozsa in a single oracle call.",
        ),
        challenge=Challenge(
            slug="deutsch-jozsa",
            title="One query, whole answer",
            qubits=3,
            goal=(
                "Build Deutsch–Jozsa for the balanced function f(x₀, x₁) = x₀ ⊕ x₁, with the "
                "inputs on q0 and q1 and the output on q2: prepare the output in |−⟩, put both "
                "inputs into superposition, query the oracle once, then bring the inputs back "
                "with a Hadamard each. Leave the output as the oracle leaves it."
            ),
            mode="operation",
            ops=(
                ("h", (0,)),
                ("h", (1,)),
                ("x", (2,)),
                ("h", (2,)),
                ("cnot", (0, 2)),
                ("cnot", (1, 2)),
                ("h", (0,)),
                ("h", (1,)),
            ),
        ),
        skills=(("algorithms", 1.0), ("complexity", 0.6), ("entanglement", 0.3)),
    ),
    Module(
        index=6,
        slug="grovers-search",
        ket="|110⟩",
        title="Grover's Search Algorithm",
        track="algorithms",
        lessons=7,
        minutes=95,
        badge=Badge(
            "amplitude-amplifier",
            "Amplitude Amplifier",
            "Pick the optimal Grover iteration count for N = 1024.",
        ),
        challenge=Challenge(
            slug="grovers-search",
            title="Find the marked item",
            qubits=2,
            goal=(
                "Search four items for |10⟩ (q1 = 1, q0 = 0) with one full Grover iteration: "
                "Hadamards on both qubits, an oracle that flips the sign of |10⟩ and nothing "
                "else, then the diffuser. Built right, the register reads |10⟩ on every shot."
            ),
            mode="operation",
            ops=(
                # the equal superposition
                ("h", (0,)),
                ("h", (1,)),
                # the oracle: a controlled-Z steered onto |10⟩ by X on q0
                ("x", (0,)),
                ("h", (1,)),
                ("cnot", (0, 1)),
                ("h", (1,)),
                ("x", (0,)),
                # the diffuser: a phase flip on |00⟩ between Hadamards
                ("h", (0,)),
                ("h", (1,)),
                ("x", (0,)),
                ("x", (1,)),
                ("h", (1,)),
                ("cnot", (0, 1)),
                ("h", (1,)),
                ("x", (0,)),
                ("x", (1,)),
                ("h", (0,)),
                ("h", (1,)),
            ),
        ),
        skills=(("algorithms", 1.0), ("complexity", 0.7), ("circuit-design", 0.4)),
    ),
    Module(
        index=7,
        slug="shors-factoring",
        ket="|111⟩",
        title="Shor's Factoring Algorithm",
        track="algorithms",
        lessons=9,
        minutes=120,
        badge=Badge("period-finder", "Period Finder", "Factor 15 with a hand-built QFT."),
        challenge=None,
        skills=(("complexity", 1.0), ("algorithms", 0.8), ("qiskit-code", 0.3)),
    ),
)

MODULE_BY_SLUG: dict[str, Module] = {module.slug: module for module in MODULES}
CHALLENGE_BY_SLUG: dict[str, Challenge] = {
    module.challenge.slug: module.challenge for module in MODULES if module.challenge
}
BADGE_BY_ID: dict[str, Badge] = {module.badge.id: module.badge for module in MODULES}
MODULE_BY_BADGE: dict[str, Module] = {module.badge.id: module for module in MODULES}

TOTAL_LESSONS: int = sum(module.lessons for module in MODULES)
TOTAL_MINUTES: int = sum(module.minutes for module in MODULES)
TOTAL_CHALLENGES: int = len(CHALLENGE_BY_SLUG)

CHALLENGE_POINTS = 3

MASTERY_LEVELS: tuple[tuple[int, str, int], ...] = (
    (1, "Bit Flipper", 0),
    (2, "Superposer", 8),
    (3, "Circuit Builder", 20),
    (4, "Algorithm Designer", 36),
    (5, "Oracle Wrangler", 52),
    (6, "Quantum Engineer", 70),
)

MAX_POINTS: int = TOTAL_LESSONS + TOTAL_CHALLENGES * CHALLENGE_POINTS


def module_units(module: Module) -> int:
    return module.lessons + (1 if module.challenge else 0)


def mastery_for(points: int) -> tuple[int, str, str | None, int]:
    level, title, floor = MASTERY_LEVELS[0]
    for candidate in MASTERY_LEVELS:
        if points >= candidate[2]:
            level, title, floor = candidate
        else:
            break

    following = next((item for item in MASTERY_LEVELS if item[0] == level + 1), None)
    if following is None:
        return level, title, None, 100

    span = following[2] - floor
    percent = 0 if span <= 0 else round(((points - floor) / span) * 100)
    return level, title, following[1], max(0, min(100, percent))
