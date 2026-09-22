import type { Metadata } from "next";
import Link from "next/link";

import { StartingPointDialog } from "@/components/auth/starting-point";
import { ModuleTrack } from "@/components/curriculum/module-track";
import { PathHeader } from "@/components/curriculum/path-header";
import { ProfessorModules } from "@/components/curriculum/professor-modules";
import { QuestBoard } from "@/components/curriculum/quest-board";

export const metadata: Metadata = {
  title: "Curriculum",
  description:
    "A quantum computing path that re-ranks itself around the graded labs you pass, from the qubit to Shor's algorithm. Free, open, and yours to fork — no paywall, no locked chapters.",
};

export default function CurriculumPage() {
  return (
    <div className="min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
        <StartingPointDialog />

        <PathHeader />

        {/* The dominant element. Level, XP, streak and the one module to open
            next — all of it counted from work done, and honest about having
            nothing to show when nobody is signed in. */}
        <div className="mt-14">
          <QuestBoard />
        </div>

        {/* Drawn only for a student whose professors have written modules
            for their class; it keeps its own spacing so that nothing is left
            behind when it is not. */}
        <ProfessorModules className="mt-14" />

        <div className="mt-14">
          <ModuleTrack />
        </div>

        {/* No closing call-to-action card. One sentence and a link is the whole
            thought, and a boxed banner around it would only add a border. */}
        <p className="mt-14 max-w-2xl text-[15px] leading-relaxed text-frost">
          Reading about a Bell pair is not the same as building one. Each module
          ends with a circuit to finish, and the simulator marks it by measuring
          the state you actually produced —{" "}
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
