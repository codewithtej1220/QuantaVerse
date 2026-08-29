import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ModuleTrack } from "@/components/curriculum/module-track";
import { LEARNER, MODULES, TRACK_LABEL } from "@/lib/data";

export const metadata: Metadata = {
  title: "Curriculum",
  description:
    "Eight modules from the qubit to Shor's algorithm, indexed |000⟩ to |111⟩. Free, open, and yours to fork — no account, no paywall, no locked chapters.",
};

const TOTAL_MINUTES = MODULES.reduce((sum, m) => sum + m.minutes, 0);
const TOTAL_LESSONS = MODULES.reduce((sum, m) => sum + m.lessons, 0);
const MASTERED = MODULES.filter((m) => m.state === "mastered").length;

/* The one thing this page is for. Everything else on it is reference. */
const RESUME = MODULES.find((m) => m.state === "active") ?? MODULES.find((m) => m.progress < 100);

export default function CurriculumPage() {
  const lessonsDone = RESUME ? Math.round((RESUME.lessons * RESUME.progress) / 100) : 0;

  return (
    <div className="min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
        {/* Deliberately unbalanced: the heading gets the room, the totals get a
            single tight line rather than a panel of their own. */}
        <header className="grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <p className="eyebrow">Curriculum · /curriculum</p>
            <h1 className="display-1 mt-5 max-w-[11ch]">Eight modules</h1>
            {/* The index, set below the heading rather than inside it: at
                display size the monospace kets are wider than the words and
                were wrapping, which made the subtitle shout over the title. */}
            <p className="ket mt-4 text-[clamp(1.5rem,3.6vw,2.75rem)] leading-none text-photon">
              |000⟩ &rarr; |111⟩
            </p>
          </div>

          <div className="lg:pb-2">
            <p className="lede max-w-md">
              A three-qubit register has exactly eight states, and this course has exactly eight
              modules — so a module&rsquo;s index is a basis state, and the order you read them in
              is the prerequisite chain.
            </p>
            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4 border-t border-edge pt-5">
              {(
                [
                  ["Lessons", `${LEARNER.lessonsDone}/${TOTAL_LESSONS}`],
                  ["Mastered", `${MASTERED}/${MODULES.length}`],
                  ["Runtime", `${Math.round(TOTAL_MINUTES / 60)}h`],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="font-mono text-[11px] tracking-[0.16em] text-dim uppercase">
                    {label}
                  </dt>
                  <dd className="font-display mt-1 text-2xl font-extrabold text-paper tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </header>

        {/* The dominant element. If a visitor reads one thing, it is this. */}
        {RESUME && (
          <Link
            href={`/curriculum/${RESUME.slug}`}
            className="group mt-16 grid gap-x-8 gap-y-6 border-y-2 border-photon py-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <p className="font-mono text-[12px] tracking-[0.2em] text-photon uppercase">
                Continue where you stopped
              </p>
              <h2 className="display-2 mt-4 text-paper">{RESUME.title}</h2>
              <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[13px] text-frost tabular-nums">
                <span className="ket text-photon">{RESUME.ket}</span>
                <span className="h-3 w-px bg-edge-hi" />
                <span>
                  lesson {Math.min(RESUME.lessons, lessonsDone + 1)} of {RESUME.lessons}
                </span>
                <span className="h-3 w-px bg-edge-hi" />
                <span>{TRACK_LABEL[RESUME.track]}</span>
                <span className="h-3 w-px bg-edge-hi" />
                <span>finishing it earns {RESUME.badge}</span>
              </p>
            </div>

            <span className="flex items-center gap-5 sm:flex-col sm:items-end sm:gap-3">
              <span className="font-display text-[4rem] leading-[0.8] font-extrabold text-photon tabular-nums sm:text-[5rem]">
                {RESUME.progress}
                <span className="text-2xl">%</span>
              </span>
              <span className="inline-flex items-center gap-2 bg-photon px-5 py-2.5 font-mono text-[12px] tracking-[0.14em] text-void uppercase">
                Resume
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </Link>
        )}

        <div className="mt-14">
          <ModuleTrack />
        </div>

        {/* No closing call-to-action card. One sentence and a link is the whole
            thought, and a boxed banner around it would only add a border. */}
        <p className="mt-14 max-w-2xl text-[15px] leading-relaxed text-frost">
          Reading about a Bell pair is not the same as building one. Each module ends with a
          circuit to finish, and the simulator marks it by measuring the state you actually
          produced —{" "}
          <Link
            href="/sandbox"
            className="text-photon underline-offset-4 hover:underline focus-visible:underline"
          >
            open the sandbox
          </Link>{" "}
          to try any of it early. A lock is a suggested order, never a paywall.
        </p>
      </div>
    </div>
  );
}
