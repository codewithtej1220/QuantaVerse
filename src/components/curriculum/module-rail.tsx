"use client";

import { Award } from "lucide-react";

import { useModuleProgress } from "@/components/curriculum/use-module-progress";
import { AmplitudeBar } from "@/components/site/amplitude-bar";
import { cn } from "@/lib/utils";

interface ModuleRailProps {
  slug: string;
  fallbackProgress: number;
  fallbackBadge: string;
}

export function ModuleRail({ slug, fallbackProgress, fallbackBadge }: ModuleRailProps) {
  const { entry } = useModuleProgress(slug);

  const percent = entry ? entry.percent : fallbackProgress;
  const badge = entry ? entry.badge : fallbackBadge;
  const earned = entry ? entry.badge_earned : fallbackProgress === 100;

  return (
    <div className="panel rounded-2xl p-5">
      <AmplitudeBar value={percent} />
      <p className="mt-4 flex items-center gap-2 border-t border-edge pt-4 text-[12.5px]">
        <Award className={cn("size-4 shrink-0", earned ? "text-photon" : "text-frost")} />
        <span className={earned ? "text-paper" : "text-frost"}>{badge}</span>
        <span className="ml-auto font-mono text-[11px] tracking-[0.14em] text-frost uppercase">
          {earned ? "earned" : "on completion"}
        </span>
      </p>
      {entry && (
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-frost">
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
