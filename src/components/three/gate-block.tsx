"use client";

import { useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { pointerState } from "@/lib/pointer";
import { scrollDepth } from "@/lib/scroll";
import { MATERIAL } from "./studio";

/**
 * A gate, as a part.
 *
 * A gate is drawn as a lettered box in every textbook, so this is that box
 * milled out of steel with the letter inlaid in copper — the same way a real
 * front panel is made, and the reason the letter is built from three bars
 * rather than set in a typeface. There is no font file to fetch and the H is
 * geometry, so it catches the studio lights along its machined edges as the
 * block turns.
 *
 * Scroll is the primary driver here: the block completes most of a revolution
 * as its zone crosses the viewport, so the face you are reading about is the
 * face you are looking at. The cursor adds a small tip on top of that.
 */

const BODY = 2.15;
const DEPTH = 0.62;

/** The bar positions of a capital H, as fractions of the block face. */
const STROKES: Array<[x: number, y: number, w: number, h: number]> = [
  [-0.42, 0, 0.2, 1.16],
  [0.42, 0, 0.2, 1.16],
  [0, 0, 0.66, 0.2],
];

export function GateBlock({
  depthId,
  reducedMotion = false,
}: {
  depthId: string;
  reducedMotion?: boolean;
}) {
  const frame = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const node = frame.current;
    if (!node) return;
    const ease = Math.min(1, Math.min(delta, 1 / 30) * 3.4);
    // Someone who asked for less motion gets the block held square-on; the
    // cursor still tips it, because that is a movement they asked for.
    const depth = reducedMotion ? 0.5 : scrollDepth(depthId);

    /* Scroll is the only thing that turns this, and it turns it through about
       a hundred degrees: square-on when the zone is centred, and angled far
       enough at either end of the pass to show the chamfer and the copper
       backplate. It deliberately never reaches edge-on — an edge-on slab is
       an invisible slab, and the letter is the point. Nothing here is on a
       timer, so what you see is a function of where you have scrolled to. */
    const targetY = (depth - 0.5) * Math.PI * 0.55 + pointerState.x * 0.3;
    const targetX = -pointerState.y * 0.24 + (depth - 0.5) * 0.3;

    node.rotation.y += (targetY - node.rotation.y) * ease;
    node.rotation.x += (targetX - node.rotation.x) * ease;
    node.position.y += ((0.5 - depth) * 0.5 - node.position.y) * ease;
  });

  return (
    <group ref={frame}>
      {/* The copper backplate it is mounted to — visible as the block turns,
          and the reason the silhouette is not one flat slab. */}
      <RoundedBox args={[BODY * 1.12, BODY * 1.12, 0.12]} radius={0.03} position={[0, 0, -0.4]}>
        <meshStandardMaterial
          color={MATERIAL.accentDeep}
          metalness={1}
          roughness={0.42}
          envMapIntensity={1.3}
        />
      </RoundedBox>

      {/* Body: steel, left matte, with a chamfer wide enough to read. */}
      <RoundedBox args={[BODY, BODY, DEPTH]} radius={0.07} smoothness={6}>
        <meshStandardMaterial
          color={MATERIAL.steel}
          metalness={1}
          roughness={0.58}
          envMapIntensity={1.25}
        />
      </RoundedBox>

      {/* Copper inlay line around the face — a seam, not a decoration: it is
          where the plate meets the body. */}
      <mesh position={[0, 0, DEPTH / 2 - 0.005]}>
        <ringGeometry args={[BODY * 0.47, BODY * 0.49, 4, 1, Math.PI / 4]} />
        <meshStandardMaterial
          color={MATERIAL.accent}
          emissive={MATERIAL.accent}
          emissiveIntensity={1.1}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* The letter, inlaid proud of the face on both sides so the block reads
          the same whichever way it has turned. */}
      {[1, -1].map((face) =>
        STROKES.map(([x, y, w, h], i) => (
          <mesh key={`${face}-${i}`} position={[x * face, y, face * (DEPTH / 2 + 0.02)]}>
            <boxGeometry args={[w, h, 0.06]} />
            <meshStandardMaterial
              color={MATERIAL.accent}
              emissive={MATERIAL.accent}
              emissiveIntensity={1.8}
              toneMapped={false}
              metalness={0}
              roughness={0.4}
            />
          </mesh>
        )),
      )}
    </group>
  );
}
