"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Award, Lock } from "lucide-react";

import { MODULES } from "@/lib/data";
import type { BadgeState } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * The badges, and — the point of this file — what each one is actually for.
 *
 * A shelf of names a learner has never seen before tells them nothing. "Phase
 * Fluent" is not a goal, it is a label; the goal is the module behind it and
 * the lab at the end of that module, and until the shelf says so the locked
 * half of it is decoration. So every badge carries the condition that awards
 * it, phrased as the thing you would go and do.
 *
 * The condition is not written down anywhere by hand. A badge is awarded when
 * its module reaches 100%, and a module reaches 100% when every lesson in it is
 * passed and its lab is passed — so the sentence is generated from the module's
 * own lesson count and title, and cannot drift away from the rule the server
 * actually applies.
 *
 * The tooltip is positioned `fixed`, from the chip's own rect. Absolute
 * positioning inside a wrapping row is where this normally goes wrong: the
 * badge at the end of a line puts its tooltip through the side of the card, and
 * the fix is usually a pile of alignment variants. Measuring once on hover
 * costs less and cannot clip.
 */

const MODULE_BY_SLUG = Object.fromEntries(MODULES.map((m) => [m.slug, m]));

/** What a learner has to go and do to get this. */
function requirement(badge: BadgeState) {
  const owner = MODULE_BY_SLUG[badge.module_slug];
  if (!owner) return badge.detail;
  return `Pass all ${owner.lessons} lesson checkpoints in ${owner.title}, then pass its lab. The badge lands the moment the module reaches 100%.`;
}

interface Hover {
  badge: BadgeState;
  x: number;
  y: number;
}

export function BadgeShelf({
  badges,
  earned,
}: {
  badges: BadgeState[];
  earned: number;
}) {
  const [hover, setHover] = useState<Hover | null>(null);
  const tip = useRef<HTMLDivElement>(null);

  const show = useCallback((badge: BadgeState, node: HTMLElement) => {
    const rect = node.getBoundingClientRect();
    setHover({ badge, x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  /* A tooltip measured from a rect is wrong the moment the page moves under
     it, and a stale tooltip pointing at the wrong badge is worse than none. */
  useEffect(() => {
    if (!hover) return;
    const drop = () => setHover(null);
    window.addEventListener("scroll", drop, { passive: true });
    window.addEventListener("resize", drop);
    return () => {
      window.removeEventListener("scroll", drop);
      window.removeEventListener("resize", drop);
    };
  }, [hover]);

  /* Keep it on screen. Measured after paint, because the width depends on the
     text and the text depends on which badge is hovered. */
  const [shift, setShift] = useState(0);
  useEffect(() => {
    if (!hover || !tip.current) {
      setShift(0);
      return;
    }
    const rect = tip.current.getBoundingClientRect();
    const margin = 12;
    if (rect.left < margin) setShift(margin - rect.left);
    else if (rect.right > window.innerWidth - margin)
      setShift(window.innerWidth - margin - rect.right);
    else setShift(0);
  }, [hover]);

  return (
    <div className="panel rounded-2xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="eyebrow">Badges</p>
        <p className="font-mono text-[12px] text-frost tabular-nums">
          <span className="text-paper">{earned}</span>
          <span className="text-dim"> / {badges.length} earned</span>
        </p>
      </div>

      <p className="mt-2 text-[13px] text-dim">
        One per module, awarded at 100%. Point at any of them for what it takes.
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {badges.map((badge) => (
          <li key={badge.id}>
            <button
              type="button"
              aria-describedby={
                hover?.badge.id === badge.id ? "badge-tip" : undefined
              }
              onMouseEnter={(e) => show(badge, e.currentTarget)}
              onMouseLeave={() => setHover(null)}
              onFocus={(e) => show(badge, e.currentTarget)}
              onBlur={() => setHover(null)}
              className={cn(
                "flex cursor-help items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                badge.earned
                  ? "border-filament/55 bg-filament/10 text-filament hover:border-filament"
                  : "border-dashed border-edge-hi bg-strata/40 text-frost hover:border-paper/40 hover:text-paper",
              )}
            >
              {badge.earned ? (
                <Award className="size-4 shrink-0" aria-hidden />
              ) : (
                <Lock className="size-3.5 shrink-0 text-dim" aria-hidden />
              )}
              <span className="font-mono text-[12px] whitespace-nowrap">
                {badge.name}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {hover && (
        <div
          id="badge-tip"
          ref={tip}
          role="tooltip"
          className="pointer-events-none fixed z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-edge-hi bg-nebula p-3.5 shadow-2xl shadow-black/60"
          style={{
            left: hover.x + shift,
            top: hover.y - 12,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p
            className={cn(
              "font-mono text-[11px] tracking-[0.14em] uppercase",
              hover.badge.earned ? "text-filament" : "text-dim",
            )}
          >
            {hover.badge.earned ? "Earned" : "Locked"}
          </p>
          <p className="mt-1 text-[14px] font-medium text-paper">
            {hover.badge.name}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-frost">
            {requirement(hover.badge)}
          </p>
          {hover.badge.earned && hover.badge.earned_at && (
            <p className="mt-2 border-t border-edge pt-2 font-mono text-[11.5px] text-dim">
              {new Date(hover.badge.earned_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
