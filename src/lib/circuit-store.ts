"use client";

/**
 * What the tutor can see.
 *
 * The tutor sidebar lives in the root layout, so it cannot receive the sandbox's
 * state through props. The sandbox publishes the circuit it is showing here, and
 * the tutor sends exactly that to the API — which is what makes "reads your
 * screen" a description rather than a boast.
 */

import type { CircuitIR } from "@/lib/api";

export interface ScreenCircuit {
  /** The circuit itself, ready to POST. Null when no circuit is open. */
  ir: CircuitIR | null;
  /** One line for the context strip: "3 qubits · depth 2 · 4 gates". */
  summary: string;
  /** Lesson or preset the learner is working on, when there is one. */
  lessonId: string | null;
}

const EMPTY: ScreenCircuit = { ir: null, summary: "no circuit open", lessonId: null };

let current: ScreenCircuit = EMPTY;
const subscribers = new Set<(circuit: ScreenCircuit) => void>();

export function publishCircuit(circuit: ScreenCircuit) {
  current = circuit;
  for (const notify of subscribers) notify(circuit);
}

export function clearCircuit() {
  publishCircuit(EMPTY);
}

export function subscribeCircuit(notify: (circuit: ScreenCircuit) => void) {
  subscribers.add(notify);
  notify(current);
  return () => {
    subscribers.delete(notify);
  };
}

export function getCircuit() {
  return current;
}

/**
 * One line for the context strip.
 *
 * `depth` and `gates` come from the sandbox's own read-out rather than the IR, so
 * the tutor quotes the same numbers the learner is looking at — measurements
 * included, even though they leave the timeline on the way to the server.
 */
export function describeCircuit(ir: CircuitIR, depth: number, gates: number) {
  return `${ir.qubits} qubits · depth ${depth} · ${gates} gate${gates === 1 ? "" : "s"}`;
}
