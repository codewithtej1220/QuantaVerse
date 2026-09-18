/**
 * Placeholder content for the QuantaVerse frontend.
 *
 * The curriculum has exactly eight modules, so they are labelled with the eight
 * basis states of a three-qubit register: |000> through |111>. The label is not
 * decoration — it is the module's index written the way the subject writes
 * numbers, and the ordering carries the prerequisite chain.
 */

export type Track = "foundations" | "algorithms" | "hardware";
export type ModuleState = "mastered" | "active" | "available" | "locked";

export interface Module {
  slug: string;
  ket: string;
  title: string;
  summary: string;
  track: Track;
  lessons: number;
  minutes: number;
  /** Percent of the module completed, shown as a measurement probability. */
  progress: number;
  state: ModuleState;
  concepts: string[];
  gates: string[];
  /** Reward unlocked on completion. */
  badge: string;
}

export const MODULES: Module[] = [
  {
    slug: "qubit-and-superposition",
    ket: "|000⟩",
    title: "The Qubit & Superposition",
    summary:
      "Build a qubit from the ground up: the Bloch sphere, amplitudes, and why a Hadamard gate puts a state in two places at once.",
    track: "foundations",
    lessons: 6,
    minutes: 55,
    progress: 100,
    state: "mastered",
    concepts: ["State vectors", "Bloch sphere", "Hadamard", "Global phase"],
    gates: ["H", "I"],
    badge: "First Superposition",
  },
  {
    slug: "measurement-and-probability",
    ket: "|001⟩",
    title: "Measurement & Probability",
    summary:
      "Collapse a superposition a thousand times and watch the histogram converge on |α|². Measurement is destructive, and that is the point.",
    track: "foundations",
    lessons: 5,
    minutes: 45,
    progress: 100,
    state: "mastered",
    concepts: ["Born rule", "Shot noise", "Basis change", "Classical registers"],
    gates: ["H", "M"],
    badge: "Thousand Shots",
  },
  {
    slug: "single-qubit-gates",
    ket: "|010⟩",
    title: "Single-Qubit Gates",
    summary:
      "Rotate a state anywhere on the sphere. Pauli X, Y, Z, the phase gates S and T, and the RX/RY/RZ family as continuous rotations.",
    track: "foundations",
    lessons: 7,
    minutes: 70,
    progress: 72,
    state: "active",
    concepts: ["Pauli group", "Unitary matrices", "Rotation angles", "T-depth"],
    gates: ["X", "Y", "Z", "S", "T", "RZ"],
    badge: "Rotation Fluent",
  },
  {
    slug: "quantum-entanglement",
    ket: "|011⟩",
    title: "Quantum Entanglement",
    summary:
      "Wire two qubits into a Bell pair, prove the correlation is not classical, and read a CHSH inequality that hardware actually violates.",
    track: "foundations",
    lessons: 6,
    minutes: 65,
    progress: 34,
    state: "active",
    concepts: ["Bell states", "CNOT", "CHSH bound", "No-signalling"],
    gates: ["H", "CNOT", "M"],
    badge: "Bell Pair",
  },
  {
    slug: "circuits-with-qiskit",
    ket: "|100⟩",
    title: "Circuits with Qiskit",
    summary:
      "Move from diagrams to code. Build, transpile, and simulate circuits in Qiskit, then read the transpiler's output like a compiler log.",
    track: "hardware",
    lessons: 8,
    minutes: 85,
    progress: 12,
    state: "available",
    concepts: ["QuantumCircuit", "Transpilation", "Basis gates", "Statevector sim"],
    gates: ["H", "X", "CNOT", "RZ", "M"],
    badge: "Transpiler Reader",
  },
  {
    slug: "deutsch-jozsa",
    ket: "|101⟩",
    title: "The Deutsch–Jozsa Algorithm",
    summary:
      "The first algorithm with a provable quantum advantage. One oracle query decides what a classical machine needs 2ⁿ⁻¹+1 queries to decide.",
    track: "algorithms",
    lessons: 5,
    minutes: 60,
    progress: 0,
    state: "available",
    concepts: ["Oracles", "Phase kickback", "Interference", "Query complexity"],
    gates: ["H", "X", "CNOT", "M"],
    badge: "One-Query Oracle",
  },
  {
    slug: "grovers-search",
    ket: "|110⟩",
    title: "Grover's Search Algorithm",
    summary:
      "Amplify the answer you want. Build the oracle and the diffuser, then watch amplitude drain from every wrong state in √N iterations.",
    track: "algorithms",
    lessons: 7,
    minutes: 95,
    progress: 0,
    state: "locked",
    concepts: ["Amplitude amplification", "Diffuser", "Optimal iterations", "√N speedup"],
    gates: ["H", "X", "Z", "CNOT", "M"],
    badge: "Amplitude Amplifier",
  },
  {
    slug: "shors-factoring",
    ket: "|111⟩",
    title: "Shor's Factoring Algorithm",
    summary:
      "The one that started the funding. Period finding via the quantum Fourier transform, and an honest look at the qubit count RSA-2048 needs.",
    track: "algorithms",
    lessons: 9,
    minutes: 120,
    progress: 0,
    state: "locked",
    concepts: ["QFT", "Period finding", "Modular exponentiation", "Error budgets"],
    gates: ["H", "RZ", "CNOT", "M"],
    badge: "Period Finder",
  },
];

