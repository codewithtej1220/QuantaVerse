"use client";

import Link from "next/link";
import {
  ArrowRight,
  Award,
  Flame,
  Loader2,
  Target,
  Zap,
} from "lucide-react";

import { MODULES } from "@/lib/data";
import { BadgeShelf } from "@/components/curriculum/badge-shelf";
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

const TONES = {
  filament: {
    icon: "text-filament",
    value: "text-filament",
    ring: "border-filament/35",
  },
  photon: {
    icon: "text-photon",
    value: "text-photon",
    ring: "border-photon/35",
  },
  quiet: { icon: "text-frost", value: "text-paper", ring: "border-edge" },
} as const;

/**
 * One counted thing.
 *
 * These used to be four icon-and-number pairs in a row on the same ground,
 * separated by grid gap alone — so four unrelated measurements read as one
 * run-on line and the eye had to parse the labels to find the boundaries.
 * Each one now stands in its own well with its own accent, which is the
 * difference between a row of numbers and four facts.
 */
function Tile({
  icon: Icon,
  value,
  label,
  tone = "quiet",
}: {
  icon: typeof Flame;
  value: string;
  label: string;
  tone?: keyof typeof TONES;
}) {
  const t = TONES[tone];
  return (
    <div className={cn("rounded-xl border bg-strata/45 px-3.5 py-3", t.ring)}>
      <Icon className={cn("size-4 shrink-0", t.icon)} aria-hidden />
      <p
        className={cn(
          "mt-2.5 font-display text-[1.55rem] leading-none font-extrabold tabular-nums",
          t.value,
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 font-mono text-[10.5px] tracking-[0.14em] text-dim uppercase">
        {label}
      </p>
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
            {TOTAL_LESSONS} lessons across {MODULES.length} modules, and every
            one of them is open right now. An account is only for keeping the
            score — XP, badges and the streak are counted from circuits you
            pass, not lessons you open.
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
  const next = quest
    ? data.modules.find((row) => row.slug === quest.module_slug)
    : null;
  const nextXp = next ? moduleXp(next) : null;

  return (
    <div className="space-y-4">
      {/* Level and XP. The bar is the mastery percent the server computes, so
          the title above it and the fill under it cannot disagree. */}
      <div className="panel rounded-2xl px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          {/* The level was a line of small grey mono next to the title, which
              made the one number the whole panel is named after the least
              visible thing on it. It is a numeral in a chip now. */}
          <p className="flex items-center gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-photon/45 bg-photon/10 font-display text-[1.4rem] leading-none font-extrabold text-photon tabular-nums">
              {mastery.level}
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">
                Level {mastery.level}
              </span>
              <span className="mt-0.5 block font-display text-[1.5rem] leading-none font-extrabold text-paper">
                {mastery.title}
              </span>
            </span>
          </p>
          <p className="flex items-center gap-2 font-mono text-[12px] text-frost tabular-nums">
            <Zap className="size-3.5 text-photon" aria-hidden />
            {xp.earned.toLocaleString("en-IN")}
            <span className="text-dim">
              / {xp.possible.toLocaleString("en-IN")} XP
            </span>
          </p>
        </div>

        <div
          className="mt-5 h-2.5 w-full overflow-hidden rounded-full border border-edge bg-void"
          role="progressbar"
          aria-valuenow={mastery.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress to ${mastery.next_title ?? "the last level"}`}
        >
          <div
            className="h-full rounded-full bg-photon transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(1.5, mastery.percent)}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-[11.5px] text-dim">
          {mastery.next_title
            ? `${mastery.percent}% of the way to ${mastery.next_title}`
            : "top level reached"}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            icon={Flame}
            value={String(stats.streak_days)}
            label={stats.streak_days === 1 ? "day streak" : "day streak"}
            tone={stats.streak_days > 0 ? "filament" : "quiet"}
          />
          <Tile
            icon={Target}
            value={`${stats.lessons_completed}/${stats.lessons_total}`}
            label="lessons"
            tone={stats.lessons_completed > 0 ? "photon" : "quiet"}
          />
          <Tile
            icon={Award}
            value={`${stats.badges_earned}/${data.badges.length}`}
            label="badges"
            tone={stats.badges_earned > 0 ? "filament" : "quiet"}
          />
          <Tile
            icon={Zap}
            value={`${stats.challenges_passed}/${stats.challenges_total}`}
            label="circuits passed"
            tone={stats.challenges_passed > 0 ? "photon" : "quiet"}
          />
        </dl>
      </div>

      {/* The active quest. One thing to do next, named. */}
      {quest && (
        <Link
          href={`/curriculum/${quest.module_slug}`}
          className="group relative flex flex-wrap items-center justify-between gap-x-8 gap-y-5 overflow-hidden rounded-2xl border border-photon/70 bg-gradient-to-br from-photon/[0.14] via-nebula to-nebula px-6 py-6 transition-colors hover:from-photon/20"
        >
          <div className="min-w-0">
            <p className="eyebrow flex items-center gap-2 text-photon">
              <Target className="size-3.5" aria-hidden />
              Current quest
            </p>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="ket text-[15px] text-photon">{quest.ket}</span>
              <span className="font-display text-[1.75rem] leading-tight font-extrabold text-paper">
                {quest.title}
              </span>
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12.5px] text-frost">
              <span>{quest.reason}</span>
              {nextXp && (
                <>
                  <span className="h-3 w-px bg-edge-hi" />
                  <span className="text-photon">
                    +{(nextXp.possible - nextXp.earned).toLocaleString("en-IN")}{" "}
                    XP left in it
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

      {data.badges.length > 0 && (
        <BadgeShelf badges={data.badges} earned={stats.badges_earned} />
      )}
    </div>
  );
}
