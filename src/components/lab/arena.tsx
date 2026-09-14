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

const length = (b: { x: number; y: number; z: number }) =>
  Math.hypot(b.x, b.y, b.z);

/* In the order they get harder: one qubit and a sign, then two qubits with no
   entanglement, then an entangled pair, then all three. They used to run the
   other way — the Bell pair first and a single qubit last, under a title,
   "Phase kickback", naming a technique the task does not use. Every brief now
   says exactly what its checks test: "depth of 1" was a check the uniform
   superposition brief never mentioned, and it failed a correct answer built
   one gate at a time. */
const TASKS: Task[] = [
  {
    id: "minus",
    title: "Minus state",
    brief:
      "Reach |−⟩ = (|0⟩ − |1⟩)/√2 on one qubit: an even superposition with a minus sign on |1⟩.",
    qubits: 1,
    target: [
      { id: "t1", gate: "x", column: 0, wires: [0] },
      { id: "t2", gate: "h", column: 1, wires: [0] },
    ],
    checks: [
      { label: "P(0) = 0.5", run: (r) => near(r.probabilities[0], 0.5) },
      {
        label: "arrow on −X (the minus sign)",
        run: (r) => near(r.bloch[0].x, -1, 0.03),
      },
    ],
  },
  {
    id: "uniform",
    title: "Uniform superposition",
    brief:
      "Put two qubits into (|00⟩ + |01⟩ + |10⟩ + |11⟩)/2 — all four outcomes, every amplitude +½.",
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
        label: "both arrows on +X (no stray signs, no entanglement)",
        run: (r) => r.bloch.slice(0, 2).every((b) => near(b.x, 1, 0.03)),
      },
    ],
  },
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
      {
        label: "P(00) = 0.5",
        run: (r) => near(r.probabilities[at("00")], 0.5),
      },
      {
        label: "P(11) = 0.5",
        run: (r) => near(r.probabilities[at("11")], 0.5),
      },
      { label: "P(01) = 0", run: (r) => near(r.probabilities[at("01")], 0) },
      { label: "P(10) = 0", run: (r) => near(r.probabilities[at("10")], 0) },
      {
        label: "both qubits maximally mixed",
        run: (r) => r.bloch.slice(0, 2).every((b) => length(b) < 0.02),
      },
    ],
  },
  {
    id: "ghz",
    title: "GHZ state",
    brief:
      "Entangle all three qubits so the register only ever reads 000 or 111.",
    qubits: 3,
    target: [
      { id: "t1", gate: "h", column: 0, wires: [0] },
      { id: "t2", gate: "cnot", column: 1, wires: [0, 1] },
      { id: "t3", gate: "cnot", column: 2, wires: [1, 2] },
    ],
    checks: [
      {
        label: "P(000) = 0.5",
        run: (r) => near(r.probabilities[at("000")], 0.5),
      },
      {
        label: "P(111) = 0.5",
        run: (r) => near(r.probabilities[at("111")], 0.5),
      },
      {
        label: "all three qubits maximally mixed",
        run: (r) => r.bloch.slice(0, 3).every((b) => length(b) < 0.02),
      },
    ],
  },
];

/**
 * The two checks every task shares, ahead of its own.
 *
 * The register first, because every other check indexes the probabilities by
 * bit-string, and on a register of the wrong width "P(00)" is quietly a
 * different outcome — a three-qubit Bell attempt could pass, while the fidelity
 * beside it read 0.000. And measurement, because the simulator steps over an M
 * rather than collapsing: an H, a measurement and then a CNOT reads as a
 * perfect Bell pair to every amplitude check, and is not one.
 */
