"use client";

import { useMemo, useRef } from "react";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { publishReadout } from "@/lib/bloch-store";
import { pointerState } from "@/lib/pointer";
import type { BlochVector } from "@/lib/quantum";

/**
 * A Bloch sphere with two drivers.
 *
 * On the landing page there is no `source`, and the cursor *is* the state
 * preparation: vertical position sets the polar angle θ (top = |0⟩, bottom =
 * |1⟩), horizontal position sets the relative phase φ. In the sandbox a
 * `source` Bloch vector arrives from the simulator instead, and its length
 * matters — an entangled qubit has a short vector, and a maximally entangled
 * one has none at all. The arrow is tinted cyan→violet by θ, matching what the
 * palette means everywhere else on the site.
 */

const RADIUS = 1.55;
const CALM = new THREE.Color("#38e8ff"); // |0>
const HOT = new THREE.Color("#b14eff"); // |1>

/** Points along a great circle in the given plane. */
function circle(plane: "xz" | "xy" | "yz", radius = RADIUS, segments = 128) {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a) * radius;
    const s = Math.sin(a) * radius;
    if (plane === "xz") points.push(new THREE.Vector3(c, 0, s));
    else if (plane === "xy") points.push(new THREE.Vector3(c, s, 0));
    else points.push(new THREE.Vector3(0, c, s));
  }
  return points;
}

/** Latitude circles, for depth cueing. */
function latitude(y: number) {
  const r = Math.sqrt(Math.max(0, RADIUS * RADIUS - y * y));
  return circle("xz", r, 96).map((p) => new THREE.Vector3(p.x, y, p.z));
}

const glowVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const glowFragment = /* glsl */ `
  uniform vec3  uInner;
  uniform vec3  uOuter;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormal, vView)), 2.6);
    gl_FragColor = vec4(mix(uInner, uOuter, fresnel), fresnel * uIntensity);
  }
`;

