/**
 * A three-qubit statevector simulator, small enough to run on every keystroke.
 *
 * The sandbox does not fake its numbers. Eight complex amplitudes are cheap, so
 * the histogram, the Bloch sphere and the Qiskit pane are all derived from the
 * same state the learner built. Qubit 0 is the least significant bit, matching
 * Qiskit, so a printed bit-string reads q(n-1) … q1 q0.
 */

export interface BlochVector {
  x: number;
  y: number;
  z: number;
}

export interface Placement {
  id: string;
  /** Gate id from GATES in lib/data. */
  gate: string;
  column: number;
  /** [target] for one-qubit gates, [control, target] for CNOT. */
  wires: number[];
}

export interface SimulationResult {
  /** Measurement probability per basis state, index = bit-string value. */
  probabilities: number[];
  /** Bit-string label per basis state, most significant qubit first. */
  labels: string[];
  /** Reduced Bloch vector per qubit. Length < 1 means the qubit is entangled. */
  bloch: BlochVector[];
  /** Amplitudes, for the state read-out. */
  amplitudes: { re: number; im: number }[];
  /** Longest chain of gates through the circuit, as Qiskit's `depth()` counts it. */
  depth: number;
  gateCount: number;
}

const S = Math.SQRT1_2;
const T_PHASE = Math.cos(Math.PI / 4);

/** Flattened 2×2 unitaries: [a00re, a00im, a01re, a01im, a10re, a10im, a11re, a11im]. */
const UNITARY: Record<string, number[]> = {
  h: [S, 0, S, 0, S, 0, -S, 0],
  x: [0, 0, 1, 0, 1, 0, 0, 0],
  y: [0, 0, 0, -1, 0, 1, 0, 0],
  z: [1, 0, 0, 0, 0, 0, -1, 0],
  s: [1, 0, 0, 0, 0, 0, 0, 1],
  t: [1, 0, 0, 0, 0, 0, T_PHASE, T_PHASE],
};

function applyOne(re: Float64Array, im: Float64Array, n: number, q: number, m: number[]) {
  const dim = 1 << n;
  const bit = 1 << q;
  for (let i = 0; i < dim; i += 1) {
    if (i & bit) continue;
    const j = i | bit;
    const ar = re[i];
    const ai = im[i];
    const br = re[j];
    const bi = im[j];
    re[i] = m[0] * ar - m[1] * ai + m[2] * br - m[3] * bi;
    im[i] = m[0] * ai + m[1] * ar + m[2] * bi + m[3] * br;
    re[j] = m[4] * ar - m[5] * ai + m[6] * br - m[7] * bi;
    im[j] = m[4] * ai + m[5] * ar + m[6] * bi + m[7] * br;
  }
}

function applyCnot(re: Float64Array, im: Float64Array, n: number, c: number, t: number) {
  const dim = 1 << n;
  const cb = 1 << c;
  const tb = 1 << t;
  for (let i = 0; i < dim; i += 1) {
    if (i & cb && !(i & tb)) {
      const j = i | tb;
      const r = re[i];
      re[i] = re[j];
      re[j] = r;
      const v = im[i];
      im[i] = im[j];
      im[j] = v;
    }
  }
}

/** Reduced density matrix of one qubit, expressed as a Bloch vector. */
function blochOf(re: Float64Array, im: Float64Array, n: number, q: number): BlochVector {
  const dim = 1 << n;
  const bit = 1 << q;
  let p0 = 0;
  let p1 = 0;
  let offRe = 0;
  let offIm = 0;
  for (let i = 0; i < dim; i += 1) {
    if (i & bit) continue;
    const j = i | bit;
    p0 += re[i] * re[i] + im[i] * im[i];
    p1 += re[j] * re[j] + im[j] * im[j];
    // rho01 = sum a_i * conj(a_j)
    offRe += re[i] * re[j] + im[i] * im[j];
    offIm += im[i] * re[j] - re[i] * im[j];
  }
  return { x: 2 * offRe, y: -2 * offIm, z: p0 - p1 };
}