function sharedChecks(
  task: Task,
  placements: Placement[],
  qubits: number,
): Check[] {
  return [
    {
      label: `register of ${task.qubits} qubit${task.qubits === 1 ? "" : "s"}`,
      run: () => qubits === task.qubits,
    },
    {
      label: "nothing after a measurement",
      run: () =>
        !placements.some(
          (m) =>
            m.gate === "m" &&
            placements.some(
              (g) =>
                g.gate !== "m" &&
                g.column > m.column &&
                g.wires.some((w) => m.wires.includes(w)),
            ),
        ),
    },
  ];
}

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
  onRegister,
}: {
  placements: Placement[];
  qubits: number;
  onVerdict: (passed: boolean) => void;
  /** Resize the lab's register — picking a task sets it to the task's width. */
  onRegister: (qubits: number) => void;
}) {
  /* Opens on the first task that fits the register the page opened with, so
     the first Verify is not a complaint about a setting nobody has touched. */
  const [taskId, setTaskId] = useState(
    () => (TASKS.find((t) => t.qubits === qubits) ?? TASKS[0]).id,
  );
  const [ran, setRan] = useState<{
    task: string;
    results: boolean[];
    key: string;
  } | null>(null);

  const task = TASKS.find((t) => t.id === taskId) ?? TASKS[0];
  const mine = useMemo(
    () => simulate(placements, qubits),
    [placements, qubits],
  );
  const goal = useMemo(() => simulate(task.target, task.qubits), [task]);

  const fidelity = qubits === task.qubits ? fidelityOf(mine, goal) : 0;
  const durationNs = mine.depth * GATE_NS;
  const headroom = Math.max(0, 100 - (durationNs / (T2_US * 1000)) * 100);

  /* A verdict speaks for the board it was run on. Edit the circuit and the
     ticks clear, rather than standing beside a circuit they were not about. */
  const verdict =
    ran &&
    ran.task === task.id &&
    ran.key === JSON.stringify([placements, qubits])
      ? ran.results
      : null;
  const passed = verdict !== null && verdict.every(Boolean);

  const checks = useMemo(
    () => [...sharedChecks(task, placements, qubits), ...task.checks],
    [task, placements, qubits],
  );

  const run = () => {
    const shared = sharedChecks(task, placements, qubits).map((check) =>
      check.run(mine),
    );
    /* A task's own checks only mean something on its register. */
    const fits = shared[0];
    const results = [
      ...shared,
      ...task.checks.map((check) => {
        if (!fits) return false;
        try {
          return check.run(mine);
        } catch {
          return false;
        }
      }),
    ];
    setRan({
      task: task.id,
      results,
      key: JSON.stringify([placements, qubits]),
    });
    onVerdict(results.every(Boolean));
  };

  return (
    <section className="well flex min-h-0 flex-col p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge pb-3">
        <p className="font-mono text-[11px] tracking-[0.18em] text-frost uppercase">
          Arena
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TASKS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setTaskId(option.id);
                if (option.qubits !== qubits) onRegister(option.qubits);
              }}
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

      <p className="mt-3.5 text-[13px] leading-relaxed text-frost">
        {task.brief}
      </p>
      <p className="mt-1.5 font-mono text-[11px] text-dim">
        register: {task.qubits} qubits
        {qubits !== task.qubits && (
          <span className="text-paper">
            {" "}
            · yours is {qubits} — set the register to match
          </span>
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
              fidelity > 0.999
                ? "text-photon"
                : fidelity > 0.5
                  ? "text-paper"
                  : "text-frost",
            ],
            ["Coherence headroom", `${headroom.toFixed(1)}%`, "text-paper"],
          ] as const
        ).map(([label, value, tone]) => (
          <div key={label}>
            <p className="font-mono text-[10px] tracking-[0.14em] text-dim uppercase">
              {label}
            </p>
            <p
              className={cn(
                "font-display mt-1 text-xl font-extrabold tabular-nums",
                tone,
              )}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-dim">
        headroom = depth × {GATE_NS} ns against a {T2_US} µs T₂. An assumption,
        stated — the simulator has no decoherence of its own to measure.
      </p>

      <ul className="mt-4 min-h-0 flex-1 space-y-1.5 overflow-y-auto font-mono text-[12px]">
        {checks.map((check, i) => {
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
