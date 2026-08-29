"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Circle, Loader2, Play } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { useModuleProgress } from "@/components/curriculum/use-module-progress";
import { ApiError } from "@/lib/api";
import { markLesson, unmarkLesson } from "@/lib/auth";
import { loadProgress } from "@/lib/progress-store";
import { cn } from "@/lib/utils";

interface LessonChecklistProps {
  slug: string;
  lessons: number;
  concepts: string[];
  fallbackDone: number;
  lab: { href: string; title: string } | null;
  labPending: string;
}

export function LessonChecklist({
  slug,
  lessons,
  concepts,
  fallbackDone,
  lab,
  labPending,
}: LessonChecklistProps) {
  const { user } = useAuth();
  const { entry } = useModuleProgress(slug);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completed = entry ? entry.completed_lessons : null;

  const toggle = async (index: number) => {
    if (!completed) return;
    setPending(index);
    setError(null);
    const isDone = completed.includes(index);
    const userId = user!.id;
    try {
      if (isDone) await unmarkLesson(slug, index);
      else await markLesson(slug, index);
      await loadProgress(userId, true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "that did not save");
    } finally {
      setPending(null);
    }
  };

  const rows = Array.from({ length: lessons }, (_, index) => ({
    index,
    label: concepts[index] ?? `Lesson ${index + 1}`,
  }));

  const live = Boolean(user && completed);
  const doneCount = live ? completed!.length : fallbackDone;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="eyebrow">Outline</h2>
        <p className="font-mono text-[11px] tracking-[0.14em] text-frost uppercase">
          {live ? `${doneCount}/${lessons} marked complete` : "sign in to track"}
        </p>
      </div>

      <ol className="mt-4 overflow-hidden rounded-2xl border border-edge">
        {rows.map(({ index, label }) => {
          const complete = live ? completed!.includes(index) : index < fallbackDone;
          const current = !complete && (live ? doneCount === index : index === fallbackDone);
          const busy = pending === index;

          const body = (
            <>
              <span className="w-6 shrink-0 font-mono text-[11px] text-frost tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              {busy ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-photon" />
              ) : complete ? (
                <Check className="size-4 shrink-0 text-photon" />
              ) : (
                <Circle
                  className={cn(
                    "size-3.5 shrink-0",
                    current ? "text-paper" : "text-frost",
                  )}
                />
              )}
              <span
                className={cn(
                  "flex-1 text-left text-[14px]",
                  complete ? "text-frost" : current ? "text-paper" : "text-frost",
                )}
              >
                {label}
              </span>
              <span className="shrink-0 font-mono text-[11px] tracking-[0.14em] text-frost uppercase">
                {complete ? "done" : current ? "in progress" : "queued"}
              </span>
            </>
          );

          return (
            <li
              key={index}
              className={cn(
                "border-b border-edge last:border-0",
                current ? "bg-strata" : "bg-strata",
              )}
            >
              {live ? (
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  disabled={busy}
                  aria-pressed={complete}
                  className="flex w-full items-center gap-4 px-4 py-3.5 transition-colors hover:bg-photon/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-photon disabled:opacity-60"
                >
                  {body}
                </button>
              ) : (
                <div className="flex items-center gap-4 px-4 py-3.5">{body}</div>
              )}
            </li>
          );
        })}

        {lab ? (
          <li className="bg-photon/10">
            <Link
              href={lab.href}
              className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-photon/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-photon"
            >
              <span className="w-6 shrink-0 font-mono text-[11px] text-frost tabular-nums">
                {String(lessons + 1).padStart(2, "0")}
              </span>
              <Play className="size-3.5 shrink-0 text-photon" />
              <span className="min-w-0 flex-1 text-[14px] text-paper">
                Circuit lab — {lab.title}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] text-photon uppercase">
                open
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ) : (
          <li className="flex items-center gap-4 bg-strata px-4 py-3.5">
            <span className="w-6 shrink-0 font-mono text-[11px] text-frost tabular-nums">
              {String(lessons + 1).padStart(2, "0")}
            </span>
            <Play className="size-3.5 shrink-0 text-frost" />
            <span className="min-w-0 flex-1 text-[14px] text-frost">
              Circuit lab — {labPending}
            </span>
            <span className="shrink-0 font-mono text-[11px] tracking-[0.14em] text-frost uppercase">
              not yet
            </span>
          </li>
        )}
      </ol>

      {error && (
        <p role="alert" className="mt-3 text-[12.5px] text-collapse">
          {error}
        </p>
      )}

      <p className="mt-3 text-[12px] leading-relaxed text-frost">
        {live ? (
          "Tick a lesson to record it. The dashboard counts it straight away, and finishing every lesson plus the circuit lab earns the module badge."
        ) : (
          <>
            These ticks are a sample.{" "}
            <Link href="/login" className="text-photon underline-offset-4 hover:underline">
              Sign in
            </Link>{" "}
            to record your own progress against this module.
          </>
        )}
      </p>
    </section>
  );
}