export interface Step {
  /** The time step this frame is the result of. -1 is the register before anything ran. */
  column: number;
  /** Human index: 0 is "before", 1 is "after the first step". */
  index: number;
  /** The gates that fired on this step. Empty on the opening frame. */
  applied: Placement[];
  result: SimulationResult;
}

/**
 * The circuit, one time step at a time.
 *
 * A learner watching only the final histogram sees the answer and none of the
 * reasoning. Stepping is where a circuit stops being a spell: you place a
 * Hadamard and watch the Bloch vector swing to the equator, then place the CNOT
 * and watch both vectors collapse to the origin as the pair entangles. The
 * final state never showed you that the second gate was the one that did it.
 *
 * Stepping is by column rather than by individual gate, because a column *is*
 * one time step — two gates on different wires in the same column genuinely
 * happen together, and pretending otherwise would teach a sequencing that the
 * hardware does not have.
 *
 * Each frame is a full re-simulation of the prefix. That is more arithmetic
 * than threading one amplitude array through the loop, and at four qubits and
 * ten columns it is a few thousand floating-point operations — far cheaper than
 * the bug where a shared buffer gets mutated by the frame after it.
 */
export function simulateSteps(placements: Placement[], qubits: number): Step[] {
  const columns = [...new Set(placements.map((p) => p.column))].sort((a, b) => a - b);

  const frames: Step[] = [
    { column: -1, index: 0, applied: [], result: simulate([], qubits) },
  ];

  columns.forEach((column, index) => {
    frames.push({
      column,
      index: index + 1,
      applied: placements.filter((p) => p.column === column),
      result: simulate(
        placements.filter((p) => p.column <= column),
        qubits,
      ),
    });
  });

  return frames;
}

/**
 * Measure one qubit in the computational basis, and keep the state that leaves.
 *
 * Projection, not decoration: the amplitudes where the measured qubit disagrees
 * with the outcome are set to zero and the rest renormalised. Everything else —
 * probabilities, both Bloch vectors, the entanglement — is then recomputed from
 * that state, so measuring one half of a Bell pair really does determine the
 * other half and really does destroy the entanglement.
 *
 * The alternative, which this replaces, was to sample an outcome and print it
 * while leaving the state alone. That reads as "measurement is a dice roll you
 * may repeat", which is the exact opposite of the lesson, and it showed: you
 * could measure the same Bell pair four times and get |1>, |0>, |0>, |0> with
 * the vector never moving.
 *
 * `depth` and `gateCount` are carried through unchanged — a measurement is not
 * a gate, and the circuit that produced the state is still the circuit it was.
 */
export function collapse(
  result: SimulationResult,
  qubits: number,
  wire: number,
  outcome: 0 | 1,
): SimulationResult {
  const dim = 1 << qubits;
  if (wire < 0 || wire >= qubits || result.amplitudes.length !== dim) return result;

  const re = new Float64Array(dim);
  const im = new Float64Array(dim);

  let norm = 0;
  for (let i = 0; i < dim; i += 1) {
    if (((i >> wire) & 1) !== outcome) continue;
    const a = result.amplitudes[i];
    re[i] = a.re;
    im[i] = a.im;
    norm += a.re * a.re + a.im * a.im;
  }

  // An outcome with no amplitude behind it cannot happen, so nothing collapses.
  if (norm < 1e-12) return result;

  const scale = 1 / Math.sqrt(norm);
  for (let i = 0; i < dim; i += 1) {
    re[i] *= scale;
    im[i] *= scale;
  }

  const probabilities: number[] = [];
  const amplitudes: { re: number; im: number }[] = [];
  for (let i = 0; i < dim; i += 1) {
    probabilities.push(re[i] * re[i] + im[i] * im[i]);
    amplitudes.push({ re: re[i], im: im[i] });
  }

  const bloch: BlochVector[] = [];
  for (let q = 0; q < qubits; q += 1) bloch.push(blochOf(re, im, qubits, q));

  return {
    probabilities,
    labels: result.labels,
    bloch,
    amplitudes,
    depth: result.depth,
    gateCount: result.gateCount,
  };
}

