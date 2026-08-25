"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";

import { useGlobalPointer, useReducedMotion } from "@/lib/pointer";
import type { BlochVector } from "@/lib/quantum";
import { cn } from "@/lib/utils";
import { BlochSphere } from "./bloch-sphere";

/**
 * A self-contained Bloch sphere for panels that already know the state.
 *
 * Used by the sandbox: the simulator hands over a reduced Bloch vector and this
 * renders it. It does not publish to the landing page's read-out store, and the
 * cursor only tips the viewing angle here — it never edits the state, because in
 * the sandbox the circuit is the only thing allowed to do that.
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
        <circle r={R} fill="none" stroke="#38e8ff" strokeOpacity="0.22" />
        <ellipse rx={R} ry={R * 0.3} fill="none" stroke="#38e8ff" strokeOpacity="0.16" />
        <line x1="0" y1={-R} x2="0" y2={R} stroke="#afc0e8" strokeOpacity="0.14" />
        <line
          x1="0"
          y1="0"
          x2={sx}
          y2={sy}
          stroke="#38e8ff"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={sx} cy={sy} r={length < 0.02 ? 4 : 5} fill="#38e8ff" />
      </svg>
      <p className="absolute bottom-2 font-mono text-[9.5px] tracking-[0.14em] text-frost/40 uppercase">
        flat projection · gpu context paused
      </p>
    </div>
  );
}

export default function BlochCanvas({
  vector,
  className,
}: {
  vector: BlochVector;
  className?: string;
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
        <BlochSphere source={vector} publish={false} reducedMotion={reduced} tilt={0.55} />
      </Canvas>
      {lost && <FlatBloch vector={vector} />}
    </div>
  );
}
