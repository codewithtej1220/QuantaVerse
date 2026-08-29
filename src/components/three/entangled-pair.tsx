"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { pointerState } from "@/lib/pointer";
import { scrollDepth } from "@/lib/scroll";
import { MATERIAL } from "./studio";

/**
 * A Bell pair, as two turned parts on one shaft.
 *
 * Two qubits, one copper shaft, and the two spheres counter-rotate: turn one
 * and the other turns with it, which is the only honest thing a static object
 * can say about entanglement. One is fired ceramic and one is polished copper
 * because they are distinguishable parts — the correlation is in how they move,
 * not in them being identical.
 *
 * The shaft is the giveaway that this is a manufactured thing: it is a real
 * cylinder with real ends, held between the two bodies rather than a glowing
 * line drawn between them.
 */
export function EntangledPair({
  depthId,
  reducedMotion = false,
}: {
  depthId: string;
  reducedMotion?: boolean;
}) {
  const frame = useRef<THREE.Group>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const node = frame.current;
    if (!node) return;
    const step = Math.min(delta, 1 / 30);
    const ease = Math.min(1, step * 3.2);
    const depth = scrollDepth(depthId);

    const targetY = (depth - 0.5) * Math.PI * 0.95 + pointerState.x * 0.34;
    const targetX = -pointerState.y * 0.2 + (depth - 0.5) * 0.24;
    node.rotation.y += (targetY - node.rotation.y) * ease;
    node.rotation.x += (targetX - node.rotation.x) * ease;

    // Counter-rotation: whatever one does, the other does the opposite. The
    // rate is shared, so they stay locked however the frame is moved.
    if (!reducedMotion) {
      const spin = state.clock.elapsedTime * 0.55;
      if (left.current) left.current.rotation.y = spin;
      if (right.current) right.current.rotation.y = -spin;
    }
  });

  return (
    <group ref={frame}>
      {/* The shaft. */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.055, 0.055, 3.1, 24]} />
        <meshStandardMaterial
          color={MATERIAL.accent}
          emissive={MATERIAL.accent}
          emissiveIntensity={1.6}
          toneMapped={false}
          metalness={0}
          roughness={0.4}
        />
      </mesh>

      {/* Collars where the shaft enters each body — the join, made visible. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 1.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.13, 0.13, 0.12, 24]} />
          <meshStandardMaterial
            color={MATERIAL.steelDark}
            metalness={1}
            roughness={0.4}
            envMapIntensity={1.2}
          />
        </mesh>
      ))}

      {/* q0 — polished ceramic. The equatorial groove is turned into it, so
          the counter-rotation is legible from any angle. */}
      <mesh ref={left} position={[-1.55, 0, 0]}>
        <sphereGeometry args={[0.78, 64, 64]} />
        <meshPhysicalMaterial
          color={MATERIAL.ceramic}
          metalness={0}
          roughness={0.34}
          clearcoat={1}
          clearcoatRoughness={0.06}
          envMapIntensity={1.1}
        />
      </mesh>
      <mesh position={[-1.55, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.79, 0.02, 12, 96]} />
        <meshStandardMaterial color={MATERIAL.steelDark} metalness={1} roughness={0.5} />
      </mesh>

      {/* q1 — polished chrome. */}
      <mesh ref={right} position={[1.55, 0, 0]}>
        <sphereGeometry args={[0.78, 64, 64]} />
        <meshStandardMaterial
          color={MATERIAL.chrome}
          metalness={1}
          roughness={0.12}
          envMapIntensity={1.9}
        />
      </mesh>
      <mesh position={[1.55, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.79, 0.02, 12, 96]} />
        <meshStandardMaterial color={MATERIAL.ceramic} metalness={0} roughness={0.4} />
      </mesh>
    </group>
  );
}
