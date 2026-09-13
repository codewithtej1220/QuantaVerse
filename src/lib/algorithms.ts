import type { Placement } from "./quantum";

/**
 * The algorithms, laid out one time step at a time.
 *
 * Every circuit here runs on the same browser statevector simulator the sandbox
 * uses, on the same eight gates the palette offers. That constraint is the
 * whole design: a page that claims every number comes from a real simulation
 * cannot also carry a gallery of hand-drawn animations, and the moment one
 * entry is a cartoon the reader is entitled to wonder which of the others are
 * too. So the list is short, and what is on it is genuinely running.
 *
 * It also rules things out, and the honest thing is to say which. Shor needs
 * controlled modular exponentiation over eight or more qubits; this board holds
 * four. Anything wanting a Toffoli or a controlled phase rotation needs T† and
 * the palette has no T†. Those are absent rather than faked.
 *
 * A step is a column, and a column is a time step — gates in one step genuinely
 * happen together. The narration is per step for the same reason the sandbox's
 * transport is: a learner watching only the final histogram sees the answer and
 * none of the reasoning.
 */

export interface AlgorithmStep {
  /** Gates firing together, in this one time step. */
  ops: { gate: string; wires: number[] }[];
  /** Which part of the algorithm this belongs to — "prepare", "oracle", … */
  phase: string;
  /** What this step does, and why it is here. */
  say: string;
  /** Where to look while this step is on screen. */
  watch?: string;
}

export interface Algorithm {
  slug: string;
  name: string;
  /** One line, for the card. */
  tagline: string;
  qubits: number;
  /** What it costs a classical computer, and what it costs this circuit. */
  classical: string;
  quantum: string;
  /** The problem, before any circuit. Two or three sentences. */
  premise: string;
  steps: AlgorithmStep[];
  /** What the finished state shows, in one sentence. */
  outcome: string;
}

/* ------------------------------------------------------------------ */

