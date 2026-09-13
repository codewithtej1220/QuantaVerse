import type { Placement } from "@/lib/quantum";

/**
 * Structural faults in a circuit, found without asking anybody.
 *
 * The obvious way to build this is to send the circuit to the tutor and ask it
 * what is wrong. That is the wrong tool for the detecting half, for three
 * reasons that all matter: a model takes a second or two and this has to run on
 * every gate placed, it costs a request per keystroke-equivalent, and it is
 * occasionally confidently wrong — and a mascot that cries wolf about a correct
 * circuit is worse than a mascot that says nothing at all.
 *
 * Everything below is provable from the placements by reading them. Each check
 * is a fact about the circuit, not an opinion about it, which is what earns the
 * right to interrupt somebody mid-build. The tutor is still the right tool for
 * the other half — explaining *why*, at length, when the learner asks — and the
 * offer attached to each finding is what hands it over.
 *
 * Findings are ordered worst-first, and only the first is ever shown. A column
 * of complaints about a half-built circuit is noise; one specific sentence
 * about the thing most likely to be wrong is help.
 */

export type IssueKind = "after-measure" | "inert-control" | "cancels-out" | "idle-qubit";

export interface CircuitIssue {
  kind: IssueKind;
  /** Wire the fault sits on, for pointing at it. */
  wire: number;
  column: number;
  /** What is wrong, in one sentence. */
  message: string;
  /** What to do about it. */
  fix: string;
}

/** Gates that undo themselves, so two in a row on one wire is nothing at all. */
const SELF_INVERSE = new Set(["h", "x", "y", "z"]);

/** Everything touching a wire, earliest first. */
function onWire(placements: Placement[], wire: number): Placement[] {
  return placements
    .filter((p) => p.wires.includes(wire))
    .sort((a, b) => a.column - b.column);
}

export function checkCircuit(placements: Placement[], qubits: number): CircuitIssue[] {
  const found: CircuitIssue[] = [];
  if (!placements.length) return found;

  for (let wire = 0; wire < qubits; wire += 1) {
    const touching = onWire(placements, wire);

    /* --- a gate after this wire has been measured ----------------------
       The measurement has already collapsed the wire, so anything after it
       is acting on a definite basis state rather than on the superposition
       the circuit was building. Almost always a gate placed in the wrong
       column rather than something intended. */
    const measured = touching.find((p) => p.gate === "m");
    if (measured) {
      const later = touching.find((p) => p.gate !== "m" && p.column > measured.column);
      if (later) {
        found.push({
          kind: "after-measure",
          wire,
          column: later.column,
          message: `q${wire} is measured at step ${measured.column + 1}, and there is still a gate on it at step ${later.column + 1}.`,
          fix: "Move the measurement to the end of the wire, or move that gate before it.",
        });
      }
    }

    /* --- two self-inverse gates in a row, doing nothing ----------------
       H·H, X·X and friends are the identity. Nothing else touches the wire
       between them, so the pair is provably dead work rather than a
       deliberate round trip through another basis. */
    for (let i = 0; i < touching.length - 1; i += 1) {
      const a = touching[i];
      const b = touching[i + 1];
      if (
        a.gate === b.gate &&
        SELF_INVERSE.has(a.gate) &&
        a.wires.length === 1 &&
        b.wires.length === 1
      ) {
        found.push({
          kind: "cancels-out",
          wire,
          column: b.column,
          message: `Two ${a.gate.toUpperCase()} gates in a row on q${wire} cancel each other out.`,
          fix: `${a.gate.toUpperCase()} is its own inverse, so those two leave the qubit exactly as it was. Remove both, or put something between them.`,
        });
      }
    }
  }

  /* --- a CNOT whose control has never been touched ---------------------
     The control is still |0⟩, so the gate never fires and the target is
     untouched. This is the single most common way a first Bell pair fails:
     the CNOT goes down before the Hadamard that feeds it. */
  for (const p of placements) {
    if (p.gate !== "cnot" || p.wires.length !== 2) continue;
    const [control] = p.wires;
    const earlier = placements.some(
      (other) => other !== p && other.column < p.column && other.wires.includes(control),
    );
    if (!earlier) {
      found.push({
        kind: "inert-control",
        wire: control,
        column: p.column,
        message: `The CNOT at step ${p.column + 1} has nothing before it on q${control}, so its control is still |0⟩.`,
        fix: `A CNOT only fires when its control is |1⟩ or in superposition. Put an H on q${control} before it and the pair entangles.`,
      });
    }
  }

  /* --- a declared qubit nothing ever uses ------------------------------
     Not wrong, and worth a word: a wider register is more to simulate and
     more to read, and an untouched wire is usually one left over from an
     earlier attempt. Ranked last, so it never speaks over a real fault. */
  for (let wire = 0; wire < qubits; wire += 1) {
    if (!onWire(placements, wire).length) {
      found.push({
        kind: "idle-qubit",
        wire,
        column: 0,
        message: `q${wire} has no gates on it.`,
        fix: "Drop the register width if you do not need that wire — a narrower circuit is faster to simulate and easier to read.",
      });
    }
  }

  const rank: Record<IssueKind, number> = {
    "after-measure": 0,
    "inert-control": 1,
    "cancels-out": 2,
    "idle-qubit": 3,
  };
  return found.sort((a, b) => rank[a.kind] - rank[b.kind] || a.column - b.column);
}
