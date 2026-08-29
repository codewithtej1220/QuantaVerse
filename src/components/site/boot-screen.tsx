"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useProgress } from "@react-three/drei";

import { fireBurst } from "@/lib/burst";
import {
  bootScreenPending,
  consumeBootScreen,
  hasBooted,
  markBooted,
  subscribeBoot,
} from "@/lib/boot";

const STAGES = [
  { at: 0, label: "Typefaces" },
  { at: 34, label: "Geometry" },
  { at: 72, label: "Shaders" },
  { at: 99, label: "Ready" },
] as const;

/** If something never resolves, the page is still more useful than the counter. */
const PATIENCE = 4000;

/** Just past the exit transition, in case transitionend never arrives. */
const EXIT = 700;

function useBootMilestones() {
  return useSyncExternalStore(
    subscribeBoot,
    () => (hasBooted("fonts") ? 1 : 0) + (hasBooted("field") ? 1 : 0),
    () => 0,
  );
}

export function BootScreen() {
  const milestones = useBootMilestones();
  const { progress: assetProgress, total: assetTotal } = useProgress();
  const [shown] = useState(bootScreenPending);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    if (shown) consumeBootScreen();
  }, [shown]);

  useEffect(() => {
    if (!shown || gone) return;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [shown, gone]);

  useEffect(() => {
    if (!shown) return;
    document.fonts.ready.then(() => markBooted("fonts"));
    /* Forces the counter itself, not just the milestones behind it. The climb
       runs on requestAnimationFrame, which a browser suspends in a background
       tab — so a visitor who opens this in a tab and switches away used to come
       back to a black screen at 56% that could never finish, with the scroll
       lock still on. Nothing about getting out of the way may depend on
       animation frames. */
    const bail = window.setTimeout(() => {
      markBooted("fonts");
      markBooted("field");
      setPercent(100);
    }, PATIENCE);
    return () => window.clearTimeout(bail);
  }, [shown]);

  useEffect(() => {
    if (!shown || gone) return;
    let frame = 0;

    const step = () => {
      // Assets count only if any exist; this page has none, so the two real
      // milestones carry the whole counter.
      const assets = assetTotal > 0 ? assetProgress / 100 : 1;
      const target = Math.round((milestones / 2) * 80 + assets * 20);

      setPercent((current) => {
        if (current >= target) return current;
        // Chases the target instead of snapping, so the digits climb like a
        // readout rather than teleporting between two numbers.
        return Math.min(target, current + Math.max(1, Math.ceil((target - current) * 0.12)));
      });
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [shown, gone, milestones, assetProgress, assetTotal]);

  useEffect(() => {
    if (!shown || percent < 100 || leaving) return;
    const hold = window.setTimeout(() => setLeaving(true), 180);
    return () => window.clearTimeout(hold);
  }, [shown, percent, leaving]);

  // transitionend is the normal path out; this is the one that guarantees it.
  useEffect(() => {
    if (!leaving) return;
    const done = window.setTimeout(() => setGone(true), EXIT);
    /* Fire the entrance burst partway through the wipe rather than at the top
       of it. The burst peaks about a quarter of a second after it is cued, and
       the overlay takes 620ms to clear — cue it immediately and the best part
       happens behind a black panel. */
    const entrance = window.setTimeout(() => fireBurst({ y: 0.1, size: 1.3 }), 260);
    return () => {
      window.clearTimeout(done);
      window.clearTimeout(entrance);
    };
  }, [leaving]);

  if (!shown || gone) return null;

  const stage = [...STAGES].reverse().find((entry) => percent >= entry.at) ?? STAGES[0];

  return (
    <div
      aria-hidden
      onTransitionEnd={() => setGone(true)}
      className="fixed inset-0 z-[100] flex flex-col justify-between bg-void px-5 py-8 will-change-transform lg:px-10 lg:py-12"
      style={{
        transform: leaving ? "translate3d(0,-100%,0)" : "none",
        transition: leaving ? "transform 620ms cubic-bezier(0.86, 0, 0.07, 1)" : "none",
      }}
    >
      <p className="font-mono text-sm tracking-[0.28em] text-frost uppercase">QuantaVerse</p>

      <div className="flex items-end justify-between gap-6">
        <p
          className="font-display leading-[0.8] font-extrabold tracking-[-0.05em] text-paper tabular-nums"
          style={{ fontSize: "clamp(6rem, 26vw, 22rem)" }}
        >
          {percent}
        </p>
        <p className="pb-3 font-mono text-sm tracking-[0.2em] text-photon uppercase lg:pb-6">
          {stage.label}
        </p>
      </div>
    </div>
  );
}
