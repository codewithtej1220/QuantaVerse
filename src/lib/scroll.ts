"use client";

import { useEffect, type RefObject } from "react";

/**
 * Scroll state for the 3D layer.
 *
 * Module-level, for the same reason the pointer record is: the field reads
 * these inside its own frame loop. Sixty scroll events a second that each
 * re-render a component is how a scroll-driven page starts to feel like it is
 * fighting you.
 */

/* ---------------- zone depth ---------------- */

const depths = new Map<string, number>();

/** 0 while the zone is still below the fold, 0.5 mid-screen, 1 once above. */
export function scrollDepth(id: string) {
  return depths.get(id) ?? 0.5;
}

export function useTrackScrollDepth(id: string, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      const box = node.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      depths.set(id, Math.min(1, Math.max(0, (viewport - box.top) / (viewport + box.height))));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      depths.delete(id);
    };
  }, [id, ref]);
}

/* ---------------- pinned-track progress ---------------- */

const tracks = new Map<string, number>();
const visible = new Map<string, number>();

export function trackProgress(id: string) {
  return tracks.get(id) ?? 0;
}

export function trackOnScreen(id: string) {
  return visible.get(id) ?? 0;
}

/** Written by ScrollTrigger's scrub. Nothing else should touch these. */
export function setTrack(id: string, progress: number, onScreen: boolean) {
  tracks.set(id, progress);
  visible.set(id, onScreen ? 1 : 0);
}

export function clearTrack(id: string) {
  tracks.delete(id);
  visible.delete(id);
}

/**
 * Turns linear scroll into a sequence that stops at each beat.
 *
 * A straight mapping means the shape is only ever correct at one exact scroll
 * position and is a smear either side of it, which is unreadable — you cannot
 * study a circuit that is halfway to being a histogram. This holds the value
 * on each whole number for most of the segment, then moves to the next one
 * quickly, so the reader gets a still frame to read the caption against and a
 * fast transition between. It is the difference between a slider and a film.
 */
export function dwell(progress: number, stops: number, hold = FILM_HOLD) {
  const span = progress * (stops - 1);
  const index = Math.floor(span);
  const within = span - index;
  if (within < hold) return Math.min(stops - 1, index);
  const t = (within - hold) / (1 - hold);
  return Math.min(stops - 1, index + t * t * (3 - 2 * t));
}

export const FILM_TRACK = "film";

/** Formations the field morphs through, in scroll order. */
export const FILM_STOPS = 5;

/**
 * Fraction of each segment a formation holds still before moving on.
 *
 * Shared with the captions so the words are on screen for exactly as long as
 * the shape they describe. Raise it and every beat lingers; the remainder is
 * the transition between beats.
 */
export const FILM_HOLD = 0.65;

/** Track progress spanned by one beat's hold. */
export const FILM_PLATEAU = FILM_HOLD / (FILM_STOPS - 1);
