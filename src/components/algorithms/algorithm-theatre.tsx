"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import {
  algorithmCode,
  algorithmPlacements,
  type Algorithm,
} from "@/lib/algorithms";
import { mascotOffer } from "@/lib/mascot";
import { simulateSteps } from "@/lib/quantum";
import { cn } from "@/lib/utils";
import { CircuitGrid } from "@/components/sandbox/circuit-grid";
import { StatePanel } from "@/components/sandbox/state-panel";
import { StepThrough } from "@/components/sandbox/step-through";

/**
 * One algorithm, run a time step at a time.
 *
 * Everything on this page is the sandbox's own machinery pointed at a circuit
 * nobody has to build: the same board, the same transport, the same statevector
 * panel, the same Qiskit. That is deliberate and it is most of the value — a
 * learner who steps through Grover here and then opens the sandbox is looking
 * at the same instrument, not at a diagram of one.
 *
 * The transport is the spine. `simulateSteps` gives one frame per column and
 * the algorithm gives one paragraph per column, so the position in the
 * transport, the lit column on the board, the highlighted lines of Qiskit, the
 * narration and every number in the state panel are all the same index. There
 * is no separate animation timeline to drift out of sync with the physics,
 * because there is no separate animation: the picture *is* the simulation.
 */
export function AlgorithmTheatre({ algorithm }: { algorithm: Algorithm }) {
  const placements = useMemo(() => algorithmPlacements(algorithm), [algorithm]);
  const code = useMemo(() => algorithmCode(algorithm), [algorithm]);
  const steps = useMemo(
    () => simulateSteps(placements, algorithm.qubits),
    [placements, algorithm.qubits],
  );

  /* Parked on the opening frame rather than the finished circuit. The sandbox
     opens on the answer because you built the thing and want to see it; this
     page opens before anything has happened, because the whole point is the
     order it happens in. */
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);

  const last = steps.length - 1;
  const index = Math.min(at, last);
  const frame = steps[index] ?? steps[0];
  /* Frame 0 is the register before anything ran, so step n is frame n+1. */
  const step = index > 0 ? algorithm.steps[index - 1] : null;
  const column = index > 0 ? index - 1 : null;

  /* The board is built rather than revealed.
     Showing the finished circuit and lighting one column of it asks the reader
     to find the step among sixteen gates that all look equally final. Placing
     only what has actually run, and outlining what is still to come, makes the
     same information a thing you watch happen: each press puts a gate down,
     and the gate plays the same drop animation it would in the sandbox. */
  const placed = useMemo(
    () => (column === null ? [] : placements.filter((p) => p.column <= column)),
    [placements, column],
  );
  const upcoming = useMemo(
    () =>
      column === null
        ? placements
        : placements.filter((p) => p.column > column),
    [placements, column],
  );

  /* Hand the tutor the step the reader is actually looking at.
     The cat carries one question, set by whatever owns the page. Left to the
     route's guide line it would offer "explain Grover" on every frame, which
     is the least useful moment to ask it — the reader who taps is almost never
     stuck on the algorithm, they are stuck on the gate in front of them. */
  useEffect(() => {
    mascotOffer.ask = step
      ? `In ${algorithm.name}, step ${index} of ${last} is: ${step.say} Why is that step there, and what would break without it?`
      : `Explain ${algorithm.name} to me simply, in plain language.`;
  }, [algorithm.name, step, index, last]);

  return (
    <div className="flex flex-col gap-6">
      {/* ---- the circuit ---- */}
      <section>
        <div className="flex items-baseline justify-between gap-4 pb-3">
          <p className="eyebrow">The circuit</p>
          <p className="font-mono text-[11.5px] text-dim">
            {algorithm.qubits} qubits · {placements.length} gates ·{" "}
            {algorithm.steps.length} steps
          </p>
        </div>
        <CircuitGrid
          qubits={algorithm.qubits}
          columns={algorithm.steps.length}
          placements={placed}
          ghost={upcoming}
          armed={null}
          onPlace={() => {}}
          onRemove={() => {}}
          highlight={column}
        />
      </section>

      {/* ---- the transport ---- */}
      <StepThrough
        steps={steps}
        at={at}
        onSeek={setAt}
        playing={playing}
        onPlaying={setPlaying}
        qubits={algorithm.qubits}
        frameMs={3200}
      />

      {/* ---- what is happening, and the code doing it ---- */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <Narration
          algorithm={algorithm}
          index={index}
          step={step}
          last={last}
        />
        <CodeScroll lines={code} active={column} />
      </div>

      {/* ---- and every number behind it ---- */}
      <StatePanel
        result={frame.result}
        qubits={algorithm.qubits}
        shots={null}
        shotCount={1024}
        stepLabel={
          index === 0
            ? "before the circuit runs"
            : index < last
              ? `after step ${index} of ${last}`
              : null
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Narration({
  algorithm,
  index,
  step,
  last,
}: {
  algorithm: Algorithm;
  index: number;
  step: Algorithm["steps"][number] | null;
  last: number;
}) {
  const finished = index === last;

  return (
    <section className="panel flex min-h-[17rem] flex-col rounded-xl p-5">
      {/* Keyed on the step, so React swaps the paragraph outright and the new
          one fades up from nothing.

          There is deliberately no exit animation and no `AnimatePresence`. The
          first version wrapped this in one with `mode="wait"`, which holds the
          incoming text until the outgoing text has finished leaving — and that
          couples the sentence to a frame budget. On a throttled tab it wedged
          on the opening paragraph while the board and the Qiskit walked on
          without it, which is the worst failure this page has: the narration
          describing a step other than the one lit up. Nothing the reader needs
          to read should wait on an animation to finish. */}
      <div className="flex flex-1 flex-col">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex flex-1 flex-col"
        >
          <div className="flex items-center gap-3">
            <span className="eyebrow text-photon">
              {index === 0 ? "before anything runs" : (step?.phase ?? "done")}
            </span>
            <span className="font-mono text-[11px] text-dim tabular-nums">
              {index === 0 ? "—" : `${index} / ${last}`}
            </span>
          </div>

          <p className="mt-3 text-[15px] leading-relaxed text-paper">
            {index === 0
              ? `Every qubit starts at |0⟩ and nothing has been applied yet. Press play, or step forward one gate at a time — the board, the Qiskit and every number below move together, because they are all the same simulation.`
              : step?.say}
          </p>

          {step?.watch && (
            <p className="mt-4 border-l-2 border-filament/60 pl-3 text-[13.5px] leading-relaxed text-frost">
              <span className="font-mono text-[10.5px] tracking-[0.14em] text-filament uppercase">
                watch
              </span>
              <br />
              {step.watch}
            </p>
          )}

          {finished && (
            <p className="mt-auto border-t border-edge pt-4 text-[13.5px] leading-relaxed text-frost">
              <span className="font-mono text-[10.5px] tracking-[0.14em] text-photon uppercase">
                result
              </span>
              <br />
              {algorithm.outcome}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/** Python that is read, not typed — so a styled block rather than an editor. */
function CodeScroll({
  lines,
  active,
}: {
  lines: ReturnType<typeof algorithmCode>;
  active: number | null;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-sheet">
      <div className="flex items-center justify-between border-b border-black/8 px-4 py-2.5">
        <p className="font-mono text-[11px] tracking-[0.14em] text-[#3f5350] uppercase">
          circuit.py
        </p>
        <p className="font-mono text-[11px] text-[#596e6a]">
          the same Qiskit the sandbox emits
        </p>
      </div>

      <div className="max-h-[22rem] overflow-auto px-2 py-3">
        <pre className="font-mono text-[12.5px] leading-[1.65]">
          {lines.map((line, i) => {
            const lit = active !== null && line.step === active;
            const comment = line.text.startsWith("#");
            return (
              <div
                key={i}
                className={cn(
                  "flex gap-3 rounded px-2 transition-colors duration-200",
                  lit && "bg-photon/18",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "w-6 shrink-0 text-right tabular-nums select-none",
                    lit ? "text-[#0e6d80]" : "text-[#a7b4b1]",
                  )}
                >
                  {i + 1}
                </span>
                <code
                  className={cn(
                    comment ? "text-[#596e6a] italic" : "text-[#0f1c19]",
                    lit && !comment && "font-semibold",
                  )}
                >
                  {line.text || " "}
                </code>
              </div>
            );
          })}
        </pre>
      </div>
    </section>
  );
}
