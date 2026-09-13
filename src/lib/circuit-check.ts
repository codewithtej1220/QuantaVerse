import { GATE_BY_ID } from "@/lib/data";
import { simulate, type Placement } from "@/lib/quantum";

/**
 * Faults in a circuit, found by running it rather than by recognising it.
 *
 * The obvious way to build this is to send the board to the tutor and ask what
 * is wrong. That is the wrong tool for the detecting half, for three reasons
 * that all matter: a model takes a second or two and this has to run on every
 * gate placed, it costs a request per keystroke-equivalent, and it is
 * occasionally confidently wrong — and a mascot that cries wolf about a correct
 * circuit is worse than a mascot that says nothing at all.
 *
 * The first version matched patterns instead: two Hadamards in a row, a CNOT
 * with nothing before it. That is fast and it is shallow, and it was wrong in
 * both directions. It called a CNOT live because *something* preceded it on the
 * control, when a Z before a CNOT leaves the control at |0⟩ and the gate still
 * never fires. It could not see a T on a fresh wire doing nothing at all. A
 * pattern is a guess about a circuit; the circuit itself is right there.
 *
 * So the gate-level checks run the simulator. For each gate, the state before
 * it and the state after it, compared by fidelity — one exactly when the two
 * are the same physical state. If the gate changed nothing, that is a fact
 * about this circuit and not an opinion about circuits in general, which is
 * what earns the right to interrupt somebody mid-build. The board caps at four
 * qubits, so this is a few thousand flops behind a 750ms debounce.
 *
 * Two things stay structural, because running the circuit cannot see them. A
 * self-inverse pair is invisible to a per-gate check — the first H does plenty
 * and so does the second, and only together are they nothing. And the simulator
 * deliberately does not collapse at a measurement, so a gate stranded after one
 * has to be found by reading the board.
 *
 * Findings are ordered worst-first and only the first is ever shown. A column
 * of complaints about a half-built circuit is noise; one specific sentence
 * about the thing most likely to be wrong is help. The tutor is still the right
 * tool for the other half — explaining *why*, at length, when the learner asks
 * — and the offer attached to each finding is what hands it over.
 */

export type IssueKind =
  | "after-measure"
  | "inert-control"
  | "cancels-out"
  | "dead-gate"
  | "no-op-circuit"
  | "idle-qubit";

export interface CircuitIssue {
  kind: IssueKind;
  /**
   * Whether this is something wrong or merely something worth knowing.
   *
   * The separation exists because the two earn very different rights. A fault
   * is a statement that the circuit does not do what it looks like it does, and
   * that is worth interrupting somebody for. Advice is a tidiness note, and a
   * tidiness note delivered before the learner has placed their first gate is
   * just a stranger telling them they are already doing it wrong.
   */
  severity: "fault" | "advice";
  /** Wire the fault sits on, for pointing at it. */
  wire: number;
  /** Column the fault sits on. With `wire`, a cell on the board. */
  column: number;
  /** What is wrong, in one sentence. */
  message: string;
  /** What to do about it. */
  fix: string;
}

type Amplitudes = { re: number; im: number }[];

/** The board offers 2, 3 or 4. The ceiling is here so a wider one degrades. */
const MAX_SIMULATED_QUBITS = 10;

/** Float64 slack. These circuits are a handful of gates deep. */
const EXACT = 1e-9;

/** Gates that undo themselves, so two in a row on one wire is nothing at all. */
const SELF_INVERSE = new Set(["h", "x", "y", "z"]);

/** Gates acting only on the |1⟩ half, so they pass a fresh |0⟩ straight through. */
const PHASE_ONLY = new Set(["z", "s", "t"]);

/**
 * |⟨a|b⟩|², which is 1 exactly when the two vectors are the same physical
 * state — *including* when they differ by a global phase. That distinction is
 * why this is not a component-wise comparison: Z on |1⟩ negates the amplitude,
 * and a negated amplitude is not something any measurement can see. Reporting
 * it as a change would be reporting a fault that does not exist.
 */
function fidelity(a: Amplitudes, b: Amplitudes) {
  let re = 0;
  let im = 0;
  for (let i = 0; i < a.length; i += 1) {
    re += a[i].re * b[i].re + a[i].im * b[i].im;
    im += a[i].re * b[i].im - a[i].im * b[i].re;
  }
  return re * re + im * im;
}