export const ALGORITHMS: Algorithm[] = [
  {
    slug: "bernstein-vazirani",
    name: "Bernstein–Vazirani",
    tagline: "Pull a hidden bit string out of a black box in a single query.",
    qubits: 3,
    classical: "one query per bit",
    quantum: "one query, total",
    premise:
      "A black box hides a secret bit string s. Ask it about any x and it answers with s·x, the parity of the bits where x and s are both 1. Classically there is no cleverness available: ask about 100, then 010, then 001, and each answer hands you exactly one bit of s. Two bits of secret, two questions. A hundred bits, a hundred questions. This circuit asks once, whatever the length.",
    outcome:
      "The input register reads the secret back directly — q0 is 1 and q1 is 0, which is the string the oracle was built around.",
    steps: [
      {
        ops: [
          { gate: "h", wires: [0] },
          { gate: "h", wires: [1] },
          { gate: "x", wires: [2] },
        ],
        phase: "prepare",
        say: "Both input wires go into an even superposition, so the query about to be made is a query about every possible x at once. The X on q2 is unrelated — it is setting up the answer wire, which needs to start at |1⟩.",
        watch: "q0 and q1 swing to the equator of their Bloch spheres. q2 flips to the south pole.",
      },
      {
        ops: [{ gate: "h", wires: [2] }],
        phase: "prepare",
        say: "The answer wire becomes |−⟩. This is the trick the whole algorithm turns on: a wire in |−⟩ does not record the oracle's answer as a bit, it turns the answer into a sign on the wire that asked.",
        watch: "q2 now points along −X. Nothing else has moved.",
      },
      {
        ops: [{ gate: "cnot", wires: [0, 2] }],
        phase: "query",
        say: "The oracle, in its entirety. A CNOT from q0 means the secret has a 1 in that position; the absence of one from q1 means it has a 0 there. This is the single query.",
        watch: "q2 does not change at all — but q0 has picked up a phase. That is the answer, kicked back onto the wire that asked the question.",
      },
      {
        ops: [
          { gate: "h", wires: [0] },
          { gate: "h", wires: [1] },
        ],
        phase: "interfere",
        say: "A second Hadamard on each input turns those phases back into bits. Every path that disagrees with the secret cancels; the one that matches reinforces.",
        watch: "Both input qubits leave the equator and snap to a pole — the register is now a definite string.",
      },
      {
        ops: [
          { gate: "m", wires: [0] },
          { gate: "m", wires: [1] },
        ],
        phase: "read",
        say: "Measure. The input register holds the secret with certainty, not with high probability — there is no repeat-and-average step here.",
        watch: "q0 reads 1 and q1 reads 0. q2 is still in |−⟩ and contributes nothing; ignore it.",
      },
    ],
  },

  {
    slug: "deutsch-jozsa",
    name: "Deutsch–Jozsa",
    tagline: "Tell a constant function from a balanced one after looking once.",
    qubits: 3,
    classical: "up to 2ⁿ⁻¹ + 1 queries",
    quantum: "one query",
    premise:
      "A black box computes a function that is promised to be one of two kinds: constant, giving the same answer for every input, or balanced, giving 0 for exactly half the inputs and 1 for the other half. Which is it? Classically, in the worst case, you have to check more than half of all possible inputs before you can be sure — on four inputs that is three queries, on a million it is over half a million. This circuit answers after one.",
    outcome:
      "The input register reads |11⟩. Anything other than all-zeros proves the oracle is balanced, and it took a single query to find out.",
    steps: [
      {
        ops: [
          { gate: "h", wires: [0] },
          { gate: "h", wires: [1] },
          { gate: "x", wires: [2] },
        ],
        phase: "prepare",
        say: "The two input wires spread across all four possible inputs at once. The X on q2 starts the answer wire at |1⟩, ready for the same phase-kickback trick.",
        watch: "Four basis states now share the amplitude evenly.",
      },
      {
        ops: [{ gate: "h", wires: [2] }],
        phase: "prepare",
        say: "The answer wire becomes |−⟩, so the oracle's output will arrive as a sign rather than as a bit.",
        watch: "q2 settles on −X and stays there for the rest of the run.",
      },
      {
        ops: [{ gate: "cnot", wires: [0, 2] }],
        phase: "query",
        say: "First half of the oracle. This one computes f(q0,q1) = q0 ⊕ q1, a balanced function — but the circuit is not told that, and neither are you until the last step.",
      },
      {
        ops: [{ gate: "cnot", wires: [1, 2] }],
        phase: "query",
        say: "Second half. Both CNOTs together are one oracle call, evaluated on every input simultaneously.",
        watch: "The amplitudes have changed sign in a pattern, but every outcome is still equally likely. Nothing is readable yet.",
      },
      {
        ops: [
          { gate: "h", wires: [0] },
          { gate: "h", wires: [1] },
        ],
        phase: "interfere",
        say: "Hadamards again. If the function were constant, every path would agree and all the amplitude would pile back onto |00⟩. It is not, so it does the opposite.",
        watch: "|00⟩ empties out completely — and an empty |00⟩ is the answer.",
      },
      {
        ops: [
          { gate: "m", wires: [0] },
          { gate: "m", wires: [1] },
        ],
        phase: "read",
        say: "Measure the input register. All zeros means constant; anything else means balanced. One query, one certain answer.",
      },
    ],
  },

  {
    slug: "grover",
    name: "Grover's search",
    tagline: "Find the marked item in an unsorted set by amplifying it.",
    qubits: 2,
    classical: "2.5 looks on average, 4 worst case",
    quantum: "one iteration, then certainty",
    premise:
      "Four boxes, one prize, no order to help you. Classically you open them one at a time and average two and a half looks. Grover does something a classical search cannot: instead of opening boxes it adjusts the amplitude of every answer at once, pushing the marked one up and everything else down. On four items a single iteration is enough to make it certain — larger sets need about √N iterations, which is the speed-up the algorithm is famous for.",
    outcome:
      "All the amplitude has moved onto |11⟩ — the marked item — and the other three outcomes are at exactly zero. One iteration, no repeats, no averaging.",
    steps: [
      {
        ops: [
          { gate: "h", wires: [0] },
          { gate: "h", wires: [1] },
        ],
        phase: "prepare",
        say: "Every one of the four items gets an equal share of the amplitude. At this point the search knows nothing and every box is as likely as every other.",
        watch: "Four bars at 25% each. This is the flat starting line the rest of the circuit works against.",
      },
      {
        ops: [{ gate: "h", wires: [1] }],
        phase: "oracle",
        say: "The oracle marks |11⟩ by flipping its sign, and a sign flip on |11⟩ is exactly what a controlled-Z does. The palette has no CZ, so it is built the standard way: a Hadamard on the target, a CNOT, and a Hadamard back.",
      },
      {
        ops: [{ gate: "cnot", wires: [0, 1] }],
        phase: "oracle",
        say: "The CNOT in the middle of that sandwich. Between the two Hadamards it acts as a controlled-Z.",
      },
      {
        ops: [{ gate: "h", wires: [1] }],
        phase: "oracle",
        say: "Closing Hadamard. The oracle is done: |11⟩ now carries a minus sign and the other three are untouched.",
        watch: "The histogram has not moved at all — all four are still at 25%. A sign is not a probability, and this is why one oracle call alone tells you nothing.",
      },
      {
        ops: [
          { gate: "h", wires: [0] },
          { gate: "h", wires: [1] },
        ],
        phase: "amplify",
        say: "Now the diffuser, which turns that hidden sign into a visible probability. It is a reflection about the average amplitude, and it is built inside-out: Hadamards first, to move into the basis where the reflection is easy.",
      },
      {
        ops: [
          { gate: "x", wires: [0] },
          { gate: "x", wires: [1] },
        ],
        phase: "amplify",
        say: "X on both wires. Together with the controlled-Z coming next, this flips the sign of everything except |00⟩ — which, back in the original basis, is a reflection about the mean.",
      },
      {
        ops: [{ gate: "h", wires: [1] }],
        phase: "amplify",
        say: "The diffuser's own controlled-Z, opened the same way as the oracle's.",
      },
      {
        ops: [{ gate: "cnot", wires: [0, 1] }],
        phase: "amplify",
        say: "Its CNOT.",
      },
      {
        ops: [{ gate: "h", wires: [1] }],
        phase: "amplify",
        say: "And closed.",
      },
      {
        ops: [
          { gate: "x", wires: [0] },
          { gate: "x", wires: [1] },
        ],
        phase: "amplify",
        say: "The X gates come back off.",
      },
      {
        ops: [
          { gate: "h", wires: [0] },
          { gate: "h", wires: [1] },
        ],
        phase: "amplify",
        say: "Final Hadamards close the diffuser and the reflection lands. The marked amplitude has grown at the expense of the other three.",
        watch: "|11⟩ goes to 100% and the other three drop to zero. On four items one iteration is exact — run a second one and it would start going back down.",
      },
    ],
  },

  {
    slug: "superdense-coding",
    name: "Superdense coding",
    tagline: "Send two classical bits by touching one qubit.",
    qubits: 2,
    classical: "two bits down the wire",
    quantum: "one qubit down the wire",
    premise:
      "Alice wants to send Bob two bits. They share an entangled pair beforehand — one qubit each, prepared while they were still in the same room. Afterwards Alice touches only her own qubit and sends that single qubit to Bob, and Bob recovers both bits. The entanglement is what pays for it: the pair had to be distributed first, and it is consumed in the process.",
    outcome:
      "Bob reads |11⟩ with certainty — exactly the two bits Alice encoded, recovered from one qubit in transit.",
    steps: [
      {
        ops: [{ gate: "h", wires: [0] }],
        phase: "share",
        say: "Building the pair they share. This happens before Alice knows what she wants to say.",
      },
      {
        ops: [{ gate: "cnot", wires: [0, 1] }],
        phase: "share",
        say: "The CNOT entangles them. q0 goes to Alice, q1 to Bob, and they part company. Neither qubit has a state of its own any more.",
        watch: "Both Bloch vectors collapse to the origin. A zero-length vector is what entanglement looks like from one qubit's point of view.",
      },
      {
        ops: [{ gate: "z", wires: [0] }],
        phase: "encode",
        say: "Alice wants to send 11. The first of those two bits is applied as a Z on her own qubit — she never touches Bob's, and Bob is not present.",
      },
      {
        ops: [{ gate: "x", wires: [0] }],
        phase: "encode",
        say: "The second bit is an X. Two gates on one qubit have now selected which of the four Bell states the pair is in, and there are exactly four — which is why two bits fit.",
        watch: "The Bloch spheres still show nothing. The message is in the correlation, not in either qubit.",
      },
      {
        ops: [{ gate: "cnot", wires: [0, 1] }],
        phase: "decode",
        say: "Alice's qubit arrives and Bob holds both. He undoes the entangling operation — CNOT first…",
      },
      {
        ops: [{ gate: "h", wires: [0] }],
        phase: "decode",
        say: "…then the Hadamard. The Bell state he was handed turns back into a plain two-bit string.",
        watch: "The Bloch vectors come back to full length: the pair is no longer entangled, and each qubit is a definite bit again.",
      },
      {
        ops: [
          { gate: "m", wires: [0] },
          { gate: "m", wires: [1] },
        ],
        phase: "read",
        say: "Both bits, read off with certainty. One qubit crossed the gap.",
      },
    ],
  },

  {
    slug: "teleportation",
    name: "Quantum teleportation",
    tagline: "Move an unknown state onto another qubit without moving the qubit.",
    qubits: 3,
    classical: "impossible without measuring, which destroys it",
    quantum: "one shared pair, two classical bits",
    premise:
      "q0 holds a state nobody knows. You cannot copy it — no-cloning forbids it — and you cannot measure it and rebuild it, because measuring destroys everything except one bit of it. Teleportation moves it onto q2 anyway, using a shared entangled pair and two classical bits. The original does not survive: it is moved, not copied, which is what keeps no-cloning intact.",
    outcome:
      "q2's Bloch vector ends up exactly where q0's started — on the equator, 45° round — and q0 no longer holds it. The state moved without anything carrying it.",
    steps: [
      {
        ops: [
          { gate: "h", wires: [0] },
          { gate: "h", wires: [1] },
        ],
        phase: "set up",
        say: "Two unrelated things at once. The H on q0 starts building the payload — the state we are going to send — and the H on q1 starts the entangled pair that will carry it.",
      },
      {
        ops: [
          { gate: "t", wires: [0] },
          { gate: "cnot", wires: [1, 2] },
        ],
        phase: "set up",
        say: "The T finishes the payload: q0 now sits on the equator at 45°, a state with both a real and an imaginary part, so there is genuinely something non-trivial to move. The CNOT finishes the Bell pair on q1 and q2.",
        watch: "q0's vector points between X and Y. q1 and q2 have collapsed to the origin — they are entangled with each other now.",
      },
      {
        ops: [{ gate: "cnot", wires: [0, 1] }],
        phase: "entangle",
        say: "Alice holds q0 and q1 and starts her joint measurement of the two. The CNOT is the first half of reading them in the Bell basis rather than one at a time.",
      },
      {
        ops: [{ gate: "h", wires: [0] }],
        phase: "entangle",
        say: "The Hadamard completes it. At this instant the payload has left q0 — it is smeared across the correlations between all three wires, and q2 holds it up to one of four possible corrections.",
        watch: "All three Bloch vectors are now at or near the origin. The state is in the correlations, not on any one qubit.",
      },
      {
        ops: [{ gate: "cnot", wires: [1, 2] }],
        phase: "correct",
        say: "The first correction. On real hardware Alice measures q1 and phones the result to Bob, who applies an X if it came back 1. Drawn as a controlled gate instead, which is the same operation with the measurement deferred to the end.",
      },
      {
        ops: [{ gate: "h", wires: [2] }],
        phase: "correct",
        say: "The second correction is a controlled-Z from q0, and a controlled-Z is a Hadamard, a CNOT and a Hadamard back.",
      },
      {
        ops: [{ gate: "cnot", wires: [0, 2] }],
        phase: "correct",
        say: "The CNOT at the heart of it.",
      },
      {
        ops: [{ gate: "h", wires: [2] }],
        phase: "correct",
        say: "And closed. The correction is applied and the payload has arrived.",
        watch: "q2's Bloch vector is now exactly where q0's was at step 2 — same equator, same 45°. q0 is not holding it any more.",
      },
    ],
  },
];

