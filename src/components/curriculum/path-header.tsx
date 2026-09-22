"use client";

import { CHALLENGES } from "@/lib/challenges";
import { MODULES } from "@/lib/data";
import { useLiveProgress } from "@/lib/quest";
import { cn } from "@/lib/utils";

/**
 * The head of the curriculum page.
 *
 * This used to be a fixed catalogue: the words "Eight modules" at display size,
 * a line explaining that a three-qubit register has eight states and so does
 * the course, and three totals counted off the module table. All true, and all
 * of it about the course rather than about the person reading it — a signed-in
 * learner who had passed four labs was told the same thing as a visitor who had
 * never opened one.
 *
 * The course is still eight modules and the prerequisite chain is still real.
 * What changes is which numbers are on the page: with an account the totals are
 * the learner's own — modules mastered, lessons finished, labs passed — and the
 * order below is ranked by where the server says they are weakest. Without one
 * it is a catalogue again, and says so rather than showing an empty bar.
 */

const TOTAL_LESSONS = MODULES.reduce((sum, m) => sum + m.lessons, 0);
const TOTAL_MINUTES = MODULES.reduce((sum, m) => sum + m.minutes, 0);
const TOTAL_LABS = CHALLENGES.length;

function Figure({
  label,
  value,
  note,
  tone = "text-paper",
}: {
  label: string;
  value: string;
  note?: string;
  /** The colour of the number — each figure keeps its own. */
  tone?: string;
}) {
  return (
    <div>
      <dt className="text-[12.5px] font-medium text-frost">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-[1.65rem] leading-none font-semibold tabular-nums",
          tone,
        )}
      >
        {value}
      </dd>
      {note && <dd className="mt-1.5 text-[12px] text-dim">{note}</dd>}
    </div>
  );
}

export function PathHeader() {
  const { data, signedIn } = useLiveProgress();

  const live = signedIn && data ? data : null;

  const mastered = live
    ? live.modules.filter((m) => m.state === "mastered").length
    : 0;
  const lessons = live
    ? live.modules.reduce((sum, m) => sum + m.lessons_completed, 0)
    : 0;
  const labsPassed = live
    ? live.modules.filter((m) => m.challenge?.passed).length
    : 0;

  /* The weakest axis, named. This is the whole claim the page makes about being
     personalised, so it is stated in words rather than implied by an ordering
     nobody can see the rule behind. */
  const weakest = live?.up_next?.weakest_skill ?? null;

  return (
    <header className="grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-end">
      <div>
        <p className="eyebrow">Curriculum</p>
        <h1 className="display-1 mt-5 max-w-[11ch]">Your path</h1>
        <p className="ket mt-4 text-[clamp(1.5rem,3.6vw,2.75rem)] leading-none text-photon">
          |000⟩ &rarr; |111⟩
        </p>
      </div>

      <div className="lg:pb-2">
        <p className="lede max-w-md">
          {live ? (
            <>
              Ranked by where you are weakest, not by where the syllabus happens
              to start.
              {weakest ? (
                <>
                  {" "}
                  Right now that is{" "}
                  <span className="text-paper">{weakest}</span> — the module at
                  the top of the track is the first open one that moves it.
                </>
              ) : (
                " Pass a graded lab and the order starts answering to your results."
              )}
            </>
          ) : (
            <>
              Eight modules and a graded circuit at the end of most of them.
              Sign in and this stops being a table of contents: the order is
              re-ranked by the skill your marked labs say is weakest, and the
              figures below become yours.
            </>
          )}
        </p>

        <dl
          className={cn(
            "mt-6 flex flex-wrap gap-x-10 gap-y-4 border-t border-edge pt-5",
            !live && "text-dim",
          )}
        >
          {live ? (
            <>
              <Figure
                label="Mastered"
                value={`${mastered}/${MODULES.length}`}
                note="modules"
                tone="text-violet-300"
              />
              <Figure
                label="Lessons"
                value={`${lessons}/${TOTAL_LESSONS}`}
                note="marked complete"
                tone="text-cyan-300"
              />
              <Figure
                label="Labs passed"
                value={`${labsPassed}/${TOTAL_LABS}`}
                note="graded by simulation"
                tone="text-emerald-300"
              />
            </>
          ) : (
            <>
              <Figure label="Lessons" value={String(TOTAL_LESSONS)} />
              <Figure label="Modules" value={String(MODULES.length)} />
              <Figure label="Graded labs" value={String(TOTAL_LABS)} />
              <Figure
                label="Runtime"
                value={`${Math.round(TOTAL_MINUTES / 60)}h`}
              />
            </>
          )}
        </dl>
      </div>
    </header>
  );
}
