"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { saveStartingPoint } from "@/lib/auth";
import { loadProgress } from "@/lib/progress-store";
import { cn } from "@/lib/utils";

/**
 * The two questions, asked once, in a box over the page.
 *
 * The track is gated in sequence: a module opens when the one before it is
 * finished. That is right for somebody meeting linear algebra and Python at the
 * same time and wrong for somebody who has already written Qiskit and now has
 * to grind through "what is a qubit" to prove it. These answers open the track
 * further up.
 *
 * A box rather than a page it lands on, for two reasons. It reads as a step in
 * the way a destination does not — the track is visible behind it, so what the
 * answers are about is on screen while they are being given. And it can be put
 * to an account that already exists, which a post-registration route cannot:
 * everybody who signed up before this shipped would otherwise keep the strictly
 * sequential gating forever, having never been asked.
 *
 * Nothing here awards XP, mastery or a badge — every number on the dashboard
 * still has to be earned — so there is no advantage in overclaiming, and the
 * answers can be changed later without anything to undo.
 */

interface Choice {
  value: number;
  label: string;
  detail: string;
}

const QUESTIONS: { key: "math" | "code"; prompt: string; choices: Choice[] }[] = [
  {
    key: "math",
    prompt: "Comfortable with linear algebra, matrices and basic quantum mechanics?",
    choices: [
      { value: 0, label: "New to it", detail: "Matrices are unfamiliar, or it has been years." },
      { value: 1, label: "Some of it", detail: "Vectors and matrices, yes. Quantum, no." },
      { value: 2, label: "Comfortable", detail: "Both are familiar ground." },
    ],
  },
  {
    key: "code",
    prompt: "How much Python, and have you used Qiskit, PennyLane or Cirq?",
    choices: [
      { value: 0, label: "New to it", detail: "Little or no Python." },
      { value: 1, label: "Python only", detail: "I can write Python. No quantum framework." },
      { value: 2, label: "Used a framework", detail: "I have built circuits in one of them." },
    ],
  },
];

/** Mirrors `head_start` on the server, so the box can say what it will do. */
const modulesOpened = (math: number, code: number) => 1 + math + code;

export function StartingPointDialog() {
  const { user, refreshUser } = useAuth();
  const [answers, setAnswers] = useState<{ math: number | null; code: number | null }>({
    math: null,
    code: null,
  });
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Null and zero are different: null is nobody asked, zero is they were asked
     and said they are starting from nothing. Only the first opens this. */
  const unanswered = Boolean(user) && user!.math_level === null && user!.code_level === null;
  const open = unanswered && !dismissed;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const complete = answers.math !== null && answers.code !== null;

  const submit = async () => {
    if (!complete || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveStartingPoint(answers.math!, answers.code!);
      /* Refresh both: the profile is what closes this box, and the progress
         snapshot is what re-draws the track behind it with the extra modules
         already open. Without the second the box shuts on an unchanged page. */
      await refreshUser();
      if (user) await loadProgress(user.id, true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "that did not save — try again");
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Where should this start?"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-void/85 p-5"
      onClick={(event) => {
        if (event.target === event.currentTarget) setDismissed(true);
      }}
    >
      <div className="panel my-auto w-full max-w-2xl rounded-2xl p-6">
        <p className="eyebrow">Before you start</p>
        <h2 className="mt-2 text-[20px] font-medium text-paper">Where should this start?</h2>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-frost">
          Two questions, asked once. They decide how much of the track is open on day one and what
          the first suggestion aims at — not your score. Everything on your dashboard still has to
          be earned, so there is nothing to gain by overstating it.
        </p>

        <div className="mt-6 flex flex-col gap-6">
          {QUESTIONS.map((question) => (
            <fieldset key={question.key}>
              <legend className="contents">
                <p className="text-[14px] leading-snug text-paper">{question.prompt}</p>
              </legend>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
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
                        "flex flex-col gap-1 border p-3 text-left transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                        picked
                          ? "border-photon bg-photon/10"
                          : "border-edge bg-strata hover:border-edge-hi",
                      )}
                    >
                      <span
                        className={cn(
                          "font-mono text-[11.5px] tracking-[0.1em] uppercase",
                          picked ? "text-photon" : "text-paper",
                        )}
                      >
                        {choice.label}
                      </span>
                      <span className="text-[12px] leading-snug text-frost">{choice.detail}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        {/* What the answers buy, said before they are sent rather than
            discovered afterwards on a track that looks unexpectedly different. */}
        <p
          className="mt-6 border-t border-edge pt-4 font-mono text-[11.5px] text-frost"
          aria-live="polite"
        >
          {complete
            ? `${modulesOpened(answers.math!, answers.code!)} of 8 modules open from the start. The rest unlock as you finish the ones before them.`
            : "Answer both and this will say where the track opens."}
        </p>

        {error && <p className="mt-3 text-[13px] text-collapse">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={!complete || busy}
            className={cn(
              "group inline-flex h-11 items-center gap-2 px-5 text-[13px] font-medium",
              "transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-photon",
              complete && !busy
                ? "bg-photon text-void hover:bg-photon-hi"
                : "cursor-not-allowed border border-edge text-dim",
            )}
          >
            {busy ? "Saving…" : "Open my track"}
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
          </button>

          {/* Skippable, and it does not come back this session. An unanswered
              account is not a broken one: it starts at lesson one, which is
              where it would have started anyway. */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="h-11 px-2 text-[13px] font-medium text-frost transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-photon"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
