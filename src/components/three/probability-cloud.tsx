"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The measurement density, drawn inside the sphere.
 *
 * Every point belongs to one of the two computational outcomes, and which one
 * is decided in the shader against the live P(|0⟩) — so the mass sitting near
 * each pole *is* the probability of that result, and it redistributes as the
 * circuit changes rather than being redrawn. A state that is going to come out
 * |0⟩ nine times in ten looks like it.
 *
 * Measuring throws the whole cloud, both lobes, at a single pole. That is the
 * part worth animating: the outcome is not a filter applied to the distribution,
 * it replaces it, and the other lobe does not fade out politely — it is dragged
 * across the sphere to the pole that won.
 */

const COUNT = 1500;
const POLE = 1.34;

const vertex = /* glsl */ `
  uniform float uP0;
  uniform float uCollapse;
  uniform float uOutcome;
  uniform float uTime;
  uniform float uCalm;

  attribute float aRand;
  attribute float aSeed;
  attribute vec3  aRest;

  varying float vHot;

  void main() {
    float lobe = aRand < uP0 ? 1.0 : -1.0;
    vec3 own = vec3(0.0, lobe * POLE_C, 0.0);
    vec3 chosen = vec3(0.0, uOutcome * POLE_C, 0.0);

    // At rest the cloud only leans toward its outcome; it stays a cloud. A
    // distribution collapsed before it is measured would be a lie about what a
    // superposition is.
    vec3 rest = mix(aRest, own, 0.26);

    float wander = uCalm * (1.0 - uCollapse);
    float t = uTime * 0.6 + aSeed * 71.0;
    rest += vec3(sin(t), cos(t * 0.83), sin(t * 1.27)) * 0.055 * wander;

    vec3 p = mix(rest, chosen, uCollapse);

    vHot = uCollapse;

    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = (1.1 + uCollapse * 2.6) * (150.0 / max(0.001, -view.z));
  }
`.replace(/POLE_C/g, POLE.toFixed(3));

const fragment = /* glsl */ `
  uniform vec3 uCool;
  uniform vec3 uHot;
  varying float vHot;

  void main() {
    vec2 offset = gl_PointCoord - 0.5;
    float falloff = 1.0 - smoothstep(0.1, 0.5, length(offset));
    if (falloff <= 0.001) discard;
    gl_FragColor = vec4(mix(uCool, uHot, vHot), falloff * (0.085 + vHot * 0.4));
  }
`;

function fill(count: number) {
  const rest = new Float32Array(count * 3);
  const rand = new Float32Array(count);
  const seed = new Float32Array(count);
  let s = 1337;
  const next = () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 4_294_967_296;
  };
  for (let i = 0; i < count; i += 1) {
    // Rejection sampling: a cube mapped onto a sphere piles points at the
    // corners, and the pile is visible.
    let x = 0;
    let y = 0;
    let z = 0;
    do {
      x = next() * 2 - 1;
      y = next() * 2 - 1;
      z = next() * 2 - 1;
    } while (x * x + y * y + z * z > 1);
    rest[i * 3] = x * 1.28;
    rest[i * 3 + 1] = y * 1.28;
    rest[i * 3 + 2] = z * 1.28;
    rand[i] = next();
    seed[i] = next();
  }
  return { rest, rand, seed };
}

export function ProbabilityCloud({
  p0,
  measuredAt,
  outcome,
  reducedMotion = false,
}: {
  /** Probability of the focused qubit reading |0⟩. */
  p0: number;
  /** performance.now()/1000 of the last measurement, or null while coherent. */
  measuredAt: number | null;
  outcome: 0 | 1;
  reducedMotion?: boolean;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const shown = useRef(0);
  const geometry = useMemo(() => fill(COUNT), []);

  const uniforms = useMemo(
    () => ({
      uP0: { value: 1 },
      uCollapse: { value: 0 },
      uOutcome: { value: 1 },
      uTime: { value: 0 },
      uCalm: { value: reducedMotion ? 0 : 1 },
      uCool: { value: new THREE.Color("#2fe4ff") },
      uHot: { value: new THREE.Color("#ffffff") },
    }),
    [reducedMotion],
  );

  useFrame((state, delta) => {
    const shader = material.current;
    if (!shader) return;
    const step = Math.min(delta, 1 / 30);

    let target = 0;
    if (measuredAt !== null) {
      const age = performance.now() / 1000 - measuredAt;
      /* Sharp deceleration with one ring, not a smooth glide. A quintic ease
         gets almost all the distance covered in the first third of the travel,
         and the decaying sine lands it like something with mass hitting a stop
         rather than a value easing to rest. */
      const t = Math.min(1, age / 0.42);
      const eased = 1 - Math.pow(1 - t, 5);
      const ring = reducedMotion ? 0 : Math.exp(-age * 11) * Math.sin(age * 26) * 0.05;
      target = Math.min(1.02, eased + ring);
    }

    // Toward a measurement it snaps; away from one it relaxes, because a
    // circuit edit re-prepares the state rather than un-measuring it.
    const rate = target > shown.current ? 1 : Math.min(1, step * 5);
    shown.current += (target - shown.current) * (target > shown.current ? 1 : rate);

    shader.uniforms.uCollapse.value = shown.current;
    shader.uniforms.uOutcome.value = outcome === 0 ? 1 : -1;
    shader.uniforms.uTime.value = state.clock.elapsedTime;
    shader.uniforms.uP0.value += (p0 - shader.uniforms.uP0.value) * Math.min(1, step * 4);
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[geometry.rest, 3]} />
        <bufferAttribute attach="attributes-aRest" args={[geometry.rest, 3]} />
        <bufferAttribute attach="attributes-aRand" args={[geometry.rand, 1]} />
        <bufferAttribute attach="attributes-aSeed" args={[geometry.seed, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
