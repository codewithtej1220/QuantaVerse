"use client";

import { useMemo, useState } from "react";

import { MODULES, TRACK_LABEL, type Track } from "@/lib/data";
import { cn } from "@/lib/utils";
import { ModuleCard } from "./module-card";

/**
 * The library, filtered by track.
 *
 * Order is the prerequisite chain, so filtering never re-sorts — a filtered view
 * is a subsequence of the same |000⟩ → |111⟩ walk, and each card still names the
 * module it follows.
 */

type Filter = "all" | Track;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All modules" },
  { id: "foundations", label: TRACK_LABEL.foundations },
  { id: "algorithms", label: TRACK_LABEL.algorithms },
  { id: "hardware", label: TRACK_LABEL.hardware },
];

export function ModuleGrid() {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const map: Record<Filter, number> = {
      all: MODULES.length,
      foundations: 0,
      algorithms: 0,
      hardware: 0,
    };
    for (const entry of MODULES) map[entry.track] += 1;
    return map;
  }, []);

  const shown = filter === "all" ? MODULES : MODULES.filter((m) => m.track === filter);

  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-1.5"
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
                "flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                active
                  ? "border-photon/50 bg-photon/10 text-photon"
                  : "border-white/10 text-frost/75 hover:border-white/20 hover:bg-white/4 hover:text-paper",
              )}
            >
              {option.label}
              <span
                className={cn(
                  "font-mono text-[10px] tabular-nums",
                  active ? "text-photon/70" : "text-frost/45",
                )}
              >
                {counts[option.id]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {shown.map((module) => (
          <ModuleCard
            key={module.slug}
            module={module}
            prerequisite={MODULES[MODULES.indexOf(module) - 1]}
          />
        ))}
      </div>
    </div>
  );
}
