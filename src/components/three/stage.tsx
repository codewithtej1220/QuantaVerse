"use client";

import { useEffect, useRef, useState } from "react";
import { View } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

import {
  clearZoneHover,
  setZoneHover,
  useGlobalPointer,
  useReducedMotion,
} from "@/lib/pointer";
import { useTrackScrollDepth } from "@/lib/scroll";
import { BlochPoleLabels, BlochSphere } from "./bloch-sphere";
import { EntangledPair } from "./entangled-pair";
import { GateBlock } from "./gate-block";
import { ProcessorChip } from "./processor-chip";
import { Studio } from "./studio";
import { cn } from "@/lib/utils";

/**
 * One WebGL context for the whole page.
 *
 * Each zone on the page is a plain <div> that a drei <View> tracks; the shared
 * canvas renders that zone's scene into the div's rectangle with a scissor.
 * This matters more than it sounds: a canvas per object would mean three GL
 * contexts, three depth buffers and three copies of the environment map on one
 * scroll, and browsers start dropping the oldest context somewhere around a
 * dozen. One context also means one frame loop, so the objects stay in step
 * with each other and with the scroll.
 *
 * The canvas sits behind the document at -z-10 and never takes a pointer event.
 * Every object reads the cursor and the scroll from module-level records
 * instead, so moving the mouse across the page does not render a single React
 * component.
 */

type Focus = "qubit" | "gate" | "pair" | "chip";

/** The fixed canvas. Mount exactly one, on any page that uses a Zone. */
export function Stage() {
  const [active, setActive] = useState(true);

  useEffect(() => {
    // No reason to burn a GPU on a tab nobody is looking at.
    const onVisibility = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
      <Canvas
        dpr={[1, 1.75]}
        frameloop={active ? "always" : "never"}
        camera={{ position: [0, 0, 8], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ pointerEvents: "none" }}
        fallback={null}
      >
        <View.Port />
      </Canvas>
    </div>
  );
}

/**
 * A zone: the box on the page an object is rendered into.
 *
 * `id` has to be unique on the page — it is the key the object reads its scroll
 * depth back out under.
 */
export function Zone({
  id,
  focus,
  className,
  scale = 1,
}: {
  id: string;
  focus: Focus;
  className?: string;
  scale?: number;
}) {
  const box = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useGlobalPointer();
  useTrackScrollDepth(id, box);

  useEffect(() => () => clearZoneHover(id), [id]);

  return (
    /* The canvas cannot be pointed at — it takes no events — so the zone's own
       box reports the hover on its behalf. Written to a module record rather
       than to state: the object reads it in its frame loop, and a header that
       re-rendered React on every pointer crossing would be paying for it. */
    <div
      className={cn("relative", className)}
      onPointerEnter={() => setZoneHover(id, true)}
      onPointerLeave={() => setZoneHover(id, false)}
    >
      <View ref={box} className="absolute inset-0">
        <Studio />
        <group scale={scale}>
          {focus === "qubit" && <BlochSphere depthId={id} reducedMotion={reduced} />}
          {focus === "gate" && <GateBlock depthId={id} reducedMotion={reduced} />}
          {focus === "pair" && <EntangledPair depthId={id} reducedMotion={reduced} />}
          {focus === "chip" && <ProcessorChip depthId={id} reducedMotion={reduced} />}
        </group>
      </View>
      {focus === "qubit" && <BlochPoleLabels inset="12%" />}
    </div>
  );
}
