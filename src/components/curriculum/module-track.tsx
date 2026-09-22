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
import { TONE, moduleTone } from "@/lib/tone";
import { ModuleByline } from "@/components/curriculum/module-byline";
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
  const tone = TONE[moduleTone(entry.slug)];

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
          done || current
            ? cn(tone.border, "hover:bg-strata/70")
            : locked
              ? "border-transparent hover:bg-strata/40"
              : "border-transparent hover:bg-strata/70",
        )}
      >
        {/* The spine. Every row's ket sits on the same axis. */}
        <span
          className={cn(
            "ket hidden self-center text-right text-[15px] tabular-nums sm:block",
            locked ? "text-dim" : tone.text,
          )}
        >
          {entry.ket}
        </span>

        {/* The wire, and this module's gate on it. */}
        <span className="flex flex-col items-center" aria-hidden>
          <span
            className={cn(
              "w-px flex-1",
              isFirst ? "bg-transparent" : done ? tone.solid : "bg-edge",
            )}
          />
          <span
            className={cn(
              "my-1 grid size-9 shrink-0 place-items-center rounded-lg font-mono text-[12px] font-semibold",
              done && cn(tone.solid, "text-void"),
              current && cn("ring-1", tone.ring, tone.soft, tone.text),
              !done && !current && "bg-strata text-dim ring-1 ring-edge",
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
              isLast ? "bg-transparent" : done ? tone.solid : "bg-edge",
            )}
          />
        </span>

        <span className="min-w-0 py-0.5">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={cn("ket text-[13px] sm:hidden", tone.text)}>
              {entry.ket}
            </span>
            <h3
              className={cn(
                "text-[1.3rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[1.45rem]",
                locked ? "text-frost" : "text-paper",
              )}
            >
              {entry.title}
            </h3>
            <span className="text-[12.5px] font-medium text-dim">
              {TRACK_LABEL[entry.track]}
            </span>
            {/* The state, said rather than implied. `percent` alone cannot
                distinguish a module you have not opened from one you cannot
                open yet, and those are very different things to a reader. */}
            <span
              className={cn(
                "pill",
                done
                  ? "text-ok"
                  : current
                    ? "text-info"
                    : locked
                      ? "text-dim"
                      : "text-frost",
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

          <ModuleByline slug={entry.slug} className="mt-2.5" />

          <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-frost">
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
                      "grid h-6 min-w-6 place-items-center rounded-md px-1.5 font-mono text-[11px] font-semibold",
                      isNew
                        ? cn("ring-1", tone.ring, tone.soft, tone.text)
                        : "bg-strata text-dim ring-1 ring-edge",
                    )}
                  >
                    {gate === "CNOT" ? "CX" : gate}
                  </span>
                );
              })}
            </span>
            <span className="text-[12.5px] text-dim tabular-nums">
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
                  "pill tabular-nums",
                  xp.earned > 0 ? "text-amber-300" : "text-dim",
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
                  "pill tabular-nums",
                  live.challenge.passed
                    ? "text-ok"
                    : live.challenge.attempts > 0
                      ? "text-warn"
                      : "text-dim",
                )}
              >
                <FlaskConical className="size-3" aria-hidden />
                {live.challenge.passed
                  ? `Lab passed · ${Math.round(live.challenge.best_score * 100)}%`
                  : live.challenge.attempts > 0
                    ? `Lab · ${live.challenge.attempts} ${
                        live.challenge.attempts === 1 ? "try" : "tries"
                      } · best ${Math.round(live.challenge.best_score * 100)}%`
                    : "Lab not attempted"}
              </span>
            )}
            {live?.badge_earned && (
              <span className={cn("pill", tone.text)}>
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
                "text-[2rem] leading-none font-bold tracking-[-0.03em] tabular-nums",
                percent > 0 ? tone.text : "text-dim",
              )}
            >
              {percent}
            </span>
            <span className="text-[12px] font-medium text-dim">per cent</span>
          </span>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors",
              done || current
                ? "border-photon bg-photon text-void group-hover:bg-photon-hi"
                : "border-edge bg-strata text-paper group-hover:border-edge-hi",
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
        className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-edge bg-nebula p-1"
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
                "flex items-baseline gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                active
                  ? "bg-strata text-paper ring-1 ring-edge-hi"
                  : "text-frost hover:text-paper",
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
      <Reveal
        as="ul"
        className="panel mt-4 divide-y divide-edge overflow-hidden rounded-2xl"
        step={85}
      >
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
