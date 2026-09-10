"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { pointerState } from "@/lib/pointer";
import { drivenQubit } from "@/lib/qubit-drive";
import type { BlochVector } from "@/lib/quantum";
import { scrollDepth } from "@/lib/scroll";

/**
 * The Bloch sphere as a lit lattice.
 *
 * Same physics as the machined version, different material: instead of a glass
 * shell in a chrome gimbal, the surface is a lattice of points on a
 * latitude/longitude grid, tinted by latitude — gold at |0⟩, through magenta at
 * the equator, to cyan at |1⟩. The gradient is doing real work: it is the θ
 * axis made visible, so a vector's height on the sphere reads as a colour
 * before you have measured anything against the grid.
 *
 * Points on the far hemisphere are dimmed in the shader. Without that a dot
 * lattice reads as a flat disc of confetti — the fall-off is the only thing
 * telling you it is a sphere at all.
 *
 * The driver is unchanged and deliberately so: on the landing page the cursor
 * *is* the state preparation, vertical position setting θ and horizontal
 * setting the relative phase φ, and both are integrated in the shared
 * `drivenQubit` store. This object is a consumer of that state, never its
 * owner, which is why swapping the visual leaves the live read-out beside it
 * working exactly as before.
 */

const RADIUS = 1.55;
/** Rings of latitude in the lattice. Poles are skipped — they are degenerate. */
const LATITUDES = 36;
const LONGITUDES = 62;
/** Every nth line of the lattice is drawn as a wire, so the grid stays legible. */
const WIRE_LAT = 4;
const WIRE_LON = 6;

/**
 * Latitude → colour.
 *
 * t = 0 at |0⟩, 1 at |1⟩. The stops are placed so the equator lands on the
 * brightest magenta: it is the one circle on the sphere a reader is asked to
 * find, because a vector on it is an equal superposition.
 */
const RAMP: readonly (readonly [number, string])[] = [
  [0.0, "#ffd76a"],
  [0.18, "#ff9a3c"],
  [0.36, "#ff4d6d"],
  [0.5, "#ff2fd0"],
  [0.66, "#a03cf0"],
  [0.82, "#4a5cf0"],
  [1.0, "#2fe4ff"],
] as const;

const EQUATOR = "#ff2fd0";
const ARM = "#ffd24a";
const AXIS = "#dfe3ea";

const STOPS = RAMP.map(([at, hex]) => ({ at, color: new THREE.Color(hex) }));

function rampAt(t: number, into: THREE.Color) {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  for (let i = 1; i < STOPS.length; i += 1) {
    const previous = STOPS[i - 1];
    const next = STOPS[i];
    if (clamped <= next.at) {
      const span = next.at - previous.at || 1;
      return into.copy(previous.color).lerp(next.color, (clamped - previous.at) / span);
    }
  }
  return into.copy(STOPS[STOPS.length - 1].color);
}

const dotVertex = /* glsl */ `
  attribute vec3 aTint;
  varying vec3 vTint;
  varying float vFacing;
  uniform float uSize;

  void main() {
    vTint = aTint;
    vec4 view = modelViewMatrix * vec4(position, 1.0);

    /* The far hemisphere fades. A lattice with no depth cue is a flat disc of
       confetti, and this is the cue — the normal of a point on a unit sphere
       is the point itself, so the facing term costs one normalize. */
    vec3 normalView = normalize(mat3(modelViewMatrix) * normalize(position));
    vFacing = 0.06 + 0.94 * smoothstep(-0.6, 0.5, normalView.z);

    gl_Position = projectionMatrix * view;
    gl_PointSize = uSize * (150.0 / max(0.001, -view.z));
  }
`;

const dotFragment = /* glsl */ `
  varying vec3 vTint;
  varying float vFacing;

  void main() {
    vec2 offset = gl_PointCoord - 0.5;
    float falloff = 1.0 - smoothstep(0.18, 0.5, length(offset));
    if (falloff <= 0.001) discard;
    gl_FragColor = vec4(vTint, falloff * vFacing);
  }
`;

