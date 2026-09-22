"use client";

import { Award } from "lucide-react";

import { useModuleProgress } from "@/components/curriculum/use-module-progress";
import { TONE, moduleTone } from "@/lib/tone";
import { cn } from "@/lib/utils";

interface ModuleRailProps {
  slug: string;
  fallbackProgress: number;
  fallbackBadge: string;
}

export function ModuleRail({
  slug,
  fallbackProgress,
  fallbackBadge,
}: ModuleRailProps) {
  const { entry } = useModuleProgress(slug);

  const percent = entry ? entry.percent : fallbackProgress;
  const badge = entry ? entry.badge : fallbackBadge;
  const earned = entry ? entry.badge_earned : fallbackProgress === 100;
  const tone = TONE[moduleTone(slug)];

  return (
    <div className="panel rounded-2xl p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Completion</p>
        <p
          className={cn(
            "text-[20px] leading-none font-semibold tabular-nums",
            percent > 0 ? tone.text : "text-dim",
          )}
        >
          {percent}%
        </p>
      </div>
      <span
        className="mt-3 block h-2 overflow-hidden rounded-full bg-strata"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Module completion"
      >
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-700",
            tone.solid,
          )}
          style={{ width: `${percent}%` }}
        />
      </span>
      <p className="mt-4 flex items-center gap-2 border-t border-edge pt-4 text-[13px]">
        <Award
          className={cn(
            "size-4 shrink-0",
            earned ? "text-amber-300" : "text-dim",
          )}
        />
        <span className={earned ? "font-medium text-paper" : "text-frost"}>
          {badge}
        </span>
        <span className={cn("pill ml-auto", earned ? "text-ok" : "text-dim")}>
          {earned ? "Earned" : "On completion"}
        </span>
      </p>
      {entry && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-frost">
          {entry.lessons_completed}/{entry.lessons} lessons
          {entry.challenge
            ? entry.challenge.passed
              ? " · lab passed"
              : " · lab not passed yet"
            : ""}
        </p>
      )}
    </div>
  );
}
