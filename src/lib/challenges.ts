import type { CircuitIR } from "@/lib/api";
import { toCircuitIR } from "@/lib/ir";
import { pack } from "@/lib/quantum";

/**
 * One graded build per module.
 *
 * A challenge is checked by the API, which rebuilds both circuits with Qiskit
 * and compares them two ways: the state they reach from |0…0⟩, and the whole
 * operation they perform. That second check is why every goal below names an
 * operation rather than a picture — "put q0 in an equal superposition" has one
 * answer, "make the histogram look flat" has hundreds.
 *
 * Measurement is deliberately absent from the targets. The comparison happens
 * on the state before the register is read, so an M tile can neither help nor
 * hurt, and pretending otherwise would teach the wrong thing.
 *
 * Two modules have no challenge: measurement is not a unitary, and Shor's
 * period-finding does not fit in four qubits. Both say so on the page rather
 * than shipping a task the grader cannot honestly mark.
 */

export interface Challenge {
  /** Module slug — the challenge lives at /sandbox/<slug>. */
  slug: string;
  title: string;
  /** What to build, in one sentence, naming the operation. */
  goal: string;
  /** Why it is worth building. Shown under the goal. */
  why: string;
  qubits: number;
  /** The reference circuit, in reading order. */
  ops: { gate: string; wires: number[] }[];
}

export const CHALLENGES: Challenge[] = [
  {
    slug: "qubit-and-superposition",
    title: "One qubit, two places",
    goal: "Put q0 into an equal superposition of |0⟩ and |1⟩ and leave q1 in |0⟩.",
    why: "Every algorithm in this course opens with this gate. Get it on the right wire and the histogram splits 50/50 down the middle.",
    qubits: 2,
    ops: [{ gate: "h", wires: [0] }],
  },
  {
    slug: "single-qubit-gates",
    title: "Reach the minus state",
    goal: "Take q0 from |0⟩ to |−⟩, the superposition whose |1⟩ amplitude is negative.",
    why: "|+⟩ and |−⟩ have identical histograms, so the only way to tell them apart is the sign in the state read-out. Two different two-gate routes get there, and the check accepts both.",
    qubits: 2,
    ops: [
      { gate: "x", wires: [0] },
      { gate: "h", wires: [0] },
    ],
  },
  {
    slug: "quantum-entanglement",
    title: "Build a Bell pair",
    goal: "Entangle q0 and q1 so the register can only be measured as |00⟩ or |11⟩.",
    why: "This is the smallest circuit no classical machine can imitate. Watch both Bloch vectors shrink to the origin as you place the second gate.",
    qubits: 2,
    ops: [
      { gate: "h", wires: [0] },
      { gate: "cnot", wires: [0, 1] },
    ],
  },
  {
    slug: "circuits-with-qiskit",
    title: "Stretch it to three",
    goal: "Extend the Bell pair into a GHZ state, so all three qubits agree: |000⟩ or |111⟩.",
    why: "One extra CNOT turns a pair into a chain. Try writing it in the Qiskit pane instead of the grid, then press build from code.",
    qubits: 3,
    ops: [
      { gate: "h", wires: [0] },
      { gate: "cnot", wires: [0, 1] },
      { gate: "cnot", wires: [1, 2] },
    ],
  },
  {
    slug: "grovers-search",
    title: "Mark |11⟩ without touching it",
    goal: "Flip the phase of |11⟩ and leave the other three basis states exactly as they are.",
    why: "This is Grover's oracle. A controlled-Z is not on the palette, so build it the way hardware does — a CNOT with a Hadamard on either side of its target. The phase it writes is invisible in the histogram until the diffusion step turns it into an amplitude.",
    qubits: 2,
    ops: [
      { gate: "h", wires: [1] },
      { gate: "cnot", wires: [0, 1] },
      { gate: "h", wires: [1] },
    ],
  },
  {
    slug: "deutsch-jozsa",
    title: "One query, whole answer",
    goal: "Build the Deutsch–Jozsa circuit for the balanced oracle f(q0,q1) = q0 ⊕ q1: Hadamard q0 and q1, prepare the target q2 with an X and then an H, query the oracle with a CNOT from each input onto q2, and bring q0 and q1 back with a Hadamard each.",
    why: "A classical program needs at least two queries to know the oracle is balanced. This one settles it in a single pass, and the input register comes out reading |11⟩ every time.",
    qubits: 3,
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
];

export const CHALLENGE_BY_SLUG: Record<string, Challenge> = Object.fromEntries(
  CHALLENGES.map((challenge) => [challenge.slug, challenge]),
);

/** The reference circuit, in the shape the grader expects. */
export function challengeIR(challenge: Challenge): CircuitIR {
  return toCircuitIR(pack(challenge.ops, challenge.qubits), challenge.qubits);
}