export function BlochSphere({
  reducedMotion = false,
  source = null,
  publish = true,
  tilt = 1,
}: {
  reducedMotion?: boolean;
  /** When set, the vector follows the simulator instead of the cursor. */
  source?: BlochVector | null;
  /** Landing page only: feed the HTML read-out panel. */
  publish?: boolean;
  /** Multiplier on how far the cursor tips the viewing frame. */
  tilt?: number;
}) {
  const frame = useRef<THREE.Group>(null);
  const vector = useRef<THREE.Group>(null);
  const shaft = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const tip = useRef<THREE.Mesh>(null);
  const drop = useRef<THREE.Mesh>(null);
  const shadowDot = useRef<THREE.Mesh>(null);

  const angles = useRef({ theta: Math.PI * 0.32, phi: 0.6, length: 1 });
  const lastEmit = useRef(0);
  const tipColor = useMemo(() => new THREE.Color(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const tipPoint = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  const greatCircles = useMemo(
    () => ({ equator: circle("xz"), meridianA: circle("xy"), meridianB: circle("yz") }),
    [],
  );
  const latitudes = useMemo(
    () => [0.85, 0.45, -0.45, -0.85].map((f) => latitude(f * RADIUS)),
    [],
  );

  const glowUniforms = useMemo(
    () => ({
      uInner: { value: new THREE.Color("#101a44") },
      uOuter: { value: new THREE.Color("#5fd7ff") },
      uIntensity: { value: 0.85 },
    }),
    [],
  );

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
      // Cursor → state preparation. Clamped so the arrow never degenerates.
      targetTheta = THREE.MathUtils.clamp(((1 - pointerState.y) / 2) * Math.PI, 0.13, Math.PI - 0.13);
      targetPhi = pointerState.x * Math.PI * 0.9;
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

    // Viewing tilt: small, so it reads as response rather than a spin toy.
    if (frame.current) {
      const spin = reducedMotion ? 0 : state.clock.elapsedTime * 0.06;
      const targetY = spin + pointerState.x * 0.22 * tilt;
      const targetX = 0.1 - pointerState.y * 0.16 * tilt;
      frame.current.rotation.y += (targetY - frame.current.rotation.y) * ease;
      frame.current.rotation.x += (targetX - frame.current.rotation.x) * ease;
    }

    direction.set(
      Math.sin(theta) * Math.sin(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.cos(phi),
    );

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
      const material = tip.current.material as THREE.MeshBasicMaterial;
      material.color.copy(tipColor);
    }

    // Drop line + equatorial shadow: the geometric read-out of φ.
    tipPoint.copy(direction).multiplyScalar(armLength);
    if (drop.current) {
      drop.current.position.set(tipPoint.x, tipPoint.y / 2, tipPoint.z);
      drop.current.scale.y = Math.max(0.001, Math.abs(tipPoint.y));
      (drop.current.material as THREE.MeshBasicMaterial).opacity = 0.42 * length;
    }
    if (shadowDot.current) {
      shadowDot.current.position.set(tipPoint.x, 0, tipPoint.z);
      (shadowDot.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * length;
    }

    // Publish the read-out at ~12fps; the HTML overlay does not need 60.
    if (publish && state.clock.elapsedTime - lastEmit.current > 0.08) {
      lastEmit.current = state.clock.elapsedTime;
      const half = Math.cos(theta / 2);
      publishReadout({ theta, phi, p0: half * half });
    }
  });

  return (
    <group ref={frame}>
      {/* Atmospheric rim, drawn from the inside so it haloes the silhouette. */}
      <mesh scale={1.04}>
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <shaderMaterial
          uniforms={glowUniforms}
          vertexShader={glowVertex}
          fragmentShader={glowFragment}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Body: barely there, just enough to occlude the far-side wireframe. */}
      <mesh>
        <sphereGeometry args={[RADIUS * 0.995, 48, 48]} />
        <meshBasicMaterial color="#060a1c" transparent opacity={0.62} />
      </mesh>

      {latitudes.map((points, index) => (
        <Line
          key={`lat-${index}`}
          points={points}
          color="#5b76c8"
          lineWidth={1}
          transparent
          opacity={0.18}
        />
      ))}

      <Line points={greatCircles.equator} color="#38e8ff" lineWidth={1.6} transparent opacity={0.6} />
      <Line points={greatCircles.meridianA} color="#8ba6ef" lineWidth={1} transparent opacity={0.3} />
      <Line points={greatCircles.meridianB} color="#8ba6ef" lineWidth={1} transparent opacity={0.3} />

      {/* Axes: z is the computational basis, x and y stay quiet. */}
      <Line
        points={[new THREE.Vector3(0, -RADIUS * 1.22, 0), new THREE.Vector3(0, RADIUS * 1.22, 0)]}
        color="#b14eff"
        lineWidth={1.2}
        transparent
        opacity={0.5}
      />
      <Line
        points={[new THREE.Vector3(-RADIUS * 1.16, 0, 0), new THREE.Vector3(RADIUS * 1.16, 0, 0)]}
        color="#5b76c8"
        lineWidth={1}
        transparent
        opacity={0.28}
      />
      <Line
        points={[new THREE.Vector3(0, 0, -RADIUS * 1.16), new THREE.Vector3(0, 0, RADIUS * 1.16)]}
        color="#5b76c8"
        lineWidth={1}
        transparent
        opacity={0.28}
      />

      {/* The state vector. Its length is |r|, so entanglement shortens it. */}
      <group ref={vector}>
        {/* Unit-height cylinder: scale.y is the arm length, set per frame. */}
        <mesh ref={shaft} position={[0, RADIUS * 0.5, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 1, 12]} />
          <meshBasicMaterial color="#dff6ff" transparent opacity={0.9} />
        </mesh>
        <group ref={head} position={[0, RADIUS, 0]}>
          <mesh ref={tip}>
            <coneGeometry args={[0.085, 0.26, 20]} />
            <meshBasicMaterial color="#38e8ff" />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.2, 20, 20]} />
            <meshBasicMaterial color="#38e8ff" transparent opacity={0.16} />
          </mesh>
        </group>
      </group>

      {/* Projection onto the equatorial plane. */}
      <mesh ref={drop}>
        <cylinderGeometry args={[0.005, 0.005, 1, 6]} />
        <meshBasicMaterial color="#ff4d9d" transparent opacity={0.42} />
      </mesh>
      <mesh ref={shadowDot} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.045, 0.075, 20]} />
        <meshBasicMaterial color="#ff4d9d" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>

      <Html
        position={[0, RADIUS * 1.42, 0]}
        center
        zIndexRange={[8, 0]}
        style={{ pointerEvents: "none" }}
      >
        <span className="ket text-[15px] leading-none text-photon/85 select-none">|0⟩</span>
      </Html>
      <Html
        position={[0, -RADIUS * 1.42, 0]}
        center
        zIndexRange={[8, 0]}
        style={{ pointerEvents: "none" }}
      >
        <span className="ket text-[15px] leading-none text-phase/85 select-none">|1⟩</span>
      </Html>
    </group>
  );
}
