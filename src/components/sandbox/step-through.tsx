"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack } from "lucide-react";

import { GATE_BY_ID } from "@/lib/data";
import type { Step } from "@/lib/quantum";
import { cn } from "@/lib/utils";

/**
 * The transport: run the circuit one time step at a time.
 *
 * A learner who only ever sees the final histogram has been shown the answer
 * and none of the reasoning. Stepping is where a circuit stops being a spell —
 * place a Hadamard and watch the Bloch vector swing to the equator, then place
 * the CNOT and watch both vectors collapse to the origin as the pair entangles.
 * The final state cannot show you which gate did that.
 *
 * Stepping is by column, because a column is one time step: two gates on
 * different wires in the same column really do happen together, and stepping
 * through them one at a time would teach a sequencing the hardware does not
 * have. The label under the scrubber names the gates that fired, so what
 * changed and what caused it are read together.
 */

const FRAME_MS = 900;

function gateName(gateId: string) {
  return GATE_BY_ID[gateId]?.name ?? gateId.toUpperCase();
}

/** What fired on this step, written out. */
function describe(step: Step, qubits: number) {
  if (step.index === 0) {
    return `every qubit at |${"0".repeat(Math.max(1, qubits))}⟩ — nothing has run yet`;
  }
  if (!step.applied.length) return "an empty step";

  const parts = step.applied.map((placement) => {
    if (placement.gate === "cnot") {
      const [control, target] = placement.wires;
      return `CNOT q${control}→q${target}`;
    }
    return `${gateName(placement.gate)} on q${placement.wires[0]}`;
  });

  return parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]} — together, in one step`;
}

export function StepThrough({
  steps,
  at,
  onSeek,
  playing,
  onPlaying,
  qubits,
}: {
  steps: Step[];
  /** Index into `steps`. The last frame is the finished circuit. */
  at: number;
  onSeek: (index: number) => void;
  playing: boolean;
  onPlaying: (playing: boolean) => void;
  qubits: number;
}) {
  const last = steps.length - 1;
  const step = steps[Math.min(at, last)] ?? steps[0];
  const live = at >= last;

  /* The clock.
     Everything it needs is read through refs so the interval is created once
     per play rather than restarted on every tick — an interval in a dependency
     array that includes the position it advances is an interval that resets
     itself forever and never fires. */
  const latest = useRef({ at, last, onSeek, onPlaying });
  useEffect(() => {
    latest.current = { at, last, onSeek, onPlaying };
  });

  useEffect(() => {
    if (!playing || steps.length < 2) return;

    const timer = window.setInterval(() => {
      const state = latest.current;
      const next = state.at + 1;
      state.onSeek(Math.min(next, state.last));
      // Stop at the end rather than looping: a circuit has a last step, and
      // a transport that silently restarts hides which frame you were on.
      if (next >= state.last) state.onPlaying(false);
    }, FRAME_MS);

    return () => window.clearInterval(timer);
  }, [playing, steps.length]);

  if (steps.length < 2) {
    return (
      <p className="border-t border-edge pt-4 font-mono text-[11.5px] text-dim">
        place a gate to step through the circuit
      </p>
    );
  }

  const button =
    "flex size-8 shrink-0 items-center justify-center border border-edge text-frost transition-colors hover:border-paper hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="border-t border-edge pt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <p className="eyebrow">Step through</p>

        <div className="flex items-center gap-1.5" role="group" aria-label="Circuit playback">
          <button
            type="button"
            className={button}
            aria-label="Back to the start"
            disabled={at === 0}
            onClick={() => {
              onPlaying(false);
              onSeek(0);
            }}
          >
            <SkipBack className="size-3.5" />
          </button>
          <button
            type="button"
            className={button}
            aria-label="Previous step"
            disabled={at === 0}
            onClick={() => {
              onPlaying(false);
              onSeek(at - 1);
            }}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            className={cn(
              button,
              "border-photon text-photon hover:bg-photon hover:text-void",
            )}
            aria-label={playing ? "Pause" : "Play the circuit"}
            onClick={() => {
              // Playing from the end starts over, the way a transport should.
              if (!playing && at >= last) onSeek(0);
              onPlaying(!playing);
            }}
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </button>
          <button
            type="button"
            className={button}
            aria-label="Next step"
            disabled={live}
            onClick={() => {
              onPlaying(false);
              onSeek(at + 1);
            }}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* The scrubber. One notch per time step, so its shape is the circuit's
            shape rather than a generic progress bar. */}
        <div className="flex min-w-[8rem] flex-1 items-center gap-1">
          {steps.map((frame, index) => (
            <button
              key={frame.index}
              type="button"
              aria-label={`Step ${index} of ${last}`}
              aria-current={index === at}
              onClick={() => {
                onPlaying(false);
                onSeek(index);
              }}
              className={cn(
                "h-6 flex-1 border-b-2 transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                index === at
                  ? "border-photon"
                  : index < at
                    ? "border-photon-deep hover:border-photon"
                    : "border-edge hover:border-edge-hi",
              )}
            />
          ))}
        </div>

        <p className="font-mono text-[12px] text-frost tabular-nums">
          <span className={live ? "text-photon" : "text-paper"}>{step.index}</span>
          <span className="text-dim"> / {last}</span>
        </p>
      </div>

      <p className="mt-2.5 font-mono text-[11.5px] leading-relaxed text-dim">
        {live ? (
          <>
            <span className="text-photon">finished</span> · {describe(step, qubits)}
          </>
        ) : (
          describe(step, qubits)
        )}
      </p>
    </div>
  );
}
