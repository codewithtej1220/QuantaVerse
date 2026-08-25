"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * A single module-level pointer record shared by every 3D consumer.
 *
 * Mouse movement must never trigger a React render — the 3D scene reads this
 * object inside its own frame loop and damps toward it, which is what keeps the
 * motion smooth regardless of how fast the pointer moves.
 */
export interface PointerState {
  /** -1 (left) … 1 (right) */
  x: number;
  /** -1 (bottom) … 1 (top) */
  y: number;
  /** False until the visitor has actually moved a pointer. */
  active: boolean;
  /** Seconds timestamp of the last click, for the collapse shockwave. */
  clickAt: number;
}

export const pointerState: PointerState = { x: 0, y: 0, active: false, clickAt: -999 };

let listeners = 0;

function read(clientX: number, clientY: number) {
  pointerState.x = (clientX / window.innerWidth) * 2 - 1;
  pointerState.y = 1 - (clientY / window.innerHeight) * 2;
  pointerState.active = true;
}

function onPointerMove(event: PointerEvent) {
  read(event.clientX, event.clientY);
}

function onTouchMove(event: TouchEvent) {
  const touch = event.touches[0];
  if (touch) read(touch.clientX, touch.clientY);
}

function onPointerDown(event: PointerEvent) {
  read(event.clientX, event.clientY);
  pointerState.clickAt = performance.now() / 1000;
}

function onLeave() {
  pointerState.active = false;
}

/** Attaches the global listeners once, however many scenes are mounted. */
export function useGlobalPointer() {
  useEffect(() => {
    listeners += 1;
    if (listeners === 1) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("pointerdown", onPointerDown, { passive: true });
      document.addEventListener("pointerleave", onLeave);
    }
    return () => {
      listeners -= 1;
      if (listeners === 0) {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("pointerleave", onLeave);
      }
    };
  }, []);
}

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** True when the visitor has asked the OS to keep motion to a minimum. */
export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(REDUCE_QUERY).matches;
}

function subscribeToMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * The same preference, as a hook.
 *
 * Read through `useSyncExternalStore` rather than an effect: the scene gets the
 * real answer on its first client render, so a visitor who asked for less motion
 * never sees the full animation start and then stop.
 */
export function useReducedMotion() {
  return useSyncExternalStore(subscribeToMotion, prefersReducedMotion, () => false);
}