export function simulate(placements: Placement[], qubits: number): SimulationResult {
  const dim = 1 << qubits;
  const re = new Float64Array(dim);
  const im = new Float64Array(dim);
  re[0] = 1;

  const ordered = [...placements].sort((a, b) => a.column - b.column);
  const level = new Array<number>(qubits).fill(0);

  for (const p of ordered) {
    // Depth, counted the way Qiskit counts it: a gate sits one step after the
    // busiest wire it touches, so a CNOT chains its two wires into one path and
    // a measurement still costs a step.
    const touched = p.wires.filter((w) => w >= 0 && w < qubits);
    if (!touched.length) continue;
    const step = Math.max(...touched.map((w) => level[w])) + 1;
    for (const w of touched) level[w] = step;

    if (p.gate === "m") continue; // Measurement does not change basis probabilities.
    if (p.gate === "cnot") {
      const [c, t] = p.wires;
      applyCnot(re, im, qubits, c, t);
    } else {
      const m = UNITARY[p.gate];
      if (m) applyOne(re, im, qubits, p.wires[0], m);
    }
  }

  const probabilities: number[] = [];
  const labels: string[] = [];
  const amplitudes: { re: number; im: number }[] = [];
  for (let i = 0; i < dim; i += 1) {
    probabilities.push(re[i] * re[i] + im[i] * im[i]);
    labels.push(i.toString(2).padStart(qubits, "0"));
    amplitudes.push({ re: re[i], im: im[i] });
  }

  const bloch: BlochVector[] = [];
  for (let q = 0; q < qubits; q += 1) bloch.push(blochOf(re, im, qubits, q));

  return {
    probabilities,
    labels,
    bloch,
    amplitudes,
    depth: Math.max(0, ...level),
    gateCount: placements.length,
  };
}

/** Sample `shots` measurements from a distribution, so shot noise looks real. */
export function sampleShots(probabilities: number[], shots: number, seed = 1): number[] {
  // A deterministic LCG keeps the histogram stable across re-renders until the
  // learner presses run again.
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const counts = new Array(probabilities.length).fill(0);
  for (let s = 0; s < shots; s += 1) {
    const r = random();
    let acc = 0;
    for (let i = 0; i < probabilities.length; i += 1) {
      acc += probabilities[i];
      if (r <= acc) {
        counts[i] += 1;
        break;
      }
    }
  }
  return counts;
}

const QISKIT_METHOD: Record<string, string> = {
  h: "h",
  x: "x",
  y: "y",
  z: "z",
  s: "s",
  t: "t",
};

/** Emit the Qiskit that builds this circuit — the code pane is generated, not typed. */
export function toQiskit(placements: Placement[], qubits: number): string {
  const ordered = [...placements].sort(
    (a, b) => a.column - b.column || a.wires[0] - b.wires[0],
  );
  const measured = new Set<number>();
  const lines: string[] = [];

  for (const p of ordered) {
    if (p.gate === "m") {
      measured.add(p.wires[0]);
      continue;
    }
    if (p.gate === "cnot") {
      lines.push(`qc.cx(${p.wires[0]}, ${p.wires[1]})`);
    } else {
      const method = QISKIT_METHOD[p.gate];
      if (method) lines.push(`qc.${method}(${p.wires[0]})`);
    }
  }

  const measureLine = measured.size
    ? `\nqc.measure(${JSON.stringify([...measured].sort())}, ${JSON.stringify(
        [...measured].sort(),
      )})`
    : "";

  const body = lines.length
    ? lines.join("\n")
    : "# Drop a gate onto a wire and this pane rewrites itself.";

  return `from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

# Generated from the circuit on the left. Edit either side —
# they describe the same ${qubits}-qubit register.
qc = QuantumCircuit(${qubits}, ${qubits})

${body}${measureLine}

state = Statevector.from_instruction(qc.remove_final_measurements(False))
print(state.probabilities_dict())
`;
}

