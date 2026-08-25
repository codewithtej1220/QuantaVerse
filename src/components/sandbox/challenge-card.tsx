"use client";

import { CheckCircle2, CircleSlash, Loader2, Save, Target, XCircle } from "lucide-react";

import type { GradeResponse } from "@/lib/api";
import type { Challenge } from "@/lib/challenges";
import { cn } from "@/lib/utils";

/**
 * The graded task.
 *
 * The verdict is the API's, printed as it came back: two named checks, each with
 * its own score, and the server's hint when they do not both pass. Nothing here
 * decides whether the circuit is right — that is the grader's job, and hiding
 * which of the two checks failed would waste the most useful part of the answer.
 */

const CHECK_LABEL: Record<string, string> = {
  state_fidelity: "Final state",
  unitary_equivalence: "Whole operation",
};

export function ChallengeCard({
  challenge,
  verdict,
  error,
  grading,
  available,
  onCheck,
}: {
  challenge: Challenge;
  /** The last verdict for the circuit currently on the grid, if any. */
  verdict: GradeResponse | null;
  error: string | null;
  grading: boolean;
  /** False when there is no API to grade against. */
  available: boolean;
  onCheck: () => void;
}) {
  return (
    <section
      className={cn(
        "glass rounded-2xl p-4 lg:p-5",
        verdict?.passed && "border-photon/45 shadow-[0_0_60px_-24px_rgba(56,232,255,0.75)]",
      )}
      aria-label="Circuit challenge"
    >
      {/* Below sm the button gets its own line: min-w-0 lets the text column
          shrink rather than wrap, so the row has to be turned off explicitly. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-6">
        <div className="min-w-0 sm:flex-1">
          <p className="eyebrow flex items-center gap-2">
            <Target className="size-3.5 text-phase" />
            Circuit lab
          </p>
          <h2 className="mt-2 text-[17px] font-semibold tracking-[-0.01em] text-paper">
            {challenge.title}
          </h2>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-frost/80">
            {challenge.goal}
          </p>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-frost/55">
            {challenge.why}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            onClick={onCheck}
            disabled={grading || !available}
            title={available ? undefined : "The check runs on the QuantaVerse API"}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3.5 py-2 font-mono text-[11px] tracking-[0.12em] uppercase",
              "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-phase",
              "border-phase/50 bg-phase/12 text-phase hover:bg-phase/20",
              "disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-frost/40",
            )}
          >
            {grading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Target className="size-3.5" />
            )}
            {grading ? "checking" : "check my circuit"}
          </button>
          <span className="font-mono text-[10px] tracking-[0.12em] text-frost/45 uppercase">
            {challenge.qubits} qubits · qiskit marks it
          </span>
        </div>
      </div>

      {/* Verdict. */}
      {(verdict || error) && (
        <div className="mt-4 border-t border-white/8 pt-4">
          {error ? (
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-collapse/90">
              <CircleSlash className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : (
            verdict && (
              <>
                <p
                  className={cn(
                    "flex items-center gap-2 text-[14px] font-medium",
                    verdict.passed ? "text-photon" : "text-paper",
                  )}
                >
                  {verdict.passed ? (
                    <CheckCircle2 className="size-4.5 shrink-0" />
                  ) : (
                    <XCircle className="size-4.5 shrink-0 text-collapse" />
                  )}
                  {verdict.passed ? "Solved — both checks pass." : "Not there yet."}
                </p>

                {verdict.recorded && (
                  <p className="mt-2 flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.14em] text-photon/75 uppercase">
                    <Save className="size-3 shrink-0" />
                    saved to your record
                    {verdict.earned_badges.length > 0 &&
                      ` · badge earned: ${verdict.earned_badges.join(", ")}`}
                  </p>
                )}

                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  {verdict.checks.map((check) => (
                    <div
                      key={check.check}
                      className={cn(
                        "rounded-xl border px-3 py-2.5",
                        check.passed
                          ? "border-photon/30 bg-photon/6"
                          : "border-collapse/25 bg-collapse/6",
                      )}
                    >
                      <dt className="flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] uppercase">
                        <span className={check.passed ? "text-photon" : "text-collapse"}>
                          {check.passed ? "pass" : "fail"}
                        </span>
                        <span className="text-frost/55">
                          {CHECK_LABEL[check.check] ?? check.check}
                        </span>
                        <span className="ml-auto text-frost/45 tabular-nums">
                          {check.score.toFixed(4)}
                        </span>
                      </dt>
                      <dd className="mt-1.5 text-[12.5px] leading-relaxed text-frost/70">
                        {check.detail}
                      </dd>
                    </div>
                  ))}
                </dl>

                {verdict.hint && (
                  <p className="mt-3 rounded-xl border border-phase/25 bg-phase/8 px-3 py-2.5 text-[13px] leading-relaxed text-paper/90">
                    <span className="font-mono text-[10px] tracking-[0.14em] text-phase uppercase">
                      hint ·{" "}
                    </span>
                    {verdict.hint}
                  </p>
                )}
              </>
            )
          )}
        </div>
      )}
    </section>
  );
}
