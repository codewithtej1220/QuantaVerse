"use client";

/**
 * Cued bursts.
 *
 * The field fires bursts on its own and on a click, but two moments on the
 * page deserve one on purpose: the boot screen lifting, and the point in the
 * scroll film where the circuit collapses into its histogram. Neither of those
 * callers should have to import three.js to ask for one, so the request goes
 * through here as plain numbers and the field picks it up on its next frame.
 *
 * Coordinates are normalised screen space — (0, 0) centre, (±1, ±1) edges — so
 * a caller can aim a burst without knowing the camera. `size` is a multiplier
 * on the standard burst radius.
 */

export interface BurstCue {
  x: number;
  y: number;
  size: number;
}

let pending: BurstCue | null = null;

export function fireBurst(cue: Partial<BurstCue> = {}) {
  pending = { x: cue.x ?? 0, y: cue.y ?? 0, size: cue.size ?? 1 };
}

/** Consumed by the field. Returns the cue once, then forgets it. */
export function takeBurst() {
  const cue = pending;
  pending = null;
  return cue;
}
