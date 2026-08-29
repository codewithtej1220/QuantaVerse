"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";

import { GATE_BY_ID, MODULES, TRACK_LABEL, type Module, type Track } from "@/lib/data";
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
}: {
  entry: Module;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  introduced: Set<string>;
}) {
  const done = entry.state === "mastered";
  const current = entry.state === "active";
  const locked = entry.state === "locked";

  return (
    <li className="group relative">
      <Link
        href={`/curriculum/${entry.slug}`}
        className={cn(
          "grid grid-cols-[auto_2.75rem_minmax(0,1fr)] items-stretch gap-x-4 py-6",
          "sm:grid-cols-[4.5rem_2.75rem_minmax(0,1fr)_9rem] sm:gap-x-6",
          "transition-colors hover:bg-nebula",
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
            {locked ? <Lock className="size-3.5" /> : String(index + 1).padStart(2, "0")}
          </span>
          <span
            className={cn("w-px flex-1", isLast ? "bg-transparent" : done ? "bg-photon" : "bg-edge")}
          />
        </span>

        <span className="min-w-0 py-0.5">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="ket text-[13px] text-photon sm:hidden">{entry.ket}</span>
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
          </span>

          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-frost">{entry.summary}</p>

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
              {entry.lessons} lessons · {entry.minutes} min
            </span>
          </span>
        </span>

        {/* Right rail: the number, then the way in. */}
        <span className="col-start-3 mt-4 flex items-center gap-4 sm:col-start-4 sm:mt-0 sm:flex-col sm:items-end sm:justify-center sm:gap-3">
          <span className="flex items-baseline gap-1.5 sm:flex-col sm:items-end sm:gap-0">
            <span
              className={cn(
                "font-display text-[2rem] leading-none font-extrabold tabular-nums",
                done ? "text-photon" : entry.progress > 0 ? "text-paper" : "text-dim",
              )}
            >
              {entry.progress}
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
            {done ? "Revisit" : entry.progress > 0 ? "Continue" : "Start"}
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
  const shown = filter === "all" ? MODULES : MODULES.filter((m) => m.track === filter);

  return (
    <section>
      <div
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
              <span className="text-[11px] tabular-nums opacity-70">{counts[option.id]}</span>
            </button>
          );
        })}
      </div>

      <ul className="divide-y divide-edge">
        {shown.map((row, i) => (
          <ModuleRow
            key={row.slug}
            entry={row}
            index={MODULES.indexOf(row)}
            isFirst={i === 0}
            isLast={i === shown.length - 1}
            introduced={introducedBy.get(row.slug) ?? new Set()}
          />
        ))}
      </ul>
    </section>
  );
}
