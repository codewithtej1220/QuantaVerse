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

/**
 * What a stage's picture shows.
 *
 * Each is read straight off the simulation — the statevector at the frame
 * before the stage and at the frame after it — so the animation is the net
 * effect of the stage's gates, not an illustration of it.
 */
export type StageVisual =
  /** The register before anything runs: one card per qubit. */
  | { kind: "register" }
  /** Signed amplitudes over some wires, animated from the stage's start to its end. */
  | {
      kind: "amplitudes";
      /** The wires shown. Others are factored out while they stay unentangled. */
      register: number[];
      /**
       * How the change is drawn. `spread`: Hadamards fanning one bar out into
       * many. `phase`: signs flipping. `interfere`: every output as the sum of
       * its signed contributions. `reflect`: inversion about the mean. `bell`:
       * which of the four Bell states the pair is in. `settle`: the plain
       * before and after.
       */
      effect: "spread" | "phase" | "interfere" | "reflect" | "bell" | "settle";
      /** Basis states to call out, written q(n−1)…q0. */
      focus?: string[];
      /** A Bloch disc per shown wire under the bars. */
      bloch?: boolean;
    }
  /** Bloch discs, for stages where each qubit's own state is the story. */
  | { kind: "bloch"; wires: number[]; ghost?: StageGhost }
  /** Shots filling a histogram over some wires. */
  | {
      kind: "histogram";
      register: number[];
      focus?: string[];
      ghost?: StageGhost;
    };

/** A reference arrow: where one qubit was at an earlier frame, drawn on another's disc. */
export interface StageGhost {
  /** The wire and frame the reference is taken from. */
  wire: number;
  frame: number;
  /** The disc it is drawn on. */
  onto: number;
}

/**
 * One named part of an algorithm — "Oracle", "Diffusion" — covering a run of
 * steps.
 *
 * The steps are the gates, one time step each; a stage is what those gates are
 * for. Reading an algorithm as eleven gates asks the learner to find the idea
 * among them, and reading it as five stages hands them the idea first and the
 * gates as its implementation.
 */
export interface AlgorithmStage {
  title: string;
  /** What the stage does and why, in two or three sentences. */
  summary: string;
  /** What to look at while its picture plays. */
  watch: string;
  /** How many steps it covers, counted on from where the previous stage ended. */
  steps: number;
  visual: StageVisual;
}

