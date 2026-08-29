"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { BlochVector } from "@/lib/quantum";

/**
 * The link between a student workspace and a watching instructor.
 *
 * The transport here is simulated — both ends run in one tab, and a frame is
 * handed over on a timer rather than over a socket. That is deliberate and it
 * is not a stub: everything above this file already talks in frames, so
 * swapping the two `deliver` calls for a WebSocket send/receive is the entire
 * migration. Nothing else has to change.
 *
 * The one rule the design turns on: telemetry flows student → instructor, and
 * only the ghost target flows back. An instructor can show a state but can
 * never set one, so a demonstration cannot take the controls out of a
 * learner's hands mid-thought.
 */

export interface StudentFrame {
  /** Reduced Bloch vector per qubit, straight from the simulator. */
  bloch: BlochVector[];
  qubits: number;
  depth: number;
  gateCount: number;
  probabilities: number[];
  /** Purity of the focused qubit: 1 is a pure state, 0.5 maximally mixed. */
  purity: number;
  focus: number;
  sentAt: number;
}

/** What the instructor is holding up as a target. Never applied automatically. */
export interface GhostTarget {
  theta: number;
  phi: number;
  label: string;
}

export type LinkState = "offline" | "connecting" | "live";

const IDLE_FRAME: StudentFrame = {
  bloch: [{ x: 0, y: 0, z: 1 }],
  qubits: 1,
  depth: 0,
  gateCount: 0,
  probabilities: [1],
  purity: 1,
  focus: 0,
  sentAt: 0,
};

let link: LinkState = "offline";
let latest: StudentFrame = IDLE_FRAME;
let ghost: GhostTarget | null = null;
let latency = 0;
let framesSent = 0;

const frameWatchers = new Set<() => void>();
const ghostWatchers = new Set<() => void>();
const linkWatchers = new Set<() => void>();

function announce(watchers: Set<() => void>) {
  for (const notify of watchers) notify();
}

/* ---------------- student side ---------------- */

let inFlight: ReturnType<typeof setTimeout> | null = null;

export function pushStudentFrame(frame: Omit<StudentFrame, "sentAt">) {
  if (link !== "live") return;
  framesSent += 1;

  // A real link has a delay and it varies. Modelling it here means the
  // instructor's panel is built against jitter from the first day rather than
  // discovering it the first time this runs over a network.
  const wire = 28 + Math.random() * 55;
  latency = Math.round(wire);
  if (inFlight) clearTimeout(inFlight);
  inFlight = setTimeout(() => {
    latest = { ...frame, sentAt: Date.now() };
    announce(frameWatchers);
  }, wire);
}

/* ---------------- instructor side ---------------- */

export function setGhostTarget(target: GhostTarget | null) {
  ghost = target;
  announce(ghostWatchers);
}

export function getGhostTarget() {
  return ghost;
}

export function openLink() {
  if (link === "live") return;
  link = "connecting";
  announce(linkWatchers);
  setTimeout(() => {
    link = "live";
    announce(linkWatchers);
  }, 420);
}

export function closeLink() {
  link = "offline";
  ghost = null;
  latest = IDLE_FRAME;
  framesSent = 0;
  if (inFlight) clearTimeout(inFlight);
  announce(linkWatchers);
  announce(ghostWatchers);
  announce(frameWatchers);
}

/* ---------------- reads ---------------- */

export function getStudentFrame() {
  return latest;
}

export function getLinkState() {
  return link;
}

export function getLinkStats() {
  return { latency, framesSent };
}

export function useStudentFrame() {
  return useSyncExternalStore(
    (notify) => {
      frameWatchers.add(notify);
      return () => frameWatchers.delete(notify);
    },
    getStudentFrame,
    () => IDLE_FRAME,
  );
}

export function useGhostTarget() {
  return useSyncExternalStore(
    (notify) => {
      ghostWatchers.add(notify);
      return () => ghostWatchers.delete(notify);
    },
    getGhostTarget,
    () => null,
  );
}

export function useLinkState() {
  return useSyncExternalStore(
    (notify) => {
      linkWatchers.add(notify);
      return () => linkWatchers.delete(notify);
    },
    getLinkState,
    () => "offline" as LinkState,
  );
}

/** Closes the link when the workspace unmounts, so a stale ghost cannot persist. */
export function useLinkTeardown() {
  useEffect(() => closeLink, []);
}

/* ---------------- helpers ---------------- */

/** Bloch vector to the angles the read-outs and the ghost are written in. */
export function anglesOf(v: BlochVector) {
  const r = Math.hypot(v.x, v.y, v.z);
  if (r < 1e-6) return { theta: Math.PI / 2, phi: 0, r: 0 };
  return { theta: Math.acos(Math.min(1, Math.max(-1, v.z / r))), phi: Math.atan2(v.y, v.x), r };
}

export function vectorOf(theta: number, phi: number, r = 1): BlochVector {
  return {
    x: r * Math.sin(theta) * Math.cos(phi),
    y: r * Math.sin(theta) * Math.sin(phi),
    z: r * Math.cos(theta),
  };
}

/**
 * How far a student is from the target, as an angle in radians.
 *
 * The instructor panel grades on this rather than on component-wise difference,
 * because two states that differ only by a global phase are the same state and
 * should score as such.
 */
export function angleBetween(a: BlochVector, b: BlochVector) {
  const la = Math.hypot(a.x, a.y, a.z);
  const lb = Math.hypot(b.x, b.y, b.z);
  if (la < 1e-6 || lb < 1e-6) return Math.PI;
  const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
  return Math.acos(Math.min(1, Math.max(-1, dot)));
}