/** Probability of finding `wire` in |1⟩. Qubit q is bit q of the index. */
function probOne(state: Amplitudes, wire: number) {
  const bit = 1 << wire;
  let p = 0;
  for (let i = 0; i < state.length; i += 1) {
    if (i & bit) p += state[i].re * state[i].re + state[i].im * state[i].im;
  }
  return p;
}

function label(gate: string) {
  if (gate === "cnot") return "CNOT";
  return GATE_BY_ID[gate]?.symbol ?? gate.toUpperCase();
}

/* Gate names are read as letters, and the letter decides the article: "an H"
   because it is said "aitch", "a T" because it is said "tee". Spelling it out
   is the only way to get this right -- no rule about vowels reaches it. */
const TAKES_AN = new Set("AEFHILMNORSX");

function aGate(gate: string) {
  const name = label(gate);
  return `${TAKES_AN.has(name[0]) && name.length === 1 ? "an" : "a"} ${name}`;
}

/** Everything touching a wire, earliest first. */
function onWire(placements: Placement[], wire: number): Placement[] {
  return placements.filter((p) => p.wires.includes(wire)).sort((a, b) => a.column - b.column);
}

/* ------------------------------------------------------------------ */
/* what has to be read off the board rather than run                    */
/* ------------------------------------------------------------------ */

function structural(placements: Placement[], qubits: number): CircuitIssue[] {
  const found: CircuitIssue[] = [];

  for (let wire = 0; wire < qubits; wire += 1) {
    const touching = onWire(placements, wire);

    /* A gate after this wire has been measured. The measurement has collapsed
       it to a definite bit, so the gate is acting on a coin that has already
       landed — and the state read-out on this page does not collapse at a
       measurement, so the numbers beside it are not showing that either.
       Almost always a gate dropped in the wrong column. */
    const measured = touching.find((p) => p.gate === "m");
    if (measured) {
      const later = touching.find((p) => p.gate !== "m" && p.column > measured.column);
      if (later) {
        found.push({
          kind: "after-measure",
        severity: "fault",
          wire,
          column: later.column,
          message: `q${wire} is measured at step ${measured.column + 1}, and there is still ${aGate(later.gate)} on it at step ${later.column + 1}.`,
          fix: "Measuring collapses that wire to a definite bit, so the gate after it has no superposition left to act on. Move the measurement to the end of the wire, or the gate before it.",
        });
      }
    }

    /* A self-inverse pair. Invisible to the per-gate check below, because each
       of the two does plenty alone and only the pair is nothing. Nothing else
       touches the wire between them, and anything on another wire commutes
       with both, so the cancellation is exact rather than likely. */
    for (let i = 0; i < touching.length - 1; i += 1) {
      const a = touching[i];
      const b = touching[i + 1];
      if (a.gate !== b.gate) continue;
      if (!SELF_INVERSE.has(a.gate)) continue;
      if (a.wires.length !== 1 || b.wires.length !== 1) continue;

      found.push({
        kind: "cancels-out",
        severity: "fault",
        wire,
        column: b.column,
        message: `The two ${label(a.gate)} gates on q${wire}, at steps ${a.column + 1} and ${b.column + 1}, cancel each other out.`,
        fix: `${label(a.gate)} is its own inverse and nothing touches q${wire} in between, so the pair hands the qubit back exactly as it found it. Remove both, or put something between them.`,
      });
      i += 1; // The second is spoken for; do not pair it with the third as well.
    }
  }

  return found;
}

/* ------------------------------------------------------------------ */
/* what comes from running it                                           */
/* ------------------------------------------------------------------ */

/** Why this particular gate turned out to be a no-op, where that is knowable. */
function deadBecause(p: Placement, before: Amplitudes) {
  const wire = p.wires[p.wires.length - 1];

  if (PHASE_ONLY.has(p.gate) && probOne(before, wire) < EXACT) {
    return `q${wire} is still |0⟩ when it gets there, and a phase gate only turns the |1⟩ part of a qubit. Put an H before it and the phase has something to act on.`;
  }
  if (p.gate === "x" && Math.abs(probOne(before, wire) - 0.5) < EXACT) {
    return `q${wire} is already in an even superposition there, and X maps that state to itself — the Bloch vector will sit still through it.`;
  }
  return `The state the circuit is in at that point is an eigenstate of ${label(p.gate)}, so the gate hands it straight back. Check it is on the wire and the step you meant.`;
}

