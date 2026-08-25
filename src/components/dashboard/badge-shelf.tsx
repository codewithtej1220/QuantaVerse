import { Award, Lock } from "lucide-react";

import { BADGES } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Badges, one per module, keyed to the same basis states the curriculum uses.
 *
 * An unearned badge shows what it takes rather than hiding it, so the shelf
 * reads as a map of what is left instead of a wall of locked mystery boxes.
 */

const TONE = {
  photon: {
    ring: "border-photon/45 bg-photon/10 text-photon",
    glow: "shadow-[0_0_28px_-10px_rgba(56,232,255,0.9)]",
  },
  phase: {
    ring: "border-phase/50 bg-phase/12 text-phase",
    glow: "shadow-[0_0_28px_-10px_rgba(177,78,255,0.9)]",
  },
  collapse: {
    ring: "border-collapse/45 bg-collapse/10 text-collapse",
    glow: "shadow-[0_0_28px_-10px_rgba(255,77,157,0.9)]",
  },
} as const;

export function BadgeShelf() {
  const earned = BADGES.filter((badge) => badge.earned).length;

  return (
    <section className="glass rounded-2xl p-5 lg:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <p className="eyebrow">Badges</p>
          <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em]">
            Earned by doing, not by watching
          </h2>
        </div>
        <p className="font-mono text-[11px] text-frost/60 tabular-nums">
          <span className="text-paper">{earned}</span> of {BADGES.length} earned
        </p>
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {BADGES.map((badge) => {
          const tone = TONE[badge.tone];
          return (
            <li
              key={badge.id}
              className={cn(
                "flex gap-3.5 rounded-xl border p-3.5 transition-colors",
                badge.earned
                  ? "border-white/10 bg-white/4"
                  : "border-dashed border-white/8 bg-white/2",
              )}
            >
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-xl border",
                  badge.earned
                    ? cn(tone.ring, tone.glow)
                    : "border-white/10 bg-white/3 text-frost/40",
                )}
              >
                <span className="ket text-[11px] leading-none">{badge.ket}</span>
              </span>

              <div className="min-w-0">
                <p className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "truncate text-[13.5px] font-medium",
                      badge.earned ? "text-paper" : "text-frost/60",
                    )}
                  >
                    {badge.name}
                  </span>
                  {badge.earned ? (
                    <Award className="size-3.5 shrink-0 text-photon" />
                  ) : (
                    <Lock className="size-3 shrink-0 text-frost/35" />
                  )}
                </p>
                <p className="mt-1 text-[11.5px] leading-snug text-frost/60">{badge.detail}</p>
                <p className="mt-1.5 font-mono text-[9.5px] tracking-[0.14em] uppercase">
                  {badge.earned ? (
                    <span className="text-photon/70">Earned {badge.earnedOn}</span>
                  ) : (
                    <span className="text-frost/35">Not yet</span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
