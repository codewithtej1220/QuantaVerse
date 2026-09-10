"use client";

import { useEffect } from "react";

import { publishReadout } from "./bloch-store";
import { pointerIdle, pointerState, prefersReducedMotion, zoneHover } from "./pointer";

/**
 * The hero qubit's state, integrated outside the renderer.
 *
 * This used to live in the Bloch sphere's useFrame, which made the read-out
 * panel a hostage of the WebGL loop: when the sphere's view was scrolled off,
 * the tab was throttled or the canvas simply had not started, the panel went on
 * displaying the store's initial values under a heading that says "Live state".
 * Wrong numbers presented as live are worse than no numbers.
 *
 * So the physics runs here, on its own frame loop, and both consumers read it:
 * the panel subscribes to the published read-out, and the sphere poses itself
 * from the same angles. The panel is now correct even if WebGL never starts.
 */

export interface QubitState {
  theta: number;
  phi: number;
}

/**
 * The zone the cursor has to be inside to be preparing this qubit.
 *
 * Matches the `id` on the hero's `<Zone focus="qubit">`. Before this, the
 * driver read the pointer wherever it was on the page, so the state — and the
 * "live state" panel's numbers with it — changed while you scrolled past the
 * paragraph, reached for the nav, or moved the mouse to close the tab. Numbers
 * that move for no reason are worse than numbers that do not move.
 */
const STAGE = "hero-qubit";

const state: QubitState = { theta: Math.PI * 0.32, phi: 0.6 };

let precession = 0;
let frame = 0;
let last = 0;
let lastEmit = 0;
let users = 0;

export function drivenQubit(): QubitState {
  return state;
}

function tick(now: number) {
  frame = requestAnimationFrame(tick);

  const seconds = now / 1000;
  const step = Math.min(1 / 30, last ? seconds - last : 1 / 60);
  last = seconds;

  const reduced = prefersReducedMotion();

  /* Preparation happens on the sphere and nowhere else.
     Off it, nothing is driven at all — not theta, not phi, not the precession.
     The state simply holds the last thing the cursor made of it, which is what
     "the live state should change only when I put the cursor on it" means: a
     phase that keeps turning while you are reading a paragraph is still the
     panel changing on its own. */
  const preparing = zoneHover(STAGE) > 0.5;

  if (!preparing) {
    if (seconds - lastEmit > 0.08) {
      lastEmit = seconds;
      const half = Math.cos(state.theta / 2);
      publishReadout({ theta: state.theta, phi: state.phi, p0: half * half });
    }
    return;
  }

  /* On the sphere, the cursor prepares the state; after a second of stillness
     it hands over to Larmor precession, where theta holds and phi advances so
     the vector walks a cone. Accumulated rather than derived from the clock, so
     handing control back and forth never makes the arrow jump. */
  const idleness = reduced ? 0 : Math.min(1, Math.max(0, (pointerIdle() - 1) / 2.5));
  precession += step * idleness * 0.8;

  const aimed = Math.min(Math.max(((1 - pointerState.y) / 2) * Math.PI, 0.13), Math.PI - 0.13);
  const targetTheta = aimed + (0.95 - aimed) * idleness;
  const targetPhi = pointerState.x * Math.PI * 0.9 + precession;

  const ease = Math.min(1, step * 4.2);
  state.theta += (targetTheta - state.theta) * ease;

  // Shortest way round, so a phase crossing ±π does not spin the arrow.
  let delta = targetPhi - state.phi;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  state.phi += delta * ease;

  // ~12Hz to the panel; React does not need sixty renders a second to show
  // two decimal places.
  if (seconds - lastEmit > 0.08) {
    lastEmit = seconds;
    const half = Math.cos(state.theta / 2);
    publishReadout({ theta: state.theta, phi: state.phi, p0: half * half });
  }
}

/** Runs the loop for as long as anything on the page is showing this state. */
export function useQubitDrive() {
  useEffect(() => {
    users += 1;
    if (users === 1) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
    return () => {
      users -= 1;
      if (users === 0 && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
  }, []);
}
