"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Award, FlaskConical, Lock, Zap } from "lucide-react";

import {
  GATE_BY_ID,
  MODULES,
  TRACK_LABEL,
  type Module,
  type Track,
} from "@/lib/data";
import type { ModuleProgress } from "@/lib/auth";
import { bySlug, moduleXp, useLiveProgress } from "@/lib/quest";
import { Reveal } from "@/components/site/reveal";
import { cn } from "@/lib/utils";

/**
 * The curriculum as the thing it actually is: one wire with gates on it.
 *
 * A card grid says these are eight parallel items you may pick between. They
 * are not — they are a prerequisite chain, and the chain is the pedagogy. So
 * the page draws it the way the subject draws a sequence of operations: a wire
 * running top to bottom with a gate box at each step, solid where you have been
 * and hairline where you have not.
 *
 * The ket column is the alignment spine. Every row hangs off it, which is most
 * of why the list reads as engineered rather than assembled.
 */

type Filter = "all" | Track;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "foundations", label: TRACK_LABEL.foundations },
  { id: "algorithms", label: TRACK_LABEL.algorithms },
  { id: "hardware", label: TRACK_LABEL.hardware },
];

/**
 * Which gates each module is the first to use.
 *
 * Worth drawing: a learner opening module six wants to know what is new in it,
 * not to re-read the four gates they have had since module one. Computed over
 * the real order, so it stays true if the curriculum is reordered.
 */
function newGatesByModule() {
  const seen = new Set<string>();
  const fresh = new Map<string, Set<string>>();
  for (const entry of MODULES) {
    const introduced = new Set<string>();
    for (const gate of entry.gates) {
      if (!seen.has(gate)) {
        seen.add(gate);
        introduced.add(gate);
      }
    }
    fresh.set(entry.slug, introduced);
  }
  return fresh;
}

function gateTitle(gate: string) {
  const known = GATE_BY_ID[gate.toLowerCase()];
  if (known) return known.name;
  if (gate === "CNOT") return "Controlled NOT";
  if (gate === "RZ") return "Z rotation";
  return gate;
}

