"use client";

/**
 * A way to open the tutor from anywhere.
 *
 * The panel owns its own open state, and the mascot sits in the root layout
 * with no path to it — the same separation `circuit-store` exists to bridge in
 * the other direction. One channel, one subscriber, no context provider for
 * what is really a single boolean and an occasional nudge.
 *
 * `ask` carries an optional question so the cat can open the panel already
 * holding something: tapping it on a lesson page can raise the tutor with the
 * lesson's own question in the box, rather than an empty prompt the reader now
 * has to fill in themselves.
 */

type Handler = (question?: string, options?: OpenOptions) => void;

export interface OpenOptions {
  /**
   * Ask it, rather than leave it typed in the box.
   *
   * A tap on the cat drops the page's suggested question in the box, because
   * that question is only a suggestion and the reader may well want to change
   * it. A button that says "Ask the tutor why" is not a suggestion, and the
   * first version treated it as one: the panel opened with the question sitting
   * unsent, and a learner who had pressed "ask" sat waiting for an answer that
   * nothing had requested.
   */
  send?: boolean;
}

let handler: Handler | null = null;

/** Registered by the tutor panel. Only one panel exists. */
export function receiveTutorOpen(next: Handler | null) {
  handler = next;
}

/** Open the tutor. Optionally with a question typed — or, with `send`, asked. */
export function openTutor(question?: string, options?: OpenOptions) {
  handler?.(question, options);
}

/** Whether anything is listening — the cat should not offer what cannot open. */
export function tutorReachable() {
  return handler !== null;
}