export const ALGORITHM_BY_SLUG = Object.fromEntries(
  ALGORITHMS.map((a) => [a.slug, a]),
) as Record<string, Algorithm>;

/**
 * One column per narrated step, rather than packing gates as tightly as they
 * will go.
 *
 * The sandbox packs, because there a column is just a column. Here a column is
 * a paragraph, and a transport that skipped two explanations in one press
 * would be explaining the circuit in a different order from the one it runs in.
 */
export function algorithmPlacements(algorithm: Algorithm): Placement[] {
  const out: Placement[] = [];
  algorithm.steps.forEach((step, column) => {
    step.ops.forEach((op, i) => {
      out.push({
        id: `${algorithm.slug}-${column}-${i}`,
        gate: op.gate,
        column,
        wires: op.wires,
      });
    });
  });
  return out;
}

/* ------------------------------------------------------------------ */

export interface CodeLine {
  text: string;
  /** The step this line belongs to, or null for scaffolding. */
  step: number | null;
}

const QISKIT_METHOD: Record<string, string> = {
  h: "h",
  x: "x",
  y: "y",
  z: "z",
  s: "s",
  t: "t",
};

/**
 * The same circuit as Qiskit, with every line tagged by the step it came from.
 *
 * Generated here rather than through `toQiskit` for one reason: the transport
 * needs to know which lines belong to the step it is parked on, and a finished
 * string cannot say. It is the same Qiskit either way — the sandbox's own
 * parser reads it back without complaint.
 */