export interface Algorithm {
  slug: string;
  name: string;
  /** One line, for the card. */
  tagline: string;
  qubits: number;
  /** What each wire is for, in wire order. */
  roles: string[];
  /** What it costs a classical computer, and what it costs this circuit. */
  classical: string;
  quantum: string;
  /** The problem, before any circuit. Two or three sentences. */
  premise: string;
  steps: AlgorithmStep[];
  /** The steps grouped into named stages, in order; together they cover every step. */
  stages: AlgorithmStage[];
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
    roles: ["input x₀", "input x₁", "answer"],
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
    stages: [
      {
        title: "Initialization",
        summary:
          "Three qubits, all |0⟩. q0 and q1 are the input register the question is asked on; q2 is the answer wire the oracle writes to. The secret, s = 01, is built into the oracle and nowhere else.",
        watch: "Every arrow points straight up, and all of the amplitude sits on one basis state.",
        steps: 0,
        visual: { kind: "register" },
      },
      {
        title: "Superposition",
        summary:
          "Hadamards put the input register into an equal superposition of all four inputs, so a single query asks about every x at once. The answer wire goes to |−⟩ first, which is what will turn the oracle's reply into a sign.",
        watch:
          "One bar splits into four equal bars of +½ as both input arrows swing down onto the equator.",
        steps: 2,
        visual: {
          kind: "amplitudes",
          register: [0, 1],
          effect: "spread",
          bloch: true,
        },
      },
      {
        title: "Oracle",
        summary:
          "One query. The oracle adds s·x to the answer wire, and because that wire is |−⟩ the reply comes back as a phase: every input with s·x = 1 has its amplitude negated.",
        watch:
          "|01⟩ and |11⟩ — the inputs with q0 = 1 — flip below the axis. No probability moves: all four are still 25%.",
        steps: 1,
        visual: {
          kind: "amplitudes",
          register: [0, 1],
          effect: "phase",
          focus: ["01", "11"],
        },
      },
      {
        title: "Interference",
        summary:
          "Hadamards on the inputs again. Each output collects a signed contribution from every input, and the sign pattern the oracle wrote is exactly the one that cancels everywhere except on the secret.",
        watch: "Three columns sum to zero and one sums to 1.",
        steps: 1,
        visual: {
          kind: "amplitudes",
          register: [0, 1],
          effect: "interfere",
          focus: ["01"],
        },
      },
      {
        title: "Measurement",
        summary:
          "Reading the input register returns the secret with certainty — one query, however long s is.",
        watch: "Every shot lands on |01⟩: q0 = 1, q1 = 0.",
        steps: 1,
        visual: { kind: "histogram", register: [0, 1], focus: ["01"] },
      },
    ],
  },

  {
    slug: "deutsch-jozsa",
    name: "Deutsch–Jozsa",
    tagline: "Tell a constant function from a balanced one after looking once.",
    qubits: 3,
    roles: ["input x₀", "input x₁", "output"],
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
    stages: [
      {
        title: "Initialization",
        summary:
          "Two input qubits and an output qubit, all |0⟩. The oracle hides a function f(x₀, x₁), and the only promise is that it is constant or balanced.",
        watch: "Every arrow points up; all the amplitude is on one basis state.",
        steps: 0,
        visual: { kind: "register" },
      },
      {
        title: "Superposition",
        summary:
          "Hadamards spread the inputs over all four values of x, and the output qubit is prepared in |−⟩ so that f(x) will arrive as a sign rather than as a bit.",
        watch: "One bar becomes four equal amplitudes of +½.",
        steps: 2,
        visual: {
          kind: "amplitudes",
          register: [0, 1],
          effect: "spread",
          bloch: true,
        },
      },
      {
        title: "Oracle",
        summary:
          "One query, built here as two CNOTs computing f(x) = x₀ ⊕ x₁. Through phase kickback each input picks up a factor of (−1)^f(x).",
        watch:
          "|01⟩ and |10⟩, where f is 1, flip negative. Half the signs have flipped — that is what balanced looks like, with every probability still at 25%.",
        steps: 2,
        visual: {
          kind: "amplitudes",
          register: [0, 1],
          effect: "phase",
          focus: ["01", "10"],
        },
      },
      {
        title: "Interference",
        summary:
          "Hadamards on the inputs. The amplitude arriving at |00⟩ is the average of all four signs, so a constant function would pile everything onto |00⟩ — and a balanced one cancels it to exactly zero.",
        watch: "|00⟩ sums to zero. Here all of the amplitude lands on |11⟩.",
        steps: 1,
        visual: {
          kind: "amplitudes",
          register: [0, 1],
          effect: "interfere",
          focus: ["00", "11"],
        },
      },
      {
        title: "Measurement",
        summary:
          "Measure the inputs. Anything but 00 proves the function is balanced, decided with certainty after a single query.",
        watch: "|11⟩ on every shot, and |00⟩ never.",
        steps: 1,
        visual: { kind: "histogram", register: [0, 1], focus: ["11"] },
      },
    ],
  },

  {
    slug: "grover",
    name: "Grover's search",
    tagline: "Find the marked item in an unsorted set by amplifying it.",
    qubits: 2,
    roles: ["index bit 0", "index bit 1"],
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
      {
        ops: [
          { gate: "m", wires: [0] },
          { gate: "m", wires: [1] },
        ],
        phase: "read",
        say: "Measure both qubits. After one iteration there is nothing left to amplify, so every shot lands on the marked item.",
        watch:
          "A single bar at 100% on |11⟩. A second iteration before measuring would have started shrinking it again.",
      },
    ],
    stages: [
      {
        title: "Initialization",
        summary:
          "Two qubits index four items, |00⟩ to |11⟩, and both start at |0⟩. The oracle knows the marked item is |11⟩; the rest of the circuit does not.",
        watch: "Both arrows point up and all the amplitude sits on |00⟩.",
        steps: 0,
        visual: { kind: "register" },
      },
      {
        title: "Superposition",
        summary:
          "A Hadamard on each qubit gives every item the same amplitude, ½. The search starts knowing nothing: each item is a 25% guess.",
        watch: "One bar fans out into four equal ones as both arrows swing onto the equator.",
        steps: 1,
        visual: {
          kind: "amplitudes",
          register: [0, 1],
          effect: "spread",
          bloch: true,
        },
      },
      {
        title: "Oracle",
        summary:
          "The oracle flips the sign of the marked item and nothing else. It is a controlled-Z, built from a Hadamard, a CNOT and a Hadamard on q1.",
        watch:
          "|11⟩ drops to −½ while its probability stays at 25% — a sign on its own is invisible to a measurement.",
        steps: 3,
        visual: {
          kind: "amplitudes",
          register: [0, 1],
          effect: "phase",
          focus: ["11"],
        },
      },
      {
        title: "Diffusion",
        summary:
          "The diffuser reflects every amplitude about their mean. The mean is +¼: the three unmarked items sit just above it and land on 0, while the marked item, far below at −½, is thrown up to +1.",
        watch: "The dashed line is the mean. Each bar jumps to its mirror image across it.",
        steps: 7,
        visual: {
          kind: "amplitudes",
          register: [0, 1],
          effect: "reflect",
          focus: ["11"],
        },
      },
      {
        title: "Measurement",
        summary:
          "Measuring now finds the marked item every time. On four items one iteration is exact; a search over N items needs about (π/4)√N of them.",
        watch: "Every shot lands on |11⟩.",
        steps: 1,
        visual: { kind: "histogram", register: [0, 1], focus: ["11"] },
      },
    ],
  },

  {
    slug: "superdense-coding",
    name: "Superdense coding",
    tagline: "Send two classical bits by touching one qubit.",
    qubits: 2,
    roles: ["Alice", "Bob"],
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
    stages: [
      {
        title: "Initialization",
        summary:
          "Two qubits at |0⟩. q0 will be Alice's and q1 will be Bob's. Alice wants to send the two bits 11.",
        watch: "Both arrows point up; nothing is shared yet.",
        steps: 0,
        visual: { kind: "register" },
      },
      {
        title: "Shared entanglement",
        summary:
          "A Hadamard and a CNOT make the Bell pair |Φ+⟩ = (|00⟩ + |11⟩)/√2. One half goes to each of them before Alice knows what she will say.",
        watch:
          "Amplitude only on |00⟩ and |11⟩ — and both arrows shrink to nothing, because neither qubit has a state of its own.",
        steps: 2,
        visual: {
          kind: "amplitudes",
          register: [0, 1],
          effect: "settle",
          bloch: true,
          focus: ["00", "11"],
        },
      },
      {
        title: "Encoding",
        summary:
          "Alice touches only her own qubit: a Z, then an X. Each two-bit message selects a different one of the four Bell states, and 11 selects |Ψ−⟩.",
        watch:
          "The pair moves from Φ+ to Φ− after the Z, and to Ψ− after the X. Bob's qubit is never touched.",
        steps: 2,
        visual: { kind: "amplitudes", register: [0, 1], effect: "bell" },
      },
      {
        title: "Decoding",
        summary:
          "Bob holds both qubits now. A CNOT and a Hadamard undo the Bell basis, turning each of the four Bell states into a different two-bit string.",
        watch: "The arrows grow back to full length as all the amplitude gathers on |11⟩.",
        steps: 2,
        visual: {
          kind: "amplitudes",
          register: [0, 1],
          effect: "settle",
          bloch: true,
          focus: ["11"],
        },
      },
      {
        title: "Measurement",
        summary:
          "Bob measures and reads 11 with certainty: two classical bits, recovered from the one qubit that travelled.",
        watch: "Every shot lands on |11⟩.",
        steps: 1,
        visual: { kind: "histogram", register: [0, 1], focus: ["11"] },
      },
    ],
  },

  {
    slug: "teleportation",
    name: "Quantum teleportation",
    tagline: "Move an unknown state onto another qubit without moving the qubit.",
    qubits: 3,
    roles: ["payload", "Alice's half", "Bob's half"],
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
      {
        ops: [
          { gate: "m", wires: [0] },
          { gate: "m", wires: [1] },
        ],
        phase: "read",
        say: "Measure Alice's two qubits. With the corrections already applied as controlled gates, her bits come out completely random — each of the four pairs a quarter of the time — and q2 holds the payload whichever pair appears.",
        watch:
          "A flat histogram over q0 and q1. The state was never in those bits: they only said which correction to apply, and that has already happened.",
      },
    ],
    stages: [
      {
        title: "Initialization",
        summary:
          "Three qubits at |0⟩. q0 will carry the payload Alice wants to send, q1 is her half of a shared pair, and q2 is Bob's half, far away.",
        watch: "All three arrows point up.",
        steps: 0,
        visual: { kind: "register" },
      },
      {
        title: "Payload and shared pair",
        summary:
          "Alice makes the payload on q0 — a Hadamard then a T, which leaves it on the equator at 45° — while q1 and q2 become an entangled Bell pair.",
        watch:
          "q0's arrow points between X and Y. q1 and q2 shrink to nothing: they are entangled with each other.",
        steps: 2,
        visual: { kind: "bloch", wires: [0, 1, 2] },
      },
      {
        title: "Bell measurement",
        summary:
          "A CNOT from q0 to q1 and a Hadamard on q0 rotate Alice's two qubits into the Bell basis. The payload leaves q0 and is spread across the correlations between all three.",
        watch: "All three arrows sit at the origin — for now, no single qubit holds the state.",
        steps: 2,
        visual: { kind: "bloch", wires: [0, 1, 2] },
      },
      {
        title: "Correction",
        summary:
          "The corrections depend on Alice's two bits: an X on q2 controlled by q1, then a Z controlled by q0, built as a Hadamard, a CNOT and a Hadamard. Running them as controlled gates is the same thing with the measurement deferred to the end.",
        watch:
          "Bob's arrow swings out to exactly where the payload started — the faint arrow on his disc.",
        steps: 4,
        visual: {
          kind: "bloch",
          wires: [0, 2],
          ghost: { wire: 0, frame: 2, onto: 2 },
        },
      },
      {
        title: "Measurement",
        summary:
          "Measuring Alice's qubits now gives two random bits. Bob's qubit keeps the payload whatever they say — it was moved, not copied, and q0 no longer has it.",
        watch: "A flat histogram over Alice's two bits, and Bob's arrow still on the payload.",
        steps: 1,
        visual: {
          kind: "histogram",
          register: [0, 1],
          ghost: { wire: 0, frame: 2, onto: 2 },
        },
      },
    ],
  },
];

export const ALGORITHM_BY_SLUG = Object.fromEntries(
  ALGORITHMS.map((a) => [a.slug, a]),
) as Record<string, Algorithm>;

/** A stage located on the transport: the frame before it runs, and the frame after. */
export interface StageSpan {
  stage: AlgorithmStage;
  index: number;
  /** Frame the stage starts from — the state before its first gate. */
  from: number;
  /** Frame the stage ends on — the state after its last gate. */
  to: number;
}

/**
 * Where each stage sits among the frames.
 *
 * Frame 0 is the register before anything runs, and frame n is the state after
 * step n, so a stage covering steps a…b runs from frame a to frame b + 1. The
 * opening stage covers no steps and sits on frame 0 alone.
 */
export function stageSpans(algorithm: Algorithm): StageSpan[] {
  let at = 0;
  return algorithm.stages.map((stage, index) => {
    const from = at;
    at += stage.steps;
    return { stage, index, from, to: at };
  });
}

/** The stage a frame belongs to: the first whose span reaches it. */
export function stageAt(spans: StageSpan[], frame: number): StageSpan {
  return spans.find((span) => frame <= span.to) ?? spans[spans.length - 1];
}

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