function simulated(placements: Placement[], qubits: number): CircuitIssue[] {
  const found: CircuitIssue[] = [];

  /* One simulation per distinct column rather than one per gate. Gates sharing
     a column sit on disjoint wires, so they commute, and the state before the
     column is the state before every gate in it. */
  const before = new Map<number, Amplitudes>();
  for (const column of new Set(placements.map((p) => p.column))) {
    const prior = placements.filter((q) => q.column < column);
    before.set(column, simulate(prior, qubits).amplitudes);
  }

  for (const p of placements) {
    /* Measurement is `structural`'s business: the simulator steps over it
       rather than collapsing, so asking whether an `m` changed anything would
       always come back no. */
    if (p.gate === "m") continue;

    const prior = before.get(p.column);
    if (!prior) continue;

    const after = simulate([...placements.filter((q) => q.column < p.column), p], qubits)
      .amplitudes;
    if (fidelity(prior, after) < 1 - EXACT) continue; // It does something. Nothing to say.

    /* The classic first-Bell-pair failure, and worth its own sentence: the
       CNOT went down before the Hadamard that was supposed to feed it. */
    if (p.gate === "cnot" && p.wires.length === 2 && probOne(prior, p.wires[0]) < EXACT) {
      const [control, target] = p.wires;
      found.push({
        kind: "inert-control",
        severity: "fault",
        wire: control,
        column: p.column,
        message: `The CNOT at step ${p.column + 1} never fires — q${control} is still |0⟩ when it arrives, so q${target} is left alone.`,
        fix: `A CNOT acts only where its control has some |1⟩ in it. Put an H on q${control} before step ${p.column + 1} and the two qubits entangle.`,
      });
      continue;
    }

    found.push({
      kind: "dead-gate",
      severity: "fault",
      wire: p.wires[p.wires.length - 1],
      column: p.column,
      message: `The ${label(p.gate)} at step ${p.column + 1} leaves the state exactly as it was.`,
      fix: deadBecause(p, prior),
    });
  }

  /* And the whole thing, end to end. Gates that each do something can still
     add up to nothing, and a learner watching one histogram bin hold all 1,024
     shots has no way to tell that from a circuit that never ran. */
  const active = placements.filter((p) => p.gate !== "m");
  if (active.length) {
    const final = simulate(placements, qubits).amplitudes;
    const ground = final.map((_, i) => ({ re: i === 0 ? 1 : 0, im: 0 }));
    if (fidelity(final, ground) > 1 - EXACT) {
      found.push({
        kind: "no-op-circuit",
        severity: "fault",
        wire: active[0].wires[0],
        column: Math.max(...active.map((p) => p.column)),
        message: `The register is back to |${"0".repeat(qubits)}⟩ by the end — every gate on the board is undone by another one.`,
        fix: "Run it and all 1,024 shots land in a single bin. Somewhere a pair of gates is inverting each other, which is usually one gate placed twice.",
      });
    }
  }

  return found;
}

/* ------------------------------------------------------------------ */

const RANK: Record<IssueKind, number> = {
  "after-measure": 0,
  "inert-control": 1,
  "cancels-out": 2,
  "dead-gate": 3,
  "no-op-circuit": 4,
  "idle-qubit": 5,
};

export function checkCircuit(placements: Placement[], qubits: number): CircuitIssue[] {
  if (!placements.length) return [];

  const found = structural(placements, qubits);
  if (qubits <= MAX_SIMULATED_QUBITS) found.push(...simulated(placements, qubits));

  /* A declared qubit nothing ever uses. Not wrong, and worth a word: an
     untouched wire is usually one left over from an earlier attempt, and it
     doubles the state vector without changing the answer. Ranked last, so it
     never speaks over a real fault. */
  for (let wire = 0; wire < qubits; wire += 1) {
    if (onWire(placements, wire).length) continue;
    found.push({
      kind: "idle-qubit",
      severity: "advice",
      wire,
      column: 0,
      message: `Nothing on the board touches q${wire}.`,
      fix:
        wire === qubits - 1
          ? `The register is a wire wider than this circuit needs — drop it to ${qubits - 1} qubits and the state read-out halves.`
          : `That wire stays |0⟩ for the whole run, so it doubles the size of the state vector without changing the answer.`,
    });
  }

  return found.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.column - b.column);
}
