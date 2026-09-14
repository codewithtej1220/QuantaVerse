import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";

import { BadgeShelf } from "@/components/dashboard/badge-shelf";
import { CoherenceLog } from "@/components/dashboard/coherence-log";
import { MasteryRing } from "@/components/dashboard/mastery-ring";
import { SkillGraph } from "@/components/dashboard/skill-graph";
import { AmplitudeBar } from "@/components/site/amplitude-bar";
import { Reveal } from "@/components/site/reveal";
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

export function DashboardShell({ model }: { model: DashboardModel }) {
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
            <p className="eyebrow">Dashboard · /dashboard</p>
            {/* display-1, not display-2, was clipping: a name is arbitrary-length
                user data and "Aditi Raghunathan" ran straight off the page. The
                dominant element here is the next action anyway, not the name. */}
            <h1 data-tour="dashboard" className="display-2 mt-5 break-words">
              {model.name}
            </h1>
            <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[12.5px] text-frost">
              <span className="text-photon">@{model.handle}</span>
              {model.institution && (
                <>
                  <span className="h-3 w-px bg-edge-hi" />
                  <span>{model.institution}</span>
                </>
              )}
              <span className="h-3 w-px bg-edge-hi" />
              <span>{model.cohort}</span>
              <span className="h-3 w-px bg-edge-hi" />
              <span className="inline-flex items-center gap-1.5 text-photon">
                <Flame className="size-3.5" />
                {model.streakDays === 0
                  ? "no run yet"
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
            className="group mt-16 grid gap-x-8 gap-y-6 border-y-2 border-photon py-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <p className="font-mono text-[12px] tracking-[0.2em] text-photon uppercase">
                Up next
              </p>
              <h2 className="display-2 mt-4 flex flex-wrap items-baseline gap-x-4 text-paper">
                <span className="ket text-[0.45em] text-photon">
                  {model.upNext.ket}
                </span>
                {model.upNext.title}
              </h2>
              <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-frost">
                {model.upNext.detail}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 self-start bg-photon px-5 py-2.5 font-mono text-[12px] tracking-[0.14em] text-void uppercase sm:self-center">
              Resume module
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        )}

        {/* Counted, not boxed: one rule and four columns. */}
        <Reveal
          as="dl"
          className="mt-14 grid grid-cols-2 gap-x-8 gap-y-8 border-t border-edge pt-8 lg:grid-cols-4"
          step={100}
        >
          {model.tiles.map((tile) => (
            <div key={tile.label}>
              <dt className="font-mono text-[11px] tracking-[0.16em] text-dim uppercase">
                {tile.label}
              </dt>
              <dd className="font-display mt-2 text-4xl font-extrabold text-paper tabular-nums">
                {tile.value}
              </dd>
              <dd className="mt-1.5 font-mono text-[11.5px] text-frost">
                {tile.detail}
              </dd>
            </div>
          ))}
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
