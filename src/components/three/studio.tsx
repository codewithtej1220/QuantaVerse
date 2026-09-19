"use client";

import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

/**
 * The lighting rig.
 *
 * Every focal object on the site is lit like a product photograph rather than
 * like a game: a long softbox overhead, two narrow strips raking the sides, and
 * a black surround. That surround is the important part — polished metal is
 * only convincing when most of what it reflects is dark, so the bright edges
 * read as edges. A scene lit from every direction turns the same material into
 * grey plastic.
 *
 * The environment map is built in-scene from these lightformers, so there is no
 * HDR file to download and nothing to fetch from a CDN.
 *
 * One rule about the accent: cyan is never a metal here. The structural parts —
 * rings, shafts, housings — are chrome and steel, and the cyan is always
 * something that emits. A quantum state is not made of a shiny blue material,
 * it is the thing that is lit up, and holding that line is most of why these
 * objects read as hardware rather than as toys.
 */

export const MATERIAL = {
  /** The state. Always emissive, never a surface. */
  accent: "#2fe4ff",
  accentDeep: "#0b6b82",
  /** Polished chrome — the parts that hold things. */
  chrome: "#cfd6dd",
  /** Machined steel, left matte. */
  steel: "#8a8a84",
  steelDark: "#4a4a47",
  /** Fired ceramic, polished. */
  ceramic: "#f2f2ef",
  /** The chassis everything is mounted to. Tracks --color-nebula. */
  chassis: "#0f2438",
} as const;

/** Overhead key, two rim strips, black surround. */
export function Studio({ intensity = 1 }: { intensity?: number }) {
  return (
    <>
      {/* Enough ambient to keep the shadow side from going to pure black,
          and no more — the modelling is done by the environment. */}
      <ambientLight intensity={0.36 * intensity} />
      <directionalLight position={[5, 7, 5]} intensity={2.1 * intensity} color="#f2f8ff" />
      <directionalLight position={[-6, -1, -4]} intensity={0.7 * intensity} color="#9fd8e8" />

      <Environment resolution={256}>
        {/* The surround. Reflections resolve to near-black except where a
            lightformer is, which is what gives metal its hard edges. */}
        <mesh scale={60}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial color="#050505" side={THREE.BackSide} />
        </mesh>

        {/* Key: a long softbox directly overhead. */}
        <Lightformer
          form="rect"
          intensity={7 * intensity}
          color="#ffffff"
          position={[0, 6, 1]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[9, 3, 1]}
        />
        {/* Rim strips: one warm from the right, one cool from the left, both
            narrow so they land as a line down the curve of a sphere. */}
        <Lightformer
          form="rect"
          intensity={4.6 * intensity}
          color="#d8f4ff"
          position={[5, 1, 2]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[6, 1.2, 1]}
        />
        <Lightformer
          form="rect"
          intensity={3.2 * intensity}
          color="#7fe3ff"
          position={[-5, 0, 1]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[6, 0.9, 1]}
        />
        {/* A low fill behind, so silhouettes separate from the page. */}
        <Lightformer
          form="rect"
          intensity={2 * intensity}
          color="#ffffff"
          position={[0, -3, -4]}
          rotation={[-Math.PI / 3, 0, 0]}
          scale={[7, 2, 1]}
        />
      </Environment>
    </>
  );
}
