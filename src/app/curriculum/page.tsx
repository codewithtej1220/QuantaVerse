import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { ModuleGrid } from "@/components/curriculum/module-grid";
import { ActionLink } from "@/components/site/action";
import { AmplitudeBar } from "@/components/site/amplitude-bar";
import { LEARNER, MODULES } from "@/lib/data";

export const metadata: Metadata = {
  title: "Curriculum",
  description:
    "Eight modules from the qubit to Shor's algorithm, indexed |000⟩ to |111⟩. Free, open, and yours to fork — no account, no paywall, no locked chapters.",
};

const TOTAL_MINUTES = MODULES.reduce((sum, m) => sum + m.minutes, 0);
const TOTAL_LESSONS = MODULES.reduce((sum, m) => sum + m.lessons, 0);
const MASTERED = MODULES.filter((m) => m.state === "mastered").length;

export default function CurriculumPage() {
  const completion = Math.round((LEARNER.lessonsDone / TOTAL_LESSONS) * 100);

  return (
    <div className="lattice min-h-screen overflow-x-clip pt-24 pb-20">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <header className="border-b border-white/8 pb-8">
          <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
            <div>
              <p className="eyebrow">Curriculum · /curriculum</p>
              <h1 className="mt-3 text-[clamp(2rem,4vw,2.9rem)] leading-[1.05] font-semibold tracking-[-0.025em]">
                Eight modules,{" "}
                <span className="ket text-photon text-glow">|000⟩ → |111⟩</span>
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-frost/80">
                A three-qubit register has exactly eight states, and this course has exactly
                eight modules — so a module&rsquo;s index is a basis state, and the order you
                read them in is the prerequisite chain. Every one is free, and every one opens
                today.
              </p>
            </div>

            {/* Where the learner stands, in the register's own terms. */}
            <div className="glass rounded-2xl p-5">
              <AmplitudeBar value={completion} label="Course completion" />
              <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-white/8 pt-4">
                {(
                  [
                    ["Lessons", `${LEARNER.lessonsDone}/${TOTAL_LESSONS}`],
                    ["Mastered", `${MASTERED}/${MODULES.length}`],
                    ["Runtime", `${Math.round(TOTAL_MINUTES / 60)}h`],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="font-mono text-[9.5px] tracking-[0.16em] text-frost/40 uppercase">
                      {label}
                    </dt>
                    <dd className="mt-1 font-mono text-[15px] text-paper tabular-nums">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-[12px] leading-relaxed text-frost/55">
                Progress is stored in this browser. No account, so nothing to sign up for and
                nothing to lose.
              </p>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <ModuleGrid />
        </div>

        {/* Closing: the sandbox is where the modules are practised. */}
        <section className="glass mt-10 flex flex-wrap items-center justify-between gap-6 rounded-2xl p-6 lg:p-8">
          <div className="max-w-xl">
            <p className="eyebrow">Practice</p>
            <h2 className="mt-2.5 text-[clamp(1.3rem,2.4vw,1.7rem)] leading-tight font-semibold tracking-[-0.02em]">
              Every module ends in the sandbox.
            </h2>
            <p className="mt-2.5 text-[14px] leading-relaxed text-frost/75">
              Reading about a Bell pair is not the same as building one. Each module hands you
              a circuit to finish, and the simulator marks it by measuring the state you
              actually produced.
            </p>
          </div>
          <ActionLink href="/sandbox" size="lg">
            Open the sandbox
            <ArrowRight className="size-4" />
          </ActionLink>
        </section>
      </div>
    </div>
  );
}
