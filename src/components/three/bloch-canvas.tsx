"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";

import { useGlobalPointer, useReducedMotion } from "@/lib/pointer";
import type { BlochVector } from "@/lib/quantum";
import { cn } from "@/lib/utils";
import { BlochPoleLabels, BlochSphere } from "./bloch-sphere";
import { Studio, MATERIAL } from "./studio";

/**
 * A self-contained Bloch sphere for panels that already know the state.
 *
 * Used by the sandbox, which is a different route from the landing page and so
 * gets its own context rather than the shared stage. The simulator hands over a
 * reduced Bloch vector and this renders it. It does not publish to the landing
 * page's read-out store, and the cursor only tips the viewing angle here — it
 * never edits the state, because in the sandbox the circuit is the only thing
 * allowed to do that.
 */

const R = 74;

/**
 * Flat fallback, drawn when the browser takes the WebGL context away — which it
 * does on some machines once enough contexts are open. The state is still exact,
 * so the panel degrades to a projection rather than to an empty box.
 */
function FlatBloch({ vector }: { vector: BlochVector }) {
  const sx = R * (0.86 * vector.x + 0.5 * vector.y);
  const sy = R * (0.3 * vector.x - 0.3 * vector.y - 0.88 * vector.z);
  const length = Math.hypot(vector.x, vector.y, vector.z);

  return (
    <div className="absolute inset-0 grid place-items-center">
      <svg viewBox="-100 -100 200 200" className="h-[190px] w-[190px]" aria-hidden>
        <circle r={R} fill="none" stroke={MATERIAL.steel} strokeOpacity="0.5" />
        <ellipse rx={R} ry={R * 0.3} fill="none" stroke={MATERIAL.steel} strokeOpacity="0.3" />
        <line x1="0" y1={-R} x2="0" y2={R} stroke={MATERIAL.steel} strokeOpacity="0.3" />
        <line
          x1="0"
          y1="0"
          x2={sx}
          y2={sy}
          stroke={MATERIAL.accent}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={sx} cy={sy} r={length < 0.02 ? 4 : 5} fill={MATERIAL.accent} />
      </svg>
      <p className="absolute bottom-2 font-mono text-[11px] tracking-[0.14em] text-dim uppercase">
        flat projection · gpu context paused
      </p>
    </div>
  );
}

export default function BlochCanvas({
  vector,
  className,
  ghost = null,
  cloud = null,
  impulse = 0,
}: {
  vector: BlochVector;
  className?: string;
  /** An instructor's target, drawn beside the student's own vector. */
  ghost?: BlochVector | null;
  cloud?: { p0: number; measuredAt: number | null; outcome: 0 | 1 } | null;
  impulse?: number;
}) {
  useGlobalPointer();
  const reduced = useReducedMotion();
  const [lost, setLost] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 5.2], fov: 44 }}
        gl={{ antialias: true, alpha: true }}
        style={{ pointerEvents: "none" }}
        className={cn("transition-opacity duration-300", lost && "opacity-0")}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener("webglcontextlost", () => setLost(true));
          canvas.addEventListener("webglcontextrestored", () => setLost(false));
        }}
        fallback={null}
      >
        <Studio intensity={0.9} />
        <BlochSphere
          source={vector}
          reducedMotion={reduced}
          tilt={0.55}
          ghost={ghost}
          cloud={cloud}
          impulse={impulse}
        />
      </Canvas>
      {!lost && <BlochPoleLabels inset="2%" />}
      {lost && <FlatBloch vector={vector} />}
    </div>
  );
}
