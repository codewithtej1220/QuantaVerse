"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { pointerState } from "@/lib/pointer";
import { drivenQubit } from "@/lib/qubit-drive";
import type { BlochVector } from "@/lib/quantum";
import { scrollDepth } from "@/lib/scroll";
import { cn } from "@/lib/utils";
import { ProbabilityCloud } from "./probability-cloud";
import { MATERIAL } from "./studio";

/**
 * A Bloch sphere, built as an object rather than as a diagram.
 *
 * The physics is unchanged from the first version — this is still the real
 * state, and it still has two drivers. On the landing page there is no
 * `source`, and the cursor *is* the state preparation: vertical position sets
 * the polar angle θ (top = |0⟩, bottom = |1⟩), horizontal position sets the
 * relative phase φ. In the sandbox a `source` Bloch vector arrives from the
 * simulator instead, and its length matters — an entangled qubit has a short
 * vector, and a maximally entangled one has none at all.
 *
 * What changed is what it is made of. The old sphere was an additive-blended
 * shader halo over a wireframe: a hologram. This one is a sandblasted glass
 * shell held in a machined copper gimbal, with the state vector milled from the
 * same copper, lit by the studio rig. Nothing emits light; every bright edge on
 * it is a reflection, which is why it reads as something that could sit on a
 * bench.
 *
 * The arrow runs copper at |0⟩ to white at |1⟩ — the site's only two colours,
 * carrying the site's only colour rule.
 */

const RADIUS = 1.55;

/** Samples kept of where the tip has been. At every other frame, ~2s of path. */
const TRAIL = 64;

const trailVertex = /* glsl */ `
  attribute float aAge;
  varying float vLife;
  void main() {
    vLife = 1.0 - aAge;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = (3.4 * vLife + 0.5) * (150.0 / max(0.001, -view.z));
  }
`;

const trailFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vLife;
  void main() {
    vec2 offset = gl_PointCoord - 0.5;
    float falloff = 1.0 - smoothstep(0.1, 0.5, length(offset));
    if (falloff <= 0.001) discard;
    gl_FragColor = vec4(uColor, falloff * vLife * vLife * 0.5);
  }
