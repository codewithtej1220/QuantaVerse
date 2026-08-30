"use client";

import { Suspense, useSyncExternalStore } from "react";

import QuantumField, { type FieldIntensity } from "./quantum-field";
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
      <QuantumField />
      <Stage />
    </Suspense>
  );
}

/**
 * The field on its own, for every page that is not the landing page.
 *
 * No `Stage` alongside it: the stage exists to render into `Zone` boxes, and a
 * page without a zone would be paying for a second WebGL context to draw
 * nothing. With no film track registered, `trackOnScreen` returns 0 and the
 * field holds the formless cloud — the cursor still tears through it, but it
 * never re-forms into a shape that has nothing to say on that page.
 */
export function FieldMount({ intensity }: { intensity?: FieldIntensity }) {
  const ready = useSyncExternalStore(neverChanges, onClient, onServer);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <QuantumField intensity={intensity} />
    </Suspense>
  );
}