export const TRACK_LABEL: Record<Track, string> = {
  foundations: "Foundations",
  algorithms: "Algorithms",
  hardware: "Hardware & Code",
};

/* ------------------------------------------------------------------ */
/* Gate palette for the sandbox                                        */
/* ------------------------------------------------------------------ */

export type GateTone = "photon" | "phase" | "collapse";

export interface Gate {
  id: string;
  symbol: string;
  name: string;
  /** Qubits the gate acts on. */
  arity: 1 | 2;
  tone: GateTone;
  matrix: string[][];
  blurb: string;
}

export const GATES: Gate[] = [
  {
    id: "h",
    symbol: "H",
    name: "Hadamard",
    arity: 1,
    tone: "photon",
    matrix: [
      ["1", "1"],
      ["1", "−1"],
    ],
    blurb: "Maps |0⟩ to an equal superposition. The entry point to every algorithm here.",
  },
  {
    id: "x",
    symbol: "X",
    name: "Pauli-X",
    arity: 1,
    tone: "photon",
    matrix: [
      ["0", "1"],
      ["1", "0"],
    ],
    blurb: "A π rotation about x. The quantum NOT: |0⟩ ↔ |1⟩.",
  },
  {
    id: "y",
    symbol: "Y",
    name: "Pauli-Y",
    arity: 1,
    tone: "phase",
    matrix: [
      ["0", "−i"],
      ["i", "0"],
    ],
    blurb: "A π rotation about y. Flips the bit and the phase together.",
  },
  {
    id: "z",
    symbol: "Z",
    name: "Pauli-Z",
    arity: 1,
    tone: "phase",
    matrix: [
      ["1", "0"],
      ["0", "−1"],
    ],
    blurb: "Leaves |0⟩ alone and negates |1⟩. Invisible until you interfere.",
  },
  {
    id: "s",
    symbol: "S",
    name: "Phase (√Z)",
    arity: 1,
    tone: "phase",
    matrix: [
      ["1", "0"],
      ["0", "i"],
    ],
    blurb: "A quarter turn about z. Two of these make a Z.",
  },
  {
    id: "t",
    symbol: "T",
    name: "π/8 gate",
    arity: 1,
    tone: "phase",
    matrix: [
      ["1", "0"],
      ["0", "ω"],
    ],
    blurb: "An eighth turn about z. Expensive on real hardware — count them.",
  },
  {
    id: "cnot",
    symbol: "●",
    name: "CNOT",
    arity: 2,
    tone: "photon",
    matrix: [
      ["I", "0"],
      ["0", "X"],
    ],
    blurb: "Flips the target when the control is |1⟩. This is how entanglement gets made.",
  },
  {
    id: "m",
    symbol: "M",
    name: "Measure",
    arity: 1,
    tone: "collapse",
    matrix: [
      ["⟨0|", "—"],
      ["—", "⟨1|"],
    ],
    blurb: "Collapses the qubit to a classical bit. Irreversible, so place it last.",
  },
];

export const GATE_BY_ID = Object.fromEntries(GATES.map((g) => [g.id, g])) as Record<string, Gate>;

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export interface Skill {
  label: string;
  short: string;
  value: number;
  /** Cohort median, for the ghost polygon behind the learner's shape. */
  cohort: number;
}

export const SKILLS: Skill[] = [
  { label: "Superposition", short: "SUP", value: 92, cohort: 71 },
  { label: "Entanglement", short: "ENT", value: 64, cohort: 55 },
  { label: "Gate algebra", short: "GAT", value: 81, cohort: 62 },
  { label: "Circuit design", short: "CIR", value: 74, cohort: 58 },
  { label: "Measurement", short: "MEA", value: 88, cohort: 69 },
  { label: "Algorithms", short: "ALG", value: 41, cohort: 44 },
  { label: "Qiskit code", short: "QIS", value: 57, cohort: 48 },
  { label: "Complexity", short: "CPX", value: 35, cohort: 39 },
];

export interface BadgeItem {
  id: string;
  name: string;
  detail: string;
  ket: string;
  earned: boolean;
  earnedOn?: string;
  tone: GateTone;
}

