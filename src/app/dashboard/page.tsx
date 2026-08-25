import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Boxes, Flame } from "lucide-react";

import { BadgeShelf } from "@/components/dashboard/badge-shelf";
import { CoherenceLog } from "@/components/dashboard/coherence-log";
import { MasteryRing } from "@/components/dashboard/mastery-ring";
import { SkillGraph } from "@/components/dashboard/skill-graph";
import { ActionLink } from "@/components/site/action";
import { AmplitudeBar } from "@/components/site/amplitude-bar";
import { LEARNER, MODULES, SKILLS, TRACK_LABEL } from "@/lib/data";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Mastery level, skill graph, badges and a 12-week practice log — every number counted from circuits you actually ran.",
};

/* Counted from the curriculum so the header can never drift from the module list. */
const TOTAL_LESSONS = MODULES.reduce((sum, m) => sum + m.lessons, 0);
const ACTIVE = MODULES.find((m) => m.state === "active") ?? MODULES[0];
const WEAKEST = [...SKILLS].sort((a, b) => a.value - b.value)[0];

const TILES = [
  {
    label: "Circuits run",
    value: LEARNER.circuitsRun.toLocaleString("en-IN"),
    detail: "simulated in your browser",
  },
  {
    label: "Shots",
    value: LEARNER.shotsSimulated.toLocaleString("en-IN"),
    detail: "measurements sampled",
  },
  {
    label: "Time on task",
    value: `${LEARNER.hoursLogged}h`,
    detail: "editor and sandbox only",
  },
  {
    label: "Lessons",
    value: `${LEARNER.lessonsDone}/${TOTAL_LESSONS}`,
    detail: `across ${MODULES.length} modules`,
  },
] as const;

export default function DashboardPage() {
  const completion = Math.round((LEARNER.lessonsDone / TOTAL_LESSONS) * 100);

  return (
    <div className="lattice min-h-screen overflow-x-clip pt-24 pb-20">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <header className="border-b border-white/8 pb-8">
          <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
            <div>
              <p className="eyebrow">Dashboard · /dashboard</p>
              <h1 className="mt-3 text-[clamp(2rem,4vw,2.9rem)] leading-[1.05] font-semibold tracking-[-0.025em]">
                {LEARNER.name}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[11.5px] text-frost/60">
                <span className="text-photon/85">@{LEARNER.handle}</span>
                <span className="h-3 w-px bg-white/15" />
                <span>{LEARNER.institution}</span>
                <span className="h-3 w-px bg-white/15" />
                <span>{LEARNER.cohort}</span>
              </p>
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-frost/80">
                Everything here is derived from circuits that ran and checks that passed. Nothing
                counts a video watched or a page scrolled, because neither one teaches you to build
                a Bell pair.
              </p>

              <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-collapse/30 bg-collapse/8 px-3.5 py-1.5">
                <Flame className="size-3.5 text-collapse" />
                <span className="font-mono text-[11px] tracking-[0.14em] text-collapse/90 uppercase">
                  {LEARNER.streakDays}-day run · coherence held
                </span>
              </p>
            </div>

            <div className="glass rounded-2xl p-5 lg:p-6">
              <MasteryRing />
              <div className="mt-5 border-t border-white/8 pt-4">
                <AmplitudeBar value={completion} label="Course completion" />
              </div>
            </div>
          </div>

          {/* The four numbers, stated once, at the top. */}
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] lg:grid-cols-4">
            {TILES.map((tile) => (
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

        {/* Where to go next, chosen from the data rather than asserted. */}
        <section className="glass mt-8 flex flex-wrap items-center justify-between gap-6 rounded-2xl p-5 lg:p-6">
          <div className="max-w-xl">
            <p className="eyebrow">Up next</p>
            <h2 className="mt-2 flex flex-wrap items-baseline gap-x-3 text-[clamp(1.15rem,2.2vw,1.5rem)] leading-tight font-semibold tracking-[-0.02em]">
              <span className="ket text-[15px] text-photon">{ACTIVE.ket}</span>
              {ACTIVE.title}
            </h2>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-frost/75">
              {ACTIVE.progress}% through {TRACK_LABEL[ACTIVE.track].toLowerCase()} ·{" "}
              {ACTIVE.lessons} lessons · finishing it earns{" "}
              <span className="text-frost/90">{ACTIVE.badge}</span>. Your thinnest axis right now
              is <span className="text-frost/90">{WEAKEST.label.toLowerCase()}</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ActionLink href={`/curriculum/${ACTIVE.slug}`} size="lg">
              Resume module
              <ArrowRight className="size-4" />
            </ActionLink>
            <ActionLink href="/sandbox" variant="outline" size="lg">
              <Boxes className="size-4 text-photon" />
              Open sandbox
            </ActionLink>
          </div>
        </section>

        <div className="mt-4 grid gap-4">
          <SkillGraph />
          <CoherenceLog />
          <BadgeShelf />
        </div>

        <p className="mt-8 text-[12.5px] leading-relaxed text-frost/50">
          This dashboard is stored in your browser. There is no account, so nothing here is on a
          server and nothing is shared with anyone — clearing site data resets it.{" "}
          <Link href="/curriculum" className="text-frost/75 underline-offset-4 hover:text-photon hover:underline">
            Back to the curriculum
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
