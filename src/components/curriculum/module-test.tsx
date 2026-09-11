"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Lock, X } from "lucide-react";

import { useModuleProgress } from "@/components/curriculum/use-module-progress";
import type { TestQuestion } from "@/lib/lessons";
import { cn } from "@/lib/utils";

/**
 * The end-of-module test.
 *
 * It sits behind the lab, and the order carries the argument. The lab asks
 * whether you can build the thing; this asks whether you know why it worked.
 * Run the other way round, somebody could answer every question off the prose
 * without ever placing a gate — which is the exact failure this site exists to
 * argue against, and the reason the lock is on the test rather than the lab.
 *
 * Marked in the browser and not recorded. The lab is the graded artefact: it is
 * checked by simulating the circuit and comparing states, which is a
 * measurement, and it is what the dashboard counts. This is a self-check on the
 * reading, so it says what you got wrong and why and then gets out of the way.
 * Sending it to the server would put a multiple-choice score next to a fidelity
 * and imply the two mean the same thing.
 */
export function ModuleTest({
  slug,
  questions,
  labHref,
}: {
  slug: string;
  questions: TestQuestion[];
  labHref: string | null;
}) {
  const { entry, signedIn } = useModuleProgress(slug);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [marked, setMarked] = useState(false);

  if (!questions.length) return null;

  const labPassed = Boolean(entry?.challenge?.passed);
  const answered = Object.keys(picked).length;
  const score = questions.reduce((n, q, i) => n + (picked[i] === q.answer ? 1 : 0), 0);

  if (!labPassed) {
    return (
      <section className="panel mt-8 rounded-2xl p-6">
        <p className="eyebrow flex items-center gap-2 text-dim">
          <Lock className="size-3.5" aria-hidden />
          Test · {questions.length} questions
        </p>
        <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-frost">
          {signedIn
            ? "Opens once you have passed the lab. Build it first — the questions are about why the circuit did what it did, and they are worth more after you have watched it do it."
            : "Sign in and pass the lab to open the test."}
        </p>
        {labHref && signedIn && (
          <Link
            href={labHref}
            className="mt-4 inline-flex items-center gap-2 border border-edge px-3.5 py-2 text-[13px] text-frost transition-colors hover:border-photon hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
          >
            Go to the lab
          </Link>
        )}
      </section>
    );
  }

  return (
    <section className="panel mt-8 rounded-2xl p-6">
      <p className="eyebrow text-photon">Test · {questions.length} questions</p>
      <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-frost">
        You built it. Now the why. Marked here in the browser — your dashboard counts the lab, not
        this.
      </p>

      <ol className="mt-6 flex flex-col gap-7">
        {questions.map((question, qi) => {
          const choice = picked[qi];
          const right = choice === question.answer;
          return (
            <li key={question.prompt}>
              <p className="text-[14.5px] leading-snug text-paper">
                {qi + 1}. {question.prompt}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {question.options.map((option, oi) => {
                  const chosen = choice === oi;
                  const isAnswer = question.answer === oi;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={marked}
                      aria-pressed={chosen}
                      onClick={() => setPicked((prev) => ({ ...prev, [qi]: oi }))}
                      className={cn(
                        "flex items-start gap-3 border px-3.5 py-2.5 text-left text-[13.5px] leading-snug transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                        marked && isAnswer && "border-photon bg-photon/10 text-paper",
                        marked && chosen && !isAnswer && "border-collapse bg-collapse/10 text-paper",
                        marked && !isAnswer && !chosen && "border-edge text-frost",
                        !marked && chosen && "border-photon bg-photon/10 text-paper",
                        !marked && !chosen && "border-edge bg-strata text-frost hover:border-edge-hi",
                      )}
                    >
                      {marked && isAnswer && (
                        <Check className="mt-0.5 size-4 shrink-0 text-photon" aria-hidden />
                      )}
                      {marked && chosen && !isAnswer && (
                        <X className="mt-0.5 size-4 shrink-0 text-collapse" aria-hidden />
                      )}
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>

              {marked && (
                <p
                  className={cn(
                    "mt-2.5 border-l-2 pl-3.5 text-[13px] leading-relaxed text-frost",
                    right ? "border-photon" : "border-collapse",
                  )}
                >
                  {question.because}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-edge pt-5">
        {marked ? (
          <>
            <p className="font-mono text-[13px] text-paper tabular-nums">
              {score} / {questions.length} correct
            </p>
            <button
              type="button"
              onClick={() => {
                setPicked({});
                setMarked(false);
              }}
              className="h-10 px-3 text-[13px] font-medium text-frost transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-photon"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={answered < questions.length}
              onClick={() => setMarked(true)}
              className={cn(
                "inline-flex h-11 items-center px-5 text-[13px] font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-photon",
                answered === questions.length
                  ? "bg-photon text-void hover:bg-photon-hi"
                  : "cursor-not-allowed border border-edge text-dim",
              )}
            >
              Mark my answers
            </button>
            <p className="font-mono text-[11.5px] text-dim tabular-nums">
              {answered} of {questions.length} answered
            </p>
          </>
        )}
      </div>
    </section>
  );
}