/* ------------------------------------------------------------------ */
/* Code → circuit                                                      */
/* ------------------------------------------------------------------ */

const ONE_QUBIT = /^\s*qc\.(h|x|y|z|s|t)\s*\(\s*(\d+)\s*\)/;
const CNOT = /^\s*qc\.(?:cx|cnot)\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/;
const MEASURE_ALL = /^\s*qc\.measure_all\s*\(/;
const MEASURE_LIST = /^\s*qc\.measure\s*\(\s*\[([\d,\s]*)\]/;
const MEASURE_ONE = /^\s*qc\.measure\s*\(\s*(\d+)\s*,/;

/**
 * Assign each operation the earliest column its wires are free in.
 *
 * Two gates on disjoint wires share a column, which is how a circuit diagram is
 * normally drawn and also what makes `depth` mean something.
 */
export function pack(
  ops: { gate: string; wires: number[] }[],
  qubits: number,
): Placement[] {
  const nextFree = new Array<number>(qubits).fill(0);
  return ops.map((op, i) => {
    // A two-qubit gate occupies every wire it crosses, not just its endpoints.
    const low = Math.min(...op.wires);
    const high = Math.max(...op.wires);
    let column = 0;
    for (let w = low; w <= high; w += 1) column = Math.max(column, nextFree[w]);
    for (let w = low; w <= high; w += 1) nextFree[w] = column + 1;
    return { id: `p${i}-${op.gate}-${op.wires.join("_")}`, gate: op.gate, column, wires: op.wires };
  });
}

/** One operation read out of Qiskit source, with the line it came from. */
export interface ParsedOp {
  gate: string;
  wires: number[];
  /** 1-based, as an editor numbers it. */
  line: number;
}

/**
 * Read the subset of Qiskit the sandbox emits, remembering where each gate was.
 *
 * Split out of `fromQiskit` so that anything which needs to point at the code
 * — a fault found on the board that came from a typed line, say — is reading
 * the same parse the diagram was built from rather than a second opinion about
 * it. Two parsers of the same text are two chances to disagree.
 *
 * Unknown lines are skipped here exactly as they always were. Saying so is the
 * job of `code-check`, which reports every line this function quietly drops.
 */
export function parseQiskitOps(code: string, qubits: number): ParsedOp[] {
  const ops: ParsedOp[] = [];
  const valid = (q: number) => q >= 0 && q < qubits;

  code.split("\n").forEach((raw, index) => {
    const lineNo = index + 1;
    const line = raw.split("#")[0];
    if (!line.trim()) return;

    const one = ONE_QUBIT.exec(line);
    if (one) {
      const q = Number(one[2]);
      if (valid(q)) ops.push({ gate: one[1], wires: [q], line: lineNo });
      return;
    }

    const cx = CNOT.exec(line);
    if (cx) {
      const c = Number(cx[1]);
      const t = Number(cx[2]);
      if (valid(c) && valid(t) && c !== t) ops.push({ gate: "cnot", wires: [c, t], line: lineNo });
      return;
    }

    if (MEASURE_ALL.test(line)) {
      for (let q = 0; q < qubits; q += 1) ops.push({ gate: "m", wires: [q], line: lineNo });
      return;
    }

    const list = MEASURE_LIST.exec(line);
    if (list) {
      for (const part of list[1].split(",")) {
        const q = Number(part.trim());
        if (part.trim() && valid(q)) ops.push({ gate: "m", wires: [q], line: lineNo });
      }
      return;
    }

    const single = MEASURE_ONE.exec(line);
    if (single) {
      const q = Number(single[1]);
      if (valid(q)) ops.push({ gate: "m", wires: [q], line: lineNo });
    }
  });

  return ops;
}

/** Parse the subset of Qiskit the sandbox emits. Unknown lines are ignored. */
export function fromQiskit(code: string, qubits: number): Placement[] {
  return pack(
    parseQiskitOps(code, qubits).map(({ gate, wires }) => ({ gate, wires })),
    qubits,
  );
}
