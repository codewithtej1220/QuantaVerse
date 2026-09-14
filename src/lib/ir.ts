/**
 * Placements ↔ Canonical Circuit IR.
 *
 * The IR is what the FastAPI service speaks, and it is the same shape whether
 * the circuit gets simulated by Qiskit, Cirq or PennyLane. The sandbox's own
 * `Placement` list is a drawing: a column and the wires a gate sits on. The
 * translation is therefore mostly a rename, plus the one real decision — a
 * placed M becomes a `Measurement`, not a gate in the timeline.
 *
 * The return trip is lossier, because the IR can describe circuits this grid
 * cannot draw, so `fromCircuitIR` is allowed to refuse.
 */

import type { CircuitIR, IRGate, IRMeasurement } from "@/lib/api";
import { pack, type Placement } from "@/lib/quantum";

/** Sandbox gate id → IR gate name. Anything absent is not sent to the server. */
const IR_GATE: Record<string, string> = {
  h: "h",
  x: "x",
  y: "y",
  z: "z",
  s: "s",
  t: "t",
  cnot: "cx",
};

/** The same table read backwards: IR gate name → the tile that draws it. */
const SANDBOX_GATE: Record<string, string> = Object.fromEntries(
  Object.entries(IR_GATE).map(([tile, gate]) => [gate, tile]),
);

export interface ToIROptions {
  /**
   * Keep placed M gates as measurements. Off by default: without them the
   * service returns the whole register's histogram, which is what the sandbox's
   * bar chart plots. The distribution is identical either way.
   */
  withMeasurements?: boolean;
  /**
   * Keep each M where it was placed, with its time step. For the grader, which
   * has to know whether anything acts on a qubit after it was measured — the
   * statevector cannot tell a Bell pair from an H, a measurement and a CNOT.
   */
  measurementSteps?: boolean;
}

export function toCircuitIR(
  placements: Placement[],
  qubits: number,
  options: ToIROptions = {},
): CircuitIR {
  const ordered = [...placements].sort(
    (a, b) =>
      a.column - b.column || Math.min(...a.wires) - Math.min(...b.wires),
  );

  const timeline: IRGate[] = [];
  const measured = new Set<number>();
  const placed: IRMeasurement[] = [];

  for (const placement of ordered) {
    if (placement.gate === "m") {
      for (const wire of placement.wires) {
        if (wire >= qubits) continue;
        measured.add(wire);
        placed.push({
          targets: [wire],
          clbits: [wire],
          step: placement.column,
        });
      }
      continue;
    }

    const gate = IR_GATE[placement.gate];
    if (!gate) continue;
    if (placement.wires.some((wire) => wire >= qubits)) continue;

    if (gate === "cx") {
      const [control, target] = placement.wires;
      if (control === target) continue;
      timeline.push({
        gate,
        control,
        targets: [target],
        params: [],
        step: placement.column,
      });
    } else {
      timeline.push({
        gate,
        control: null,
        targets: [placement.wires[0]],
        params: [],
        step: placement.column,
      });
    }
  }

  if (options.measurementSteps) {
    return {
      qubits,
      clbits: placed.length
        ? Math.max(...placed.map((m) => m.targets[0])) + 1
        : 0,
      timeline,
      measurements: placed,
    };
  }

  const targets = [...measured].sort((a, b) => a - b);
  const measurements: IRMeasurement[] =
    options.withMeasurements && targets.length
      ? [{ targets, clbits: targets.map((_, index) => index) }]
      : [];

  return {
    qubits,
    clbits: measurements.length ? targets.length : 0,
    timeline,
    measurements,
  };
}

export interface GridLimits {
  /** Smallest register the wire picker offers. */
  minQubits: number;
  /** Largest register the wire picker offers. */
  maxQubits: number;
  /** Time steps the diagram has room for. */
  columns: number;
}

export type LoadOutcome =
  | { ok: true; qubits: number; placements: Placement[] }
  /** Why the circuit cannot be drawn. Written to be shown to the learner. */
  | { ok: false; reason: string };

/**
 * Canonical Circuit IR → placements, so the grid can draw what the API ran.
 *
 * The IR describes far more than this grid can draw — 26 gate names, 12 qubits,
 * any depth — so the answer is either a circuit that renders exactly, or a
 * refusal that names the obstacle. Loading a partial circuit would show the
 * learner a diagram their code does not produce, which is worse than a note.
 */
export function fromCircuitIR(ir: CircuitIR, limits: GridLimits): LoadOutcome {
  if (ir.qubits > limits.maxQubits) {
    return {
      ok: false,
      reason: `the circuit has ${ir.qubits} qubits and this grid holds ${limits.maxQubits}`,
    };
  }

  const unknown = [
    ...new Set(
      ir.timeline
        .filter((gate) => !SANDBOX_GATE[gate.gate])
        .map((gate) => gate.gate),
    ),
  ];
  if (unknown.length) {
    const names = unknown.map((gate) => gate.toUpperCase()).join(", ");
    return {
      ok: false,
      reason: `the palette has no tile for ${names} — the diagram only draws H, X, Y, Z, S, T, CX and measurement`,
    };
  }

  const ops = [...ir.timeline]
    .sort((a, b) => a.step - b.step)
    .map((gate) => ({
      gate: SANDBOX_GATE[gate.gate],
      wires:
        gate.control === null || gate.control === undefined
          ? [gate.targets[0]]
          : [gate.control, gate.targets[0]],
    }));

  const measured = [
    ...new Set(
      (ir.measurements ?? []).flatMap((measurement) => measurement.targets),
    ),
  ].sort((a, b) => a - b);
  for (const wire of measured) ops.push({ gate: "m", wires: [wire] });

  const qubits = Math.max(limits.minQubits, ir.qubits);
  if (ops.some((op) => op.wires.some((wire) => wire < 0 || wire >= qubits))) {
    return {
      ok: false,
      reason: "a gate lands on a wire the circuit never declared",
    };
  }

  const placements = pack(ops, qubits);
  const columns = placements.reduce(
    (widest, item) => Math.max(widest, item.column + 1),
    0,
  );
  if (columns > limits.columns) {
    return {
      ok: false,
      reason: `the circuit is ${columns} steps long and the diagram has ${limits.columns} columns`,
    };
  }

  return { ok: true, qubits, placements };
}

/**
 * A server histogram, re-indexed to the sandbox's bar order.
 *
 * Keys arrive most-significant-qubit-first (`q(n-1) … q0`), the same way the
 * local simulator labels its basis states, so the key parses straight back to
 * the index of its bar.
 */
export function histogramToCounts(
  histogram: Record<string, number>,
  qubits: number,
): number[] {
  const counts = new Array<number>(1 << qubits).fill(0);
  for (const [label, value] of Object.entries(histogram)) {
    const index = Number.parseInt(label, 2);
    if (Number.isFinite(index) && index >= 0 && index < counts.length) {
      counts[index] += value;
    }
  }
  return counts;
}
