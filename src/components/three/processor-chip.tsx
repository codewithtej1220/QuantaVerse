"use client";

import { useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { pointerState, zoneHover } from "@/lib/pointer";
import { scrollDepth } from "@/lib/scroll";
import { MATERIAL } from "./studio";

/**
 * The processor.
 *
 * A packaged die seen at a raking angle, with its fan-out routed across the
 * substrate: the traces leave the die, break at forty-five degrees the way real
 * routing does, and run out to the pins. It is the one object on this site that
 * is a classical machine, which is the point of it sitting at the top of the
 * page where you build a circuit to run on a quantum one.
 *
 * Everything glowing is a shader on flat geometry rather than a lit material.
 * A trace is a conductor with current in it, not a shiny blue surface, and the
 * house rule about the accent applies here as much as anywhere: the substrate,
 * the rim and the pins are metal and take the studio lighting; the cyan emits.
 *
 * Point at it and the die pushes a wavefront out along every trace at once.
 * That is the interaction — the fan-out is a picture of something being carried
 * outward, so the hover makes the carrying visible rather than just brightening
 * the whole thing.
 */

/* --- proportions, in scene units --------------------------------------- */

const PKG = 2.0;
/** The die, raised proud of the substrate. */
const DIE = 0.58;
const SUB_H = 0.2;
/** Where the routed surface sits, just clear of the substrate face. */
const TRACE_Y = SUB_H / 2 + 0.006;
const TRACE_W = 0.043;
/** Traces per side of the die. */
const PER_SIDE = 24;
/**
 * How far past the package edge the board fan-out carries on.
 *
 * Kept short deliberately. The view is scissored to the zone's box, so anything
 * that reaches past it is not vignetted — it is cut off with a straight edge,
 * which reads as a bug rather than as a crop. The package wants to be the thing
 * filling the frame anyway.
 */
const BOARD = 2.3;

type Pt = [x: number, z: number];

/**
 * One trace, as a right-angled path from the die out to the package edge.
 *
 * Real fan-out leaves a die perpendicular, breaks at forty-five degrees to gain
 * lateral room, then runs straight again. Reproducing that rather than drawing
 * a radial spray is most of why this reads as a component instead of a sunburst.
 */
function traceFor(t: number, target: number, from: number, to: number): Pt[] {
  const run = Math.abs(target - t);
  const knee = Math.min(from + 0.14 + run, to - 0.08);
  return [
    [t, from],
    [t, Math.min(from + 0.14, knee)],
    [target, knee],
    [target, to],
  ];
}

/** Deterministic per-trace jitter, so the board is the same on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 4_294_967_296;
  };
}

/**
 * Every trace on the board, merged into one buffer.
 *
 * Two hundred-odd polylines is two hundred-odd draw calls if they are meshes,
 * and this is a decoration in a page header. They share a material and never
 * move relative to each other, so they are one geometry: quads laid flat, with
 * the radial position of each vertex carried alongside it as an attribute for
 * the shader to run its wavefront against.
 */
function buildTraces() {
  const position: number[] = [];
  const dist: number[] = [];
  const seed: number[] = [];

  const rand = rng(41);

  const strip = (path: Pt[], d0: number, d1: number, s: number, w: number) => {
    const span = path.length - 1;
    for (let i = 0; i < span; i += 1) {
      const [ax, az] = path[i];
      const [bx, bz] = path[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 1e-4) continue;
      // Perpendicular in the plane, so the quad has an even width along its run.
      const nx = (-dz / len) * w;
      const nz = (dx / len) * w;

      const da = d0 + ((d1 - d0) * i) / span;
      const db = d0 + ((d1 - d0) * (i + 1)) / span;

      position.push(
        ax - nx, TRACE_Y, az - nz,
        ax + nx, TRACE_Y, az + nz,
        bx + nx, TRACE_Y, bz + nz,
        ax - nx, TRACE_Y, az - nz,
        bx + nx, TRACE_Y, bz + nz,
        bx - nx, TRACE_Y, bz - nz,
      );
      dist.push(da, da, db, da, db, db);
      for (let k = 0; k < 6; k += 1) seed.push(s);
    }
  };

  for (let side = 0; side < 4; side += 1) {
    const turn = (side * Math.PI) / 2;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    /** Rotate a path built on the +Z side round to this one. */
    const spin = (path: Pt[]): Pt[] =>
      path.map(([x, z]) => [x * cos - z * sin, x * sin + z * cos]);

    for (let i = 0; i < PER_SIDE; i += 1) {
      const u = (i / (PER_SIDE - 1)) * 2 - 1;
      const t = u * DIE * 0.9;
      // The fan: traces spread as they travel, wider at the ends of the row.
      const target = u * PKG * 0.6;
      const s = rand();

      // A few stop short, the way a real board has traces that are not pins.
      const short = s > 0.86;
      const edge = short ? PKG * 0.55 + s * 0.3 : PKG - 0.11;

      strip(spin(traceFor(t, target, DIE, edge)), 0, short ? 0.62 : 1, s, TRACE_W);

      // The board carries a third of them onwards, past the package.
      if (i % 4 === 0 && !short && Math.abs(u) < 0.62) {
        const out: Pt[] = [
          [target, PKG - 0.1],
          [target, PKG + 0.5],
          [target * 1.5, PKG + 0.5 + Math.abs(target * 0.5)],
          [target * 1.5, BOARD],
        ];
        strip(spin(out), 1, 1.85, s, TRACE_W * 0.7);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute("aDist", new THREE.Float32BufferAttribute(dist, 1));
  geometry.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 1));
  return geometry;
}

const vertexShader = /* glsl */ `
  attribute float aDist;
  attribute float aSeed;

  varying float vDist;
  varying float vSeed;

  void main() {
    vDist = aDist;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uHover;
  uniform vec3  uCalm;
  uniform vec3  uHot;

  varying float vDist;
  varying float vSeed;

  void main() {
    /* Brightest at the die and falling off outward: the current is being spent
       as it travels, and it is also what keeps the middle of the object the
       thing you look at. Past the package edge it drops away to nothing. */
    float base = mix(1.0, 0.44, clamp(vDist, 0.0, 1.0));
    base *= 1.0 - smoothstep(0.98, 1.5, vDist) * 0.95;

    // An idle shimmer, offset per trace so they never breathe in unison.
    base *= 0.78 + 0.22 * sin(uTime * 1.7 + vSeed * 37.0);

    /* The hover: a wavefront leaving the die and running out along every trace
       at once. Phase is distance, so it travels rather than blinking. */
    float wave = fract(uTime * 0.62 - vDist * 0.85 + vSeed * 0.12);
    float front = smoothstep(0.0, 0.10, wave) * smoothstep(0.46, 0.14, wave);

    float lit = base + uHover * front * 2.4;
    vec3 tint = mix(uCalm, uHot, clamp(uHover * front * 1.3, 0.0, 1.0));

    gl_FragColor = vec4(tint * lit, 1.0);
  }
`;

/** The pins, as one instanced row repeated round all four sides. */
function pinMatrices() {
  const out: THREE.Matrix4[] = [];
  const count = 30;
  for (let side = 0; side < 4; side += 1) {
    const turn = (side * Math.PI) / 2;
    for (let i = 0; i < count; i += 1) {
      const u = (i / (count - 1)) * 2 - 1;
      const x = u * PKG * 0.84;
      const z = PKG + 0.02;
      const m = new THREE.Matrix4();
      const spun = new THREE.Vector3(x, -SUB_H * 0.18, z).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        turn,
      );
      m.makeRotationY(turn);
      m.setPosition(spun);
      out.push(m);
    }
  }
  return out;
}

export function ProcessorChip({
  depthId,
  reducedMotion = false,
}: {
  depthId: string;
  reducedMotion?: boolean;
}) {
  const frame = useRef<THREE.Group>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const hover = useRef(0);

  const traces = useMemo(() => buildTraces(), []);

  const pins = useMemo(() => {
    const matrices = pinMatrices();
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.055, SUB_H * 0.42, 0.2),
      new THREE.MeshStandardMaterial({
        color: MATERIAL.steel,
        metalness: 1,
        roughness: 0.44,
        envMapIntensity: 0.95,
      }),
      matrices.length,
    );
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHover: { value: 0 },
      uCalm: { value: new THREE.Color(MATERIAL.accent) },
      uHot: { value: new THREE.Color("#ffffff") },
    }),
    [],
  );

  useFrame((state, delta) => {
    const step = Math.min(delta, 1 / 30);

    if (material.current) {
      material.current.uniforms.uTime.value = state.clock.elapsedTime;
      /* Damped rather than switched. The wavefront should arrive and leave, not
         appear the instant the cursor crosses the edge of the box. */
      const want = reducedMotion ? 0 : zoneHover(depthId);
      hover.current += (want - hover.current) * Math.min(1, step * 6);
      material.current.uniforms.uHover.value = hover.current;
    }

    const node = frame.current;
    if (!node) return;

    const ease = Math.min(1, step * 3.2);
    const depth = reducedMotion ? 0.5 : scrollDepth(depthId);

    /* Held at the raking three-quarter angle a component is photographed at,
       turned a little by the cursor and by where the zone has scrolled to. The
       diamond plan is deliberate: it puts a corner nearest the reader, which is
       what shows the substrate has thickness. */
    const targetY = Math.PI / 4 + pointerState.x * 0.26 + (depth - 0.5) * 0.3;
    const targetX = 0.78 - pointerState.y * 0.14;

    node.rotation.y += (targetY - node.rotation.y) * ease;
    node.rotation.x += (targetX - node.rotation.x) * ease;
    // A shallow lift under the pointer, so it answers before it pulses.
    node.position.y += (hover.current * 0.12 - node.position.y) * ease;
  });

  return (
    <group ref={frame} rotation={[0.78, Math.PI / 4, 0]}>
      {/* The gold flange, wider than the substrate so it shows as a band. */}
      <mesh position={[0, -SUB_H * 0.42, 0]}>
        <boxGeometry args={[PKG * 2.03, SUB_H * 0.34, PKG * 2.03]} />
        <meshStandardMaterial
          color="#7d6128"
          metalness={0.9}
          roughness={0.52}
          envMapIntensity={0.8}
        />
      </mesh>

      {/* The substrate. */}
      <RoundedBox args={[PKG * 2, SUB_H, PKG * 2]} radius={0.02} smoothness={3}>
        <meshStandardMaterial
          color="#041013"
          metalness={0.14}
          roughness={0.85}
          envMapIntensity={0.3}
        />
      </RoundedBox>

      {/* The routing. */}
      <mesh geometry={traces} frustumCulled={false}>
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* The die: dark silicon, sitting proud, with a lit seam round its top. */}
      <RoundedBox
        args={[DIE * 2, SUB_H * 0.72, DIE * 2]}
        radius={0.015}
        smoothness={3}
        position={[0, SUB_H * 0.5, 0]}
      >
        <meshStandardMaterial
          color="#05090d"
          metalness={0.85}
          roughness={0.22}
          envMapIntensity={1.1}
        />
      </RoundedBox>
      <mesh position={[0, SUB_H * 0.86, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.88, 0.94, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial color={MATERIAL.accent} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>

      {/* The pins, built as one instanced mesh rather than declared as JSX.
          An `instancedMesh` element wants its geometry and material as
          constructor arguments, and the usual trick of passing them as children
          leaves the first two args undefined at construction. */}
      <primitive object={pins} />
    </group>
  );
}
