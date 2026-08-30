"use client";

import { useMemo, useState } from "react";
import { Check, Play, X } from "lucide-react";

import { simulate, type Placement, type SimulationResult } from "@/lib/quantum";
import { cn } from "@/lib/utils";

/**
 * The graded side of the workspace.
 *
 * Every number in here is computed from the same statevector the sphere is
 * drawn from — the checks are assertions against real amplitudes, not a lookup
 * of whether the expected gates happen to be present. That is the difference
 * that matters pedagogically: a different route to the same state passes, which
 * is what you want a learner to discover.
 */

interface Check {
  label: string;
  run: (result: SimulationResult) => boolean;
}

interface Task {
  id: string;
  title: string;
  brief: string;
  qubits: number;
  target: Placement[];
  checks: Check[];
}

const near = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol;

/** Index of a bit-string in the probability array; q0 is the least significant. */
const at = (bits: string) => parseInt(bits, 2);

const TASKS: Task[] = [
  {
    id: "bell",
    title: "Bell pair",
    brief: "Entangle two qubits so the register only ever reads 00 or 11.",
    qubits: 2,
    target: [
      { id: "t1", gate: "h", column: 0, wires: [0] },
      { id: "t2", gate: "cnot", column: 1, wires: [0, 1] },
    ],
    checks: [
      { label: "P(00) = 0.5", run: (r) => near(r.probabilities[at("00")], 0.5) },
      { label: "P(11) = 0.5", run: (r) => near(r.probabilities[at("11")], 0.5) },
      { label: "P(01) = 0", run: (r) => near(r.probabilities[at("01")], 0) },
      { label: "P(10) = 0", run: (r) => near(r.probabilities[at("10")], 0) },
      {
        label: "both qubits maximally mixed",
        run: (r) => r.bloch.slice(0, 2).every((b) => Math.hypot(b.x, b.y, b.z) < 0.02),
      },
    ],
  },
  {
    id: "uniform",
    title: "Uniform superposition",
    brief: "Put a two-qubit register into an equal superposition of all four states.",
    qubits: 2,
    target: [
      { id: "t1", gate: "h", column: 0, wires: [0] },
      { id: "t2", gate: "h", column: 0, wires: [1] },
    ],
    checks: [
      {
        label: "all four outcomes at 0.25",
        run: (r) => r.probabilities.slice(0, 4).every((p) => near(p, 0.25)),
      },
      {
        label: "no entanglement (both vectors full length)",
        run: (r) => r.bloch.slice(0, 2).every((b) => near(Math.hypot(b.x, b.y, b.z), 1, 0.03)),
      },
      { label: "depth of 1", run: (r) => r.depth === 1 },
    ],
  },
  {
    id: "flip",
    title: "Phase kickback",
    brief: "Reach |−⟩ on q0 — an equal superposition carrying a π phase.",
    qubits: 1,
    target: [
      { id: "t1", gate: "x", column: 0, wires: [0] },
      { id: "t2", gate: "h", column: 1, wires: [0] },
    ],
    checks: [
      { label: "P(0) = 0.5", run: (r) => near(r.probabilities[0], 0.5) },
      { label: "vector on −x", run: (r) => near(r.bloch[0].x, -1, 0.03) },
      { label: "no z component", run: (r) => near(r.bloch[0].z, 0, 0.03) },
    ],
  },
];

/** |⟨target|ψ⟩|², the standard state fidelity. */
function fidelityOf(a: SimulationResult, b: SimulationResult) {
  const n = Math.min(a.amplitudes.length, b.amplitudes.length);
  let re = 0;
  let im = 0;
  for (let i = 0; i < n; i += 1) {
    const x = a.amplitudes[i];
    const y = b.amplitudes[i];
    re += x.re * y.re + x.im * y.im;
    im += x.re * y.im - x.im * y.re;
  }
  return Math.min(1, re * re + im * im);
}

/* Stated assumptions, not measurements. A simulator cannot observe a
   decoherence time — it has none — so the panel does arithmetic against
   published figures and says which ones, rather than inventing a number and
   presenting it as an instrument reading. */
const GATE_NS = 50;
const T2_US = 100;

