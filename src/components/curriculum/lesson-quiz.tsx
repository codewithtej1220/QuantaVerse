"use client";

import { useState } from "react";
import { ArrowDown, Check, Loader2, X } from "lucide-react";

import type { TestQuestion } from "@/lib/lessons";
import { QUIZ_PASS } from "@/lib/quizzes";
import { cn } from "@/lib/utils";

/**
 * The checkpoint at the end of a lesson.
 *
 * Passing it is what marks the lesson complete. There is no "I have read this"
 * button any more, and that is the whole change: a button like that costs
 * nothing to press and tells the recommendation engine nothing, while getting
 * more than half of four questions right is weak evidence rather than none.
 *
 * Half is deliberately a low bar. This is a checkpoint on one lesson, not the
 * assessment — the lab at the foot of the module is that — and a checkpoint
 * that sends somebody back over a page they mostly understood only teaches
 * them to resent it.
 *
 * It marks and never unmarks. Passing is evidence the lesson was read; failing
 * a retake later is not evidence that it was un-read, so a second attempt can
 * only ever leave the record alone.
 */
export function LessonQuiz({
  questions,
  index,
  complete,
  busy,
  signedIn,
  onPass,
  isLast,
}: {
  questions: TestQuestion[];
  index: number;
  complete: boolean;
  busy: boolean;
  signedIn: boolean;
  onPass: (index: number) => void;
  isLast: boolean;
}) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [marked, setMarked] = useState(false);

  if (!questions.length) return null;

  const answered = Object.keys(picked).length;
  const score = questions.reduce(
    (n, q, i) => n + (picked[i] === q.answer ? 1 : 0),
    0,
  );
  /* Strictly more than half, not half — two of four is a coin toss dressed
     up as a checkpoint, and with four options a guesser already expects one
     right. Three of four means something without being punishing. */
  const needed = Math.floor(questions.length * QUIZ_PASS) + 1;
  const passed = marked && score >= needed;

  const mark = () => {
    setMarked(true);
    if (score >= needed) onPass(index);
  };

  return (
    <div className="mt-8 rounded-2xl border border-edge bg-strata p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="eyebrow">
          Checkpoint · {questions.length}{" "}
          {questions.length === 1 ? "question" : "questions"}
        </p>
        <p className="font-mono text-[11px] text-dim tabular-nums">
          {complete
            ? "lesson complete"
            : `${needed} of ${questions.length} to pass`}
        </p>
      </div>

      <ol className="mt-4 flex flex-col gap-5">
        {questions.map((question, qi) => {
          const choice = picked[qi];
          const right = choice === question.answer;
          return (
            <li key={`${qi}:${question.prompt}`}>
              <p className="text-[14px] leading-snug text-paper">
                {qi + 1}. {question.prompt}
              </p>
              <div className="mt-2.5 flex flex-col gap-1.5">
                {question.options.map((option, oi) => {
                  const chosen = choice === oi;
                  const isAnswer = question.answer === oi;
                  return (
                    <button
                      key={`${oi}:${option}`}
                      type="button"
                      disabled={marked}
                      aria-pressed={chosen}
                      onClick={() =>
                        setPicked((prev) => ({ ...prev, [qi]: oi }))
                      }
                      className={cn(
                        "flex items-start gap-2.5 border px-3 py-2 text-left text-[13px] leading-snug transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                        marked &&
                          isAnswer &&
                          "border-photon bg-photon/10 text-paper",
                        marked &&
                          chosen &&
                          !isAnswer &&
                          "border-collapse bg-collapse/10 text-paper",
                        marked &&
                          !isAnswer &&
                          !chosen &&
                          "border-edge text-dim",
                        !marked &&
                          chosen &&
                          "border-photon bg-photon/10 text-paper",
                        !marked &&
                          !chosen &&
                          "border-edge bg-void text-frost hover:border-edge-hi",
                      )}
                    >
                      {marked && isAnswer && (
                        <Check
                          className="mt-0.5 size-3.5 shrink-0 text-photon"
                          aria-hidden
                        />
                      )}
                      {marked && chosen && !isAnswer && (
                        <X
                          className="mt-0.5 size-3.5 shrink-0 text-collapse"
                          aria-hidden
                        />
                      )}
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>

              {/* A professor's own question may have no explanation. */}
              {marked && question.because && (
                <p
                  className={cn(
                    "mt-2 border-l-2 pl-3 text-[12.5px] leading-relaxed text-frost",
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

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-edge pt-4">
        {!marked ? (
          <>
            <button
              type="button"
              disabled={answered < questions.length}
              onClick={mark}
              className={cn(
                "inline-flex h-10 items-center px-4 text-[13px] font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-photon",
                answered === questions.length
                  ? "bg-photon text-void hover:bg-photon-hi"
                  : "cursor-not-allowed border border-edge text-dim",
              )}
            >
              Check answers
            </button>
            <p className="font-mono text-[11px] text-dim tabular-nums">
              {answered} of {questions.length} answered
            </p>
          </>
        ) : (
          <>
            <p
              className={cn(
                "font-mono text-[12.5px] tabular-nums",
                passed ? "text-photon" : "text-collapse",
              )}
            >
              {busy ? (
                <Loader2 className="inline size-3.5 animate-spin" aria-hidden />
              ) : (
                `${score} / ${questions.length}`
              )}
              {passed ? " — passed" : " — not yet"}
            </p>

            {passed ? (
              <p className="flex items-center gap-1.5 text-[13px] text-frost">
                {signedIn ? (
                  <>
                    Lesson marked complete.
                    {!isLast && (
                      <a
                        href={`#lesson-${index + 2}`}
                        className="inline-flex items-center gap-1 text-photon underline-offset-4 hover:underline focus-visible:underline"
                      >
                        Next lesson{" "}
                        <ArrowDown className="size-3.5" aria-hidden />
                      </a>
                    )}
                    {isLast && (
                      <a
                        href="#module-lab"
                        className="inline-flex items-center gap-1 text-photon underline-offset-4 hover:underline focus-visible:underline"
                      >
                        On to the lab{" "}
                        <ArrowDown className="size-3.5" aria-hidden />
                      </a>
                    )}
                  </>
                ) : (
                  <>Sign in and this would mark the lesson complete.</>
                )}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPicked({});
                  setMarked(false);
                }}
                className="h-10 px-2 text-[13px] font-medium text-frost transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-photon"
              >
                Read it again, then retry
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
