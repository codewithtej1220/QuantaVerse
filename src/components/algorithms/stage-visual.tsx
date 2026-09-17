"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { animate, motion } from "framer-motion";
import { RotateCcw } from "lucide-react";

import type { Algorithm, StageSpan } from "@/lib/algorithms";
import type { BlochVector, Step } from "@/lib/quantum";
import { useReducedMotion } from "@/lib/pointer";
import {
  BELL_STATES,
  blochFidelity,
  hadamardContributions,
  reflectAboutMean,
  registerView,
  whichBell,
  type Complex,
} from "@/lib/stage-state";
import { cn } from "@/lib/utils";

/**
 * The picture for one stage of an algorithm.
 *
 * It plays the stage's net effect — the state before its first gate turning
 * into the state after its last — in the form that effect is easiest to see:
 * bars fanning out under Hadamards, a sign flipping under an oracle, every bar
 * jumping across the mean under a diffuser, shots filling a histogram at the
 * end. Both end points are simulation frames; the motion between them is the
 * only thing drawn rather than computed, and each picture checks that the
 * transformation it animates really does land on the next frame.
 *
 * Parked part-way through a stage, it shows the state at that gate as it is,
 * with no effect drawn over it: the in-between states of a diffuser are in a
 * rotated basis, and animating a reflection over them would be illustrating
 * something that is not on screen.
 */

type Props = {
  algorithm: Algorithm;
  span: StageSpan;
  frames: Step[];
  /** The frame the transport is on. */
  at: number;
};

