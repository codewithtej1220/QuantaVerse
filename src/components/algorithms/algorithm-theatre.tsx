"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

import {
  algorithmCode,
  algorithmPlacements,
  stageAt,
  stageSpans,
  type Algorithm,
  type AlgorithmStep,
  type StageSpan,
} from "@/lib/algorithms";
import { mascotOffer } from "@/lib/mascot";
import { simulateSteps } from "@/lib/quantum";
import { cn } from "@/lib/utils";
import { CircuitGrid } from "@/components/sandbox/circuit-grid";
import { StatePanel } from "@/components/sandbox/state-panel";
import { StepThrough } from "@/components/sandbox/step-through";

import { StageVisual } from "./stage-visual";

/**
 * One algorithm, run a stage at a time — and a time step at a time underneath.
 *
 * Everything on this page is the sandbox's own machinery pointed at a circuit
 * nobody has to build: the same board, the same transport, the same statevector
 * panel, the same Qiskit. That is deliberate and it is most of the value — a
 * learner who steps through Grover here and then opens the sandbox is looking
 * at the same instrument, not at a diagram of one.
 *
 * The stages sit on top of it. Initialization, Superposition, Oracle,
 * Diffusion, Measurement: a stage is what a run of gates is for, and each has a
 * picture of what it does, drawn from the simulation frames at its ends. The
 * gates underneath are the implementation, and they are still all here.
 *
 * The frame index is the spine. `simulateSteps` gives one frame per column and
 * the algorithm gives one paragraph per column, so the position in the
 * transport, the lit column on the board, the highlighted lines of Qiskit, the
 * narration and every number in the state panel are all the same index — and a
 * stage is a run of those frames, so choosing one moves the index to its end
 * and stepping through gates carries the stage along. There is no separate
 * animation timeline to drift out of sync with the physics, because nothing
 * keeps a position of its own.
 */

/* Long enough to watch a stage play and read its paragraph. */
const STAGE_MS = 8000;

