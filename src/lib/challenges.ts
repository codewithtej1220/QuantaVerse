import { pack, type Placement } from "@/lib/quantum";

/**
 * One graded build per module, and the ladder they make together.
 *
 * Each lab is harder than the one before it, on purpose and in a way you can
 * count: more gates, more qubits, and less of the construction handed over.
 * The first is one gate the lesson has just named. The last is a full Grover
 * iteration — oracle and diffuser — built from a CNOT and single-qubit gates,
 * with nothing on the page saying which ones. They used to wander: the
 * Deutsch–Jozsa lab spelled out every gate in its goal, which made module six
 * a transcription exercise, while module seven's asked for three gates.
 *
 * A lab is marked in one of two ways, and the goal says which thing it wants.
 * A *state* lab asks for a state, so any route to it is right. An *operation*
 * lab asks for an algorithm, so it is checked on every input: otherwise one X
 * on the right wire would "find" Grover's marked item without searching.
 *
 * The reference circuits are mirrored in `backend/app/core/curriculum.py`,
 * which is what the grader actually marks against — a client never supplies
 * the target any more. The copy here drives the in-browser reading the cat
 * uses, and the offline check when the API is not running.
 *
 * Two modules have no lab: measurement is not a unitary, and Shor's
 * period-finding does not fit in four qubits.
 */

export type GradeMode = "state" | "operation";

export interface Challenge {
  /** Module slug — the lab lives at /sandbox/<slug>. */
  slug: string;
  title: string;
  /** Where it sits on the ladder, 1 (first) to CHALLENGES.length (last). */
  level: number;
  /** What to build, in one or two sentences. */
  goal: string;
  /** Why it is worth building, and the nudge a stuck learner needs. */
  why: string;
  qubits: number;
  /** Time steps the board offers. The long builds need more than ten. */
  columns?: number;
  mode: GradeMode;
  /** The reference circuit, in reading order. */
  ops: { gate: string; wires: number[] }[];
}

