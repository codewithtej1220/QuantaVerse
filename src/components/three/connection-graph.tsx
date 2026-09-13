"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { pointerState } from "@/lib/pointer";
import { scrollDepth } from "@/lib/scroll";
import { MATERIAL } from "./studio";

/**
 * The hub, as a network with you in the middle of it.
 *
 * This replaces an entangled pair — two spheres on a shaft — which was chosen
 * because two things that only mean something together is a fair description of
 * what a collaboration page is for. It was also, unavoidably, a picture of
 * entanglement, and a reader arriving on a directory of researchers had no way
 * to know the object was about them rather than about physics. On a page whose
 * job is to say "find someone who has already been stuck here", a node graph
 * says it in the first second and the pair never did.
 *
 * Built as hardware rather than as a glowing web, because that is the language
 * every other object on this site is drawn in: real spheres, real struts
 * between them, and the accent reserved for the one node that is you. The
 * near links run in accent and the far ones in steel, so the thing reads as a
 * reach outwards from a centre rather than as an undifferentiated mesh.
 *
 * The layout is written out rather than generated. Sixteen nodes is few enough
 * to place by hand, and a hand-placed graph avoids the two ways a random one
 * goes wrong: struts that cross where they look like a join, and a cluster that
 * happens to read as a face.
 */

/** Nodes, in view space. The first is the centre — the visitor. */
const NODES: [number, number, number][] = [
  [0, 0, 0],

  // Inner ring: the people one hop away.
  [-1.45, 0.62, 0.25],
  [1.38, 0.78, -0.2],
  [-1.2, -0.82, -0.3],
  [1.5, -0.55, 0.3],
  [0.15, 1.32, 0.15],
  [-0.3, -1.28, 0.2],

  // Outer ring: the wider directory, reachable through somebody.
  [-2.55, 1.28, -0.35],
  [2.48, 1.35, 0.3],
  [-2.62, -0.35, 0.4],
  [2.66, -0.28, -0.35],
  [-1.75, -1.62, -0.25],
  [1.82, -1.5, 0.35],
  [0.85, 1.92, -0.3],
  [-0.95, 1.85, 0.3],
  [0.05, -2.05, -0.2],
];

/** Links from the centre outwards — the accent ones. */
const NEAR: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
];

/** Peer links, further out. Steel, so the centre stays the subject. */
const FAR: [number, number][] = [
  [1, 7],
  [1, 14],
  [2, 8],
  [2, 13],
  [3, 9],
  [3, 11],
  [4, 10],
  [4, 12],
  [5, 13],
  [5, 14],
  [6, 11],
  [6, 15],
  [11, 15],
  [12, 15],
  [7, 9],
  [8, 10],
];

interface Strut {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  length: number;
}

/** A cylinder is built along Y, so each strut is rotated onto its own axis. */
function strutsFor(pairs: [number, number][]): Strut[] {
  const up = new THREE.Vector3(0, 1, 0);
  return pairs.map(([a, b]) => {
    const from = new THREE.Vector3(...NODES[a]);
    const to = new THREE.Vector3(...NODES[b]);
    const along = new THREE.Vector3().subVectors(to, from);
    const length = along.length();
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, along.clone().normalize());
    return {
      position: [mid.x, mid.y, mid.z],
      quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
      length,
    };
  });
}

export function ConnectionGraph({
  depthId,
  reducedMotion = false,
}: {
  depthId: string;
  reducedMotion?: boolean;
}) {
  const frame = useRef<THREE.Group>(null);
  const centre = useRef<THREE.Mesh>(null);

  const near = useMemo(() => strutsFor(NEAR), []);
  const far = useMemo(() => strutsFor(FAR), []);

  useFrame((state, delta) => {
    const node = frame.current;
    if (!node) return;
    const step = Math.min(delta, 1 / 30);
    const ease = Math.min(1, step * 3.2);
    const depth = scrollDepth(depthId);

    /* The same drive as every other object on the site: scroll sets the pose,
       the pointer leans it. A graph is read rather than admired, so this turns
       less than the pair it replaces — enough for the struts to separate in
       depth, not so much that a node you were looking at has moved. */
    const targetY = (depth - 0.5) * Math.PI * 0.42 + pointerState.x * 0.4;
    const targetX = -pointerState.y * 0.24 + (depth - 0.5) * 0.18;
    node.rotation.y += (targetY - node.rotation.y) * ease;
    node.rotation.x += (targetX - node.rotation.x) * ease;

    // The centre turns on its own, so the object is alive when nothing moves.
    if (!reducedMotion && centre.current) {
      centre.current.rotation.y = state.clock.elapsedTime * 0.4;
    }
  });

  return (
    <group ref={frame}>
      {/* Far links first, so the accent ones draw over them. */}
      {far.map((strut, index) => (
        <mesh
          key={`far-${index}`}
          position={strut.position}
          quaternion={strut.quaternion}
        >
          <cylinderGeometry args={[0.012, 0.012, strut.length, 6]} />
          <meshStandardMaterial color={MATERIAL.steelDark} metalness={1} roughness={0.55} />
        </mesh>
      ))}

      {near.map((strut, index) => (
        <mesh
          key={`near-${index}`}
          position={strut.position}
          quaternion={strut.quaternion}
        >
          <cylinderGeometry args={[0.022, 0.022, strut.length, 8]} />
          <meshStandardMaterial
            color={MATERIAL.accent}
            emissive={MATERIAL.accent}
            emissiveIntensity={1.25}
            toneMapped={false}
            metalness={0}
            roughness={0.4}
          />
        </mesh>
      ))}

      {/* The other people. Ceramic and chrome alternate so the ring does not
          read as one repeated part stamped out sixteen times. */}
      {NODES.slice(1).map((position, index) => {
        const inner = index < 6;
        const ceramic = index % 2 === 0;
        return (
          <mesh key={`node-${index}`} position={position}>
            <sphereGeometry args={[inner ? 0.2 : 0.15, 32, 32]} />
            {ceramic ? (
              <meshPhysicalMaterial
                color={MATERIAL.ceramic}
                metalness={0}
                roughness={0.34}
                clearcoat={1}
                clearcoatRoughness={0.08}
                envMapIntensity={1.1}
              />
            ) : (
              <meshStandardMaterial
                color={MATERIAL.chrome}
                metalness={1}
                roughness={0.16}
                envMapIntensity={1.8}
              />
            )}
          </mesh>
        );
      })}

      {/* You. Larger, lit from within, and the only accent body in the scene —
          which is what makes the graph read as a reach outwards rather than as
          a constellation somebody else is at the middle of. */}
      <mesh ref={centre}>
        <sphereGeometry args={[0.34, 48, 48]} />
        <meshStandardMaterial
          color={MATERIAL.accent}
          emissive={MATERIAL.accent}
          emissiveIntensity={1.5}
          toneMapped={false}
          metalness={0}
          roughness={0.35}
        />
      </mesh>

      {/* A turned collar on the centre, so it is a made object at any angle
          rather than a glowing ball. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.42, 0.018, 12, 96]} />
        <meshStandardMaterial color={MATERIAL.steelDark} metalness={1} roughness={0.45} />
      </mesh>
    </group>
  );
}
