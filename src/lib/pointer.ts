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
  /** Pointer speed in viewports per second, damped. Drives the wake. */
  speed: number;
}

export const pointerState: PointerState = {
  x: 0,
  y: 0,
  active: false,
  clickAt: -999,
  speed: 0,
};

let lastX = 0;
let lastY = 0;
let lastAt = 0;

let listeners = 0;

function read(clientX: number, clientY: number) {
  const x = (clientX / window.innerWidth) * 2 - 1;
  const y = 1 - (clientY / window.innerHeight) * 2;

  const now = performance.now();
  const dt = Math.max(16, now - lastAt);
  const travelled = Math.hypot(x - lastX, y - lastY);
  // Blend rather than replace, so the wake decays instead of flickering.
  pointerState.speed = Math.min(
    1,
    pointerState.speed * 0.75 + (travelled / dt) * 260 * 0.25,
  );
  lastX = x;
  lastY = y;
  lastAt = now;

  pointerState.x = x;
  pointerState.y = y;
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

/** Seconds since the pointer last moved. Drives everything that idles. */
export function pointerIdle() {
  if (!pointerState.active) return Infinity;
  return (performance.now() - lastAt) / 1000;
}

/**
 * Seconds since the last click, on the same clock the click was stamped with.
 *
 * The shockwave used to be driven by subtracting this timestamp from the
 * renderer's own elapsed time, which is a different origin — it starts when
 * the canvas mounts, not when the page loads. The ring therefore fired late by
 * however long the canvas had taken to come up, which on a cold load is about
 * a second and a half of a visitor clicking and nothing happening.
 */
export function secondsSinceClick() {
  return performance.now() / 1000 - pointerState.clickAt;
}

/**
 * Pointer speed, decayed by wall-clock time rather than by frames.
 *
 * The wake has to settle about a third of a second after the pointer stops,
 * and it has to settle on a machine dropping frames, on a background tab that
 * has had its rAF suspended, and on a 144Hz display. Decaying inside the
 * render loop makes the settle time a function of frame rate; decaying against
 * the clock makes it a function of time, which is what it is supposed to be.
 */
export function pointerSpeed() {
  const idle = (performance.now() - lastAt) / 1000;
  return pointerState.speed * Math.max(0, 1 - idle * 3);
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

/* ---------------- zone hover ---------------- */

const hovered = new Map<string, number>();

/**
 * Whether the pointer is over a given 3D zone, as 1 or 0.
 *
 * The stage canvas takes no pointer events — every object on it reads the
 * cursor from this module instead — so an object cannot raycast to discover it
 * is being pointed at. The zone's own div knows, though, and it is exactly the
 * box the object is drawn into. So the div reports it here and the object reads
 * it inside its frame loop, on the same terms as everything else: no React
 * render between the pointer moving and the picture changing.
 */
export function zoneHover(id: string) {
  return hovered.get(id) ?? 0;
}

export function setZoneHover(id: string, on: boolean) {
  hovered.set(id, on ? 1 : 0);
}

export function clearZoneHover(id: string) {
  hovered.delete(id);
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
