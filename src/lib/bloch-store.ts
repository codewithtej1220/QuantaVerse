"use client";

/**
 * A one-value store for the live Bloch state.
 *
 * The 3D scene publishes the qubit's angles ~12 times a second. Routing that
 * through React state in a parent would re-render the <Canvas> subtree at the
 * same rate, so only the leaf read-outs subscribe here.
 */

export interface BlochReadout {
  /** Polar angle, 0 at |0> and π at |1>. */
  theta: number;
  /** Relative phase. */
  phi: number;
  /** Probability of measuring |0>. */
  p0: number;
}

let current: BlochReadout = { theta: Math.PI * 0.32, phi: 0.6, p0: 0.75 };
const subscribers = new Set<(readout: BlochReadout) => void>();

export function publishReadout(readout: BlochReadout) {
  current = readout;
  for (const notify of subscribers) notify(readout);
}

export function subscribeReadout(notify: (readout: BlochReadout) => void) {
  subscribers.add(notify);
  notify(current);
  return () => {
    subscribers.delete(notify);
  };
}

export function getReadout() {
  return current;
}

/** Radians as a multiple of π, the way a physicist would write the angle. */
export function formatRadians(value: number) {
  return `${(value / Math.PI).toFixed(2)}π`;
}
