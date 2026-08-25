"use client";

import { useState } from "react";

import { axisPoint, radarPoints } from "@/lib/geometry";
import { SKILLS, type Skill } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * The skill graph.
 *
 * Eight axes, one per topic, drawn by hand in SVG so the shape uses the site's
 * own tokens instead of a charting library's defaults. The dashed polygon behind
 * the learner's is the cohort median — a shape only means something next to
 * another shape.
 */

const R = 128;
const RINGS = [0.25, 0.5, 0.75, 1];
export function SkillGraph({ skills = SKILLS }: { skills?: Skill[] }) {
  const [active, setActive] = useState<number | null>(null);
  const COUNT = skills.length;
  const skill = active === null ? null : skills[active];

  return (
    <div className="glass rounded-2xl p-5 lg:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <p className="eyebrow">Skill graph</p>
          <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em]">
            Eight axes, measured weekly
          </h2>
        </div>
        <p className="flex items-center gap-4 font-mono text-[10px] tracking-[0.12em] uppercase">
          <span className="flex items-center gap-1.5 text-photon/85">
            <span className="h-2 w-3 rounded-sm bg-photon/35 ring-1 ring-photon" />
            you
          </span>
          <span className="flex items-center gap-1.5 text-frost/55">
            <span className="h-2 w-3 rounded-sm border border-dashed border-frost/50" />
            cohort median
          </span>
        </p>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,220px)] lg:items-center">
        <div className="relative mx-auto w-full max-w-[420px]">
          <svg viewBox="-165 -165 330 330" className="w-full" role="img" aria-label="Skill graph">
            {/* Rings, labelled like a probability axis. */}
            {RINGS.map((ring) => (
              <circle
                key={ring}
                r={R * ring}
                fill="none"
                stroke="#8fb0ff"
                strokeOpacity={ring === 1 ? 0.22 : 0.09}
              />
            ))}

            {/* Axes. */}
            {skills.map((s, i) => {
              const outer = axisPoint(i, COUNT, R);
              const label = axisPoint(i, COUNT, R + 26);
              return (
                <g key={s.short}>
                  <line
                    x1="0"
                    y1="0"
                    x2={outer.x}
                    y2={outer.y}
                    stroke="#8fb0ff"
                    strokeOpacity={active === i ? 0.5 : 0.12}
                  />
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={cn(
                      "font-mono text-[10px] transition-colors",
                      active === i ? "fill-photon" : "fill-[#afc0e8]/60",
                    )}
                  >
                    {s.short}
                  </text>
                </g>
              );
            })}

            {/* Cohort median, behind. */}
            <polygon
              points={radarPoints(
                skills.map((s) => s.cohort),
                R,
              )}
              fill="none"
              stroke="#afc0e8"
              strokeOpacity="0.45"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />

            {/* The learner. */}
            <polygon
              points={radarPoints(
                skills.map((s) => s.value),
                R,
              )}
              fill="#38e8ff"
              fillOpacity="0.16"
              stroke="#38e8ff"
              strokeWidth="2"
              strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 0 14px rgba(56,232,255,0.45))" }}
            />

            {/* Vertices double as hit targets. */}
            {skills.map((s, i) => {
              const point = axisPoint(i, COUNT, (s.value / 100) * R);
              const hit = axisPoint(i, COUNT, R + 12);
              return (
                <g key={`${s.short}-point`}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={active === i ? 5 : 3.5}
                    fill="#38e8ff"
                    className="transition-[r]"
                  />
                  <circle
                    cx={hit.x}
                    cy={hit.y}
                    r="26"
                    fill="transparent"
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive((value) => (value === i ? null : value))}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Read-out: hovering an axis fills this in, otherwise it lists the extremes. */}
        <div className="min-w-0">
          {skill ? (
            <div>
              <p className="eyebrow">{skill.short}</p>
              <p className="mt-1.5 text-[15px] font-medium text-paper">{skill.label}</p>
              <p className="mt-3 font-mono text-[34px] leading-none text-photon tabular-nums">
                {skill.value}
                <span className="text-[15px] text-frost/45">/100</span>
              </p>
              <p className="mt-2 font-mono text-[11.5px] text-frost/60">
                cohort median {skill.cohort} ·{" "}
                <span className={skill.value >= skill.cohort ? "text-photon/85" : "text-collapse/85"}>
                  {skill.value >= skill.cohort ? "+" : ""}
                  {skill.value - skill.cohort}
                </span>
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {[...skills]
                .sort((a, b) => b.value - a.value)
                .slice(0, 4)
                .map((s) => (
                  <li key={s.short} className="flex items-baseline gap-3">
                    <span className="font-mono text-[10px] text-frost/40">{s.short}</span>
                    <span className="flex-1 truncate text-[13px] text-frost/75">{s.label}</span>
                    <span className="font-mono text-[13px] text-paper tabular-nums">
                      {s.value}
                    </span>
                  </li>
                ))}
              <li className="border-t border-white/8 pt-2.5 text-[12px] leading-relaxed text-frost/55">
                Hover an axis for the cohort comparison. Weakest axis:{" "}
                <span className="text-frost/80">
                  {[...skills].sort((a, b) => a.value - b.value)[0].label}
                </span>
                .
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
