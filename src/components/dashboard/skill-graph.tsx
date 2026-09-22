"use client";

import { SKILLS, type Skill } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Proficiency, ranked, against the cohort.
 *
 * This was a radar chart, and a radar chart is the wrong instrument for the
 * two questions actually being asked of it. Its area depends on the order the
 * axes happen to be listed in, so the shape carries no meaning; and "am I above
 * the median on algorithms?" means comparing two overlapping polygons at a
 * vertex, which is genuinely hard to do by eye.
 *
 * One row per topic, sorted strongest first, with the cohort median as a tick
 * on the same track: the comparison is now a single horizontal distance, and
 * "where am I weakest" is just the bottom of the list. It also scales — a radar
 * with sixteen axes is unreadable, a list of sixteen rows is a list.
 */
export function SkillGraph({ skills = SKILLS }: { skills?: Skill[] }) {
  const ranked = [...skills].sort((a, b) => b.value - a.value);
  const ahead = skills.filter((s) => s.value >= s.cohort).length;

  return (
    <section aria-labelledby="skills-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-edge pb-4">
        <div>
          <p className="eyebrow">Proficiency</p>
          <h2 id="skills-heading" className="display-3 mt-2 text-paper">
            Eight topics, ranked
          </h2>
        </div>
        <p className="pill text-[12.5px] text-ok tabular-nums">
          {ahead} of {skills.length} at or above the cohort median
        </p>
      </div>

      <ul>
        {ranked.map((skill) => {
          const delta = skill.value - skill.cohort;
          const leading = delta >= 0;
          return (
            <li
              key={skill.short}
              className="grid grid-cols-[3rem_minmax(0,1fr)_3.5rem] items-center gap-x-4 border-b border-edge py-3.5 sm:grid-cols-[3rem_11rem_minmax(0,1fr)_3.5rem_4rem] sm:gap-x-6"
            >
              <span className="font-mono text-[12px] font-semibold text-dim">{skill.short}</span>
              <span className="col-start-2 truncate text-[14px] text-paper sm:col-start-2">
                {skill.label}
              </span>

              {/* The bar and the median share one track, so the comparison is a
                  distance rather than an act of memory. */}
              <span className="col-span-3 col-start-1 mt-2 sm:col-span-1 sm:col-start-3 sm:mt-0">
                <span className="relative block h-2 rounded-full bg-strata">
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      leading ? "bg-emerald-400" : "bg-amber-400",
                    )}
                    style={{ width: `${skill.value}%` }}
                  />
                  <span
                    className="absolute inset-y-[-3px] w-px bg-paper"
                    style={{ left: `${skill.cohort}%` }}
                    title={`cohort median ${skill.cohort}`}
                  />
                </span>
              </span>

              <span className="col-start-3 text-right text-[15px] font-semibold text-paper tabular-nums sm:col-start-4">
                {skill.value}
              </span>
              <span
                className={cn(
                  "col-start-3 hidden text-right text-[13px] font-semibold tabular-nums sm:col-start-5 sm:block",
                  leading ? "text-ok" : "text-warn",
                )}
              >
                {leading ? "+" : ""}
                {delta}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-dim">
        <span className="flex items-center gap-2">
          <span className="h-2 w-6 rounded-full bg-emerald-400" />
          You, above the median
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-6 rounded-full bg-amber-400" />
          You, below it
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-px bg-paper" />
          Cohort median
        </span>
      </p>
    </section>
  );
}