export function StageVisual({ algorithm, span, frames, at }: Props) {
  const reduced = useReducedMotion();
  /* Bumped by the replay button, and part of every timeline's key, so the
     same stage can be played again without leaving it. */
  const [replay, setReplay] = useState(0);
  const visual = span.stage.visual;
  const complete = at >= span.to;
  const inside = at > span.from && at < span.to;
  const key = `${algorithm.slug}:${span.index}:${at}:${replay}`;

  return (
    <section
      className="panel relative flex min-h-[23rem] flex-col overflow-hidden rounded-2xl"
      aria-label={`${span.stage.title}, animated`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-4 py-2.5">
        <p className="eyebrow">
          Step {span.index + 1} · {span.stage.title}
        </p>
        <div className="flex items-center gap-3">
          {inside && (
            <span className="font-mono text-[11px] text-filament tabular-nums">
              gate {at - span.from} of {span.to - span.from} · the stage&rsquo;s effect lands on its
              last gate
            </span>
          )}
          {complete && span.stage.visual.kind !== "register" && !reduced && (
            <button
              type="button"
              onClick={() => setReplay((n) => n + 1)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] tracking-[0.12em] text-frost uppercase transition-colors hover:bg-strata hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
            >
              <RotateCcw className="size-3" aria-hidden />
              replay
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col px-4 pt-4 pb-4">
        {visual.kind === "register" && (
          <RegisterCards key={key} algorithm={algorithm} frame={frames[0]} />
        )}
        {visual.kind === "amplitudes" && (
          <AmplitudeStage
            key={key}
            algorithm={algorithm}
            span={span}
            frames={frames}
            at={at}
            animated={complete && !reduced}
          />
        )}
        {visual.kind === "bloch" && (
          <BlochStage
            key={key}
            algorithm={algorithm}
            span={span}
            frames={frames}
            at={at}
            animated={!reduced}
          />
        )}
        {visual.kind === "histogram" && (
          <HistogramStage
            key={key}
            algorithm={algorithm}
            span={span}
            frames={frames}
            at={at}
            animated={!reduced}
          />
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* the register, before anything runs                                  */
/* ------------------------------------------------------------------ */

function RegisterCards({ algorithm, frame }: { algorithm: Algorithm; frame: Step }) {
  const zeros = "0".repeat(algorithm.qubits);
  return (
    <div className="flex flex-1 flex-col justify-center gap-5">
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${algorithm.qubits}, minmax(0, 1fr))`,
        }}
      >
        {/* Top wire first, the way the board draws them. */}
        {Array.from({ length: algorithm.qubits }, (_, wire) => wire).map((wire) => (
          <motion.div
            key={wire}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              delay: wire * 0.12,
              ease: "easeOut",
            }}
            className="flex flex-col items-center rounded-xl border border-edge bg-void/60 px-2 py-3"
          >
            <p className="font-mono text-[11px] text-photon">q{wire}</p>
            <p className="mt-0.5 text-center text-[12px] leading-tight text-frost">
              {algorithm.roles[wire]}
            </p>
            <BlochDisc vector={frame.result.bloch[wire]} size={96} delay={0.2 + wire * 0.12} />
            <p className="ket text-[18px] text-paper">|0⟩</p>
          </motion.div>
        ))}
      </div>
      <p className="text-center text-[14px] leading-relaxed text-frost">
        <span className="ket text-[17px] text-paper">|ψ⟩ = |{zeros}⟩</span>
        <br />
        amplitude 1 on one basis state and 0 on the other {(1 << algorithm.qubits) - 1}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* amplitudes                                                           */
/* ------------------------------------------------------------------ */

type Phase = "before" | "middle" | "after";

/** A three-beat timeline: hold the start, mark what is about to change, land. */
function useBeats(animated: boolean, middleAt = 450, afterAt = 1250): Phase {
  const [phase, setPhase] = useState<Phase>(animated ? "before" : "after");
  useEffect(() => {
    if (!animated) return;
    const middle = window.setTimeout(() => setPhase("middle"), middleAt);
    const after = window.setTimeout(() => setPhase("after"), afterAt);
    return () => {
      window.clearTimeout(middle);
      window.clearTimeout(after);
    };
  }, [animated, middleAt, afterAt]);
  return phase;
}

function AmplitudeStage({
  algorithm,
  span,
  frames,
  at,
  animated,
}: {
  algorithm: Algorithm;
  span: StageSpan;
  frames: Step[];
  at: number;
  animated: boolean;
}) {
  const visual = span.stage.visual;
  if (visual.kind !== "amplitudes") return null;

  const complete = at >= span.to;
  const before = registerView(frames[span.from].result, algorithm.qubits, visual.register);
  const current = registerView(frames[at].result, algorithm.qubits, visual.register);
  /* The effect is drawn only across the whole stage. Part-way, the picture is
     the state at that gate and nothing else. */
  const effect = complete ? visual.effect : "settle";

  return (
    <div className="flex flex-1 flex-col gap-4">
      {effect === "spread" && (
        <Spread
          algorithm={algorithm}
          register={visual.register}
          before={before.amplitudes}
          after={current.amplitudes}
          labels={current.labels}
          animated={animated}
        />
      )}
      {effect === "phase" && (
        <PhaseFlip
          before={before.amplitudes}
          after={current.amplitudes}
          labels={current.labels}
          probabilities={current.probabilities}
          focus={visual.focus}
          animated={animated}
        />
      )}
      {effect === "interfere" && (
        <Interfere
          before={before.amplitudes}
          after={current.amplitudes}
          labels={current.labels}
          focus={visual.focus}
          animated={animated}
        />
      )}
      {effect === "reflect" && (
        <Reflect
          before={before.amplitudes}
          after={current.amplitudes}
          labels={current.labels}
          focus={visual.focus}
          animated={animated}
        />
      )}
      {effect === "bell" && (
        <BellStates
          algorithm={algorithm}
          span={span}
          frames={frames}
          at={at}
          current={current.amplitudes}
          labels={current.labels}
        />
      )}
      {effect === "settle" && (
        <Settle
          before={before.amplitudes}
          after={current.amplitudes}
          labels={current.labels}
          focus={complete ? visual.focus : undefined}
          animated={animated && complete}
        />
      )}

      {visual.bloch && (
        <div
          className="grid gap-2 border-t border-edge pt-3"
          style={{
            gridTemplateColumns: `repeat(${visual.register.length}, minmax(0, 1fr))`,
          }}
        >
          {visual.register.map((wire) => (
            <div key={wire} className="flex flex-col items-center">
              <BlochDisc
                vector={frames[at].result.bloch[wire]}
                from={animated ? frames[span.from].result.bloch[wire] : undefined}
                size={84}
                delay={0.35}
              />
              <p className="font-mono text-[11px] text-frost">
                q{wire} · {algorithm.roles[wire]}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Signed bars around a zero axis, +1 at the top and −1 at the bottom. */
function SignedBars({
  values,
  labels,
  focus,
  tone,
  ghost,
  mean,
  badges,
  delays,
  height = 220,
}: {
  values: number[];
  labels: string[];
  focus?: string[];
  /** A colour per bar; defaults to the sign. */
  tone?: ("photon" | "filament" | "dim")[];
  /** A dashed outline per bar, where it stood a moment ago. */
  ghost?: (number | null)[];
  /** A dashed horizontal line at this amplitude. */
  mean?: number | null;
  /** A short label pinned to a bar. */
  badges?: (string | null)[];
  delays?: number[];
  height?: number;
}) {
  const place = (value: number) =>
    value >= 0
      ? { top: `${50 - value * 50}%`, height: `${value * 50}%` }
      : { top: "50%", height: `${-value * 50}%` };
  /* A chart that can show a mean keeps a gutter for its label the whole time,
     so the bars do not shift sideways when the line arrives. Pinned over the
     plot instead, the label sat on top of whichever bar was last. */
  const gutter = mean !== undefined;

  return (
    <div className="flex flex-col">
      <div className="relative" style={{ height }}>
        {[1, 0.5, 0, -0.5, -1].map((tick) => (
          <div
            key={tick}
            className="absolute inset-x-0 flex items-center gap-2"
            style={{ top: `${50 - tick * 50}%` }}
          >
            <span className="w-8 shrink-0 -translate-y-px text-right font-mono text-[10.5px] text-dim tabular-nums">
              {tick > 0 ? `+${tick}` : tick}
            </span>
            <span className={cn("h-px flex-1", tick === 0 ? "bg-edge-hi" : "bg-edge/60")} />
          </div>
        ))}

        {mean !== undefined && mean !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="absolute right-14 left-10 border-t-2 border-dashed border-paper/70"
            style={{ top: `${50 - mean * 50}%` }}
          >
            <span className="absolute top-0 left-full ml-2 -translate-y-1/2 font-mono text-[10.5px] leading-tight whitespace-nowrap text-paper tabular-nums">
              mean
              <br />
              {mean >= 0 ? "+" : "−"}
              {Math.abs(mean).toFixed(2)}
            </span>
          </motion.div>
        )}

        <div
          className={cn(
            "absolute inset-y-0 left-10 flex items-stretch gap-3",
            gutter ? "right-14" : "right-0",
          )}
        >
          {values.map((value, index) => {
            const label = labels[index];
            const lit = focus?.includes(label);
            const colour = tone?.[index] ?? (value < -1e-6 ? "filament" : "photon");
            const outline = ghost?.[index];
            return (
              <div key={label} className="relative flex-1">
                {outline !== undefined && outline !== null && Math.abs(outline) > 1e-6 && (
                  <span
                    aria-hidden
                    className="absolute inset-x-[18%] border border-dashed border-frost/50"
                    style={place(outline)}
                  />
                )}
                <motion.span
                  aria-hidden
                  initial={false}
                  animate={place(value)}
                  transition={{
                    type: "spring",
                    stiffness: 120,
                    damping: 18,
                    delay: delays?.[index] ?? 0,
                  }}
                  className={cn(
                    "absolute inset-x-[18%] rounded-[3px]",
                    colour === "photon" && "bg-photon/85",
                    colour === "filament" && "bg-filament/90",
                    colour === "dim" && "bg-frost/40",
                    lit && "ring-2 ring-paper/70 ring-offset-2 ring-offset-nebula",
                  )}
                />
                <motion.span
                  initial={false}
                  animate={{
                    top:
                      value >= 0
                        ? `calc(${50 - value * 50}% - 20px)`
                        : `calc(${50 - value * 50}% + 4px)`,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 120,
                    damping: 18,
                    delay: delays?.[index] ?? 0,
                  }}
                  className={cn(
                    "absolute inset-x-0 text-center font-mono text-[11.5px] tabular-nums",
                    Math.abs(value) < 1e-6 ? "text-dim" : "text-paper",
                  )}
                >
                  {Math.abs(value) < 1e-6
                    ? "0"
                    : `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`}
                </motion.span>
                {badges?.[index] && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-x-0 bottom-1 mx-auto w-fit rounded-md bg-filament px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-void"
                  >
                    {badges[index]}
                  </motion.span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className={cn("mt-2 flex gap-3 pl-10", gutter && "pr-14")}>
        {labels.map((label) => (
          <span
            key={label}
            className={cn(
              "ket flex-1 text-center text-[14px]",
              focus?.includes(label) ? "text-photon" : "text-frost",
            )}
          >
            |{label}⟩
          </span>
        ))}
      </div>
    </div>
  );
}

const real = (values: Complex[]) => values.map((value) => value.re);

function Spread({
  algorithm,
  register,
  before,
  after,
  labels,
  animated,
}: {
  algorithm: Algorithm;
  register: number[];
  before: Complex[];
  after: Complex[];
  labels: string[];
  animated: boolean;
}) {
  const phase = useBeats(animated, 500, 1100);
  const shown = phase === "after" ? real(after) : real(before);
  const share = after.length ? Math.round(100 / after.length) : 0;

  return (
    <>
      {/* The gates doing it: one H per wire, turning over as they fire. */}
      <div className="flex flex-wrap items-center gap-2">
        {register.map((wire, index) => (
          <motion.span
            key={wire}
            initial={false}
            animate={
              phase === "before" ? { rotateY: 0, opacity: 0.55 } : { rotateY: 360, opacity: 1 }
            }
            transition={{ duration: 0.6, delay: index * 0.12 }}
            className="grid size-9 place-items-center rounded-md border border-photon bg-photon/10 font-mono text-[14px] font-semibold text-photon"
            title={`Hadamard on q${wire}`}
          >
            H
          </motion.span>
        ))}
        <span className="text-[13px] text-frost">
          on {register.map((wire) => `q${wire}`).join(" and ")} —{" "}
          {phase === "after"
            ? `${after.length} equal amplitudes, each outcome ${share}%`
            : `all of the amplitude on |${"0".repeat(register.length)}⟩`}
        </span>
      </div>
      <SignedBars
        values={shown}
        labels={labels}
        delays={labels.map((_, index) => (phase === "after" ? index * 0.08 : 0))}
      />
      {algorithm.qubits > register.length && phase === "after" && (
        <p className="text-[12.5px] leading-relaxed text-frost">
          The other wire is in a state of its own, so it is factored out: these are the amplitudes
          of the input register alone.
        </p>
      )}
    </>
  );
}

function PhaseFlip({
  before,
  after,
  labels,
  probabilities,
  focus,
  animated,
}: {
  before: Complex[];
  after: Complex[];
  labels: string[];
  probabilities: number[];
  focus?: string[];
  animated: boolean;
}) {
  const phase = useBeats(animated, 500, 1300);
  const flipped = after.map(
    (value, index) =>
      Math.sign(value.re) !== Math.sign(before[index].re) && Math.abs(value.re) > 1e-6,
  );
  const shown = phase === "after" ? real(after) : real(before);

  return (
    <>
      <SignedBars
        values={shown}
        labels={labels}
        focus={phase === "before" ? undefined : focus}
        badges={flipped.map((flip) => (flip && phase !== "before" ? "× −1" : null))}
        tone={shown.map((value, index) =>
          flipped[index] && phase !== "before" ? "filament" : value < -1e-6 ? "filament" : "photon",
        )}
        ghost={
          phase === "after"
            ? real(before).map((value, index) => (flipped[index] ? value : null))
            : undefined
        }
      />
      <p className="text-[13px] leading-relaxed text-frost">
        {flipped.filter(Boolean).length}{" "}
        {flipped.filter(Boolean).length === 1 ? "sign has" : "signs have"} flipped, and every
        probability is still{" "}
        <span className="text-paper">
          {[...new Set(probabilities.map((p) => `${Math.round(p * 100)}%`))].join(" / ")}
        </span>
        . The oracle&rsquo;s answer is in the phases, where a measurement cannot see it yet.
      </p>
    </>
  );
}

function fraction(value: number) {
  const magnitude = Math.abs(value);
  const sign = value < 0 ? "−" : "+";
  if (Math.abs(magnitude - 0.25) < 1e-6) return `${sign}¼`;
  if (Math.abs(magnitude - 0.5) < 1e-6) return `${sign}½`;
  if (magnitude < 1e-6) return "0";
  return `${sign}${magnitude.toFixed(2)}`;
}

function Interfere({
  before,
  after,
  labels,
  focus,
  animated,
}: {
  before: Complex[];
  after: Complex[];
  labels: string[];
  focus?: string[];
  animated: boolean;
}) {
  const phase = useBeats(animated, 400, 1900);
  const contributions = useMemo(() => hadamardContributions(before), [before]);
  const sums = contributions.map((row) => row.reduce((sum, value) => sum + value, 0));
  /* The picture's own arithmetic, held to the simulation's answer. */
  const agrees = sums.every((sum, index) => Math.abs(sum - after[index].re) < 1e-6);

  return (
    <>
      <p className="text-[13px] leading-relaxed text-frost">
        Each output collects one signed share from every input amplitude. Where the shares disagree
        they cancel; where they agree they add up.
      </p>
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))`,
        }}
      >
        {labels.map((label, y) => {
          const lit = focus?.includes(label);
          return (
            <div
              key={label}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-1 py-2",
                lit ? "border-photon/60 bg-photon/5" : "border-edge",
              )}
            >
              <span className={cn("ket text-[14px]", lit ? "text-photon" : "text-frost")}>
                |{label}⟩
              </span>
              <div className="flex flex-wrap justify-center gap-1">
                {contributions[y].map((share, x) => (
                  <motion.span
                    key={x}
                    initial={animated ? { opacity: 0, y: -6 } : false}
                    animate={{ opacity: phase === "before" ? 0 : 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: animated ? 0.1 * x + 0.08 * y : 0,
                    }}
                    className={cn(
                      "rounded px-1 font-mono text-[11px] tabular-nums",
                      share < 0 ? "bg-filament/20 text-filament" : "bg-photon/15 text-photon",
                    )}
                    title={`from |${labels[x]}⟩`}
                  >
                    {fraction(share)}
                  </motion.span>
                ))}
              </div>
              <motion.span
                initial={animated ? { opacity: 0 } : false}
                animate={{ opacity: phase === "after" ? 1 : 0 }}
                className={cn(
                  "font-mono text-[12.5px] font-semibold tabular-nums",
                  Math.abs(sums[y]) < 1e-6 ? "text-dim" : "text-paper",
                )}
              >
                = {fraction(sums[y])}
              </motion.span>
            </div>
          );
        })}
      </div>
      <SignedBars
        values={phase === "after" ? sums : sums.map(() => 0)}
        labels={labels}
        focus={phase === "after" ? focus : undefined}
        height={150}
      />
      {!agrees && (
        <p className="font-mono text-[11px] text-collapse">
          The sums above do not match the simulation&rsquo;s next frame; the bars show the
          simulation.
        </p>
      )}
    </>
  );
}

function Reflect({
  before,
  after,
  labels,
  focus,
  animated,
}: {
  before: Complex[];
  after: Complex[];
  labels: string[];
  focus?: string[];
  animated: boolean;
}) {
  const phase = useBeats(animated, 700, 1900);
  const { mean, reflected } = reflectAboutMean(real(before));
  const agrees = reflected.every((value, index) => Math.abs(value - after[index].re) < 1e-6);
  /* What lands is the simulation's frame. The reflection is the explanation,
     and it is only drawn if it really is what the frame shows. */
  const landing = real(after);
  const shown = phase === "after" ? landing : real(before);

  return (
    <>
      <SignedBars
        values={shown}
        labels={labels}
        focus={phase === "after" ? focus : undefined}
        mean={phase === "before" || !agrees ? null : mean}
        ghost={phase === "after" ? real(before) : undefined}
        delays={labels.map((_, index) => (phase === "after" ? index * 0.06 : 0))}
      />
      <p className="text-[13px] leading-relaxed text-frost">
        {agrees ? (
          <>
            Every amplitude a becomes 2·mean − a. With the mean at{" "}
            <span className="text-paper">
              {mean >= 0 ? "+" : "−"}
              {Math.abs(mean).toFixed(2)}
            </span>
            , the bars near it barely move — or, here, land on zero — while the one far below is
            thrown just as far above. The dashed outlines are where each bar stood before.
          </>
        ) : (
          <>The state after the stage, drawn as the simulation computed it.</>
        )}
      </p>
    </>
  );
}

function Settle({
  before,
  after,
  labels,
  focus,
  animated,
}: {
  before: Complex[];
  after: Complex[];
  labels: string[];
  focus?: string[];
  animated: boolean;
}) {
  const phase = useBeats(animated, 350, 900);
  const values = phase === "after" ? after : before;
  const complex = values.some((value) => Math.abs(value.im) > 1e-6);
  return (
    <SignedBars
      values={complex ? values.map((value) => Math.hypot(value.re, value.im)) : real(values)}
      labels={labels}
      focus={phase === "after" ? focus : undefined}
      delays={labels.map((_, index) => (phase === "after" ? index * 0.06 : 0))}
    />
  );
}

function BellStates({
  algorithm,
  span,
  frames,
  at,
  current,
  labels,
}: {
  algorithm: Algorithm;
  span: StageSpan;
  frames: Step[];
  at: number;
  current: Complex[];
  labels: string[];
}) {
  const visual = span.stage.visual;
  const register = visual.kind === "amplitudes" ? visual.register : [0, 1];
  const now = whichBell(current);
  /* The route the pair has taken so far, one Bell state per gate. */
  const trail = Array.from({ length: at - span.from + 1 }, (_, offset) =>
    whichBell(
      registerView(frames[span.from + offset].result, algorithm.qubits, register).amplitudes,
    ),
  );
  const applied = algorithm.steps
    .slice(span.from, at)
    .flatMap((step) => step.ops.map((op) => `${op.gate.toUpperCase()} on q${op.wires[0]}`));

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BELL_STATES.map((bell, index) => {
          const active = now === index;
          const visited = trail.includes(index) && !active;
          return (
            <motion.div
              key={bell.name}
              initial={false}
              animate={{ scale: active ? 1.03 : 1 }}
              className={cn(
                "rounded-lg border px-3 py-2",
                active
                  ? "border-photon bg-photon/10"
                  : visited
                    ? "border-edge-hi bg-strata/40"
                    : "border-edge",
              )}
            >
              <p
                className={cn(
                  "font-mono text-[13px] font-semibold",
                  active ? "text-photon" : "text-frost",
                )}
              >
                |{bell.name}⟩
              </p>
              <p className="ket mt-0.5 text-[12.5px] text-paper">{bell.ket}</p>
            </motion.div>
          );
        })}
      </div>
      <p className="text-[13px] leading-relaxed text-frost">
        {applied.length ? (
          <>
            Alice has applied <span className="text-paper">{applied.join(", then ")}</span> — to her
            own qubit only. The pair is now{" "}
            <span className="text-photon">
              {now === null ? "not a Bell state" : `|${BELL_STATES[now].name}⟩`}
            </span>
            .
          </>
        ) : (
          <>The pair starts as |Φ+⟩. Step through Alice&rsquo;s two gates to move it.</>
        )}
      </p>
      <SignedBars values={real(current)} labels={labels} height={170} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Bloch discs                                                          */
/* ------------------------------------------------------------------ */

function BlochStage({
  algorithm,
  span,
  frames,
  at,
  animated,
}: {
  algorithm: Algorithm;
  span: StageSpan;
  frames: Step[];
  at: number;
  animated: boolean;
}) {
  const visual = span.stage.visual;
  if (visual.kind !== "bloch") return null;
  const ghost = visual.ghost;
  const reference = ghost ? frames[ghost.frame].result.bloch[ghost.wire] : null;

  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${visual.wires.length}, minmax(0, 1fr))`,
        }}
      >
        {visual.wires.map((wire) => {
          const vector = frames[at].result.bloch[wire];
          const length = Math.hypot(vector.x, vector.y, vector.z);
          const onto = ghost && ghost.onto === wire ? reference : null;
          return (
            <div
              key={wire}
              className="flex flex-col items-center rounded-xl border border-edge bg-void/50 px-2 py-3"
            >
              <p className="font-mono text-[11px] text-photon">q{wire}</p>
              <p className="text-center text-[12px] text-frost">{algorithm.roles[wire]}</p>
              <BlochDisc
                vector={vector}
                from={animated ? frames[span.from].result.bloch[wire] : undefined}
                ghost={onto ?? undefined}
                size={128}
                delay={0.25}
              />
              <p className="font-mono text-[11px] text-frost tabular-nums">
                {length < 0.02 ? "no state of its own" : `|r| = ${length.toFixed(2)}`}
              </p>
              {onto && (
                <p className="mt-1 font-mono text-[11px] text-photon tabular-nums">
                  matches the payload: F = {blochFidelity(vector, onto).toFixed(3)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A Bloch sphere drawn flat: the outline, the equator, and the state's arrow.
 *
 * SVG rather than another WebGL canvas, because a stage can show three of these
 * at once beside a chart, and three contexts for three arrows is not a trade
 * worth making. z is up, x comes towards the reader down and to the left, and y
 * runs to the right — the usual textbook view.
 */
function BlochDisc({
  vector,
  from,
  ghost,
  size = 110,
  delay = 0,
}: {
  vector: BlochVector;
  /** Where the arrow starts its move from, when it should be seen moving. */
  from?: BlochVector;
  /** A faint reference arrow. */
  ghost?: BlochVector;
  size?: number;
  delay?: number;
}) {
  const id = useId();
  const centre = size / 2;
  const radius = size * 0.38;
  const project = (v: BlochVector) => ({
    x: centre + radius * (-0.42 * v.x + 0.9 * v.y),
    y: centre + radius * (0.32 * v.x - 0.92 * v.z),
  });
  const tip = project(vector);
  const start = from ? project(from) : tip;
  const length = Math.hypot(vector.x, vector.y, vector.z);
  const equator = Array.from({ length: 49 }, (_, i) => {
    const t = (i / 48) * Math.PI * 2;
    const point = project({ x: Math.cos(t), y: Math.sin(t), z: 0 });
    return `${i === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="my-1">
      <defs>
        <marker
          id={`${id}-head`}
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" className="fill-photon" />
        </marker>
      </defs>
      <circle
        cx={centre}
        cy={centre}
        r={radius}
        className="fill-none stroke-edge-hi"
        strokeWidth={1}
      />
      <path
        d={equator}
        className="fill-none stroke-edge-hi"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <line
        x1={centre}
        y1={centre - radius}
        x2={centre}
        y2={centre + radius}
        className="stroke-edge"
        strokeWidth={1}
      />
      <text
        x={centre}
        y={centre - radius - 4}
        textAnchor="middle"
        className="fill-frost font-mono"
        fontSize={9}
      >
        |0⟩
      </text>
      <text
        x={centre}
        y={centre + radius + 11}
        textAnchor="middle"
        className="fill-frost font-mono"
        fontSize={9}
      >
        |1⟩
      </text>
      {ghost && (
        <line
          x1={centre}
          y1={centre}
          x2={project(ghost).x}
          y2={project(ghost).y}
          className="stroke-paper/35"
          strokeWidth={3}
          strokeLinecap="round"
        />
      )}
      {length < 0.02 ? (
        <motion.circle
          cx={centre}
          cy={centre}
          initial={{ r: 0 }}
          animate={{ r: 3.5 }}
          transition={{ delay }}
          className="fill-filament"
        />
      ) : (
        <motion.line
          x1={centre}
          y1={centre}
          initial={{ x2: start.x, y2: start.y }}
          animate={{ x2: tip.x, y2: tip.y }}
          transition={{ type: "spring", stiffness: 70, damping: 14, delay }}
          className="stroke-photon"
          strokeWidth={2.5}
          strokeLinecap="round"
          markerEnd={`url(#${id}-head)`}
        />
      )}
      <circle cx={centre} cy={centre} r={2} className="fill-paper/60" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* measurement                                                          */
/* ------------------------------------------------------------------ */

const SHOTS = 1024;

/** A deterministic stream of outcomes, so a replay draws the same shots. */
function drawShots(probabilities: number[], count: number, seed: number) {
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return Array.from({ length: count }, () => {
    const roll = random();
    let running = 0;
    for (let index = 0; index < probabilities.length; index += 1) {
      running += probabilities[index];
      if (roll < running) return index;
    }
    return probabilities.length - 1;
  });
}

function HistogramStage({
  algorithm,
  span,
  frames,
  at,
  animated,
}: {
  algorithm: Algorithm;
  span: StageSpan;
  frames: Step[];
  at: number;
  animated: boolean;
}) {
  const visual = span.stage.visual;
  const register = visual.kind === "histogram" ? visual.register : [];
  const focus = visual.kind === "histogram" ? visual.focus : undefined;
  const ghost = visual.kind === "histogram" ? visual.ghost : undefined;
  const view = registerView(frames[span.to].result, algorithm.qubits, register);
  const outcomes = useMemo(
    () => drawShots(view.probabilities, SHOTS, algorithm.slug.length * 7919 + 13),
    [view.probabilities, algorithm.slug],
  );

  const [shown, setShown] = useState(animated ? 0 : SHOTS);
  useEffect(() => {
    if (!animated) return;
    const controls = animate(0, SHOTS, {
      duration: 1.8,
      ease: "easeInOut",
      onUpdate: (value) => setShown(Math.round(value)),
    });
    return () => controls.stop();
  }, [animated]);

  const counts = view.labels.map(() => 0);
  for (let index = 0; index < shown; index += 1) counts[outcomes[index]] += 1;
  const reference = ghost ? frames[ghost.frame].result.bloch[ghost.wire] : null;
  const bob = ghost ? frames[at].result.bloch[ghost.onto] : null;

  return (
    <div className={cn("grid flex-1 gap-4", ghost && "md:grid-cols-[minmax(0,1fr)_auto]")}>
      <div className="flex flex-col">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[11px] tracking-[0.12em] text-frost uppercase">
            measuring {register.map((wire) => `q${wire}`).join(" and ")}
          </p>
          <p className="font-mono text-[12px] text-paper tabular-nums">
            {shown.toLocaleString("en-IN")} / {SHOTS.toLocaleString("en-IN")} shots
          </p>
        </div>
        {/* Room above the 100% line for a count sitting on a full bar. */}
        <div className="relative mt-8 h-[210px]">
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <div
              key={tick}
              className="absolute inset-x-0 flex items-center gap-2"
              style={{ bottom: `${tick * 100}%` }}
            >
              <span className="w-8 shrink-0 text-right font-mono text-[10.5px] text-dim tabular-nums">
                {Math.round(tick * 100)}%
              </span>
              <span className="h-px flex-1 bg-edge/70" />
            </div>
          ))}
          <div className="absolute inset-y-0 right-0 left-10 flex items-end gap-3">
            {view.labels.map((label, index) => {
              const exact = view.probabilities[index];
              const sampled = counts[index] / SHOTS;
              const lit = focus?.includes(label);
              return (
                <div key={label} className="relative flex h-full flex-1 items-end">
                  {exact > 1e-6 && (
                    <span
                      aria-hidden
                      className="absolute inset-x-[12%] border-t-2 border-dashed border-paper/60"
                      style={{ bottom: `${exact * 100}%` }}
                      title={`exactly ${(exact * 100).toFixed(1)}%`}
                    />
                  )}
                  <span
                    className={cn(
                      "mx-[18%] w-full rounded-t-[3px]",
                      lit ? "bg-photon" : "bg-photon/60",
                    )}
                    style={{ height: `${sampled * 100}%` }}
                  />
                  {counts[index] > 0 && (
                    <span
                      className="absolute inset-x-0 text-center font-mono text-[11px] text-paper tabular-nums"
                      style={{ bottom: `calc(${sampled * 100}% + 4px)` }}
                    >
                      {counts[index]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex gap-3 pl-10">
          {view.labels.map((label) => (
            <span
              key={label}
              className={cn(
                "ket flex-1 text-center text-[14px]",
                focus?.includes(label) ? "text-photon" : "text-frost",
              )}
            >
              |{label}⟩
            </span>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-frost">
          Bars are shots drawn from the state; the dashed marks are the exact probabilities they
          settle towards.
        </p>
      </div>

      {ghost && reference && bob && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-edge bg-void/50 px-3 py-3">
          <p className="font-mono text-[11px] text-photon">q{ghost.onto}</p>
          <p className="text-center text-[12px] text-frost">{algorithm.roles[ghost.onto]}</p>
          <BlochDisc vector={bob} ghost={reference} size={128} />
          <p className="font-mono text-[11px] text-photon tabular-nums">
            payload kept: F = {blochFidelity(bob, reference).toFixed(3)}
          </p>
        </div>
      )}
    </div>
  );
}