export const BADGES: BadgeItem[] = [
  {
    id: "first-superposition",
    name: "First Superposition",
    detail: "Put a qubit in an equal superposition and read the histogram.",
    ket: "|000⟩",
    earned: true,
    earnedOn: "12 Jun 2026",
    tone: "photon",
  },
  {
    id: "thousand-shots",
    name: "Thousand Shots",
    detail: "Ran 1,024 shots and matched the predicted distribution within 2%.",
    ket: "|001⟩",
    earned: true,
    earnedOn: "19 Jun 2026",
    tone: "photon",
  },
  {
    id: "rotation-fluent",
    name: "Rotation Fluent",
    detail: "Reached any point on the Bloch sphere in three gates or fewer.",
    ket: "|010⟩",
    earned: true,
    earnedOn: "2 Aug 2026",
    tone: "phase",
  },
  {
    id: "bell-pair",
    name: "Bell Pair",
    detail: "Built all four Bell states from scratch without a hint.",
    ket: "|011⟩",
    earned: true,
    earnedOn: "18 Aug 2026",
    tone: "phase",
  },
  {
    id: "transpiler-reader",
    name: "Transpiler Reader",
    detail: "Explain why the transpiler rewrote your circuit.",
    ket: "|100⟩",
    earned: false,
    tone: "photon",
  },
  {
    id: "one-query-oracle",
    name: "One-Query Oracle",
    detail: "Solve Deutsch–Jozsa in a single oracle call.",
    ket: "|101⟩",
    earned: false,
    tone: "phase",
  },
  {
    id: "amplitude-amplifier",
    name: "Amplitude Amplifier",
    detail: "Pick the optimal Grover iteration count for N = 1024.",
    ket: "|110⟩",
    earned: false,
    tone: "collapse",
  },
  {
    id: "period-finder",
    name: "Period Finder",
    detail: "Factor 15 with a hand-built QFT.",
    ket: "|111⟩",
    earned: false,
    tone: "collapse",
  },
];

export const LEARNER = {
  name: "Aditi Raghunathan",
  handle: "aditi.r",
  institution: "PSG College of Technology, Coimbatore",
  cohort: "Open cohort · self-paced",
  masteryLevel: 3,
  masteryTitle: "Circuit Builder",
  masteryProgress: 68,
  nextTitle: "Algorithm Designer",
  streakDays: 17,
  circuitsRun: 214,
  shotsSimulated: 186_400,
  hoursLogged: 42.5,
  lessonsDone: 24,
  lessonsTotal: 53,
};

/**
 * Twelve complete weeks of practice, most recent last: 84 days, Monday-first,
 * 0–4 sessions each. The final 17 entries are all non-zero — that run is the
 * streak in LEARNER.streakDays, so the heatmap and the header agree.
 */
export const COHERENCE_LOG: number[] = [
  0, 1, 2, 1, 0, 0, 1, 2, 3, 2, 1, 0, 0, 2, 3, 4, 3, 1, 0, 1, 2, 2, 4, 4, 3, 2, 1, 0, 1, 3, 4, 4,
  4, 2, 1, 1, 2, 3, 3, 4, 2, 0, 0, 1, 2, 4, 4, 3, 2, 1, 0, 2, 3, 4, 4, 4, 3, 2, 1, 2, 3, 4, 4, 3,
  2, 1, 0, 3, 4, 4, 2, 1, 1, 2, 2, 3, 4, 4, 3, 2, 1, 1, 2, 3,
];

/* ------------------------------------------------------------------ */
/* AI tutor                                                           */
/* ------------------------------------------------------------------ */

export interface ChatTurn {
  id: string;
  from: "tutor" | "learner";
  body: string;
  /** Rendered as a monospace code block under the message. */
  code?: string;
  /** Shown as a labelled reference to what the tutor is looking at. */
  looking?: string;
  chips?: string[];
}

export const TUTOR_SUGGESTIONS = [
  "Why did the transpiler add a swap?",
  "Explain phase kickback with my circuit",
  "Is my Grover iteration count optimal?",
];

/* ------------------------------------------------------------------ */
/* Landing page                                                        */
/* ------------------------------------------------------------------ */

export const STARTER_CIRCUIT = `from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

# Bell pair: the smallest circuit that cannot be
# explained by classical correlation.
qc = QuantumCircuit(2, 2)

qc.h(0)          # q0 -> (|0> + |1>) / sqrt(2)
qc.cx(0, 1)      # entangle q1 with q0
qc.measure([0, 1], [0, 1])

state = Statevector.from_instruction(qc.remove_final_measurements(False))
print(state.probabilities_dict())
# {'00': 0.4999999999999999, '11': 0.4999999999999999}
`;
