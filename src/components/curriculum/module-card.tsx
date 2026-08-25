import Link from "next/link";
import { ArrowRight, Award, Check, Lock } from "lucide-react";

import { AmplitudeBar } from "@/components/site/amplitude-bar";
import { TRACK_LABEL, type Module, type ModuleState } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * A module, drawn as an unlockable achievement.
 *
 * The medallion is the module's index written as a basis state, and the ring
 * around it is the completion probability — so the badge and the progress bar
 * are the same number twice, once as a shape and once as a figure. Locked cards
 * still open: the lock marks the suggested order, and says so.
 */

const STATE_META: Record<
  ModuleState,
  { label: string; chip: string; ring: string; medallion: string }
> = {
  mastered: {
    label: "Mastered",
    chip: "border-photon/40 bg-photon/10 text-photon",
    ring: "stroke-photon",
    medallion: "border-photon/45 bg-photon/8 text-photon",
  },
  active: {
    label: "In progress",
    chip: "border-phase/45 bg-phase/12 text-phase",
    ring: "stroke-phase",
    medallion: "border-phase/50 bg-phase/10 text-phase",
  },
  available: {
    label: "Open",
    chip: "border-white/14 bg-white/5 text-frost/80",
    ring: "stroke-frost/70",
    medallion: "border-white/16 bg-white/4 text-frost/85",
  },
  locked: {
    label: "Suggested later",
    chip: "border-white/10 bg-white/3 text-frost/55",
    ring: "stroke-frost/40",
    medallion: "border-white/10 bg-white/3 text-frost/50",
  },
};

const R = 25;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function ModuleCard({
  module,
  prerequisite,
}: {
  module: Module;
  prerequisite?: Module;
}) {
  const meta = STATE_META[module.state];
  const locked = module.state === "locked";

  return (
    <article
      className={cn(
        "group glass relative flex flex-col overflow-hidden rounded-2xl p-5",
        "transition-[transform,border-color,box-shadow] duration-300",
        "hover:-translate-y-1 hover:border-photon/30 hover:shadow-[0_22px_60px_-28px_rgba(56,232,255,0.55)]",
      )}
    >
      {/* Ambient wash, keyed to the module's state. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-24 -right-16 size-52 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100",
          module.state === "mastered" && "bg-photon/22",
          module.state === "active" && "bg-phase/22",
          module.state === "available" && "bg-photon/12",
          locked && "bg-white/6",
        )}
      />

      <header className="relative flex items-start gap-4">
        {/* Medallion: the basis-state index, ringed by completion. */}
        <div className="relative shrink-0">
          <svg viewBox="0 0 60 60" className="size-[60px] -rotate-90">
            <circle cx="30" cy="30" r={R} fill="none" className="stroke-white/8" strokeWidth="2" />
            <circle
              cx="30"
              cy="30"
              r={R}
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - module.progress / 100)}
              className={cn(meta.ring, "transition-[stroke-dashoffset] duration-700")}
            />
          </svg>
          <span
            className={cn(
              "absolute inset-[7px] grid place-items-center rounded-full border",
              meta.medallion,
            )}
          >
            <span className="ket text-[13px] leading-none">{module.ket}</span>
          </span>
          {module.state === "mastered" && (
            <span className="absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full border border-photon/50 bg-void">
              <Check className="size-3 text-photon" />
            </span>
          )}
          {locked && (
            <span className="absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full border border-white/12 bg-void">
              <Lock className="size-2.5 text-frost/60" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-mono text-[9.5px] tracking-[0.14em] uppercase",
                meta.chip,
              )}
            >
              {meta.label}
            </span>
            <span className="font-mono text-[9.5px] tracking-[0.14em] text-frost/45 uppercase">
              {TRACK_LABEL[module.track]}
            </span>
          </div>
          <h3 className="mt-2 text-[16.5px] leading-snug font-semibold tracking-[-0.01em] text-paper">
            {module.title}
          </h3>
        </div>
      </header>

      <p className="mt-3.5 text-[13px] leading-relaxed text-frost/75">{module.summary}</p>

      <ul className="mt-3.5 flex flex-wrap gap-1.5">
        {module.concepts.map((concept) => (
          <li
            key={concept}
            className="rounded-md border border-white/8 bg-white/3 px-2 py-1 text-[11px] text-frost/70"
          >
            {concept}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-2 border-t border-white/6 pt-3.5">
        <span className="font-mono text-[9.5px] tracking-[0.14em] text-frost/40 uppercase">
          Gates
        </span>
        <span className="flex flex-wrap gap-1">
          {module.gates.map((gate) => (
            <span
              key={gate}
              className="rounded border border-photon/20 bg-photon/6 px-1.5 py-0.5 font-mono text-[10px] text-photon/85"
            >
              {gate}
            </span>
          ))}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[10.5px] text-frost/50 tabular-nums">
          {module.lessons} lessons · {module.minutes}m
        </span>
      </div>

      {/* Completion, and the reward it unlocks. */}
      <div className="mt-4 space-y-3">
        <AmplitudeBar value={module.progress} dim={locked} />

        <p className="flex items-center gap-2 text-[11.5px]">
          <Award
            className={cn(
              "size-3.5 shrink-0",
              module.progress === 100 ? "text-photon" : "text-frost/40",
            )}
          />
          <span className={module.progress === 100 ? "text-paper/90" : "text-frost/60"}>
            {module.badge}
          </span>
          <span className="ml-auto font-mono text-[9.5px] tracking-[0.14em] text-frost/40 uppercase">
            {module.progress === 100 ? "earned" : "badge"}
          </span>
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/6 pt-3.5">
        {locked ? (
          <span className="text-[11.5px] leading-snug text-frost/55">
            Suggested after{" "}
            <span className="text-frost/80">{prerequisite?.title ?? "the previous module"}</span>.
            Nothing is paywalled.
          </span>
        ) : (
          <span className="font-mono text-[10px] tracking-[0.14em] text-frost/40 uppercase">
            {module.progress === 0
              ? "not started"
              : module.progress === 100
                ? "revisit any time"
                : `${module.progress}% measured`}
          </span>
        )}

        <Link
          href={`/curriculum/${module.slug}`}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
            locked
              ? "border-white/12 text-frost/70 hover:border-photon/40 hover:text-paper"
              : "border-photon/35 bg-photon/8 text-photon hover:bg-photon/16",
          )}
        >
          {locked ? "Open anyway" : module.progress > 0 ? "Continue" : "Start"}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}
