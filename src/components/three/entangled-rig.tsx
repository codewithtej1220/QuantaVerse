"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { useGlobalPointer, useReducedMotion } from "@/lib/pointer";
import type { BlochVector } from "@/lib/quantum";
import { cn } from "@/lib/utils";
import { BlochSphere } from "./bloch-sphere";
import { MATERIAL, Studio } from "./studio";

/**
 * Two qubits, and the thing between them.
 *
 * Nothing here mirrors anything. Both gyroscopes are fed the reduced Bloch
 * vector the simulator already computes for their wire, so turning qubit A with
 * a gate moves qubit B only when the state actually says it should — and when
 * the pair is separable, B sits still no matter what you do to A. A mirrored
 * animation would look the same in the entangled case and lie in every other
 * one.
 *
 * The tether is the honest part. For a pure two-qubit state the concurrence is
 * sqrt(1 - r²) in the length of either reduced vector, so entanglement is
 * already sitting in the numbers on screen. Slack and dim at zero, taut and
 * lit at one: as a Bell pair forms, both arrows shrink to nothing and the line
 * between them pulls straight. The correlation goes exactly where the
 * individual states go.
 */

const SEGMENTS = 60;
const SPAN = 2.35;

/** Concurrence of a pure two-qubit state, from either reduced vector's length. */
export function concurrenceOf(bloch: BlochVector[]) {
  if (bloch.length < 2) return 0;
  const r = Math.hypot(bloch[0].x, bloch[0].y, bloch[0].z);
  return Math.sqrt(Math.max(0, 1 - r * r));
}

function Tether({ tension, reducedMotion }: { tension: number; reducedMotion: boolean }) {
  const line = useRef<THREE.Line>(null);
  const shown = useRef(0);
  const positions = useMemo(() => new Float32Array((SEGMENTS + 1) * 3), []);
  const colors = useMemo(() => new Float32Array((SEGMENTS + 1) * 3), []);
  const cool = useMemo(() => new THREE.Color("#0b3d4d"), []);
  const hot = useMemo(() => new THREE.Color(MATERIAL.accent), []);
  const tint = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const node = line.current;
    if (!node) return;
    const step = Math.min(delta, 1 / 30);
    shown.current += (tension - shown.current) * Math.min(1, step * 3.5);
    const t = shown.current;

    const attr = node.geometry.getAttribute("position") as THREE.BufferAttribute;
    const paint = node.geometry.getAttribute("color") as THREE.BufferAttribute;
    const buffer = attr.array as Float32Array;
    const paints = paint.array as Float32Array;

    const sag = (1 - t) * 0.95;
    const shimmer = reducedMotion ? 0 : state.clock.elapsedTime * 3.4;

    for (let i = 0; i <= SEGMENTS; i += 1) {
      const u = i / SEGMENTS;
      const x = -SPAN + u * SPAN * 2;
      // A slack line hangs; a taut one is straight. The parabola is the whole
      // read-out, and it is legible from across a room.
      const droop = -Math.sin(u * Math.PI) * sag;
      const buzz = reducedMotion ? 0 : Math.sin(u * 22 + shimmer) * 0.02 * t;
      buffer[i * 3] = x;
      buffer[i * 3 + 1] = droop + buzz;
      buffer[i * 3 + 2] = 0;

      tint.copy(cool).lerp(hot, t);
      paints[i * 3] = tint.r;
      paints[i * 3 + 1] = tint.g;
      paints[i * 3 + 2] = tint.b;
    }
    attr.needsUpdate = true;
    paint.needsUpdate = true;
  });

  return (
    <line ref={line as never}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.95} toneMapped={false} />
    </line>
  );
}

function Rig({
  bloch,
  reducedMotion,
  ghost,
  focus,
}: {
  bloch: BlochVector[];
  reducedMotion: boolean;
  ghost: BlochVector | null;
  focus: number;
}) {
  const tension = concurrenceOf(bloch);

  return (
    <>
      <Tether tension={tension} reducedMotion={reducedMotion} />
      {[0, 1].map((q) => (
        <group key={q} position={[q === 0 ? -SPAN : SPAN, 0, 0]} scale={0.62}>
          <BlochSphere
            source={bloch[q] ?? { x: 0, y: 0, z: 1 }}
            reducedMotion={reducedMotion}
            tilt={0.4}
            // The target belongs to the wire the instructor is discussing, not
            // to both of them.
            ghost={q === focus ? ghost : null}
          />
        </group>
      ))}
    </>
  );
}

export function EntangledRig({
  bloch,
  className,
  ghost = null,
  focus = 0,
}: {
  bloch: BlochVector[];
  className?: string;
  ghost?: BlochVector | null;
  focus?: number;
}) {
  useGlobalPointer();
  const reduced = useReducedMotion();
  const [lost, setLost] = useState(false);
  const tension = concurrenceOf(bloch);

  return (
    <div className={cn("relative", className)}>
      <Canvas
        dpr={[1, 1.6]}
        camera={{ position: [0, 0.4, 7.4], fov: 42 }}
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
        <Studio intensity={0.85} />
        <Rig bloch={bloch} reducedMotion={reduced} ghost={ghost} focus={focus} />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-4 pb-3">
        <span className="ket text-[13px] text-photon">q0</span>
        <span className="text-center font-mono text-[11px] tracking-[0.14em] text-dim uppercase">
          concurrence{" "}
          <span className={tension > 0.02 ? "text-photon" : "text-dim"}>{tension.toFixed(2)}</span>
          <span className="mt-0.5 block text-[10px] tracking-[0.1em] normal-case">
            {tension > 0.97
              ? "maximally entangled · tether taut"
              : tension > 0.02
                ? "partially entangled"
                : "separable · tether slack"}
          </span>
        </span>
        <span className="ket text-[13px] text-photon">q1</span>
      </div>

      {lost && (
        <p className="absolute inset-0 grid place-items-center font-mono text-[11px] tracking-[0.14em] text-dim uppercase">
          gpu context paused
        </p>
      )}
    </div>
  );
}
