import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";

import { BadgeShelf } from "@/components/dashboard/badge-shelf";
import { CoherenceLog } from "@/components/dashboard/coherence-log";
import { MasteryRing } from "@/components/dashboard/mastery-ring";
import { SkillGraph } from "@/components/dashboard/skill-graph";
import { AmplitudeBar } from "@/components/site/amplitude-bar";
import { Reveal } from "@/components/site/reveal";
import { TONE, moduleTone, type Tone } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { StreakWatcher } from "@/components/mascot/streak-watcher";
import type { BadgeItem, Skill } from "@/lib/data";
import type { ReactNode } from "react";

export interface DashboardModel {
  name: string;
  handle: string;
  institution: string | null;
  cohort: string;
  streakDays: number;
  completion: number;
  mastery: {
    level: number;
    title: string;
    progress: number;
    nextTitle: string | null;
    levels: number;
  };
  tiles: { label: string; value: string; detail: string }[];
  upNext: {
    slug: string;
    ket: string;
    title: string;
    detail: string;
  } | null;
  skills: Skill[];
  badges: BadgeItem[];
  log: number[];
  logStart: number;
  /** What the numbers on this page are. Differs for a live record and a sample. */
  intro: string;
  footnote: ReactNode;
  banner?: ReactNode;
}

/* Each count in its own colour, in the order the tiles come. */
const TILE_TONES: Tone[] = ["cyan", "violet", "emerald", "amber"];

export function DashboardShell({ model }: { model: DashboardModel }) {
  const upNextTone = TONE[moduleTone(model.upNext?.slug ?? "")];
  return (
    <div className="min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
        {model.banner}

        {/* Name gets the room; mastery sits beside it as a read-out rather than
            in a panel of its own. */}
        {/* The cat notices a broken streak before the numbers do. */}
        <StreakWatcher days={model.streakDays} />

        <header className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <p className="eyebrow">Dashboard</p>
            {/* display-1, not display-2, was clipping: a name is arbitrary-length
                user data and "Aditi Raghunathan" ran straight off the page. The
                dominant element here is the next action anyway, not the name. */}
            <h1 data-tour="dashboard" className="display-2 mt-5 break-words">
              {model.name}
            </h1>
            <p className="mt-5 flex flex-wrap items-center gap-2 text-[13px] text-frost">
              <span className="pill text-cyan-300">@{model.handle}</span>
              {model.institution && (
                <span className="pill text-frost">{model.institution}</span>
              )}
              <span className="pill text-grape">{model.cohort}</span>
              <span
                className={cn(
                  "pill",
                  model.streakDays === 0 ? "text-dim" : "text-orange-300",
                )}
              >
                <Flame className="size-3" />
                {model.streakDays === 0
                  ? "No run yet"
                  : `${model.streakDays}-day run`}
              </span>
            </p>
            <p className="lede mt-6 max-w-2xl">{model.intro}</p>
          </div>

          <div className="lg:pb-1">
            <MasteryRing
              level={model.mastery.level}
              title={model.mastery.title}
              progress={model.mastery.progress}
              nextTitle={model.mastery.nextTitle}
              levels={model.mastery.levels}
            />
            <div className="mt-6 border-t border-edge pt-5">
              <AmplitudeBar
                value={model.completion}
                label="Course completion"
              />
            </div>
          </div>
        </header>

        {/* The dominant element, in the same grammar as the curriculum's. */}
        {model.upNext && (
          <Link
            href={`/curriculum/${model.upNext.slug}`}
            className={cn(
              "panel group relative mt-16 grid gap-x-8 gap-y-6 overflow-hidden rounded-2xl px-7 py-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 w-1.5",
                upNextTone.solid,
              )}
            />
            <div className="min-w-0">
              <p className={cn("eyebrow", upNextTone.text)}>Up next</p>
              <h2 className="display-2 mt-3 flex flex-wrap items-baseline gap-x-4 text-paper">
                <span className={cn("ket text-[0.45em]", upNextTone.text)}>
                  {model.upNext.ket}
                </span>
                {model.upNext.title}
              </h2>
              <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-frost">
                {model.upNext.detail}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg bg-photon px-5 py-2.5 text-[13.5px] font-semibold text-void transition-colors group-hover:bg-photon-hi sm:self-center">
              Resume module
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        )}

        {/* Counted, not boxed: one rule and four columns. */}
        <Reveal
          as="dl"
          className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4"
          step={100}
        >
          {model.tiles.map((tile, index) => {
            const tone = TONE[TILE_TONES[index % TILE_TONES.length]];
            return (
              <div
                key={tile.label}
                className="panel relative overflow-hidden rounded-2xl px-5 py-4"
              >
                <span
                  aria-hidden
                  className={cn("absolute inset-x-0 top-0 h-1", tone.solid)}
                />
                <dt className="text-[13px] font-medium text-frost">
                  {tile.label}
                </dt>
                <dd
                  className={cn(
                    "mt-2 text-[2.1rem] leading-none font-semibold tracking-[-0.02em] tabular-nums",
                    tone.text,
                  )}
                >
                  {tile.value}
                </dd>
                <dd className="mt-2 text-[12.5px] text-dim">{tile.detail}</dd>
              </div>
            );
          })}
        </Reveal>

        {/* Each panel arrives as you reach it, so the page reads as a record
            being counted out rather than one screen dumped at once. */}
        <Reveal className="mt-16">
          <SkillGraph skills={model.skills} />
        </Reveal>

        <Reveal className="mt-16">
          <CoherenceLog
            log={model.log}
            streakDays={model.streakDays}
            start={model.logStart}
          />
        </Reveal>

        <Reveal className="mt-16">
          <BadgeShelf badges={model.badges} />
        </Reveal>

        <p className="mt-16 max-w-3xl border-t border-edge pt-6 text-[13px] leading-relaxed text-frost">
          {model.footnote}{" "}
          <Link
            href="/curriculum"
            className="text-photon underline-offset-4 hover:underline focus-visible:underline"
          >
            Back to the curriculum
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
