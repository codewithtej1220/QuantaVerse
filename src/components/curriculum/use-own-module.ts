"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { fetchOwnModule, type OwnModuleView } from "@/lib/own-modules";

/**
 * A professor's own module, fetched for whoever is signed in.
 *
 * The module page and its lab page both need it, and both need the same four
 * answers before they can draw anything: still checking the account, nobody
 * signed in, not one of this viewer's professors' modules, or the module. An
 * answer is kept with the account it was fetched for, so signing out and in
 * as somebody else never shows them the last person's module.
 */

type Loaded =
  | { key: string; view: OwnModuleView }
  | { key: string; error: string; status: number };

export type OwnModuleState =
  | { kind: "checking" }
  | { kind: "signed-out" }
  | { kind: "loading" }
  | { kind: "closed" }
  | { kind: "failed"; error: string; retry: () => void }
  | {
      kind: "ready";
      view: OwnModuleView;
      replace: (view: OwnModuleView) => void;
    };

export function useOwnModule(slug: string): OwnModuleState {
  const { user, ready } = useAuth();
  const key = user ? `${slug}:${user.id}` : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!key) return;
    let live = true;
    fetchOwnModule(slug).then(
      (view) => live && setLoaded({ key, view }),
      (error: unknown) =>
        live &&
        setLoaded({
          key,
          error:
            error instanceof ApiError
              ? error.message
              : "this module could not be loaded",
          status: error instanceof ApiError ? error.status : 0,
        }),
    );
    return () => {
      live = false;
    };
  }, [key, slug, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  const replace = useCallback(
    (view: OwnModuleView) => key && setLoaded({ key, view }),
    [key],
  );

  if (!ready) return { kind: "checking" };
  if (!key) return { kind: "signed-out" };
  const current = loaded && loaded.key === key ? loaded : null;
  if (!current) return { kind: "loading" };
  if ("error" in current) {
    return current.status === 404
      ? { kind: "closed" }
      : { kind: "failed", error: current.error, retry };
  }
  return { kind: "ready", view: current.view, replace };
}