function ModuleRow({
  entry,
  index,
  isFirst,
  isLast,
  introduced,
  live,
}: {
  entry: Module;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  introduced: Set<string>;
  /** The account's own row for this module, when there is an account. */
  live?: ModuleProgress;
}) {
  /* The record wins wherever there is one. `data.ts` carries an example
     learner so the signed-out page has something to show; rendering that
     example's "mastered" tick to someone who has done none of it is the bug
     this replaces. */
  const state = live?.state ?? entry.state;
  const done = state === "mastered";
  const current = state === "active";
  const locked = state === "locked";
  const xp = live ? moduleXp(live) : null;
  const percent = live?.percent ?? entry.progress;

  return (
    <li className="group relative">
      <Link
        href={`/curriculum/${entry.slug}`}
        className={cn(
          "grid grid-cols-[auto_2.75rem_minmax(0,1fr)] items-stretch gap-x-4 py-6 pr-4 pl-3",
          "sm:grid-cols-[4.5rem_2.75rem_minmax(0,1fr)_9rem] sm:gap-x-6 sm:pl-4",
          "border-l-[3px] transition-colors",
          /* Eight rows of the same weight separated by one hairline is a list
             you have to read to navigate. The accent and the wash say which
             state a row is in before any of its words do — and they are the
             only thing on the row that differs by state, so they cannot
             disagree with the number on the right. */
          done
            ? "border-photon/70 bg-photon/[0.045] hover:bg-photon/[0.09]"
            : current
              ? "border-paper bg-paper/[0.05] hover:bg-paper/[0.08]"
              : locked
                ? "border-edge hover:bg-nebula/60"
                : "border-edge-hi hover:bg-nebula",
        )}
      >
        {/* The spine. Every row's ket sits on the same axis. */}
        <span
          className={cn(
            "ket hidden self-center text-right text-[15px] tabular-nums sm:block",
            done ? "text-photon" : current ? "text-paper" : "text-dim",
          )}
        >
          {entry.ket}
        </span>

        {/* The wire, and this module's gate on it. */}
        <span className="flex flex-col items-center" aria-hidden>
          <span
            className={cn(
              "w-px flex-1",
              isFirst ? "bg-transparent" : done ? "bg-photon" : "bg-edge",
            )}
          />
          <span
            className={cn(
              "my-1 grid size-9 shrink-0 place-items-center border font-mono text-[12px] font-semibold",
              done && "border-photon bg-photon text-void",
              current && "border-paper text-paper",
              !done && !current && "border-edge-hi text-dim",
            )}
          >
            {locked ? (
              <Lock className="size-3.5" />
            ) : (
              String(index + 1).padStart(2, "0")
            )}
          </span>
          <span
            className={cn(
              "w-px flex-1",
              isLast ? "bg-transparent" : done ? "bg-photon" : "bg-edge",
            )}
          />
        </span>

        <span className="min-w-0 py-0.5">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="ket text-[13px] text-photon sm:hidden">
              {entry.ket}
            </span>
            <h3
              className={cn(
                "font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.025em] sm:text-[1.55rem]",
                locked ? "text-frost" : "text-paper",
              )}
            >
              {entry.title}
            </h3>
            <span className="font-mono text-[11px] tracking-[0.16em] text-dim uppercase">
              {TRACK_LABEL[entry.track]}
            </span>
            {/* The state, said rather than implied. `percent` alone cannot
                distinguish a module you have not opened from one you cannot
                open yet, and those are very different things to a reader. */}
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-[0.14em] uppercase",
                done
                  ? "border-photon/50 bg-photon/10 text-photon"
                  : current
                    ? "border-paper/40 bg-paper/10 text-paper"
                    : locked
                      ? "border-edge text-dim"
                      : "border-edge-hi text-frost",
              )}
            >
              {done
                ? "Mastered"
                : current
                  ? "In progress"
                  : locked
                    ? "Locked"
                    : "Open"}
            </span>
          </span>

          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-frost">
            {entry.summary}
          </p>

          <span className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex flex-wrap items-center gap-1">
              {entry.gates.map((gate) => {
                const isNew = introduced.has(gate);
                return (
                  <span
                    key={gate}
                    title={`${gateTitle(gate)}${isNew ? " — introduced here" : " — carried forward"}`}
                    className={cn(
                      "grid h-6 min-w-6 place-items-center px-1.5 font-mono text-[11px] font-medium",
                      isNew
                        ? "border border-photon text-photon"
                        : "border border-edge text-dim",
                    )}
                  >
                    {gate === "CNOT" ? "CX" : gate}
                  </span>
                );
              })}
            </span>
            <span className="font-mono text-[11.5px] text-dim tabular-nums">
              {live
                ? `${live.lessons_completed}/${live.lessons}`
                : entry.lessons}{" "}
              lessons · {entry.minutes} min
            </span>
            {/* What the module is worth, and what has been banked of it. Shown
                only to an account, because to anyone else it is a number about
                somebody who does not exist. */}
            {xp && (
              <span
                className={cn(
                  "flex items-center gap-1.5 font-mono text-[11.5px] tabular-nums",
                  xp.earned > 0 ? "text-photon" : "text-dim",
                )}
              >
                <Zap className="size-3" aria-hidden />
                {xp.earned}/{xp.possible} XP
              </span>
            )}
            {/* The graded lab. A module's reading is self-reported — you tick a
                lesson when you say you have read it — and this is the one line
                on the row that is not: the score is a fidelity the simulator
                measured against the target state, so it is the only number here
                the learner cannot simply assert. */}
            {live?.challenge && (
              <span
                className={cn(
                  "flex items-center gap-1.5 font-mono text-[11.5px] tabular-nums",
                  live.challenge.passed
                    ? "text-photon"
                    : live.challenge.attempts > 0
                      ? "text-frost"
                      : "text-dim",
                )}
              >
                <FlaskConical className="size-3" aria-hidden />
                {live.challenge.passed
                  ? `lab passed · ${Math.round(live.challenge.best_score * 100)}%`
                  : live.challenge.attempts > 0
                    ? `lab · ${live.challenge.attempts} ${
                        live.challenge.attempts === 1 ? "try" : "tries"
                      } · best ${Math.round(live.challenge.best_score * 100)}%`
                    : "lab not attempted"}
              </span>
            )}
            {live?.badge_earned && (
              <span className="flex items-center gap-1.5 font-mono text-[11.5px] text-photon">
                <Award className="size-3" aria-hidden />
                {live.badge}
              </span>
            )}
          </span>
        </span>

        {/* Right rail: the number, then the way in. */}
        <span className="col-start-3 mt-4 flex items-center gap-4 sm:col-start-4 sm:mt-0 sm:flex-col sm:items-end sm:justify-center sm:gap-3">
          <span className="flex items-baseline gap-1.5 sm:flex-col sm:items-end sm:gap-0">
            <span
              className={cn(
                "font-display text-[2rem] leading-none font-extrabold tabular-nums",
                done ? "text-photon" : percent > 0 ? "text-paper" : "text-dim",
              )}
            >
              {percent}
            </span>
            <span className="font-mono text-[11px] tracking-[0.14em] text-dim uppercase">
              per cent
            </span>
          </span>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[11px] tracking-[0.12em] uppercase transition-colors",
              done || current
                ? "border-photon text-photon group-hover:bg-photon group-hover:text-void"
                : "border-edge text-frost group-hover:border-photon group-hover:text-photon",
            )}
          >
            {done ? "Revisit" : percent > 0 ? "Continue" : "Start"}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </span>
      </Link>
    </li>
  );
}

