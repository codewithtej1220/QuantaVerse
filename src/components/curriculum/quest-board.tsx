"use client";

import Link from "next/link";
import { ArrowRight, Award, Flame, Loader2, Lock, Target, Zap } from "lucide-react";

import { MODULES } from "@/lib/data";
import { moduleXp, totalXp, useLiveProgress } from "@/lib/quest";
import { cn } from "@/lib/utils";

/**
 * The curriculum's game layer.
 *
 * Everything on it is counted from something the learner actually did — a
 * lesson marked, a graded circuit passed, a badge awarded — because the whole
 * argument for gamifying a physics course is that the points mean the physics.
 * A streak you can get by opening a tab is a streak nobody respects, so the
 * server counts days with real activity on them and this only renders it.
 *
 * Signed out, it says so and shows the course's totals instead of inventing a
 * learner. The old page did invent one: it rendered a fixture's 17-day streak
 * to every visitor, including the one who had just signed up.
 */

const TOTAL_LESSONS = MODULES.reduce((sum, module) => sum + module.lessons, 0);

function Tile({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Flame;
  value: string;
  label: string;
  tone?: "photon";
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon
        className={cn("size-4 shrink-0", tone === "photon" ? "text-photon" : "text-frost")}
        aria-hidden
      />
      <div className="min-w-0">
        <p
          className={cn(
            "font-display text-[1.5rem] leading-none font-extrabold tabular-nums",
            tone === "photon" ? "text-photon" : "text-paper",
          )}
        >
          {value}
        </p>
        <p className="mt-1 font-mono text-[11px] tracking-[0.14em] text-dim uppercase">{label}</p>
      </div>
    </div>
  );
}

export function QuestBoard() {
  const { data, ready, signedIn } = useLiveProgress();

  if (!ready) {
    return (
      <div className="panel flex items-center gap-2 rounded-2xl px-5 py-4 font-mono text-[12.5px] text-frost">
        <Loader2 className="size-3.5 animate-spin" />
        reading your record
      </div>
    );
  }

  /* Signed out: the course's own numbers, and an honest offer. No fixture. */
  if (!signedIn || !data) {
    return (
      <div className="panel flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-2xl px-5 py-4">
        <div>
          <p className="eyebrow">Nothing tracked yet</p>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-frost">
            {TOTAL_LESSONS} lessons across {MODULES.length} modules, and every one of them is
            open right now. An account is only for keeping the score — XP, badges and the
            streak are counted from circuits you pass, not lessons you open.
          </p>
        </div>
        <Link
          href="/register"
          className="flex shrink-0 items-center gap-2 bg-photon px-5 py-2.5 font-mono text-[12px] font-semibold tracking-[0.12em] text-void uppercase hover:bg-photon-hi"
        >
          start tracking
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    );
  }

  const { stats, mastery, up_next: quest } = data;
  const xp = totalXp(data.modules);
  const next = quest ? data.modules.find((row) => row.slug === quest.module_slug) : null;
  const nextXp = next ? moduleXp(next) : null;

  return (
    <div className="space-y-4">
      {/* Level and XP. The bar is the mastery percent the server computes, so
          the title above it and the fill under it cannot disagree. */}
      <div className="panel rounded-2xl px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] tracking-[0.16em] text-dim uppercase">
              level {mastery.level}
            </span>
            <span className="font-display text-[1.6rem] leading-none font-extrabold text-paper">
              {mastery.title}
            </span>
          </p>
          <p className="flex items-center gap-2 font-mono text-[12px] text-frost tabular-nums">
            <Zap className="size-3.5 text-photon" aria-hidden />
            {xp.earned.toLocaleString("en-IN")}
            <span className="text-dim">/ {xp.possible.toLocaleString("en-IN")} XP</span>
          </p>
        </div>

        <div
          className="mt-3 h-1.5 w-full overflow-hidden bg-strata"
          role="progressbar"
          aria-valuenow={mastery.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress to ${mastery.next_title ?? "the last level"}`}
        >
          <div
            className="h-full bg-photon transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(1.5, mastery.percent)}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-[11.5px] text-dim">
          {mastery.next_title
            ? `${mastery.percent}% of the way to ${mastery.next_title}`
            : "top level reached"}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-edge pt-4 sm:grid-cols-4">
          <Tile
            icon={Flame}
            value={String(stats.streak_days)}
            label={stats.streak_days === 1 ? "day streak" : "day streak"}
            tone={stats.streak_days > 0 ? "photon" : undefined}
          />
          <Tile
            icon={Target}
            value={`${stats.lessons_completed}/${stats.lessons_total}`}
            label="lessons"
          />
          <Tile
            icon={Award}
            value={`${stats.badges_earned}/${data.badges.length}`}
            label="badges"
          />
          <Tile
            icon={Zap}
            value={`${stats.challenges_passed}/${stats.challenges_total}`}
            label="circuits passed"
          />
        </dl>
      </div>

      {/* The active quest. One thing to do next, named. */}
      {quest && (
        <Link
          href={`/curriculum/${quest.module_slug}`}
          className="group panel flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-2xl border-photon px-5 py-4 transition-colors hover:bg-photon/5"
        >
          <div className="min-w-0">
            <p className="eyebrow text-photon">Current quest</p>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="ket text-[15px] text-photon">{quest.ket}</span>
              <span className="font-display text-[1.4rem] leading-tight font-extrabold text-paper">
                {quest.title}
              </span>
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12.5px] text-frost">
              <span>{quest.reason}</span>
              {nextXp && (
                <>
                  <span className="h-3 w-px bg-edge-hi" />
                  <span className="text-photon">
                    +{(nextXp.possible - nextXp.earned).toLocaleString("en-IN")} XP left in it
                  </span>
                </>
              )}
              {next && !next.badge_earned && (
                <>
                  <span className="h-3 w-px bg-edge-hi" />
                  <span>earns {next.badge}</span>
                </>
              )}
            </p>
          </div>

          <span className="flex shrink-0 items-center gap-5">
            <span className="font-display text-[3rem] leading-[0.8] font-extrabold text-photon tabular-nums">
              {quest.percent}
              <span className="text-xl">%</span>
            </span>
            <span className="inline-flex items-center gap-2 bg-photon px-5 py-2.5 font-mono text-[12px] font-semibold tracking-[0.12em] text-void uppercase">
              resume
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </span>
        </Link>
      )}

      {/* Badges as a shelf: earned ones lit, the rest as outlines you can see
          the shape of. Showing what is still to win is most of the point. */}
      {data.badges.length > 0 && (
        <div className="panel rounded-2xl px-5 py-4">
          <p className="eyebrow">Badges · {stats.badges_earned} of {data.badges.length}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.badges.map((badge) => (
              <li
                key={badge.id}
                title={badge.detail}
                className={cn(
                  "flex items-center gap-2 border px-2.5 py-1.5 font-mono text-[11.5px]",
                  badge.earned
                    ? "border-photon/60 bg-photon/10 text-photon"
                    : "border-edge text-dim",
                )}
              >
                {badge.earned ? (
                  <Award className="size-3.5 shrink-0" aria-hidden />
                ) : (
                  <Lock className="size-3 shrink-0" aria-hidden />
                )}
                {badge.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
