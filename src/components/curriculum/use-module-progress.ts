"use client";

import { useEffect, useSyncExternalStore } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import type { ModuleProgress } from "@/lib/auth";
import { loadProgress, progressSnapshot, subscribeProgress } from "@/lib/progress-store";

export function useModuleProgress(slug: string) {
  const { user, ready } = useAuth();
  const userId = user?.id ?? null;

  const snapshot = useSyncExternalStore(
    subscribeProgress,
    () => progressSnapshot(userId),
    () => null,
  );

  useEffect(() => {
    if (!ready || userId === null) return;
    void loadProgress(userId);
  }, [ready, userId]);

  const entry: ModuleProgress | null =
    snapshot?.data?.modules.find((row) => row.slug === slug) ?? null;

  return { entry, error: snapshot?.error ?? null, signedIn: userId !== null };
}
