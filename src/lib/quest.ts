"use client";

import { useEffect, useSyncExternalStore } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import type { ModuleProgress, ProgressResponse } from "@/lib/auth";
import { loadProgress, progressSnapshot, subscribeProgress } from "@/lib/progress-store";

/**
 * The learner's real record, for the pages that were showing a fixture.
 *
 * The curriculum was built against `MODULES` and `LEARNER` in `data.ts` — a
 * hand-written example learner, which is fine for a signed-out visitor looking
 * at what the course is, and wrong for a signed-in one who has actually done
 * six lessons and is being shown somebody else's progress bar.
 *
 * This hook hands back whichever is true: the account's own record when there
 * is one, and `null` when there is not, so a caller can fall back to the
 * fixture rather than render an empty shell.
 */

/** XP per lesson finished. */
export const XP_PER_LESSON = 40;
/** XP for passing a module's graded circuit — worth more than reading. */
export const XP_PER_CHALLENGE = 150;
/** XP for a badge, which is the module finished end to end. */
export const XP_PER_BADGE = 100;

export interface LiveProgress {
  data: ProgressResponse | null;
  error: string | null;
  /** True once we know one way or the other. */
  ready: boolean;
  signedIn: boolean;
}

export function useLiveProgress(): LiveProgress {
  const { user, ready: authReady } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (userId !== null) void loadProgress(userId);
  }, [userId]);

  const snapshot = useSyncExternalStore(
    subscribeProgress,
    () => progressSnapshot(userId),
    () => null,
  );

  return {
    data: snapshot?.data ?? null,
    error: snapshot?.error ?? null,
    ready: authReady && (userId === null || snapshot !== null),
    signedIn: userId !== null,
  };
}

/**
 * What a module is worth, and how much of it has been banked.
 *
 * Deliberately derived from things the learner did rather than stored as its
 * own number: XP that can drift from the lessons behind it is XP nobody
 * believes. Recomputing it here means the two can never disagree.
 */
export function moduleXp(row: ModuleProgress) {
  const earned =
    row.lessons_completed * XP_PER_LESSON +
    (row.challenge?.passed ? XP_PER_CHALLENGE : 0) +
    (row.badge_earned ? XP_PER_BADGE : 0);

  const possible =
    row.lessons * XP_PER_LESSON + (row.challenge ? XP_PER_CHALLENGE : 0) + XP_PER_BADGE;

  return { earned, possible };
}

export function totalXp(modules: ModuleProgress[]) {
  return modules.reduce(
    (sum, row) => {
      const { earned, possible } = moduleXp(row);
      return { earned: sum.earned + earned, possible: sum.possible + possible };
    },
    { earned: 0, possible: 0 },
  );
}

/** Modules keyed by slug, for a list that needs to look one up per row. */
export function bySlug(modules: ModuleProgress[]) {
  return new Map(modules.map((row) => [row.slug, row]));
}
