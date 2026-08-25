"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { pointerState } from "@/lib/pointer";

/**
 * A lattice of points that bends toward the cursor.
 *
 * All displacement happens in the vertex shader: the cursor is a single uniform,
 * so 4,000 points cost one uniform write per frame instead of 4,000 array
 * writes. Clicking sends a radial shockwave outward from the cursor — a
 * measurement collapsing the field.
 */

const COLS = 58;
const ROWS = 30;
const LAYERS = 3;

const vertexShader = /* glsl */ `
  uniform vec3  uMouse;
  uniform float uTime;
  uniform float uPull;
  uniform float uWave;      // seconds since the last click
  uniform float uReduced;   // 1.0 when reduced motion is requested

  attribute float aSeed;

  varying float vGlow;
  varying float vDepth;

  void main() {
    vec3 p = position;

    // Ambient breathing so the lattice is never fully static.
    float drift = 1.0 - uReduced * 0.85;
    p.x += sin(uTime * 0.34 + aSeed * 12.9) * 0.10 * drift;
    p.y += cos(uTime * 0.29 + aSeed * 7.3) * 0.10 * drift;
    p.z += sin(uTime * 0.21 + aSeed * 4.1) * 0.16 * drift;

    // Attraction toward the cursor, falling off with distance.
    vec3 toMouse = uMouse - p;
    float dist = length(toMouse);
    float pull = uPull / (1.0 + dist * dist * 1.15);
    p += normalize(toMouse + vec3(1e-5)) * pull;

    // Collapse shockwave: a ring travelling outward from the click.
    float waveRadius = uWave * 5.2;
    float ring = exp(-pow(dist - waveRadius, 2.0) * 3.2) * max(0.0, 1.0 - uWave * 0.55);
    p -= normalize(toMouse + vec3(1e-5)) * ring * 0.85;

    vGlow = clamp(pull * 1.9 + ring * 1.6, 0.0, 1.0);

    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    vDepth = clamp((viewPosition.z + 9.0) / 8.0, 0.0, 1.0);

    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = (1.35 + vGlow * 5.4) * (260.0 / max(0.001, -viewPosition.z));
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uCalm;
  uniform vec3 uHot;

  varying float vGlow;
  varying float vDepth;

  void main() {
    // Soft round sprite, no texture needed.
    vec2 offset = gl_PointCoord - 0.5;
    float radial = 1.0 - smoothstep(0.16, 0.5, length(offset));
    if (radial <= 0.001) discard;

    vec3 tint = mix(uCalm, uHot, vGlow);
    float alpha = radial * (0.16 + vGlow * 0.84) * (0.35 + vDepth * 0.65);
    gl_FragColor = vec4(tint, alpha);
  }
`;

export function ParticleLattice({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const viewport = useThree((state) => state.viewport);
  const mouse = useRef(new THREE.Vector3());
  const pull = useRef(0);

  const { positions, seeds } = useMemo(() => {
    const count = COLS * ROWS * LAYERS;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    let i = 0;
    for (let layer = 0; layer < LAYERS; layer += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          // Slight per-point jitter stops the grid from moiréing on retina.
          const jitter = (n: number) => (Math.sin(n * 127.1) * 43758.5453) % 1;
          positions[i * 3] = (col / (COLS - 1) - 0.5) * 20 + jitter(i) * 0.18;
          positions[i * 3 + 1] = (row / (ROWS - 1) - 0.5) * 11 + jitter(i + 3) * 0.18;
          positions[i * 3 + 2] = -1.6 - layer * 1.7 + jitter(i + 7) * 0.4;
          seeds[i] = i / count;
          i += 1;
        }
      }
    }
    return { positions, seeds };
  }, []);

  const uniforms = useMemo(
    () => ({
      uMouse: { value: new THREE.Vector3(0, 0, 0) },
      uTime: { value: 0 },
      uPull: { value: 0 },
      uWave: { value: 99 },
      uReduced: { value: reducedMotion ? 1 : 0 },
      uCalm: { value: new THREE.Color("#2a3a70") },
      uHot: { value: new THREE.Color("#38e8ff") },
    }),
    [reducedMotion],
  );

  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;
    const step = Math.min(delta, 1 / 30);

    // Project the cursor onto a plane just in front of the lattice.
    const targetX = pointerState.x * (viewport.width / 2) * 1.05;
    const targetY = pointerState.y * (viewport.height / 2) * 1.05;
    mouse.current.x += (targetX - mouse.current.x) * Math.min(1, step * 6.5);
    mouse.current.y += (targetY - mouse.current.y) * Math.min(1, step * 6.5);
    mouse.current.z = -0.4;

    const targetPull = pointerState.active ? (reducedMotion ? 0.5 : 1.35) : 0;
    pull.current += (targetPull - pull.current) * Math.min(1, step * 3.2);

    material.uniforms.uMouse.value.copy(mouse.current);
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPull.value = pull.current;
    material.uniforms.uWave.value = state.clock.elapsedTime - pointerState.clickAt;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
