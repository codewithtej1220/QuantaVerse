import type { BlochVector, SimulationResult } from "@/lib/quantum";

/**
 * Reading a stage's picture off the statevector.
 *
 * The stage visuals draw amplitudes, reflections and Bell states, and every
 * number they draw comes from here — from the same simulation frames the board
 * and the state panel read. Nothing is tweened towards a value this file did not
 * compute.
 */

export interface Complex {
  re: number;
  im: number;
}

const EPS = 1e-9;

const abs = (a: Complex) => Math.hypot(a.re, a.im);
const conjMul = (a: Complex, b: Complex): Complex => ({
  /* conj(a) · b */
  re: a.re * b.re + a.im * b.im,
  im: a.re * b.im - a.im * b.re,
});

export interface RegisterView {
  /** Basis labels for the shown wires, q(k−1)…q0, in index order. */
  labels: string[];
  /**
   * Amplitudes over the shown wires, with the other wires factored out and the
   * global phase turned so the first of the largest amplitudes is positive.
   * Only meaningful when `separable`.
   */
  amplitudes: Complex[];
  /** Marginal probabilities over the shown wires — always meaningful. */
  probabilities: number[];
  /**
   * Whether the other wires are unentangled with the shown ones. When they
   * are, the shown wires have amplitudes of their own; when they are not, only
   * probabilities do, and a visual must not draw signs it cannot know.
   */
  separable: boolean;
  /** Whether every amplitude is real, so it can be drawn as a signed bar. */
  real: boolean;
}

/**
 * Turn a vector so the first of its largest entries is positive real.
 *
 * A global phase is unobservable, and the simulator's is arbitrary: Grover's
 * diffuser, as built, ends on −|11⟩. Drawn as it stands, the marked item would
 * finish on a bar pointing down at −1 — true, meaningless, and the opposite of
 * what the reflection about the mean shows. Anchoring on the largest amplitude
 * keeps the signs that matter (relative ones) and drops the one that does not.
 */
export function withoutGlobalPhase(vector: Complex[]): Complex[] {
  let peak = 0;
  for (const value of vector) peak = Math.max(peak, abs(value));
  if (peak < EPS) return vector;
  const anchor = vector.find((value) => abs(value) >= peak - 1e-6)!;
  const turn = { re: anchor.re / abs(anchor), im: -anchor.im / abs(anchor) };
  return vector.map((value) => ({
    re: value.re * turn.re - value.im * turn.im,
    im: value.re * turn.im + value.im * turn.re,
  }));
}

/** The dominant eigenvector of a small Hermitian matrix, by power iteration. */
function principal(matrix: Complex[][]): Complex[] {
  const size = matrix.length;
  let start = 0;
  for (let i = 1; i < size; i += 1) {
    if (matrix[i][i].re > matrix[start][start].re) start = i;
  }
  let vector: Complex[] = matrix.map((row) => ({ ...row[start] }));
  for (let round = 0; round < 60; round += 1) {
    const next: Complex[] = Array.from({ length: size }, () => ({
      re: 0,
      im: 0,
    }));
    for (let i = 0; i < size; i += 1) {
      for (let j = 0; j < size; j += 1) {
        const m = matrix[i][j];
        const v = vector[j];
        next[i].re += m.re * v.re - m.im * v.im;
        next[i].im += m.re * v.im + m.im * v.re;
      }
    }
    const norm = Math.sqrt(next.reduce((sum, v) => sum + v.re * v.re + v.im * v.im, 0));
    if (norm < EPS) break;
    vector = next.map((v) => ({ re: v.re / norm, im: v.im / norm }));
  }
  return vector;
}

/**
 * The state of some wires of a register.
 *
 * For the wires left out, the reduced state is computed; if it is pure, those
 * wires are in a state of their own and can be factored out exactly, leaving
 * amplitudes for the shown wires. That is what lets Bernstein–Vazirani be drawn
 * as four bars for its input register while the answer wire sits in |−⟩ beside
 * it — the input register genuinely has those amplitudes, sign and all.
 */
