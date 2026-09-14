import type { GradeCheck, GradeResponse } from "@/lib/api";
import {
  challengePlacements,
  type Challenge,
  type GradeMode,
} from "@/lib/challenges";
import { simulate, type Placement } from "@/lib/quantum";

/**
 * The grader, run in the browser.
 *
 * A line-for-line mirror of `backend/app/services/grader.py`: the same two
 * modes, the same exact tolerance, the same register widening, the same
 * measurement rule and the same hints, worded identically. The server is still
 * what marks a lab and records it. This exists for the two things that cannot
 * wait for a request:
 *
 * - the cat, which reads the board after every edit and needs to know whether
 *   the circuit in front of it is right *for this lab* — the general circuit
 *   checks cannot know that, and on an algorithm lab they called a correct
 *   Grover oracle a CNOT that "never fires";
 * - a check with no API running, which used to be a disabled button.
 *
 * Mirrored rather than shared because the grader is Python and this page is
 * not, so the two have to be changed together: a verdict or a hint that
 * differed between them would have the cat and the marker disagreeing about
 * the same board.
 */

/** Rounding, not leniency: every gate the course uses is exact. */
export const TOLERANCE = 1e-6;
const PASS_MARK = 1 - TOLERANCE;

interface Complex {
  re: number;
  im: number;
}

const mul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
const conj = (a: Complex): Complex => ({ re: a.re, im: -a.im });
const abs = (a: Complex) => Math.hypot(a.re, a.im);
const div = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im;
  return {
    re: (a.re * b.re + a.im * b.im) / d,
    im: (a.im * b.re - a.re * b.im) / d,
  };
};
const scale = (a: Complex, k: number): Complex => ({
  re: a.re * k,
  im: a.im * k,
});

/** ⟨a|b⟩ */
function inner(a: Complex[], b: Complex[]): Complex {
  let re = 0;
  let im = 0;
  for (let i = 0; i < a.length; i += 1) {
    const term = mul(conj(a[i]), b[i]);
    re += term.re;
    im += term.im;
  }
  return { re, im };
}

const round9 = (value: number) => Math.round(value * 1e9) / 1e9;

/* ------------------------------------------------------------------ */
/* reading circuits                                                     */
/* ------------------------------------------------------------------ */

function stateOf(placements: Placement[], qubits: number): Complex[] {
  return simulate(placements, qubits).amplitudes;
}

/** U|x⟩: the circuit run from one basis input, prepared with X gates before it. */
function columnOf(
  placements: Placement[],
  qubits: number,
  input: number,
): Complex[] {
  const prepare: Placement[] = [];
  for (let wire = 0; wire < qubits; wire += 1) {
    if ((input >> wire) & 1) {
      prepare.push({
        id: `prep-${wire}`,
        gate: "x",
        column: -1,
        wires: [wire],
      });
    }
  }
  return stateOf([...prepare, ...placements], qubits);
}

function earlyMeasurement(
  placements: Placement[],
): { wire: number; step: number; gate: Placement } | null {
  let worst: { wire: number; step: number; gate: Placement } | null = null;
  /* In the order the IR sends them, so a tie is broken the way the server
     breaks it. */
  const ordered = [...placements].sort(
    (a, b) =>
      a.column - b.column || Math.min(...a.wires) - Math.min(...b.wires),
  );
  const gates = ordered.filter((p) => p.gate !== "m");
  for (const measure of ordered) {
    if (measure.gate !== "m") continue;
    for (const wire of measure.wires) {
      const later = gates.find(
        (g) => g.wires.includes(wire) && g.column > measure.column,
      );
      if (later && (!worst || later.column < worst.gate.column)) {
        worst = { wire, step: measure.column, gate: later };
      }
    }
  }
  return worst;
}

/* ------------------------------------------------------------------ */
/* words for numbers                                                    */
/* ------------------------------------------------------------------ */

const label = (index: number, qubits: number) =>
  index.toString(2).padStart(qubits, "0");

/** Rounded half up, as the server rounds — see `_fixed` in the grader. */
function fixed(value: number, digits: number) {
  const settled = round9(value);
  const factor = 10 ** digits;
  return (Math.floor(settled * factor + 0.5) / factor).toFixed(digits);
}

