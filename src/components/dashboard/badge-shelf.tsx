import { Award, Lock } from "lucide-react";

import { BADGES, type BadgeItem } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Badges, one per module, keyed to the same basis states the curriculum uses.
 *
 * An unearned badge shows what it takes rather than hiding it, so the shelf
 * reads as a map of what is left instead of a wall of locked mystery boxes.
 */

/* Earned badges are all struck in the same copper. The per-badge tone the
   data carries is not used here: eight badges in three colours would say
   there are three kinds of achievement, and there are not — there is earned
   and there is not yet. */

export function BadgeShelf({ badges = BADGES }: { badges?: BadgeItem[] }) {
  const earned = badges.filter((badge) => badge.earned).length;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-edge pb-4">
        <div>
          <p className="eyebrow">Badges</p>
          <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em]">
            Earned by doing, not by watching
          </h2>
        </div>
        <p className="font-mono text-[11px] text-frost tabular-nums">
          <span className="text-paper">{earned}</span> of {badges.length} earned
        </p>
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {badges.map((badge) => {
          return (
            <li
              key={badge.id}
              className={cn(
                "flex gap-3.5 p-4 transition-colors",
                badge.earned ? "panel" : "panel-quiet",
              )}
            >
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center border",
                  badge.earned
                    ? "border-transparent bg-photon text-void"
                    : "border-dashed border-edge text-dim",
                )}
              >
                <span className="ket text-[11px] leading-none">{badge.ket}</span>
              </span>

              <div className="min-w-0">
                <p className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "truncate text-[13.5px] font-medium",
                      badge.earned ? "text-paper" : "text-frost",
                    )}
                  >
                    {badge.name}
                  </span>
                  {badge.earned ? (
                    <Award className="size-3.5 shrink-0 text-photon" />
                  ) : (
                    <Lock className="size-3 shrink-0 text-frost" />
                  )}
                </p>
                <p className="mt-1 text-[11.5px] leading-snug text-frost">{badge.detail}</p>
                <p className="mt-1.5 font-mono text-[11px] tracking-[0.14em] uppercase">
                  {badge.earned ? (
                    <span className="text-photon">Earned {badge.earnedOn}</span>
                  ) : (
                    <span className="text-frost">Not yet</span>
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