/** A letter, drawn to a texture so it needs no font file and always faces you. */
function Glyph({
  text,
  position,
  scale = 0.34,
}: {
  text: string;
  position: [number, number, number];
  scale?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, 128, 128);
      context.fillStyle = "#ffffff";
      context.font = "500 76px ui-monospace, 'SF Mono', Menlo, monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, 64, 68);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  }, [text]);

  return (
    <sprite position={position} scale={[scale, scale, scale]}>
      <spriteMaterial
        map={texture}
        transparent
        depthWrite={false}
        opacity={0.75}
        toneMapped={false}
      />
    </sprite>
  );
}

/** One axis: a hairline through the origin with a head on the positive end. */
function Axis({
  direction,
  label,
  reach = 1.3,
  both = false,
}: {
  direction: [number, number, number];
  label?: string;
  reach?: number;
  both?: boolean;
}) {
  const end = new THREE.Vector3(...direction).normalize();
  const length = RADIUS * reach;
  const tip = end.clone().multiplyScalar(length);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    end,
  );

  return (
    <group>
      <mesh quaternion={quaternion}>
        <cylinderGeometry args={[0.006, 0.006, length * 2, 6]} />
        <meshBasicMaterial color={AXIS} transparent opacity={0.42} />
      </mesh>

      <mesh position={tip.toArray()} quaternion={quaternion}>
        <coneGeometry args={[0.052, 0.16, 16]} />
        <meshBasicMaterial color={AXIS} transparent opacity={0.8} />
      </mesh>

      {both && (
        <mesh
          position={tip.clone().negate().toArray()}
          quaternion={quaternion.clone().multiply(
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI),
          )}
        >
          <coneGeometry args={[0.052, 0.16, 16]} />
          <meshBasicMaterial color={AXIS} transparent opacity={0.8} />
        </mesh>
      )}

      {label && (
        <Glyph text={label} position={tip.clone().multiplyScalar(1.16).toArray()} />
      )}
    </group>
  );
}

