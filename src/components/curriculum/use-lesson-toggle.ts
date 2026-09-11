"use client";

import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { useModuleProgress } from "@/components/curriculum/use-module-progress";
import { ApiError } from "@/lib/api";
import { markLesson, unmarkLesson } from "@/lib/auth";
import { loadProgress } from "@/lib/progress-store";

/**
 * Ticking a lesson, in one place.
 *
 * This used to live inside the outline, which was the only thing that could
 * mark a lesson. Once the outline moved to the rail as a navigator, the mark
 * had to move to the bottom of the lesson itself — you finish reading, then you
 * say so — and two components needed the same write. Rather than have the rail
 * and the body each own a copy of it and race each other's refreshes, both read
 * this.
 *
 * `completed` is null rather than empty when nobody is signed in. Empty would
 * mean "an account with nothing marked", and the two render differently: one
 * offers a control, the other explains why there is not one.
 */
export function useLessonToggle(slug: string) {
  const { user } = useAuth();
  const { entry } = useModuleProgress(slug);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completed = entry ? entry.completed_lessons : null;
  const signedIn = Boolean(user);

  const toggle = async (index: number) => {
    if (!completed || !user) return;
    setPending(index);
    setError(null);
    const wasDone = completed.includes(index);
    try {
      if (wasDone) await unmarkLesson(slug, index);
      else await markLesson(slug, index);
      /* Forced, because the point of marking is that everything counting the
         module — the rail, the outline, the dashboard — moves at once. */
      await loadProgress(user.id, true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "that did not save");
    } finally {
      setPending(null);
    }
  };

  return {
    completed,
    signedIn,
    pending,
    error,
    toggle,
    isDone: (index: number) => Boolean(completed?.includes(index)),
  };
}
