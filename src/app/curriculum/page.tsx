import type { Metadata } from "next";
import Link from "next/link";

import { ModuleTrack } from "@/components/curriculum/module-track";
import { QuestBoard } from "@/components/curriculum/quest-board";
import { MODULES } from "@/lib/data";

export const metadata: Metadata = {
  title: "Curriculum",
  description:
    "Eight modules from the qubit to Shor's algorithm, indexed |000⟩ to |111⟩. Free, open, and yours to fork — no account, no paywall, no locked chapters.",
};

const TOTAL_MINUTES = MODULES.reduce((sum, m) => sum + m.minutes, 0);
const TOTAL_LESSONS = MODULES.reduce((sum, m) => sum + m.lessons, 0);

export default function CurriculumPage() {
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
                  ["Lessons", String(TOTAL_LESSONS)],
                  ["Modules", String(MODULES.length)],
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

        {/* The dominant element. Level, XP, streak and the one module to open
            next — all of it counted from work done, and honest about having
            nothing to show when nobody is signed in. */}
        <div className="mt-14">
          <QuestBoard />
        </div>

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