`;
const CALM = new THREE.Color(MATERIAL.accent); // |0>
const HOT = new THREE.Color("#ffffff"); // |1>

export function BlochSphere({
  reducedMotion = false,
  source = null,
  tilt = 1,
  depthId,
  ghost = null,
  cloud = null,
  impulse = 0,
}: {
  reducedMotion?: boolean;
  /** When set, the vector follows the simulator instead of the cursor. */
  source?: BlochVector | null;
  /** Multiplier on how far the cursor tips the viewing frame. */
  tilt?: number;
  /** Zone id, when the object should also respond to scroll depth. */
  depthId?: string;
  /**
   * An instructor's target state, shown alongside the student's own.
   *
   * Rendered in frosted white with no emission so it reads as a demonstration
   * rather than as a second reading. It never writes to the state — an
   * instructor can hold a state up, not take the controls.
   */
  ghost?: BlochVector | null;
  /** Measurement density inside the shell, and its collapse. */
  cloud?: { p0: number; measuredAt: number | null; outcome: 0 | 1 } | null;
  /** Increment to jolt the instrument, as when a gate lands on the grid. */
  impulse?: number;
}) {
  const frame = useRef<THREE.Group>(null);
  const vector = useRef<THREE.Group>(null);
  const shaft = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const tip = useRef<THREE.Mesh>(null);
  const drop = useRef<THREE.Mesh>(null);
  const shadowDot = useRef<THREE.Mesh>(null);

  const angles = useRef({ theta: Math.PI * 0.32, phi: 0.6, length: 1 });
  const ghostArm = useRef<THREE.Group>(null);
  const equator = useRef<THREE.Group>(null);
  const struckAt = useRef(-99);
  const lastImpulse = useRef(0);
  const trail = useRef<THREE.Points>(null);
  const trailMark = useMemo(() => new THREE.Vector3(1e3, 1e3, 1e3), []);
  const path = useMemo(() => new Float32Array(TRAIL * 3), []);
  const ages = useMemo(() => Float32Array.from({ length: TRAIL }, (_, i) => i / TRAIL), []);
  const trailUniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(MATERIAL.accent) } }),
    [],
  );
  const tipColor = useMemo(() => new THREE.Color(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const tipPoint = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const ghostDir = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const step = Math.min(delta, 1 / 30);
    const ease = Math.min(1, step * 4.2);

    let targetTheta: number;
    let targetPhi: number;
    let targetLength = 1;

    if (source) {
      // Simulator-driven: a short vector is a real result, not a glitch.
      const r = Math.hypot(source.x, source.y, source.z);
      targetLength = Math.min(1, r);
      targetTheta = r < 1e-6 ? Math.PI / 2 : Math.acos(THREE.MathUtils.clamp(source.z / r, -1, 1));
      targetPhi = Math.atan2(source.y, source.x);
    } else {
      // Cursor preparation and idle precession are integrated in the shared
      // driver, so the read-out panel stays correct even when this canvas is
      // not running. The object is a consumer of that state, not its owner.
      const driven = drivenQubit();
      targetTheta = driven.theta;
      targetPhi = driven.phi;
    }

    angles.current.theta += (targetTheta - angles.current.theta) * ease;
    angles.current.length += (targetLength - angles.current.length) * ease;
    // Take the short way round so a phase crossing ±π does not spin the arrow.
    let phiDelta = targetPhi - angles.current.phi;
    while (phiDelta > Math.PI) phiDelta -= Math.PI * 2;
    while (phiDelta < -Math.PI) phiDelta += Math.PI * 2;
    angles.current.phi += phiDelta * ease;

    const { theta, phi, length } = angles.current;
    const armLength = Math.max(0.001, length) * RADIUS;

    /* A gate landing is a mechanical event, so the instrument answers like
       one: a damped jolt through the whole frame and a quarter turn of the
       equator ring that rings out rather than easing. */
    if (impulse !== lastImpulse.current) {
      lastImpulse.current = impulse;
      struckAt.current = state.clock.elapsedTime;
    }
    const sinceStruck = state.clock.elapsedTime - struckAt.current;
    const jolt = reducedMotion ? 0 : Math.exp(-sinceStruck * 7) * Math.sin(sinceStruck * 26);
    if (equator.current) equator.current.rotation.y = jolt * 0.55;

    /* Viewing frame.
       Three inputs, all damped, none of them large: a slow turntable so the
       machining catches the light, the cursor tipping the frame toward the
       reader, and — where the object sits in a scrolling zone — the scroll
       depth rolling it as it passes. */
    if (frame.current) {
      const spin = reducedMotion ? 0 : state.clock.elapsedTime * 0.08;
      const depth = depthId ? scrollDepth(depthId) - 0.5 : 0;
      const targetY = spin + pointerState.x * 0.26 * tilt + depth * 0.5;
      const targetX = 0.08 - pointerState.y * 0.18 * tilt + depth * 0.42;
      frame.current.rotation.y += (targetY - frame.current.rotation.y) * ease;
      frame.current.rotation.x += (targetX - frame.current.rotation.x) * ease;
      frame.current.position.y += (-depth * 0.32 - frame.current.position.y) * ease;
      frame.current.rotation.z = jolt * 0.055;
    }

    direction.set(
      Math.sin(theta) * Math.sin(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.cos(phi),
    );

    if (ghostArm.current) {
      if (ghost) {
        const gr = Math.hypot(ghost.x, ghost.y, ghost.z);
        ghostArm.current.visible = gr > 1e-4;
        if (gr > 1e-4) {
          // The simulator's frame is (x, y, z) with z up; the object's is y up.
          ghostDir.set(ghost.y / gr, ghost.z / gr, ghost.x / gr);
          ghostArm.current.quaternion.setFromUnitVectors(up, ghostDir);
          ghostArm.current.scale.setScalar(Math.min(1, gr));
        }
      } else {
        ghostArm.current.visible = false;
      }
    }

    if (vector.current) {
      vector.current.quaternion.setFromUnitVectors(up, direction);
    }
    if (shaft.current) {
      shaft.current.position.y = armLength / 2;
      shaft.current.scale.y = armLength;
    }
    if (head.current) {
      head.current.position.y = armLength;
      // The arrowhead vanishes with the vector, so a mixed state reads as a dot.
      head.current.scale.setScalar(THREE.MathUtils.clamp(length * 1.6, 0.05, 1));
    }

    tipColor.copy(CALM).lerp(HOT, theta / Math.PI);
    if (tip.current) {
      const material = tip.current.material as THREE.MeshStandardMaterial;
      material.color.copy(tipColor);
      material.emissive.copy(tipColor);
    }

    // Drop line + equatorial shadow: the geometric read-out of φ.
    tipPoint.copy(direction).multiplyScalar(armLength);
    if (drop.current) {
      drop.current.position.set(tipPoint.x, tipPoint.y / 2, tipPoint.z);
      drop.current.scale.y = Math.max(0.001, Math.abs(tipPoint.y));
      (drop.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * length;
    }
    if (shadowDot.current) {
      shadowDot.current.position.set(tipPoint.x, 0, tipPoint.z);
      (shadowDot.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * length;
    }

    /* The path the tip has taken — precession only.
       A simulator-fed sphere is showing one static state, so there is no
       trajectory to draw; worse, when the qubit is maximally entangled the
       vector collapses to the origin and every sample lands in the same place,
       which additively blends into a bright ball sitting in the middle of the
       sandbox. The trail is a statement about motion, so it is drawn only
       where there is motion.
       Sampled every other frame into a shift-down buffer, so index 0 is always
       the newest point and the fixed age attribute fades and tapers the rest.
       While the qubit is precessing this draws the cone it is walking, which is
       the part of the motion a still frame cannot show. */
    /* Gated on distance travelled, not on frame count. Sampling every nth
       frame piles all sixty-four points on top of each other whenever the tip
       is barely moving, and sixty-four additively blended sprites in one place
       is a headlight, not a trail. */
    if (!source && trail.current && tipPoint.distanceTo(trailMark) > 0.05) {
      trailMark.copy(tipPoint);
      // Written through the attribute rather than through the array we handed
      // it: the geometry owns that buffer once it has been uploaded.
      const attr = trail.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      const buffer = attr.array as Float32Array;
      buffer.copyWithin(3, 0, (TRAIL - 1) * 3);
      buffer[0] = tipPoint.x;
      buffer[1] = tipPoint.y;
      buffer[2] = tipPoint.z;
      attr.needsUpdate = true;
    }

  });

  return (
    <group ref={frame}>
      {/* Shell: sandblasted glass. Two surfaces rather than one, so the
          silhouette has thickness where you look through the rim. */}
      <mesh renderOrder={2}>
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <meshPhysicalMaterial
          color={MATERIAL.ceramic}
          transparent
          opacity={0.1}
          roughness={0.5}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.12}
          envMapIntensity={2}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={0.985} renderOrder={1}>
        <sphereGeometry args={[RADIUS, 48, 48]} />
        <meshPhysicalMaterial
          color={MATERIAL.ceramic}
          transparent
          opacity={0.04}
          roughness={0.9}
          metalness={0}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* The gimbal: a turned chrome ring on the equator, and two steel
          meridians holding it. This is the part that makes it an object. */}
      <group ref={equator}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[RADIUS * 1.005, 0.038, 20, 160]} />
          <meshStandardMaterial
            color={MATERIAL.chrome}
            metalness={1}
            roughness={0.16}
            envMapIntensity={1.8}
          />
        </mesh>
        {/* Index marks, so the ring's rotation is legible instead of silent. */}
        {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((turn) => (
          <mesh key={turn} position={[Math.sin(turn) * RADIUS, 0, Math.cos(turn) * RADIUS]}>
            <boxGeometry args={[0.05, 0.11, 0.05]} />
            <meshStandardMaterial color={MATERIAL.chrome} metalness={1} roughness={0.2} />
          </mesh>
        ))}
      </group>
      <mesh>
        <torusGeometry args={[RADIUS * 1.02, 0.018, 16, 140]} />
        <meshStandardMaterial
          color={MATERIAL.steel}
          metalness={1}
          roughness={0.55}
          envMapIntensity={1.2}
        />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[RADIUS * 1.02, 0.018, 16, 140]} />
        <meshStandardMaterial
          color={MATERIAL.steel}
          metalness={1}
          roughness={0.55}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* Latitudes at 60° and 120°, and meridians on the diagonals. Together
          with the equator these are what make a sphere read as a sphere at a
          glance instead of as a disc — the classic globe wireframe, kept to
          hairlines so it structures the surface without decorating it. */}
      {[1, -1].map((side) => (
        <mesh key={`lat-${side}`} position={[0, side * RADIUS * 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[RADIUS * 0.866, 0.007, 8, 96]} />
          <meshStandardMaterial
            color={MATERIAL.steel}
            metalness={1}
            roughness={0.6}
            envMapIntensity={1}
          />
        </mesh>
      ))}
      {[Math.PI / 4, -Math.PI / 4].map((turn) => (
        <mesh key={`mer-${turn}`} rotation={[0, turn, 0]}>
          <torusGeometry args={[RADIUS * 1.01, 0.007, 8, 96]} />
          <meshStandardMaterial
            color={MATERIAL.steel}
            metalness={1}
            roughness={0.6}
            envMapIntensity={1}
          />
        </mesh>
      ))}

      {/* The two equatorial axes, so the sphere is a coordinate frame you can
          read a phase against rather than a ball. */}
      {[0, Math.PI / 2].map((turn) => (
        <mesh key={`axis-${turn}`} rotation={[Math.PI / 2, 0, turn]}>
          <cylinderGeometry args={[0.008, 0.008, RADIUS * 2.3, 8]} />
          <meshStandardMaterial
            color={MATERIAL.steelDark}
            metalness={1}
            roughness={0.5}
            envMapIntensity={0.9}
          />
        </mesh>
      ))}

      {/* Polar posts: the z axis is the computational basis, so it is the only
          axis given hardware. */}
      {[1, -1].map((sign) => (
        <mesh key={sign} position={[0, sign * RADIUS * 1.11, 0]}>
          <cylinderGeometry args={[0.026, 0.026, RADIUS * 0.22, 16]} />
          <meshStandardMaterial
            color={MATERIAL.steel}
            metalness={1}
            roughness={0.42}
            envMapIntensity={1.2}
          />
        </mesh>
      ))}

      {/* The state vector. Its length is |r|, so entanglement shortens it. */}
      <group ref={vector}>
        {/* Unit-height cylinder: scale.y is the arm length, set per frame. */}
        <mesh ref={shaft} position={[0, RADIUS * 0.5, 0]}>
          <cylinderGeometry args={[0.032, 0.032, 1, 18]} />
          <meshStandardMaterial
            color={MATERIAL.accent}
            emissive={MATERIAL.accent}
            emissiveIntensity={1.5}
            toneMapped={false}
            metalness={0}
            roughness={0.4}
          />
        </mesh>
        <group ref={head} position={[0, RADIUS, 0]}>
          <mesh ref={tip}>
            <coneGeometry args={[0.135, 0.36, 32]} />
            <meshStandardMaterial
              color={MATERIAL.accent}
              emissive={MATERIAL.accent}
              emissiveIntensity={2.2}
              toneMapped={false}
              metalness={0}
              roughness={0.35}
            />
          </mesh>
        </group>
      </group>

      {/* The instructor's target. Frosted, unlit, and always behind the
          student's arm in visual weight. */}
      <group ref={ghostArm} visible={false}>
        <mesh position={[0, RADIUS * 0.5, 0]}>
          <cylinderGeometry args={[0.02, 0.02, RADIUS, 12]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transparent
            opacity={0.32}
            roughness={0.75}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.4}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, RADIUS, 0]}>
          <coneGeometry args={[0.1, 0.26, 20]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transparent
            opacity={0.42}
            roughness={0.7}
            metalness={0}
            clearcoat={1}
            depthWrite={false}
          />
        </mesh>
      </group>

      {cloud && (
        <ProbabilityCloud
          p0={cloud.p0}
          measuredAt={cloud.measuredAt}
          outcome={cloud.outcome}
          reducedMotion={reducedMotion}
        />
      )}

      {/* The origin bead, so the vector visibly pivots on something. */}
      <mesh>
        <sphereGeometry args={[0.07, 24, 24]} />
        <meshStandardMaterial
          color={MATERIAL.steelDark}
          metalness={1}
          roughness={0.3}
          envMapIntensity={1.2}
        />
      </mesh>

      {!source && (
        <points ref={trail} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[path, 3]} />
            <bufferAttribute attach="attributes-aAge" args={[ages, 1]} />
          </bufferGeometry>
          <shaderMaterial
            uniforms={trailUniforms}
            vertexShader={trailVertex}
            fragmentShader={trailFragment}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}

      {/* Projection onto the equatorial plane: the geometry of φ. */}
      <mesh ref={drop}>
        <cylinderGeometry args={[0.006, 0.006, 1, 6]} />
        <meshBasicMaterial color={MATERIAL.steel} transparent opacity={0.5} />
      </mesh>
      <mesh ref={shadowDot} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 0.082, 24]} />
        <meshBasicMaterial
          color={MATERIAL.steel}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

    </group>
  );
}

/**
 * The pole markers.
 *
 * Drawn in HTML over the object rather than inside the scene: within a shared
 * canvas, a 3D-anchored label projects against the whole canvas instead of the
 * view's scissor rectangle, so it lands somewhere else entirely on the page.
 * The poles do not move, so HTML is both correct and free.
 */
export function BlochPoleLabels({ inset = "10%" }: { inset?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 select-none" aria-hidden>
      <span
        className={cn("ket absolute inset-x-0 text-center text-[14px] font-medium text-photon")}
        style={{ top: inset }}
      >
        |0⟩
      </span>
      <span
        className={cn("ket absolute inset-x-0 text-center text-[14px] font-medium text-paper")}
        style={{ bottom: inset }}
      >
        |1⟩
      </span>
    </div>
  );
}
