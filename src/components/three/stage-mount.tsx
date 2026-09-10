"use client";

import { Suspense, useSyncExternalStore } from "react";

import LatticeField from "./lattice-field";
import QuantumField from "./quantum-field";
import { Stage } from "./stage";

/**
 * The whole 3D layer, mounted on the client only.
 *
 * Two canvases, deliberately. The field is one full-viewport sheet of points
 * behind everything at -z-20; the stage is the anchored focal objects at -z-10.
 * They could share a context, but only by rendering the field into a scissored
 * view and then compositing the objects over it without clearing the depth
 * buffer between them — which is how you get objects punching holes in the
 * field they are supposed to be floating in front of. Two contexts, two depth
 * buffers, no interference.
 *
 * WebGL cannot render on a server, so both wait for hydration. The zones the
 * stage draws into *do* render server-side, as empty boxes of the right size,
 * so the type around them is laid out correctly on the first paint and nothing
 * jumps when the canvases arrive.
 *
 * The client check goes through useSyncExternalStore rather than a mount flag
 * in an effect: the very first client render already knows the answer, so React
 * never has to reconcile a server "null" against a live canvas.
 */
const neverChanges = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function StageMount() {
  const ready = useSyncExternalStore(neverChanges, onClient, onServer);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      {/* The lattice is the background. The field is here only for the film —
          it holds at nothing until that track is on screen. */}
      <LatticeField />
      <QuantumField />
      <Stage />
    </Suspense>
  );
}

/**
 * The lattice on its own, for every page that is not the landing page.
 *
 * No `Stage` alongside it: the stage exists to render into `Zone` boxes, and a
 * page without a zone would be paying for a second WebGL context to draw
 * nothing. No `QuantumField` either — its formations are the landing page's
 * film, and it has nothing to say on a page with no film track.
 */
export function LatticeMount() {
  const ready = useSyncExternalStore(neverChanges, onClient, onServer);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <LatticeField />
    </Suspense>
  );
}
