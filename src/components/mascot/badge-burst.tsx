"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { mascot } from "@/lib/mascot";

/**
 * Badges, fired out of the box when an assessment passes.
 *
 * Ballistics by hand rather than a physics engine. Rapier is a megabyte of
 * WASM and a solver stepping a whole world, and what actually happens here is
 * eight discs on a parabola with drag — the entire simulation is four lines in
 * the frame loop. A physics engine would be the right call the moment they had
 * to collide with each other or with the page; they do not.
 *
 * They rise, spread, slow, and hang for a moment before fading, which is the
 * shape of a reward: the eye needs time to read what it won.
 */

const COUNT = 8;
const GRAVITY = -3.1;
const DRAG = 0.62;

/** The three tones the site already uses for gates, so a badge belongs here. */
const TONES = ["#2fe4ff", "#ff8c2b", "#f2f2ef"];

interface Badge {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  spin: number;
  angle: number;
  life: number;
  tone: number;
}

function seed(): Badge {
  // Up and outward, with enough spread that they never stack into one line.
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
  const speed = 2.6 + Math.random() * 1.5;
  return {
    position: new THREE.Vector3(0, -0.2, 0.3 + Math.random() * 0.2),
    velocity: new THREE.Vector3(
      -Math.cos(angle) * speed * 0.55,
      Math.sin(angle) * -speed,
      0,
    ),
    spin: (Math.random() - 0.5) * 7,
    angle: Math.random() * Math.PI,
    life: 0,
    tone: Math.floor(Math.random() * TONES.length),
  };
}

export function BadgeBurst({
  reducedMotion = false,
}: {
  reducedMotion?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const meshes = useRef<(THREE.Group | null)[]>([]);
  const badges = useRef<Badge[]>([]);
  const seenBurst = useRef(mascot.burst);
  const active = useRef(false);

  const geometry = useMemo(() => new THREE.CircleGeometry(0.17, 6), []);
  const ring = useMemo(() => new THREE.RingGeometry(0.185, 0.215, 6), []);

  useFrame((_, delta) => {
    const step = Math.min(delta, 1 / 30);

    if (mascot.burst !== seenBurst.current) {
      seenBurst.current = mascot.burst;
      badges.current = Array.from({ length: COUNT }, seed);
      active.current = true;
    }

    if (!active.current) return;

    let alive = false;
    badges.current.forEach((badge, i) => {
      badge.life += step;
      // Drag first, then gravity: the arc flattens as it rises, which reads as
      // weight without needing a real solver.
      badge.velocity.multiplyScalar(1 - DRAG * step);
      badge.velocity.y += GRAVITY * step * (reducedMotion ? 0 : 1);
      badge.position.addScaledVector(badge.velocity, step);
      badge.angle += badge.spin * step;

      const node = meshes.current[i];
      if (!node) return;

      const fade = Math.max(0, 1 - Math.max(0, badge.life - 1.5) / 1.1);
      const pop = Math.min(1, badge.life * 7);
      node.position.copy(badge.position);
      node.rotation.z = badge.angle;
      node.scale.setScalar(pop * fade);
      node.visible = fade > 0.01;

      if (fade > 0.01) alive = true;
    });

    if (!alive) {
      active.current = false;
      for (const node of meshes.current) if (node) node.visible = false;
    }
  });

  return (
    <group ref={group} position={[0, -0.1, 0]}>
      {Array.from({ length: COUNT }, (_, i) => (
        <group
          key={i}
          visible={false}
          ref={(node) => {
            meshes.current[i] = node;
          }}
        >
          <mesh geometry={geometry}>
            <meshBasicMaterial
              color={TONES[i % TONES.length]}
              toneMapped={false}
            />
          </mesh>
          <mesh geometry={ring} position={[0, 0, 0.001]}>
            <meshBasicMaterial color="#0c0d11" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