function number(value: number) {
  return fixed(Math.abs(value), 2).replace(/0+$/, "").replace(/\.$/, "") || "0";
}

/** A unit phase as a reader would write it: +1, −1, +i, −i, or e^(iπ/4). */
function phaseText(factor: Complex) {
  const angle = Math.atan2(factor.im, factor.re);
  const quarters = angle / (Math.PI / 4);
  const nearest = Math.round(quarters);
  if (Math.abs(quarters - nearest) < 1e-4) {
    const eighth = ((nearest % 8) + 8) % 8;
    const named: Record<number, string> = {
      0: "+1",
      2: "+i",
      4: "−1",
      6: "−i",
    };
    if (named[eighth]) return named[eighth];
    const numerator: Record<number, string> = {
      1: "π/4",
      3: "3π/4",
      5: "5π/4",
      7: "7π/4",
    };
    return `e^(i${numerator[eighth]})`;
  }
  return `e^(i${fixed(angle, 2)})`;
}

function ket(vector: Complex[], qubits: number, limit = 4) {
  const support = vector
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => abs(value) > TOLERANCE)
    .map(({ index }) => index);
  if (!support.length) return "nothing";
  if (support.length === 1) return `|${label(support[0], qubits)}⟩`;

  const anchor = vector[support[0]];
  const unwind = scale(conj(anchor), 1 / abs(anchor));

  const parts: string[] = [];
  for (const index of support.slice(0, limit)) {
    const value = mul(vector[index], unwind);
    const magnitude = number(abs(value));
    const phase = phaseText(scale(value, 1 / abs(value)));
    const basis = `|${label(index, qubits)}⟩`;
    let sign: string;
    let body: string;
    if (phase === "+1" || phase === "−1") {
      sign = phase[0];
      body = `${magnitude}${basis}`;
    } else if (phase === "+i" || phase === "−i") {
      sign = phase[0];
      body = `${magnitude}i${basis}`;
    } else {
      sign = "+";
      body = `${magnitude}·${phase}${basis}`;
    }
    if (!parts.length) parts.push(sign === "+" ? body : `−${body}`);
    else parts.push(`${sign} ${body}`);
  }
  if (support.length > limit) parts.push("+ …");
  return parts.join(" ");
}

function chance(probability: number) {
  if (probability < TOLERANCE) return "never";
  if (probability > 1 - TOLERANCE) return "every time";
  return `${fixed(probability * 100, 0)}% of the time`;
}