export function algorithmCode(algorithm: Algorithm): CodeLine[] {
  const lines: CodeLine[] = [
    { text: "from qiskit import QuantumCircuit", step: null },
    { text: "from qiskit.quantum_info import Statevector", step: null },
    { text: "", step: null },
    { text: `qc = QuantumCircuit(${algorithm.qubits}, ${algorithm.qubits})`, step: null },
  ];

  let phase: string | null = null;
  const pending: number[] = [];

  algorithm.steps.forEach((step, index) => {
    if (step.phase !== phase) {
      phase = step.phase;
      lines.push({ text: "", step: null });
      lines.push({ text: `# ${phase}`, step: index });
    }

    for (const op of step.ops) {
      if (op.gate === "m") {
        pending.push(op.wires[0]);
        continue;
      }
      if (op.gate === "cnot") {
        lines.push({ text: `qc.cx(${op.wires[0]}, ${op.wires[1]})`, step: index });
        continue;
      }
      const method = QISKIT_METHOD[op.gate];
      if (method) lines.push({ text: `qc.${method}(${op.wires[0]})`, step: index });
    }

    /* Qiskit takes a measurement of several wires as one call, so it is
       emitted once the step that asked for them is finished rather than once
       per wire. */
    if (pending.length) {
      const wires = [...pending].sort((a, b) => a - b);
      lines.push({
        text: `qc.measure(${JSON.stringify(wires)}, ${JSON.stringify(wires)})`,
        step: index,
      });
      pending.length = 0;
    }
  });

  lines.push({ text: "", step: null });
  lines.push({
    text: "state = Statevector.from_instruction(qc.remove_final_measurements(False))",
    step: null,
  });
  lines.push({ text: "print(state.probabilities_dict())", step: null });

  return lines;
}
