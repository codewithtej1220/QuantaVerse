"use client";

import { useEffect } from "react";

import { hush, say, setPose } from "@/lib/mascot";

/**
 * The cat's opinion of your streak.
 *
 * Mounted by the dashboard, which is the only page that knows the number. It
 * renders nothing — it exists so the shell does not have to reach into the
 * mascot store in the middle of its own layout.
 *
 * The tone is deliberately mild. A mascot that guilt-trips is a mascot people
 * turn off, and this one is attached to a free course rather than a subscription
 * with a retention target. It looks disappointed and says one true sentence; it
 * does not beg, and it does not stay sad once you have done anything at all.
 */
export function StreakWatcher({ days }: { days: number }) {
  useEffect(() => {
    if (days > 0) return;

    // Slumped, and looking at the floor rather than at you.
    setPose("distressed");
    say("No circuits yesterday. Build one and the streak starts again today.", {
      eyebrow: "streak · 0 days",
    });

    const settle = window.setTimeout(() => {
      setPose("idle");
      hush();
    }, 11_000);

    return () => {
      window.clearTimeout(settle);
      setPose("idle");
      hush();
    };
  }, [days]);

  return null;
}
