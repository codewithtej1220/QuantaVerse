"use client";

import {
  CheckCircle2,
  CircleSlash,
  Info,
  Loader2,
  Save,
  Target,
  XCircle,
} from "lucide-react";

import type { GradeResponse } from "@/lib/api";
import { CHALLENGES, MODE_LABEL, type Challenge } from "@/lib/challenges";
import { cn } from "@/lib/utils";

/**
 * The graded task.
 *
 * The verdict is the grader's, printed as it came back: each named check with
 * its own score, and the grader's hint when the grade is not a pass. Nothing
 * here decides whether the circuit is right — hiding which check failed would
 * waste the most useful part of the answer.
 *
 * The card also says two things the old one left the learner to discover by
 * failing: where this lab sits on the ladder, and what it is marked on. A lab
 * marked on the state accepts any route to the state; one marked on every
 * input does not accept a circuit that only lands on the answer from |0…0⟩,
 * and that is worth knowing before the first attempt rather than after it.
 */

/* For a server that predates labelled checks. */
const CHECK_LABEL: Record<string, string> = {
  state_fidelity: "Final state",
  unitary_equivalence: "Every input",
  measurement_order: "Measurements",
};

export function ChallengeCard({
  challenge,
  verdict,
  offline,
  error,
  grading,
  onCheck,
}: {
  challenge: Challenge;
  /** The last verdict for the circuit currently on the grid, if any. */
  verdict: GradeResponse | null;
  /** True when the check runs in this tab because no API can be reached. */
  offline: boolean;
  error: string | null;
  grading: boolean;
  onCheck: () => void;
}) {
  const mode = MODE_LABEL[challenge.mode];
  const total = CHALLENGES.length;

  return (
    <section
      className={cn(
        "panel rounded-2xl p-4 lg:p-5",
        /* Important: `panel` sets its own edges and is emitted after the
           colour utilities, so a plain border class loses to it. */
        verdict?.passed && "border-photon!",
      )}
      aria-label="Circuit challenge"
    >
      {/* Below sm the button gets its own line: min-w-0 lets the text column
          shrink rather than wrap, so the row has to be turned off explicitly. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-6">
        <div className="min-w-0 sm:flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="eyebrow flex items-center gap-2">
              <Target className="size-3.5 text-paper" />
              {challenge.setBy
                ? `Circuit lab · set by ${challenge.setBy}`
                : `Circuit lab ${challenge.level} of ${total}`}
            </p>
            {/* The ladder, as a count you can see: one pip per lab, the ones
                up to this one filled. A professor's own lab is not on it. */}
            {!challenge.setBy && (
              <span
                className="flex items-center gap-1"
                role="img"
                aria-label={`Difficulty ${challenge.level} of ${total}`}
              >
                {Array.from({ length: total }, (_, index) => (
                  <span
                    key={index}
                    aria-hidden
                    className={cn(
                      "h-1.5 w-3 rounded-full",
                      index < challenge.level ? "bg-photon" : "bg-edge",
                    )}
                  />
                ))}
              </span>
            )}
          </div>
          <h2 className="mt-2 text-[17px] font-semibold tracking-[-0.01em] text-paper">
            {challenge.title}
          </h2>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-paper">
            {challenge.goal}
          </p>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-frost">
            {challenge.why}
          </p>
          <p className="mt-3 flex max-w-2xl items-start gap-2 text-[12px] leading-relaxed text-frost">
            <span className="shrink-0 rounded-md border border-edge-hi px-1.5 py-0.5 font-mono text-[10.5px] tracking-[0.12em] text-paper uppercase">
              {mode.name}
            </span>
            <span className="pt-px">{mode.detail}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            onClick={onCheck}
            disabled={grading}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3.5 py-2 font-mono text-[11px] tracking-[0.12em] uppercase",
              "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-phase",
              "border-paper bg-strata text-paper hover:bg-strata",
              "disabled:cursor-not-allowed disabled:border-edge disabled:bg-transparent disabled:text-frost",
            )}
          >
            {grading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Target className="size-3.5" />
            )}
            {grading ? "checking" : "check my circuit"}
          </button>
          <span className="font-mono text-[11px] tracking-[0.12em] text-frost uppercase">
            {challenge.qubits} qubits ·{" "}
            {offline ? "checked in this tab" : "qiskit marks it"}
          </span>
        </div>
      </div>

      {/* Verdict. */}
      {(verdict || error) && (
        <div className="mt-4 border-t border-edge pt-4">
          {error ? (
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-collapse">
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
                  {verdict.passed ? "Solved." : "Not there yet."}
                </p>

                {verdict.recorded && (
                  <p className="mt-2 flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] text-photon uppercase">
                    <Save className="size-3 shrink-0" />
                    saved to your record
                    {verdict.earned_badges.length > 0 &&
                      ` · badge earned: ${verdict.earned_badges.join(", ")}`}
                  </p>
                )}
                {offline && (
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-frost">
                    Marked in this tab — the QuantaVerse API is not running, so
                    the result is not saved. The in-tab check is the same one
                    the server runs.
                  </p>
                )}

                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  {verdict.checks.map((check) => {
                    const informative = check.required === false;
                    return (
                      <div
                        key={check.check}
                        className={cn(
                          "rounded-xl border px-3 py-2.5",
                          informative
                            ? "border-edge bg-transparent"
                            : check.passed
                              ? "border-photon bg-photon/10"
                              : "border-edge-hi bg-strata",
                        )}
                      >
                        <dt className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] uppercase">
                          {informative ? (
                            <span className="flex items-center gap-1 text-frost">
                              <Info className="size-3" aria-hidden />
                              info
                            </span>
                          ) : (
                            <span
                              className={
                                check.passed ? "text-photon" : "text-collapse"
                              }
                            >
                              {check.passed ? "pass" : "fail"}
                            </span>
                          )}
                          <span className="text-frost normal-case tracking-normal">
                            {check.label ||
                              CHECK_LABEL[check.check] ||
                              check.check}
                          </span>
                          <span className="ml-auto text-frost tabular-nums">
                            {check.score.toFixed(4)}
                          </span>
                        </dt>
                        <dd className="mt-1.5 text-[12.5px] leading-relaxed text-frost">
                          {check.detail}
                          {informative && (
                            <span className="text-dim">
                              {" "}
                              — shown for information; it cannot pass or fail
                              the lab.
                            </span>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>

                {verdict.hint && (
                  <p className="mt-3 rounded-xl border border-paper bg-strata px-3 py-2.5 text-[13px] leading-relaxed text-paper">
                    <span className="font-mono text-[11px] tracking-[0.14em] text-paper uppercase">
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