export function BlochLattice({
  reducedMotion = false,
  source = null,
  tilt = 1,
  depthId,
}: {
  reducedMotion?: boolean;
  /** When set, the vector follows the simulator instead of the cursor. */
  source?: BlochVector | null;
  tilt?: number;
  depthId?: string;
}) {
  const frame = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const shaft = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const bead = useRef<THREE.Mesh>(null);

  const angles = useRef({ theta: Math.PI * 0.3, phi: 0.7, length: 1 });
  const direction = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  /* The lattice. Built once: a few thousand positions and their tints never
     change, because the sphere does not deform — only the arm inside it moves. */
  const lattice = useMemo(() => {
    const positions: number[] = [];
    const tints: number[] = [];
    const paint = new THREE.Color();

    for (let lat = 1; lat < LATITUDES; lat += 1) {
      const theta = (lat / LATITUDES) * Math.PI;
      const y = Math.cos(theta);
      const ring = Math.sin(theta);
      rampAt(lat / LATITUDES, paint);

      for (let lon = 0; lon < LONGITUDES; lon += 1) {
        const phi = (lon / LONGITUDES) * Math.PI * 2;
        positions.push(
          RADIUS * ring * Math.cos(phi),
          RADIUS * y,
          RADIUS * ring * Math.sin(phi),
        );
        tints.push(paint.r, paint.g, paint.b);
      }
    }

    return {
      position: new Float32Array(positions),
      tint: new Float32Array(tints),
      count: positions.length / 3,
    };
  }, []);

  /* The wires. Every fourth parallel and every sixth meridian, as line
     segments in one buffer rather than fifty separate objects. */
  const wires = useMemo(() => {
    const positions: number[] = [];
    const tints: number[] = [];
    const paint = new THREE.Color();
    const STEPS = 96;

    const push = (x: number, y: number, z: number, t: number) => {
      rampAt(t, paint);
      positions.push(x, y, z);
      tints.push(paint.r, paint.g, paint.b);
    };

    for (let lat = WIRE_LAT; lat < LATITUDES; lat += WIRE_LAT) {
      const theta = (lat / LATITUDES) * Math.PI;
      const y = RADIUS * Math.cos(theta);
      const ring = RADIUS * Math.sin(theta);
      const t = lat / LATITUDES;

      for (let i = 0; i < STEPS; i += 1) {
        const a = (i / STEPS) * Math.PI * 2;
        const b = ((i + 1) / STEPS) * Math.PI * 2;
        push(ring * Math.cos(a), y, ring * Math.sin(a), t);
        push(ring * Math.cos(b), y, ring * Math.sin(b), t);
      }
    }

    for (let lon = 0; lon < LONGITUDES; lon += WIRE_LON) {
      const phi = (lon / LONGITUDES) * Math.PI * 2;
      for (let i = 0; i < STEPS; i += 1) {
        const a = (i / STEPS) * Math.PI;
        const b = ((i + 1) / STEPS) * Math.PI;
        push(
          RADIUS * Math.sin(a) * Math.cos(phi),
          RADIUS * Math.cos(a),
          RADIUS * Math.sin(a) * Math.sin(phi),
          a / Math.PI,
        );
        push(
          RADIUS * Math.sin(b) * Math.cos(phi),
          RADIUS * Math.cos(b),
          RADIUS * Math.sin(b) * Math.sin(phi),
          b / Math.PI,
        );
      }
    }

    return {
      position: new Float32Array(positions),
      tint: new Float32Array(tints),
    };
  }, []);

  /**
   * Dot size.
   *
   * `gl_PointSize` is in device pixels, and the `150 / -view.z` term is about
   * 19 at this camera — so the first value that looked reasonable in source,
   * 1.85, drew thirty-five-pixel blobs. Overlapping soft blobs are not a
   * lattice, they are a gradient-filled disc, which is exactly what the first
   * render was. Five or six pixels is a dot.
   */
  const dotUniforms = useMemo(() => ({ uSize: { value: 0.3 } }), []);

  useFrame((state, delta) => {
    const step = Math.min(delta, 1 / 30);
    const ease = Math.min(1, step * 4.2);

    let targetTheta: number;
    let targetPhi: number;
    let targetLength = 1;

    if (source) {
      const r = Math.hypot(source.x, source.y, source.z);
      targetLength = Math.min(1, r);
      targetTheta = r < 1e-6 ? Math.PI / 2 : Math.acos(THREE.MathUtils.clamp(source.z / r, -1, 1));
      targetPhi = Math.atan2(source.y, source.x);
    } else {
      const driven = drivenQubit();
      targetTheta = driven.theta;
      targetPhi = driven.phi;
    }

    angles.current.theta += (targetTheta - angles.current.theta) * ease;
    angles.current.length += (targetLength - angles.current.length) * ease;
    // Take the short way round, so a phase crossing ±π does not spin the arm.
    let phiDelta = targetPhi - angles.current.phi;
    while (phiDelta > Math.PI) phiDelta -= Math.PI * 2;
    while (phiDelta < -Math.PI) phiDelta += Math.PI * 2;
    angles.current.phi += phiDelta * ease;

    const { theta, phi, length } = angles.current;
    const armLength = Math.max(0.001, length) * RADIUS;

    if (frame.current) {
      /* Three damped inputs, none of them large: a slow turntable so the
         lattice catches the light, the cursor tipping the frame toward the
         reader, and the scroll depth rolling it as the section passes. The
         base offset puts +x on the right and +y going back and to the left,
         which is the orientation the axes are labelled for. */
      const spin = reducedMotion ? 0 : state.clock.elapsedTime * 0.06;
      const depth = depthId ? scrollDepth(depthId) - 0.5 : 0;
      const targetY = 0.42 + spin + pointerState.x * 0.24 * tilt + depth * 0.45;
      const targetX = 0.1 - pointerState.y * 0.16 * tilt + depth * 0.38;
      frame.current.rotation.y += (targetY - frame.current.rotation.y) * ease;
      frame.current.rotation.x += (targetX - frame.current.rotation.x) * ease;
      frame.current.position.y += (-depth * 0.3 - frame.current.position.y) * ease;
    }

    /* Physics (x, y, z) into the scene's (right, up, back): x to the right,
       z up, y away — a right-handed frame read the way the axis labels are
       placed. The state itself is untouched by the choice; only which way the
       reader is standing changes. */
    direction.set(
      Math.sin(theta) * Math.cos(phi),
      Math.cos(theta),
      -Math.sin(theta) * Math.sin(phi),
    );

    if (arm.current) arm.current.quaternion.setFromUnitVectors(up, direction);
    if (shaft.current) {
      shaft.current.position.y = armLength / 2;
      shaft.current.scale.y = armLength;
    }
    if (head.current) {
      head.current.position.y = armLength;
      head.current.scale.setScalar(THREE.MathUtils.clamp(length * 1.6, 0.05, 1));
    }
    if (bead.current) bead.current.position.y = armLength;
  });

  return (
    <group ref={frame}>
      {/* The lattice: the sphere itself, and the only thing drawing its
          surface. There is no shell — the points are the object. */}
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lattice.position, 3]} />
          <bufferAttribute attach="attributes-aTint" args={[lattice.tint, 3]} />
        </bufferGeometry>
        {/* Normal blending, not additive.
            Additive was the first instinct and it was wrong: three thousand
            overlapping points summed to white wherever the lattice is dense,
            so the gradient the sphere exists to show — gold at |0>, magenta at
            the equator, cyan at |1> — washed out to one flat pink disc. Normal
            blending keeps every dot the colour its latitude says it is. */}
        <shaderMaterial
          uniforms={dotUniforms}
          vertexShader={dotVertex}
          fragmentShader={dotFragment}
          transparent
          depthWrite={false}
        />
      </points>

      {/* The grid the lattice sits on, at a fraction of its brightness. */}
      <lineSegments frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[wires.position, 3]} />
          <bufferAttribute attach="attributes-color" args={[wires.tint, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </lineSegments>

      {/* The equator, drawn solid. It is the one circle a reader is asked to
          find — a vector on it is an equal superposition — so it is the only
          line here allowed to be bright. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RADIUS, 0.008, 12, 160]} />
        <meshBasicMaterial color={EQUATOR} toneMapped={false} />
      </mesh>

      {/* The frame the state is read against. */}
      <Axis direction={[0, 1, 0]} reach={1.34} both />
      <Axis direction={[1, 0, 0]} label="x" reach={1.24} />
      <Axis direction={[0, 0, -1]} label="y" reach={1.24} />

      {/* The state. Its length is |r|, so a mixed qubit has a short arm and a
          maximally mixed one has none — which is a real result, not a glitch. */}
      <group ref={arm}>
        <mesh ref={shaft} position={[0, RADIUS * 0.5, 0]}>
          <cylinderGeometry args={[0.026, 0.026, 1, 18]} />
          <meshBasicMaterial color={ARM} toneMapped={false} />
        </mesh>
        <group ref={head} position={[0, RADIUS, 0]}>
          <mesh>
            <coneGeometry args={[0.075, 0.2, 24]} />
            <meshBasicMaterial color={ARM} toneMapped={false} />
          </mesh>
        </group>
        {/* The tip, in white, so the point being read is unmistakable. */}
        <mesh ref={bead} position={[0, RADIUS, 0]}>
          <sphereGeometry args={[0.062, 20, 20]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      </group>

      {/* The pivot, so the arm visibly turns on something. */}
      <mesh>
        <sphereGeometry args={[0.032, 16, 16]} />
        <meshBasicMaterial color={AXIS} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}
