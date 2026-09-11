"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { ActionLink } from "@/components/site/action";
import { ApiError } from "@/lib/api";
import { saveStartingPoint } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * The two questions, asked once, straight after sign-up.
 *
 * The track is gated in sequence: a module opens when the one before it is
 * finished. That is right for somebody meeting linear algebra and Python at the
 * same time and wrong for somebody who has already written Qiskit, and until
 * now the second person had to grind through the first person's first module to
 * prove it. These answers are what open the track further up.
 *
 * They are a starting point and not a score, and the page says so rather than
 * leaving it to be discovered. Nothing here awards XP, mastery or a badge —
 * every number on the dashboard still has to be earned — so there is no reason
 * to overclaim, and the answer can be changed later without anything to undo.
 */

interface Choice {
  value: number;
  label: string;
  detail: string;
}

interface Question {
  key: "math" | "code";
  eyebrow: string;
  prompt: string;
  choices: Choice[];
}

const QUESTIONS: Question[] = [
  {
    key: "math",
    eyebrow: "Question 1 of 2",
    prompt: "How comfortable are you with linear algebra, matrices and basic quantum mechanics?",
    choices: [
      {
        value: 0,
        label: "New to it",
        detail: "Matrices are unfamiliar, or it has been a long time.",
      },
      {
        value: 1,
        label: "Some of it",
        detail: "Comfortable with vectors and matrices. Quantum mechanics is new.",
      },
      {
        value: 2,
        label: "Comfortable",
        detail: "Linear algebra is second nature and I have met quantum states before.",
      },
    ],
  },
  {
    key: "code",
    eyebrow: "Question 2 of 2",
    prompt: "How much programming have you done, and have you used a quantum framework?",
    choices: [
      { value: 0, label: "New to it", detail: "Little or no Python." },
      {
        value: 1,
        label: "Python, not quantum",
        detail: "I can write Python. I have not used Qiskit, PennyLane or Cirq.",
      },
      {
        value: 2,
        label: "Used a framework",
        detail: "I have built circuits in Qiskit, PennyLane or Cirq.",
      },
    ],
  },
];

/** Mirrors `head_start` on the server, so the page can say what it will do. */
const modulesOpened = (math: number | null, code: number | null) =>
  1 + (math ?? 0) + (code ?? 0);

export function StartingPoint() {
  const router = useRouter();
  const [answers, setAnswers] = useState<{ math: number | null; code: number | null }>({
    math: null,
    code: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = answers.math !== null && answers.code !== null;

  const submit = async () => {
    if (!complete) return;
    setBusy(true);
    setError(null);
    try {
      await saveStartingPoint(answers.math!, answers.code!);
      router.push("/curriculum");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "that did not save — try again");
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <p className="eyebrow">Welcome · /welcome</p>
      <h1 className="display-2 mt-5">Where should this start?</h1>
      <p className="lede mt-5 max-w-xl">
        Two questions, asked once. They decide how much of the track is open on your first day
        and what the first suggestion aims at — not your score. Every number on your dashboard
        still has to be earned, so there is nothing to be gained by overstating this, and you can
        change it later.
      </p>

      <div className="mt-12 flex flex-col gap-10">
        {QUESTIONS.map((question) => (
          <fieldset key={question.key}>
            <legend className="contents">
              <p className="eyebrow">{question.eyebrow}</p>
              <p className="mt-2.5 max-w-2xl text-[17px] leading-snug text-paper">
                {question.prompt}
              </p>
            </legend>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {question.choices.map((choice) => {
                const picked = answers[question.key] === choice.value;
                return (
                  <button
                    key={choice.value}
                    type="button"
                    aria-pressed={picked}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [question.key]: choice.value }))
                    }
                    className={cn(
                      "flex flex-col gap-1.5 border p-4 text-left transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                      picked
                        ? "border-photon bg-photon/10"
                        : "border-edge bg-nebula hover:border-edge-hi",
                    )}
                  >
                    <span
                      className={cn(
                        "font-mono text-[12px] tracking-[0.1em] uppercase",
                        picked ? "text-photon" : "text-paper",
                      )}
                    >
                      {choice.label}
                    </span>
                    <span className="text-[13px] leading-snug text-frost">{choice.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {/* What the answers actually buy, stated before they are sent rather than
          discovered afterwards on a page that looks different than expected. */}
      <p
        className="mt-10 border-t border-edge pt-5 font-mono text-[12px] text-frost"
        aria-live="polite"
      >
        {complete
          ? `${modulesOpened(answers.math, answers.code)} of 8 modules will be open from the start. The rest unlock as you finish the ones before them.`
          : "Answer both and this will say where the track opens."}
      </p>

      {error && <p className="mt-4 text-[13px] text-collapse">{error}</p>}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={!complete || busy}
          className={cn(
            "group inline-flex h-12 items-center gap-2 px-6 text-[14px] font-medium",
            "transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-photon",
            complete && !busy
              ? "bg-photon text-void hover:bg-[#8af2ff]"
              : "cursor-not-allowed border border-edge text-dim",
          )}
        >
          {busy ? "Saving…" : "Open my track"}
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
        </button>

        {/* Skippable. An unanswered account is not a broken one — it simply
            starts at lesson one, which is where it would have started anyway. */}
        <ActionLink href="/curriculum" variant="quiet">
          Skip, start at the beginning
        </ActionLink>
      </div>
    </div>
  );
}
