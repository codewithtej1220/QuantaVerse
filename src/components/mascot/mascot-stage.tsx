"use client";

import { Suspense, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";

import { hush, mascotOffer, mascotSnapshot, subscribeMascot, type MascotSpeech } from "@/lib/mascot";
import { useGlobalPointer, useReducedMotion } from "@/lib/pointer";
import { openTutor } from "@/lib/tutor-bus";
import { cn } from "@/lib/utils";
import { BadgeBurst } from "./badge-burst";
import { QuantumCat } from "./quantum-cat";

/**
 * The tutor, in the corner, on every page.
 *
 * Mounted in the root layout — which is the whole reason it survives a route
 * change. Next keeps the layout mounted while pages swap underneath it, so the
 * WebGL context is never torn down and the cat is simply still there.
 *
 * The canvas is a small box pinned to the corner rather than a full-screen
 * sheet with the cat flown to a position inside it. That earlier arrangement
 * had the scene converting a normalised anchor into world units through the
 * camera while the DOM converted the same anchor into pixels, and the two
 * disagreed — the art ended up a couple of hundred pixels from its own hit
 * target. Sizing the canvas to the cat deletes the conversion: the art, the
 * button and the bubble are one box, aligned because they cannot be otherwise.
 *
 * The bubble stays DOM rather than a texture. It carries streamed model output,
 * which wants real text — selectable, wrapping, screen-readable, and set in the
 * site's own faces.
 */

const SILENT: MascotSpeech = { text: "", eyebrow: null, streaming: false, offer: false };

const neverChanges = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function MascotStage() {
  const ready = useSyncExternalStore(neverChanges, onClient, onServer);
  const reducedMotion = useReducedMotion();
  const speech = useSyncExternalStore(subscribeMascot, mascotSnapshot, () => SILENT);

  useGlobalPointer();

  if (!ready) return null;

  const open = speech.text.length > 0;

  return (
    /* Below the tutor panel (z-40) and the nav (z-50). The wrapper takes no
       pointer events, so the page underneath stays entirely usable; only the
       cat's button and the bubble opt back in. */
    <div className="pointer-events-none fixed right-4 bottom-5 z-30 sm:right-6 sm:bottom-7">
      {/* Above the cat and opening leftward: it sits against the right edge of
          the window, so it has nowhere else to go. */}
      {open && (
        <div className="animate-rise pointer-events-auto absolute right-0 bottom-full mb-3 w-[clamp(15rem,26vw,21rem)] origin-bottom-right">
          <div className="panel rounded-2xl px-4 py-3.5">
            {speech.eyebrow && <p className="eyebrow mb-1.5 text-filament">{speech.eyebrow}</p>}
            <p className="text-[13.5px] leading-relaxed text-paper" role="status" aria-live="polite">
              {speech.text}
              {speech.streaming && (
                <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] animate-pulse bg-filament align-middle" />
              )}
            </p>
            {speech.offer && (
              <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] tracking-[0.12em] text-filament uppercase">
                tap to ask <span aria-hidden>&rarr;</span>
              </p>
            )}
          </div>
          <span className="absolute right-10 -bottom-[7px] size-3.5 rotate-45 border-r border-b border-edge bg-nebula" />
        </div>
      )}

      {/* The cat, and the button over it. One box, so what you see and what you
          press cannot drift apart. */}
      <div className="relative size-[124px] sm:size-[146px]">
        <Canvas
          dpr={[1, 1.75]}
          orthographic
          /* The cat stands about 2.4 world units tall. At 146 CSS pixels the
             zoom is what decides how much world fits, so 34 leaves a margin
             rather than cropping the ears and the base of the crate. */
          camera={{ position: [0, 0, 10], zoom: 34 }}
          gl={{ antialias: true, alpha: true }}
          style={{ pointerEvents: "none" }}
          fallback={null}
        >
          <Suspense fallback={null}>
            <QuantumCat reducedMotion={reducedMotion}>
              <BadgeBurst reducedMotion={reducedMotion} />
            </QuantumCat>
          </Suspense>
        </Canvas>

        <button
          type="button"
          aria-label="Ask the tutor"
          onClick={() => {
            /* The cat is the way into the tutor, not something that talks about
               it, and it brings whatever question this page makes worth asking. */
            hush();
            openTutor(mascotOffer.ask ?? undefined);
          }}
          className={cn(
            "pointer-events-auto absolute inset-0 cursor-pointer rounded-2xl",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-filament",
          )}
        />
      </div>
    </div>
  );
}
