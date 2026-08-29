"use client";

/**
 * First-load milestones.
 *
 * drei's useProgress only knows about things that went through three's loading
 * manager, and this page has none — every object is procedural geometry and the
 * environment map is built in-scene. Left to itself the counter would sit at
 * zero and then jump, which is worse than no counter at all. So the boot screen
 * is driven by what genuinely costs time on a cold load: the webfonts, the
 * three.js chunk, and the first frame the field actually renders.
 */

export type BootStep = "fonts" | "field";

const reached = new Set<BootStep>();
const listeners = new Set<() => void>();

export function markBooted(step: BootStep) {
  if (reached.has(step)) return;
  reached.add(step);
  for (const notify of listeners) notify();
}

export function hasBooted(step: BootStep) {
  return reached.has(step);
}

export function subscribeBoot(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/**
 * The boot screen is a first-load event, not a route transition.
 *
 * Split into a pure read and an explicit consume so the component can decide
 * during render without mutating anything there — a render that React throws
 * away must not be able to spend the one showing this screen gets.
 */
let consumed = false;

export function bootScreenPending() {
  return !consumed;
}

export function consumeBootScreen() {
  consumed = true;
}