export const CHALLENGES: Challenge[] = [
  {
    slug: "qubit-and-superposition",
    title: "One qubit, two places",
    level: 1,
    goal: "Put q0 into the equal superposition |+⟩ = (|0⟩ + |1⟩)/√2, and leave q1 in |0⟩.",
    why: "Every algorithm in this course opens with this gate. Put it on the right wire and the histogram splits evenly between |00⟩ and |01⟩ — q0 is the right-hand bit.",
    qubits: 2,
    mode: "state",
    ops: [{ gate: "h", wires: [0] }],
  },
  {
    slug: "single-qubit-gates",
    title: "Point it at −Y",
    level: 2,
    goal: "Turn q0 from |0⟩ into (|0⟩ − i|1⟩)/√2, the state at the −Y pole of the Bloch sphere, and leave q1 in |0⟩.",
    why: "H then S reaches +Y, so you are one idea away. ±X and ±Y all give the same 50/50 histogram — only the Bloch arrow and the state read-out show which pole you reached, and more than one route gets there.",
    qubits: 2,
    mode: "state",
    ops: [
      { gate: "h", wires: [0] },
      { gate: "s", wires: [0] },
      { gate: "z", wires: [0] },
    ],
  },
  {
    slug: "quantum-entanglement",
    title: "The singlet",
    level: 3,
    goal: "Build the singlet (|01⟩ − |10⟩)/√2: the two qubits always measure opposite, and the two branches carry opposite signs.",
    why: "The Bell pair from the lessons is one of four. This one needs a bit flip and a phase flip on top of the entangling pair, and the minus sign never shows in the histogram — check it in the state read-out before you submit.",
    qubits: 2,
    mode: "state",
    ops: [
      { gate: "x", wires: [0] },
      { gate: "h", wires: [0] },
      { gate: "cnot", wires: [0, 1] },
      { gate: "x", wires: [1] },
    ],
  },
  {
    slug: "circuits-with-qiskit",
    title: "Four in a row, with a twist",
    level: 4,
    goal: "Put all four qubits into (|0000⟩ − |1111⟩)/√2: they always agree when measured, and the all-ones branch carries a minus sign.",
    why: "A loop in the Qiskit pane lays the CNOT chain in two lines — write it, then press Build from code. The sign is the part the histogram cannot show you.",
    qubits: 4,
    mode: "state",
    ops: [
      { gate: "h", wires: [0] },
      { gate: "z", wires: [0] },
      { gate: "cnot", wires: [0, 1] },
      { gate: "cnot", wires: [1, 2] },
      { gate: "cnot", wires: [2, 3] },
    ],
  },
  {
    slug: "deutsch-jozsa",
    title: "One query, whole answer",
    level: 5,
    goal: "Build Deutsch–Jozsa for the balanced function f(x₀, x₁) = x₀ ⊕ x₁, with the inputs on q0 and q1 and the output on q2: prepare the output in |−⟩, put both inputs into superposition, query the oracle once, then bring the inputs back with a Hadamard each. Leave the output as the oracle leaves it.",
    why: "Nobody hands you the oracle: work its gates out from U_f|x⟩|y⟩ = |x⟩|y ⊕ f(x)⟩. It is marked on every input, not only |000⟩ — and built right, the inputs read |11⟩ every time, never |00⟩.",
    qubits: 3,
    mode: "operation",
    ops: [
      { gate: "h", wires: [0] },
      { gate: "h", wires: [1] },
      { gate: "x", wires: [2] },
      { gate: "h", wires: [2] },
      { gate: "cnot", wires: [0, 2] },
      { gate: "cnot", wires: [1, 2] },
      { gate: "h", wires: [0] },
      { gate: "h", wires: [1] },
    ],
  },
  {
    slug: "grovers-search",
    title: "Find the marked item",
    level: 6,
    goal: "Search four items for |10⟩ (q1 = 1, q0 = 0) with one full Grover iteration: Hadamards on both qubits, an oracle that flips the sign of |10⟩ and nothing else, then the diffuser. Built right, the register reads |10⟩ on every shot.",
    why: "There is no controlled-Z on the palette — make one from a CNOT with a Hadamard either side of its target, and use X gates to steer the flip onto |10⟩. It is marked on all four inputs, so a circuit that only lands on |10⟩ from |00⟩ will not pass.",
    qubits: 2,
    columns: 14,
    mode: "operation",
    ops: [
      // the equal superposition
      { gate: "h", wires: [0] },
      { gate: "h", wires: [1] },
      // the oracle: a controlled-Z steered onto |10⟩ by an X either side on q0
      { gate: "x", wires: [0] },
      { gate: "h", wires: [1] },
      { gate: "cnot", wires: [0, 1] },
      { gate: "h", wires: [1] },
      { gate: "x", wires: [0] },
      // the diffuser: a phase flip on |00⟩, between Hadamards
      { gate: "h", wires: [0] },
      { gate: "h", wires: [1] },
      { gate: "x", wires: [0] },
      { gate: "x", wires: [1] },
      { gate: "h", wires: [1] },
      { gate: "cnot", wires: [0, 1] },
      { gate: "h", wires: [1] },
      { gate: "x", wires: [0] },
      { gate: "x", wires: [1] },
      { gate: "h", wires: [0] },
      { gate: "h", wires: [1] },
    ],
  },
];

export const CHALLENGE_BY_SLUG: Record<string, Challenge> = Object.fromEntries(
  CHALLENGES.map((challenge) => [challenge.slug, challenge]),
);

/** The reference circuit, as placements on the board. */
export function challengePlacements(challenge: Challenge): Placement[] {
  return pack(challenge.ops, challenge.qubits);
}

/** What each marking mode means, in the words the page uses. */
export const MODE_LABEL: Record<GradeMode, { name: string; detail: string }> = {
  state: {
    name: "marked on the state",
    detail:
      "Only the state your circuit reaches counts, up to a global phase — any route there passes.",
  },
  operation: {
    name: "marked on every input",
    detail:
      "Your circuit has to do what the algorithm does to every input, not just land on the answer from |0…0⟩.",
  },
};