function wireList(indexes: number[]) {
  const names = indexes.map((index) => `q${index}`);
  return names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The lowest index within rounding of the peak — a stable argmax. */
function firstNear(values: number[], peak: number) {
  return values.findIndex((value) => value >= peak - TOLERANCE);
}

function marginalOne(probabilities: number[], wire: number) {
  let total = 0;
  probabilities.forEach((value, index) => {
    if ((index >> wire) & 1) total += value;
  });
  return total;
}

/** Each qubit's purity alone: 1 for a state of its own, ½ for maximally mixed. */
function purities(vector: Complex[], qubits: number) {
  const values: number[] = [];
  for (let wire = 0; wire < qubits; wire += 1) {
    const bit = 1 << wire;
    let a = 0;
    let d = 0;
    let off: Complex = { re: 0, im: 0 };
    for (let i = 0; i < vector.length; i += 1) {
      if (i & bit) {
        d += abs(vector[i]) ** 2;
      } else {
        a += abs(vector[i]) ** 2;
        const term = mul(vector[i], conj(vector[i | bit]));
        off = { re: off.re + term.re, im: off.im + term.im };
      }
    }
    values.push(a * a + d * d + 2 * abs(off) ** 2);
  }
  return values;
}

/* ------------------------------------------------------------------ */
/* the checks                                                           */
/* ------------------------------------------------------------------ */

function stateCheck(
  fidelity: number,
  qubits: number,
  required: boolean,
): GradeCheck {
  const passed = fidelity >= PASS_MARK;
  const zeros = "0".repeat(qubits);
  return {
    check: "state_fidelity",
    label: required ? "Final state" : `From |${zeros}⟩`,
    required,
    passed,
    score: round9(fidelity),
    threshold: PASS_MARK,
    detail: required
      ? passed
        ? "your circuit reaches exactly the target state, up to a global phase"
        : `your final state overlaps the target with fidelity ${fixed(fidelity, 4)}; a right answer overlaps it completely`
      : passed
        ? `run from |${zeros}⟩ it ends in the same state as the reference`
        : `run from |${zeros}⟩ it ends somewhere else (fidelity ${fixed(fidelity, 4)})`,
  };
}

function operationCheck(score: number, qubits: number): GradeCheck {
  const passed = score >= PASS_MARK;
  const inputs = 1 << qubits;
  return {
    check: "unitary_equivalence",
    label: `All ${inputs} inputs`,
    required: true,
    passed,
    score: round9(score),
    threshold: PASS_MARK,
    detail: passed
      ? `it does what the reference does to every one of the ${inputs} inputs, up to a global phase`
      : `on at least one input it does something different (process fidelity ${fixed(score, 4)})`,
  };
}

function measurementCheck(
  early: { wire: number; step: number; gate: Placement } | null,
): GradeCheck {
  return early
    ? {
        check: "measurement_order",
        label: "Measurements",
        required: true,
        passed: false,
        score: 0,
        threshold: 1,
        detail: `q${early.wire} is measured at step ${early.step + 1} and still used at step ${early.gate.column + 1}`,
      }
    : {
        check: "measurement_order",
        label: "Measurements",
        required: true,
        passed: true,
        score: 1,
        threshold: 1,
        detail: "nothing acts on a qubit after it has been measured",
      };
}

/* ------------------------------------------------------------------ */
/* the hints                                                            */
/* ------------------------------------------------------------------ */

function stateHint(target: Complex[], produced: Complex[], qubits: number) {
  const expected = target.map((a) => abs(a) ** 2);
  const actual = produced.map((a) => abs(a) ** 2);

  const wanted = purities(target, qubits)
    .map((value, q) => (value < PASS_MARK ? q : -1))
    .filter((q) => q >= 0);
  const made = purities(produced, qubits)
    .map((value, q) => (value < PASS_MARK ? q : -1))
    .filter((q) => q >= 0);
  if (wanted.length && !made.length) {
    return `The target is entangled — ${wireList(wanted)} have no state of their own — but every qubit in yours still does. It takes a two-qubit gate.`;
  }
  if (made.length && !wanted.length) {
    return `Your circuit entangles ${wireList(made)}, and the target leaves every qubit with a state of its own.`;
  }

  for (let wire = 0; wire < qubits; wire += 1) {
    const should = marginalOne(expected, wire);
    const does = marginalOne(actual, wire);
    if (Math.abs(should - does) > TOLERANCE) {
      return `q${wire} should read 1 ${chance(should)}, but yours reads 1 ${chance(does)}.`;
    }
  }

  /* Ties go to the lowest basis state, not to whichever one rounding favoured. */
  const gaps = expected.map((value, i) => Math.abs(value - actual[i]));
  const widest = Math.max(...gaps);
  const worst = firstNear(gaps, widest);
  if (widest > TOLERANCE) {
    return `Each qubit on its own reads right, but not the way they go together: the target gives |${label(worst, qubits)}⟩ ${chance(expected[worst])} and yours gives it ${chance(actual[worst])}.`;
  }

  const anchor = firstNear(expected, Math.max(...expected));
  for (let index = 0; index < target.length; index += 1) {
    if (index === anchor || expected[index] < TOLERANCE) continue;
    const should = div(target[index], target[anchor]);
    const does = div(produced[index], produced[anchor]);
    if (abs({ re: should.re - does.re, im: should.im - does.im }) > TOLERANCE) {
      return `Every outcome already has the right probability, so what is wrong is a phase the histogram cannot show: relative to |${label(anchor, qubits)}⟩, the |${label(index, qubits)}⟩ amplitude should carry ${phaseText(scale(should, 1 / abs(should)))} and yours carries ${phaseText(scale(does, 1 / abs(does)))}. Compare them in the state read-out.`;
    }
  }
  return "The two states differ by less than the read-out can show. Compare them term by term.";
}

function operationHint(
  target: Complex[][],
  produced: Complex[][],
  qubits: number,
): string | null {
  const inputs = target.length;
  const failing: number[] = [];
  for (let index = 0; index < inputs; index += 1) {
    if (abs(inner(target[index], produced[index])) ** 2 < PASS_MARK)
      failing.push(index);
  }

  if (failing.length) {
    const first = failing[0];
    const example = `Run from |${label(first, qubits)}⟩, the reference ends in ${ket(target[first], qubits)} and yours ends in ${ket(produced[first], qubits)}.`;
    const passing = Array.from({ length: inputs }, (_, i) => i).filter(
      (i) => !failing.includes(i),
    );
    if (passing.length) {
      for (let wire = 0; wire < qubits; wire += 1) {
        if (
          failing.every((i) => (i >> wire) & 1) &&
          !passing.some((i) => (i >> wire) & 1)
        ) {
          return `It matches the reference whenever q${wire} starts in |0⟩ and never when q${wire} starts in |1⟩, so q${wire} is being treated as if it could only ever be |0⟩. ${example}`;
        }
      }
    }
    return example;
  }

  const base = inner(target[0], produced[0]);
  for (let index = 1; index < inputs; index += 1) {
    const here = inner(target[index], produced[index]);
    if (abs({ re: here.re - base.re, im: here.im - base.im }) > TOLERANCE) {
      return `Every input ends in the right state, but not with the right phase between them: compared with |${label(0, qubits)}⟩, yours gives |${label(index, qubits)}⟩ an extra factor of ${phaseText(div(here, base))}. No single run can show that, and it is exactly what the algorithm uses.`;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* the grade                                                            */
/* ------------------------------------------------------------------ */

/** Mark a board against a lab, exactly as the server would. */
export function gradeLocally(
  challenge: Challenge,
  placements: Placement[],
  qubits: number,
): GradeResponse {
  return gradeAgainst(
    challengePlacements(challenge),
    challenge.qubits,
    placements,
    qubits,
    challenge.mode,
  );
}

export function gradeAgainst(
  reference: Placement[],
  referenceQubits: number,
  placements: Placement[],
  submissionQubits: number,
  mode: GradeMode,
): GradeResponse {
  const qubits = Math.max(referenceQubits, submissionQubits);
  const gates = placements.filter((p) => p.gate !== "m");

  const expectedState = stateOf(reference, qubits);
  const producedState = stateOf(gates, qubits);
  const fidelity = abs(inner(expectedState, producedState)) ** 2;

  const checks: GradeCheck[] = [];
  let expectedColumns: Complex[][] | null = null;
  let producedColumns: Complex[][] | null = null;

  if (mode === "state") {
    checks.push(stateCheck(fidelity, qubits, true));
  } else {
    checks.push(stateCheck(fidelity, qubits, false));
    const dimension = 1 << qubits;
    expectedColumns = [];
    producedColumns = [];
    let trace: Complex = { re: 0, im: 0 };
    for (let input = 0; input < dimension; input += 1) {
      const t = columnOf(reference, qubits, input);
      const s = columnOf(gates, qubits, input);
      expectedColumns.push(t);
      producedColumns.push(s);
      const term = inner(t, s);
      trace = { re: trace.re + term.re, im: trace.im + term.im };
    }
    const score = Math.min(1, abs(trace) ** 2 / (dimension * dimension));
    checks.push(operationCheck(score, qubits));
  }

  const early = earlyMeasurement(placements);
  if (placements.some((p) => p.gate === "m"))
    checks.push(measurementCheck(early));

  const passed = checks.every((check) => !check.required || check.passed);

  let hint: string | null = null;
  if (!passed) {
    if (early) {
      const name =
        early.gate.gate === "cnot" ? "CX" : early.gate.gate.toUpperCase();
      hint = `q${early.wire} is measured at step ${early.step + 1}, and the ${name} at step ${early.gate.column + 1} still acts on it. A measurement collapses the qubit to a definite bit, so nothing after it is building the state the lab asks for — move the measurement to the end.`;
    } else {
      if (mode === "state") {
        hint = stateHint(expectedState, producedState, qubits);
      } else if (expectedColumns && producedColumns) {
        hint = operationHint(expectedColumns, producedColumns, qubits);
      }
      if (submissionQubits < referenceQubits) {
        const register = `The lab needs a ${referenceQubits}-qubit register and yours has ${submissionQubits}.`;
        hint = hint ? `${register} ${hint}` : register;
      }
    }
  }

  return { passed, checks, hint, mode, recorded: false, earned_badges: [] };
}