export function ModuleTrack() {
  const [filter, setFilter] = useState<Filter>("all");
  const introducedBy = useMemo(() => newGatesByModule(), []);
  const { data } = useLiveProgress();
  const live = useMemo(() => (data ? bySlug(data.modules) : null), [data]);

  const counts = useMemo(() => {
    const map: Record<Filter, number> = {
      all: MODULES.length,
      foundations: 0,
      algorithms: 0,
      hardware: 0,
    };
    for (const row of MODULES) map[row.track] += 1;
    return map;
  }, []);

  // Filtering never re-sorts: a filtered view is a subsequence of the same walk.
  const shown =
    filter === "all" ? MODULES : MODULES.filter((m) => m.track === filter);

  return (
    <section>
      <div
        data-tour="curriculum-modules"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-edge pb-4"
        role="group"
        aria-label="Filter modules by track"
      >
        {FILTERS.map((option) => {
          const active = filter === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              aria-pressed={active}
              className={cn(
                "flex items-baseline gap-2 border-b-2 pb-1 font-mono text-[12px] tracking-[0.14em] uppercase transition-colors",
                active
                  ? "border-photon text-photon"
                  : "border-transparent text-dim hover:text-paper",
              )}
            >
              {option.label}
              <span className="text-[11px] tabular-nums opacity-70">
                {counts[option.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* The eight modules arrive in order as the list is reached, which is
          the order they are meant to be read in. */}
      <Reveal as="ul" className="divide-y divide-edge" step={85}>
        {shown.map((row, i) => (
          <ModuleRow
            key={row.slug}
            entry={row}
            index={MODULES.indexOf(row)}
            isFirst={i === 0}
            isLast={i === shown.length - 1}
            introduced={introducedBy.get(row.slug) ?? new Set()}
            live={live?.get(row.slug)}
          />
        ))}
      </Reveal>
    </section>
  );
}
