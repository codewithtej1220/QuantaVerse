import Link from "next/link";
import { ArrowRight, Boxes, Flame } from "lucide-react";

import { BadgeShelf } from "@/components/dashboard/badge-shelf";
import { CoherenceLog } from "@/components/dashboard/coherence-log";
import { MasteryRing } from "@/components/dashboard/mastery-ring";
import { SkillGraph } from "@/components/dashboard/skill-graph";
import { ActionLink } from "@/components/site/action";
import { AmplitudeBar } from "@/components/site/amplitude-bar";
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
  footnote: ReactNode;
  banner?: ReactNode;
}

export function DashboardShell({ model }: { model: DashboardModel }) {
  return (
    <div className="lattice min-h-screen overflow-x-clip pt-24 pb-20">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        {model.banner}

        <header className="border-b border-white/8 pb-8">
          <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
            <div>
              <p className="eyebrow">Dashboard · /dashboard</p>
              <h1 className="mt-3 text-[clamp(2rem,4vw,2.9rem)] leading-[1.05] font-semibold tracking-[-0.025em]">
                {model.name}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[11.5px] text-frost/60">
                <span className="text-photon/85">@{model.handle}</span>
                {model.institution && (
                  <>
                    <span className="h-3 w-px bg-white/15" />
                    <span>{model.institution}</span>
                  </>
                )}
                <span className="h-3 w-px bg-white/15" />
                <span>{model.cohort}</span>
              </p>
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-frost/80">
                Everything here is derived from circuits that ran and checks that passed. Nothing
                counts a video watched or a page scrolled, because neither one teaches you to build
                a Bell pair.
              </p>

              <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-collapse/30 bg-collapse/8 px-3.5 py-1.5">
                <Flame className="size-3.5 text-collapse" />
                <span className="font-mono text-[11px] tracking-[0.14em] text-collapse/90 uppercase">
                  {model.streakDays === 0
                    ? "no run yet · start today"
                    : `${model.streakDays}-day run · coherence held`}
                </span>
              </p>
            </div>

            <div className="glass rounded-2xl p-5 lg:p-6">
              <MasteryRing
                level={model.mastery.level}
                title={model.mastery.title}
                progress={model.mastery.progress}
                nextTitle={model.mastery.nextTitle}
                levels={model.mastery.levels}
              />
              <div className="mt-5 border-t border-white/8 pt-4">
                <AmplitudeBar value={model.completion} label="Course completion" />
              </div>
            </div>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] lg:grid-cols-4">
            {model.tiles.map((tile) => (
              <div
                key={tile.label}
                className="flex flex-col gap-1 border-t border-l border-white/6 px-5 py-4 first:border-l-0 lg:border-t-0"
              >
                <dt className="eyebrow">{tile.label}</dt>
                <dd className="text-2xl font-semibold tracking-tight text-paper tabular-nums">
                  {tile.value}
                </dd>
                <dd className="font-mono text-[11px] text-frost/55">{tile.detail}</dd>
              </div>
            ))}
          </dl>
        </header>

        {model.upNext && (
          <section className="glass mt-8 flex flex-wrap items-center justify-between gap-6 rounded-2xl p-5 lg:p-6">
            <div className="max-w-xl">
              <p className="eyebrow">Up next</p>
              <h2 className="mt-2 flex flex-wrap items-baseline gap-x-3 text-[clamp(1.15rem,2.2vw,1.5rem)] leading-tight font-semibold tracking-[-0.02em]">
                <span className="ket text-[15px] text-photon">{model.upNext.ket}</span>
                {model.upNext.title}
              </h2>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-frost/75">
                {model.upNext.detail}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ActionLink href={`/curriculum/${model.upNext.slug}`} size="lg">
                Resume module
                <ArrowRight className="size-4" />
              </ActionLink>
              <ActionLink href="/sandbox" variant="outline" size="lg">
                <Boxes className="size-4 text-photon" />
                Open sandbox
              </ActionLink>
            </div>
          </section>
        )}

        <div className="mt-4 grid gap-4">
          <SkillGraph skills={model.skills} />
          <CoherenceLog
            log={model.log}
            streakDays={model.streakDays}
            start={model.logStart}
          />
          <BadgeShelf badges={model.badges} />
        </div>

        <p className="mt-8 text-[12.5px] leading-relaxed text-frost/50">
          {model.footnote}{" "}
          <Link
            href="/curriculum"
            className="text-frost/75 underline-offset-4 hover:text-photon hover:underline"
          >
            Back to the curriculum
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