export function Arena({
  placements,
  qubits,
  onVerdict,
}: {
  placements: Placement[];
  qubits: number;
  onVerdict: (passed: boolean) => void;
}) {
  const [taskId, setTaskId] = useState(TASKS[0].id);
  const [ran, setRan] = useState<{ task: string; results: boolean[] } | null>(null);

  const task = TASKS.find((t) => t.id === taskId) ?? TASKS[0];
  const mine = useMemo(() => simulate(placements, qubits), [placements, qubits]);
  const goal = useMemo(() => simulate(task.target, task.qubits), [task]);

  const fidelity = qubits === task.qubits ? fidelityOf(mine, goal) : 0;
  const durationNs = mine.depth * GATE_NS;
  const headroom = Math.max(0, 100 - (durationNs / (T2_US * 1000)) * 100);

  const verdict = ran && ran.task === task.id ? ran.results : null;
  const passed = verdict !== null && verdict.every(Boolean);

  const run = () => {
    const results = task.checks.map((check) => {
      try {
        return check.run(mine);
      } catch {
        return false;
      }
    });
    setRan({ task: task.id, results });
    onVerdict(results.every(Boolean));
  };

  return (
    <section className="well flex min-h-0 flex-col p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge pb-3">
        <p className="font-mono text-[11px] tracking-[0.18em] text-frost uppercase">Arena</p>
        <div className="flex flex-wrap gap-1.5">
          {TASKS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTaskId(option.id)}
              className={cn(
                "border px-2.5 py-1 font-mono text-[10.5px] tracking-[0.12em] uppercase transition-colors",
                option.id === task.id
                  ? "border-photon text-photon"
                  : "border-edge text-dim hover:border-edge-hi hover:text-frost",
              )}
            >
              {option.title}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3.5 text-[13px] leading-relaxed text-frost">{task.brief}</p>
      <p className="mt-1.5 font-mono text-[11px] text-dim">
        register: {task.qubits} qubits
        {qubits !== task.qubits && (
          <span className="text-paper"> · yours is {qubits} — set the register to match</span>
        )}
      </p>

      {/* Two up, not four. `sm:grid-cols-4` was reading the viewport, but this
          panel lives in a column about four hundred pixels wide whatever the
          viewport is doing — so at any desktop size it forced four columns of
          ninety pixels and "Gate depth" and "Coherence headroom" both wrapped
          onto two lines. */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-edge py-4">
        {(
          [
            ["Gate depth", String(mine.depth), "text-paper"],
            ["Gates", String(mine.gateCount), "text-paper"],
            [
              "Fidelity",
              fidelity.toFixed(3),
              fidelity > 0.999 ? "text-photon" : fidelity > 0.5 ? "text-paper" : "text-frost",
            ],
            ["Coherence headroom", `${headroom.toFixed(1)}%`, "text-paper"],
          ] as const
        ).map(([label, value, tone]) => (
          <div key={label}>
            <p className="font-mono text-[10px] tracking-[0.14em] text-dim uppercase">{label}</p>
            <p className={cn("font-display mt-1 text-xl font-extrabold tabular-nums", tone)}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-dim">
        headroom = depth × {GATE_NS} ns against a {T2_US} µs T₂. An assumption, stated — the
        simulator has no decoherence of its own to measure.
      </p>

      <ul className="mt-4 min-h-0 flex-1 space-y-1.5 overflow-y-auto font-mono text-[12px]">
        {task.checks.map((check, i) => {
          const state = verdict ? verdict[i] : null;
          return (
            <li
              key={check.label}
              className={cn(
                "flex items-center gap-2.5 border-l-2 py-1 pl-2.5",
                state === null && "border-edge text-dim",
                state === true && "border-photon text-photon",
                state === false && "border-frost text-frost",
              )}
            >
              {state === null ? (
                <span className="w-3.5 text-center">·</span>
              ) : state ? (
                <Check className="size-3.5 shrink-0" />
              ) : (
                <X className="size-3.5 shrink-0" />
              )}
              {check.label}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-edge pt-3.5">
        <p className="font-mono text-[11px] tracking-[0.14em] uppercase">
          {verdict === null ? (
            <span className="text-dim">not run</span>
          ) : passed ? (
            <span className="text-photon">all checks passed</span>
          ) : (
            <span className="text-frost">
              {verdict.filter(Boolean).length}/{verdict.length} passed
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={run}
          className="inline-flex items-center gap-2 bg-photon px-4 py-2 font-mono text-[11px] tracking-[0.14em] text-void uppercase transition-colors hover:bg-photon-hi"
        >
          <Play className="size-3.5" />
          Verify
        </button>
      </div>
    </section>
  );
}
