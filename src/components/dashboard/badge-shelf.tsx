import { Award, Lock } from "lucide-react";

import { BADGES, MODULES, type BadgeItem } from "@/lib/data";
import { TONE, moduleTone } from "@/lib/tone";
import { cn } from "@/lib/utils";

/* A badge belongs to the module whose ket it carries. */
const SLUG_BY_KET = Object.fromEntries(MODULES.map((m) => [m.ket, m.slug]));

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
        <p className="pill text-[12.5px] text-amber-300 tabular-nums">
          <Award className="size-3" aria-hidden />
          {earned} of {badges.length} earned
        </p>
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {badges.map((badge) => {
          const tone = TONE[moduleTone(SLUG_BY_KET[badge.ket] ?? "")];
          return (
            <li
              key={badge.id}
              className={cn(
                "flex gap-3.5 rounded-2xl p-4 transition-colors",
                badge.earned ? "panel" : "panel-quiet",
              )}
            >
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-xl border",
                  badge.earned
                    ? cn("border-transparent text-void", tone.solid)
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
                    <Award className="size-3.5 shrink-0 text-amber-300" />
                  ) : (
                    <Lock className="size-3 shrink-0 text-frost" />
                  )}
                </p>
                <p className="mt-1 text-[12.5px] leading-snug text-frost">{badge.detail}</p>
                <p className="mt-2">
                  {badge.earned ? (
                    <span className="pill text-ok">Earned {badge.earnedOn}</span>
                  ) : (
                    <span className="pill text-dim">Not yet</span>
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