export function registerView(
  result: SimulationResult,
  qubits: number,
  register: number[],
): RegisterView {
  const rest = Array.from({ length: qubits }, (_, wire) => wire).filter(
    (wire) => !register.includes(wire),
  );
  const shownSize = 1 << register.length;
  const restSize = 1 << rest.length;

  /* Ψ[x][r]: the amplitude with the shown wires reading x and the rest r. */
  const grid: Complex[][] = Array.from({ length: shownSize }, () =>
    Array.from({ length: restSize }, () => ({ re: 0, im: 0 })),
  );
  result.amplitudes.forEach((amplitude, index) => {
    let x = 0;
    register.forEach((wire, bit) => {
      if ((index >> wire) & 1) x |= 1 << bit;
    });
    let r = 0;
    rest.forEach((wire, bit) => {
      if ((index >> wire) & 1) r |= 1 << bit;
    });
    grid[x][r] = { re: amplitude.re, im: amplitude.im };
  });

  const probabilities = grid.map((row) =>
    row.reduce((sum, value) => sum + value.re * value.re + value.im * value.im, 0),
  );

  /* ρ_rest[r][r'] = Σ_x Ψ[x][r] · conj(Ψ[x][r']) */
  const reduced: Complex[][] = Array.from({ length: restSize }, (_, r) =>
    Array.from({ length: restSize }, (_, s) => {
      let re = 0;
      let im = 0;
      for (let x = 0; x < shownSize; x += 1) {
        const term = conjMul(grid[x][s], grid[x][r]);
        re += term.re;
        im += term.im;
      }
      return { re, im };
    }),
  );
  let purity = 0;
  for (const row of reduced) {
    for (const value of row) purity += value.re * value.re + value.im * value.im;
  }
  const separable = rest.length === 0 || purity > 1 - 1e-6;

  let amplitudes: Complex[];
  if (rest.length === 0) {
    amplitudes = grid.map((row) => row[0]);
  } else if (separable) {
    const other = principal(reduced);
    amplitudes = grid.map((row) => {
      let re = 0;
      let im = 0;
      row.forEach((value, r) => {
        const term = conjMul(other[r], value);
        re += term.re;
        im += term.im;
      });
      return { re, im };
    });
  } else {
    amplitudes = probabilities.map((p) => ({ re: Math.sqrt(p), im: 0 }));
  }
  amplitudes = withoutGlobalPhase(amplitudes);

  const labels = Array.from({ length: shownSize }, (_, x) =>
    x.toString(2).padStart(register.length, "0"),
  );

  return {
    labels,
    amplitudes,
    probabilities,
    separable,
    real: amplitudes.every((value) => Math.abs(value.im) < 1e-6),
  };
}

/**
 * Each output of a Hadamard layer as its signed contributions from the inputs.
 *
 * H⊗ᵏ sends amplitude a_x to every output y with weight (−1)^(x·y)/√2ᵏ. The
 * interference picture draws those terms and their sum; the sum is the next
 * frame's amplitude, which is checked against it rather than assumed.
 */
export function hadamardContributions(amplitudes: Complex[]): number[][] {
  const size = amplitudes.length;
  const scale = 1 / Math.sqrt(size);
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      let parity = 0;
      for (let bits = x & y; bits; bits >>= 1) parity ^= bits & 1;
      return (parity ? -1 : 1) * amplitudes[x].re * scale;
    }),
  );
}

/** The mean of some real amplitudes, and each one reflected about it. */
export function reflectAboutMean(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { mean, reflected: values.map((value) => 2 * mean - value) };
}

export const BELL_STATES = [
  { name: "Φ+", ket: "(|00⟩ + |11⟩)/√2", vector: [1, 0, 0, 1] },
  { name: "Φ−", ket: "(|00⟩ − |11⟩)/√2", vector: [1, 0, 0, -1] },
  { name: "Ψ+", ket: "(|01⟩ + |10⟩)/√2", vector: [0, 1, 1, 0] },
  { name: "Ψ−", ket: "(|01⟩ − |10⟩)/√2", vector: [0, 1, -1, 0] },
] as const;

/** Which Bell state two qubits are in, if any — by overlap, so a global phase does not matter. */
export function whichBell(amplitudes: Complex[]): number | null {
  if (amplitudes.length !== 4) return null;
  for (let index = 0; index < BELL_STATES.length; index += 1) {
    const vector = BELL_STATES[index].vector;
    let re = 0;
    let im = 0;
    vector.forEach((weight, i) => {
      re += (weight / Math.SQRT2) * amplitudes[i].re;
      im += (weight / Math.SQRT2) * amplitudes[i].im;
    });
    if (re * re + im * im > 1 - 1e-6) return index;
  }
  return null;
}

/** How closely a Bloch vector matches a pure reference: (1 + r·s)/2 for unit s. */
export function blochFidelity(vector: BlochVector, reference: BlochVector) {
  return (1 + vector.x * reference.x + vector.y * reference.y + vector.z * reference.z) / 2;
}
