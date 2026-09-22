"use client";

import Link from "next/link";
import { ArrowRight, Award, Flame, Loader2, Target, Zap } from "lucide-react";

import { MODULES } from "@/lib/data";
import { BadgeShelf } from "@/components/curriculum/badge-shelf";
import { moduleXp, totalXp, useLiveProgress } from "@/lib/quest";
import { TONE, moduleTone, type Tone } from "@/lib/tone";
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
  tone,
  lit,
}: {
  icon: typeof Flame;
  value: string;
  label: string;
  tone: Tone;
  /** Nothing counted yet: the tile keeps its colour for the icon only. */
  lit: boolean;
}) {
  const t = TONE[tone];
  return (
    <div className="rounded-xl border border-edge bg-strata/60 px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-medium text-frost">{label}</p>
        <span
          className={cn(
            "grid size-7 place-items-center rounded-lg",
            t.soft,
            t.text,
          )}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden />
        </span>
      </div>
      <p
        className={cn(
          "mt-2 text-[1.7rem] leading-none font-semibold tabular-nums",
          lit ? t.text : "text-paper",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function QuestBoard() {
  const { data, ready, signedIn } = useLiveProgress();

  /* The tour points at the deck by its heading-sized first thing — the level,
     or the line saying nothing is tracked — rather than the whole deck. The
     deck is as wide as the page, and a cat parked inside the end of it sat on
     top of the "start tracking" button. */
  if (!ready) {
    return (
      <div
        data-tour="curriculum-deck"
        className="panel flex items-center gap-2 rounded-2xl px-5 py-4 text-[13px] text-frost"
      >
        <Loader2 className="size-3.5 animate-spin" />
        reading your record
      </div>
    );
  }

  /* Signed out: the course's own numbers, and an honest offer. No fixture. */
  if (!signedIn || !data) {
    return (
      <div className="panel flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-2xl px-5 py-4">
        <div data-tour="curriculum-deck">
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
          className="flex shrink-0 items-center gap-2 rounded-lg bg-photon px-5 py-2.5 text-[13.5px] font-semibold text-void hover:bg-photon-hi"
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
  const questTone = TONE[moduleTone(quest?.module_slug ?? "")];

  return (
    <div className="space-y-4">
      {/* Level and XP. The bar is the mastery percent the server computes, so
          the title above it and the fill under it cannot disagree. */}
      <div className="panel rounded-2xl px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          {/* The level was a line of small grey mono next to the title, which
              made the one number the whole panel is named after the least
              visible thing on it. It is a numeral in a chip now. */}
          <p data-tour="curriculum-deck" className="flex items-center gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-[1.4rem] leading-none font-bold text-amber-300 tabular-nums ring-1 ring-amber-400/40">
              {mastery.level}
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium text-frost">
                Level {mastery.level}
              </span>
              <span className="mt-0.5 block text-[1.5rem] leading-none font-bold tracking-[-0.02em] text-paper">
                {mastery.title}
              </span>
            </span>
          </p>
          <p className="pill text-[12.5px] text-amber-300 tabular-nums">
            <Zap className="size-3.5" aria-hidden />
            {xp.earned.toLocaleString("en-IN")}
            <span className="font-medium text-amber-200/70">
              / {xp.possible.toLocaleString("en-IN")} XP
            </span>
          </p>
        </div>

        <div
          className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-strata"
          role="progressbar"
          aria-valuenow={mastery.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress to ${mastery.next_title ?? "the last level"}`}
        >
          <div
            className="h-full rounded-full bg-amber-400 transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(1.5, mastery.percent)}%` }}
          />
        </div>
        <p className="mt-2 text-[12.5px] text-frost">
          {mastery.next_title
            ? `${mastery.percent}% of the way to ${mastery.next_title}`
            : "top level reached"}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            icon={Flame}
            value={String(stats.streak_days)}
            label="Day streak"
            tone="orange"
            lit={stats.streak_days > 0}
          />
          <Tile
            icon={Target}
            value={`${stats.lessons_completed}/${stats.lessons_total}`}
            label="Lessons"
            tone="cyan"
            lit={stats.lessons_completed > 0}
          />
          <Tile
            icon={Award}
            value={`${stats.badges_earned}/${data.badges.length}`}
            label="Badges"
            tone="amber"
            lit={stats.badges_earned > 0}
          />
          <Tile
            icon={Zap}
            value={`${stats.challenges_passed}/${stats.challenges_total}`}
            label="Circuits passed"
            tone="emerald"
            lit={stats.challenges_passed > 0}
          />
        </dl>
      </div>

      {/* The active quest. One thing to do next, named. */}
      {quest && (
        <Link
          href={`/curriculum/${quest.module_slug}`}
          className={cn(
            "panel group relative flex flex-wrap items-center justify-between gap-x-8 gap-y-5 overflow-hidden rounded-2xl px-6 py-6 transition-colors",
            questTone.border,
          )}
        >
          {/* The module's colour, as a wash from the left edge. */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 w-1.5",
              questTone.solid,
            )}
          />
          <div className="min-w-0">
            <p
              className={cn("eyebrow flex items-center gap-2", questTone.text)}
            >
              <Target className="size-3.5" aria-hidden />
              Current quest
            </p>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={cn("ket text-[15px]", questTone.text)}>
                {quest.ket}
              </span>
              <span className="text-[1.75rem] leading-tight font-bold tracking-[-0.02em] text-paper">
                {quest.title}
              </span>
            </p>
            <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[13.5px] text-frost">
              <span className="mr-1 first-letter:uppercase">
                {quest.reason}
              </span>
              {nextXp && (
                <span className="pill text-amber-300">
                  <Zap className="size-3" aria-hidden />+
                  {(nextXp.possible - nextXp.earned).toLocaleString("en-IN")} XP
                  left
                </span>
              )}
              {next && !next.badge_earned && (
                <span className="pill text-grape">
                  <Award className="size-3" aria-hidden />
                  Earns {next.badge}
                </span>
              )}
            </p>
          </div>

          <span className="flex shrink-0 items-center gap-5">
            <span
              className={cn(
                "text-[3rem] leading-[0.8] font-bold tracking-[-0.03em] tabular-nums",
                questTone.text,
              )}
            >
              {quest.percent}
              <span className="text-xl">%</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-photon px-5 py-2.5 text-[13.5px] font-semibold text-void">
              Resume
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