export function AlgorithmTheatre({ algorithm }: { algorithm: Algorithm }) {
  const placements = useMemo(() => algorithmPlacements(algorithm), [algorithm]);
  const code = useMemo(() => algorithmCode(algorithm), [algorithm]);
  const steps = useMemo(
    () => simulateSteps(placements, algorithm.qubits),
    [placements, algorithm.qubits],
  );
  const spans = useMemo(() => stageSpans(algorithm), [algorithm]);

  /* Parked on the opening frame rather than the finished circuit. The sandbox
     opens on the answer because you built the thing and want to see it; this
     page opens before anything has happened, because the whole point is the
     order it happens in. */
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [touring, setTouring] = useState(false);

  const last = steps.length - 1;
  const index = Math.min(at, last);
  const frame = steps[index] ?? steps[0];
  /* Frame 0 is the register before anything ran, so step n is frame n+1. */
  const step = index > 0 ? algorithm.steps[index - 1] : null;
  const column = index > 0 ? index - 1 : null;
  const span = stageAt(spans, index);
  const onStageEnd = index === span.to;

  /* The stage player: one stage every few seconds, to the end, then stop. */
  useEffect(() => {
    if (!touring) return;
    const timer = window.setTimeout(() => {
      const next = spans[span.index + 1];
      if (next) setAt(next.to);
      else setTouring(false);
    }, STAGE_MS);
    return () => window.clearTimeout(timer);
  }, [touring, span.index, spans]);

  const goToStage = (target: StageSpan) => {
    setPlaying(false);
    setAt(target.to);
  };
  const seekGate = (frameIndex: number) => {
    setTouring(false);
    setAt(frameIndex);
  };

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
     stuck on the algorithm, they are stuck on the gate in front of them. Parked
     at the end of a stage, what is in front of them is the stage, so that is
     what it offers; stepped inside one, it is back to the gate. */
  useEffect(() => {
    if (onStageEnd && span.stage.steps > 0) {
      mascotOffer.ask = `In ${algorithm.name}, the "${span.stage.title}" stage: ${span.stage.summary} Why does the algorithm need this stage, and what would go wrong without it?`;
    } else if (step) {
      mascotOffer.ask = `In ${algorithm.name}, step ${index} of ${last} is: ${step.say} Why is that step there, and what would break without it?`;
    } else {
      mascotOffer.ask = `Explain ${algorithm.name} to me simply, in plain language.`;
    }
  }, [algorithm.name, onStageEnd, span, step, index, last]);

  return (
    <div className="flex flex-col gap-6">
      <StageRail
        spans={spans}
        current={span}
        at={index}
        touring={touring}
        onTouring={(next) => {
          setPlaying(false);
          if (next && span.index === spans.length - 1 && onStageEnd) setAt(0);
          setTouring(next);
        }}
        onSelect={goToStage}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <StageVisual algorithm={algorithm} span={span} frames={steps} at={index} />
        <StageCard
          algorithm={algorithm}
          span={span}
          spans={spans}
          at={index}
          onSeek={seekGate}
          onStage={goToStage}
        />
      </div>

      {/* ---- the circuit ---- */}
      <section>
        <div className="flex items-baseline justify-between gap-4 pb-3">
          <p className="eyebrow">The circuit</p>
          <p className="font-mono text-[11.5px] text-dim">
            {algorithm.qubits} qubits · {placements.length} gates · {algorithm.steps.length} steps ·{" "}
            {spans.length} stages
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
          highlight={
            onStageEnd && span.to > span.from ? ([span.from, span.to - 1] as const) : column
          }
        />
      </section>

      {/* ---- gate by gate ---- */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-edge pt-6">
          <p className="eyebrow">Gate by gate</p>
          <p className="text-[13px] text-frost">
            The same run, one time step at a time — the stage above follows along.
          </p>
        </div>
        <StepThrough
          steps={steps}
          at={at}
          onSeek={seekGate}
          playing={playing}
          onPlaying={(next) => {
            if (next) setTouring(false);
            setPlaying(next);
          }}
          qubits={algorithm.qubits}
          frameMs={3200}
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <Narration algorithm={algorithm} index={index} step={step} last={last} />
          <CodeScroll lines={code} active={column} />
        </div>
      </section>

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

function StageRail({
  spans,
  current,
  at,
  touring,
  onTouring,
  onSelect,
}: {
  spans: StageSpan[];
  current: StageSpan;
  at: number;
  touring: boolean;
  onTouring: (touring: boolean) => void;
  onSelect: (span: StageSpan) => void;
}) {
  const previous = spans[current.index - 1];
  const next = spans[current.index + 1];

  return (
    <nav
      aria-label="Stages of the algorithm"
      className="panel flex flex-col gap-3 rounded-2xl px-3 py-3 sm:px-4"
    >
      <ol className="flex gap-2 overflow-x-auto pb-1">
        {spans.map((span) => {
          const active = span.index === current.index;
          const done = at >= span.to && !active;
          return (
            <li key={span.index} className="min-w-[9.5rem] flex-1">
              <button
                type="button"
                onClick={() => onSelect(span)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                  active
                    ? "border-photon bg-photon/10"
                    : done
                      ? "border-edge-hi bg-strata/50 hover:border-photon/50"
                      : "border-edge hover:border-edge-hi",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full font-mono text-[12px] font-semibold tabular-nums",
                    active
                      ? "bg-photon text-void"
                      : done
                        ? "bg-photon/25 text-photon"
                        : "border border-edge-hi text-frost",
                  )}
                >
                  {span.index + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-[13.5px] leading-tight font-medium",
                      active ? "text-paper" : "text-frost",
                    )}
                  >
                    {span.stage.title}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10.5px] tracking-[0.1em] text-dim uppercase">
                    {span.stage.steps === 0
                      ? "before any gate"
                      : `${span.stage.steps} step${span.stage.steps === 1 ? "" : "s"}`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => previous && onSelect(previous)}
          disabled={!previous}
          className="flex items-center gap-1 rounded-lg border border-edge px-2.5 py-1.5 font-mono text-[11px] tracking-[0.1em] text-frost uppercase transition-colors hover:border-edge-hi hover:text-paper disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          previous stage
        </button>
        <button
          type="button"
          onClick={() => onTouring(!touring)}
          className="flex items-center gap-1.5 rounded-lg bg-photon px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.1em] text-void uppercase transition-colors hover:bg-photon-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
        >
          {touring ? (
            <Pause className="size-3.5" aria-hidden />
          ) : (
            <Play className="size-3.5" aria-hidden />
          )}
          {touring ? "pause" : "play the stages"}
        </button>
        <button
          type="button"
          onClick={() => next && onSelect(next)}
          disabled={!next}
          className="flex items-center gap-1 rounded-lg border border-edge px-2.5 py-1.5 font-mono text-[11px] tracking-[0.1em] text-frost uppercase transition-colors hover:border-edge-hi hover:text-paper disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
        >
          next stage
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
      </div>
    </nav>
  );
}

/** A step's gates, written out. */
function describeOps(step: AlgorithmStep) {
  const measured = step.ops.filter((op) => op.gate === "m").map((op) => `q${op.wires[0]}`);
  const gates = step.ops
    .filter((op) => op.gate !== "m")
    .map((op) =>
      op.gate === "cnot"
        ? `CNOT q${op.wires[0]}→q${op.wires[1]}`
        : `${op.gate.toUpperCase()} on q${op.wires[0]}`,
    );
  if (measured.length) gates.push(`measure ${measured.join(", ")}`);
  return gates.join(" · ");
}

function StageCard({
  algorithm,
  span,
  spans,
  at,
  onSeek,
  onStage,
}: {
  algorithm: Algorithm;
  span: StageSpan;
  spans: StageSpan[];
  at: number;
  onSeek: (frame: number) => void;
  onStage: (span: StageSpan) => void;
}) {
  const stepIndexes = Array.from(
    { length: span.to - span.from },
    (_, offset) => span.from + offset,
  );
  const next = spans[span.index + 1];

  return (
    <section className="panel flex flex-col rounded-2xl p-5">
      <motion.div
        key={span.index}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex flex-1 flex-col"
      >
        <p className="eyebrow text-photon">
          Step {span.index + 1} of {spans.length}
        </p>
        <h2 className="mt-2 text-[26px] leading-tight font-medium text-paper">
          {span.stage.title}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-paper">{span.stage.summary}</p>
        <p className="mt-4 border-l-2 border-filament/60 pl-3 text-[13.5px] leading-relaxed text-frost">
          <span className="font-mono text-[10.5px] tracking-[0.14em] text-filament uppercase">
            watch
          </span>
          <br />
          {span.stage.watch}
        </p>

        {stepIndexes.length > 0 && (
          <div className="mt-5 border-t border-edge pt-4">
            <p className="font-mono text-[10.5px] tracking-[0.14em] text-dim uppercase">
              the gates in this stage
            </p>
            {/* One line per gate, and the narration only for the gate the
                reader is on. Every gate's opening sentence under every row made
                Grover's diffuser a wall of seven, several of them fragments
                ("Its CNOT.") that only read in sequence. */}
            <ol className="mt-2 flex flex-col gap-1">
              {stepIndexes.map((stepIndex) => {
                const gate = algorithm.steps[stepIndex];
                const frame = stepIndex + 1;
                const here = at === frame;
                return (
                  <li key={stepIndex}>
                    <button
                      type="button"
                      onClick={() => onSeek(frame)}
                      aria-current={here ? "step" : undefined}
                      className={cn(
                        "w-full rounded-lg border px-3 py-1.5 text-left transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                        here ? "border-photon/60 bg-photon/10" : "border-edge hover:border-edge-hi",
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn("font-mono text-[12px]", here ? "text-paper" : "text-frost")}
                        >
                          {describeOps(gate)}
                        </span>
                        <span className="font-mono text-[10.5px] text-dim tabular-nums">
                          step {frame}
                        </span>
                      </span>
                      {here && (
                        <span className="mt-1 block text-[12.5px] leading-snug text-frost">
                          {gate.say}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="mt-auto pt-5">
          {next ? (
            <button
              type="button"
              onClick={() => onStage(next)}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] text-photon uppercase transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
            >
              Next: {next.stage.title}
              <ChevronRight className="size-3.5" aria-hidden />
            </button>
          ) : (
            <p className="text-[13.5px] leading-relaxed text-frost">
              <span className="font-mono text-[10.5px] tracking-[0.14em] text-photon uppercase">
                result
              </span>
              <br />
              {algorithm.outcome}
            </p>
          )}
        </div>
      </motion.div>
    </section>
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
