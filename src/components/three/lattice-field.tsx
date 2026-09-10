"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { pointerState, useGlobalPointer, useReducedMotion } from "@/lib/pointer";
import { markBooted } from "@/lib/boot";

/**
 * The lattice.
 *
 * A loose grid of tiny points behind the page. Three things happen on it:
 *
 *   The cursor pushes. Points inside a radius are driven radially outward,
 *   hardest at the centre, and then spring back to where they belong. The
 *   spring is real — every point carries a velocity, is pulled toward its own
 *   base position, and is damped — which is why the return overshoots slightly
 *   and settles rather than snapping. A shader-only version of this cannot
 *   overshoot, because a point with no state has nothing to be moving with.
 *
 *   Neighbours link. Every so often a patch of the grid connects itself with
 *   hairlines and then lets go. A grid is what makes this affordable: the
 *   topology is fixed, so the pairs are known at build time and each frame only
 *   streams positions and brightness into a buffer that already exists. Finding
 *   near neighbours among loose points every frame is the version of this
 *   effect that costs a spatial index.
 *
 *   Links break under the cursor. They are gated on the distance between the
 *   two points they join, so the same push that scatters the grid also tears
 *   its connections, and they knit back as the springs settle. That falls out
 *   of the geometry rather than being animated on top of it.
 *
 * The camera is orthographic at zoom 1, so one world unit is one CSS pixel and
 * every number below — spacing, radius, dot size — is in the units they are
 * described in.
 */

/** Nominal gap between points, in pixels. Jittered per point. */
const SPACING = 30;
/** How far the cursor reaches, in pixels. */
const REACH = 150;
const PUSH = 9200;
const STIFFNESS = 34;
const DAMPING = 0.86;

/** A link is drawn while its two ends are at most this far apart. */
const LINK_MAX = SPACING * 1.55;
/** Share of neighbour pairs that are ever wired at all. See `buildGrid`. */
const LINK_CHANCE = 0.2;

const DOT_NEAR = new THREE.Color("#7fd4ff");
const DOT_FAR = new THREE.Color("#2b6fa8");
const LINK = new THREE.Color("#4aa8e0");

const dotVertex = /* glsl */ `
  attribute float aTwinkle;
  attribute float aDepth;
  varying float vAlpha;
  varying vec3 vTint;

  uniform float uTime;
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform float uReduced;

  void main() {
    /* Depth is a fiction — the grid is flat — but it is the cheapest way to
       stop a regular lattice reading as graph paper. Points sit at different
       brightnesses and sizes as though at different distances, and the eye
       reads the variation as space rather than as a printed grid. */
    vTint = mix(uFar, uNear, aDepth);

    float twinkle = uReduced > 0.5
      ? 1.0
      : 0.72 + 0.28 * sin(uTime * 1.1 + aTwinkle * 6.2831);

    vAlpha = (0.5 + aDepth * 0.6) * twinkle;

    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    // 1 to 2 physical pixels, as specified.
    gl_PointSize = 1.0 + aDepth * 1.2;
  }
`;

const dotFragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vTint;
  uniform float uOpacity;

  void main() {
    /* No round-sprite maths. At one or two pixels a falloff has nowhere to
       land — it just makes every dot a grey smear — so the square the
       rasteriser gives us is the dot, and the shape is carried by size and
       brightness instead. */
    gl_FragColor = vec4(vTint, vAlpha * uOpacity);
  }
`;

interface Grid {
  cols: number;
  rows: number;
  count: number;
  /** Rest position, x/y interleaved. The sim copies this and springs to it. */
  base: Float32Array;
  /** Point buffer, x/y/z interleaved — what the GPU reads. */
  position: Float32Array;
  twinkle: Float32Array;
  depth: Float32Array;
  /** Index pairs, two entries per link. */
  links: Uint32Array;
  linkPositions: Float32Array;
  linkColors: Float32Array;
  /** Per-link phase, so patches light rather than the whole grid at once. */
  linkPhase: Float32Array;
}

function buildGrid(width: number, height: number): Grid {
  // A margin, so the outermost points are off-screen and the grid has no edge.
  const cols = Math.max(2, Math.ceil(width / SPACING) + 3);
  const rows = Math.max(2, Math.ceil(height / SPACING) + 3);
  const count = cols * rows;

  const base = new Float32Array(count * 2);
  const position = new Float32Array(count * 3);
  const twinkle = new Float32Array(count);
  const depth = new Float32Array(count);

  const originX = -width / 2 - SPACING;
  const originY = -height / 2 - SPACING;

  // Deterministic jitter, so a resize does not reshuffle the whole sky.
  let seed = 0x2f6e2b1;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const i = row * cols + col;
      /* Loose, not exact. A perfectly regular lattice reads as a technical
         drawing; a third of a cell of jitter reads as a field that happens to
         be roughly ordered, which is the thing being asked for. */
      const x = originX + col * SPACING + (rand() - 0.5) * SPACING * 0.62;
      const y = originY + row * SPACING + (rand() - 0.5) * SPACING * 0.62;

      base[i * 2] = x;
      base[i * 2 + 1] = y;
      position[i * 3] = x;
      position[i * 3 + 1] = y;
      twinkle[i] = rand();
      depth[i] = Math.pow(rand(), 1.7);
    }
  }

  /* Links: right and down from each point, and then most of them thrown away.
     Only one edge in five is ever built.

     Wiring every neighbour is what made this read as cracked glass rather than
     as a field of dots. A complete grid has two edges per point, so even with
     only a third of them lit at a time the survivors still close into polygons
     everywhere you look, and the eye reads the polygons, not the points. The
     brief was dots that *occasionally* find each other. Discarding four edges
     in five at build time is what makes a lit edge a thread between two
     neighbours instead of one more cell in a mesh — and it is done here rather
     than by dimming, because an edge that does not exist costs no upload and no
     draw either.

     Both directions from every point would draw each edge twice, which at these
     counts is a doubled upload for an identical picture. */
  const pairs: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const i = row * cols + col;
      if (col + 1 < cols && rand() < LINK_CHANCE) pairs.push(i, i + 1);
      if (row + 1 < rows && rand() < LINK_CHANCE) pairs.push(i, i + cols);
    }
  }

  const links = Uint32Array.from(pairs);
  const linkCount = links.length / 2;

  return {
    cols,
    rows,
    count,
    base,
    position,
    twinkle,
    depth,
    links,
    linkPositions: new Float32Array(linkCount * 6),
    linkColors: new Float32Array(linkCount * 6),
    linkPhase: Float32Array.from({ length: linkCount }, () => rand()),
  };
}

/**
 * The mutable half of the simulation.
 *
 * Held in a ref rather than a memo because every value in it is written sixty
 * times a second, and React's compiler — correctly — refuses to let a memo's
 * contents be mutated. The GPU-facing buffers are reached through the geometry
 * attributes for the same reason: the attribute owns its array once uploaded,
 * so that is the copy to write into.
 */
interface Sim {
  owner: Grid;
  base: Float32Array;
  live: Float32Array;
  velocity: Float32Array;
  linkPhase: Float32Array;
}

function makeSim(grid: Grid): Sim {
  return {
    owner: grid,
    base: Float32Array.from(grid.base),
    live: Float32Array.from(grid.base),
    velocity: new Float32Array(grid.count * 2),
    linkPhase: Float32Array.from(grid.linkPhase),
  };
}

function Lattice({ reducedMotion }: { reducedMotion: boolean }) {
  const { viewport, size } = useThree();
  const dots = useRef<THREE.Points>(null);
  const wires = useRef<THREE.LineSegments>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const sim = useRef<Sim | null>(null);
  const opacity = useRef(0);

  /* Rebuilt only when the viewport genuinely changes size. Rounding to 40px
     keeps a drag-resize from reallocating a few thousand floats every frame. */
  const cell = Math.round(Math.max(320, size.width) / 40);
  const row = Math.round(Math.max(320, size.height) / 40);
  const grid = useMemo(
    () => buildGrid(Math.max(cell * 40, 320), Math.max(row * 40, 320)),
    [cell, row],
  );

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uNear: { value: DOT_NEAR },
      uFar: { value: DOT_FAR },
      uReduced: { value: reducedMotion ? 1 : 0 },
    }),
    [reducedMotion],
  );

  useFrame((state, delta) => {
    const shader = material.current;
    const dotGeometry = dots.current?.geometry;
    const wireGeometry = wires.current?.geometry;
    if (!shader || !dotGeometry || !wireGeometry) return;

    markBooted("field");
    const step = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;

    if (!sim.current || sim.current.owner !== grid) sim.current = makeSim(grid);
    const { base, live, velocity, linkPhase } = sim.current;

    shader.uniforms.uTime.value = time;

    /* Fade in once, then duck behind the reading sections. The lattice is far
       quieter than the field it replaces, so it does not have to duck as far. */
    const scrolled = window.scrollY;
    const fold = Math.max(0, 1 - scrolled / (window.innerHeight * 1.4));
    const want = 0.5 + fold * 0.5;
    opacity.current =
      opacity.current === 0
        ? want
        : opacity.current + (want - opacity.current) * Math.min(1, step * 3);
    shader.uniforms.uOpacity.value = opacity.current;

    // Cursor, in the same pixel units the grid is laid out in.
    const mx = pointerState.active ? pointerState.x * (viewport.width / 2) : 1e6;
    const my = pointerState.active ? pointerState.y * (viewport.height / 2) : 1e6;

    const positions = (dotGeometry.getAttribute("position") as THREE.BufferAttribute)
      .array as Float32Array;
    const reach2 = REACH * REACH;
    const damp = Math.pow(DAMPING, step * 60);

    for (let i = 0; i < grid.count; i += 1) {
      const ix = i * 2;
      const iy = ix + 1;

      let vx = velocity[ix];
      let vy = velocity[iy];
      const x = live[ix];
      const y = live[iy];

      // --- the cursor's push ------------------------------------------
      const dx = x - mx;
      const dy = y - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < reach2) {
        const d = Math.sqrt(d2) || 0.0001;
        /* Squared falloff, so the very centre shoves hard and the rim barely
           stirs. A linear falloff moves the whole disc almost equally, which
           reads as the grid being dragged rather than parted. */
        const fall = 1 - d / REACH;
        const force = (fall * fall * PUSH) / d;
        vx += dx * force * step;
        vy += dy * force * step;
      }

      // --- the spring home --------------------------------------------
      vx += (base[ix] - x) * STIFFNESS * step;
      vy += (base[iy] - y) * STIFFNESS * step;

      vx *= damp;
      vy *= damp;

      velocity[ix] = vx;
      velocity[iy] = vy;

      const nx = x + vx * step;
      const ny = y + vy * step;
      live[ix] = nx;
      live[iy] = ny;
      positions[i * 3] = nx;
      positions[i * 3 + 1] = ny;
    }
    (dotGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;

    // --- the links ------------------------------------------------------
    const linkPositions = (wireGeometry.getAttribute("position") as THREE.BufferAttribute)
      .array as Float32Array;
    const linkColors = (wireGeometry.getAttribute("color") as THREE.BufferAttribute)
      .array as Float32Array;
    const linkCount = grid.links.length / 2;

    for (let l = 0; l < linkCount; l += 1) {
      const a = grid.links[l * 2];
      const b = grid.links[l * 2 + 1];

      const ax = live[a * 2];
      const ay = live[a * 2 + 1];
      const bx = live[b * 2];
      const by = live[b * 2 + 1];

      const o = l * 6;
      linkPositions[o] = ax;
      linkPositions[o + 1] = ay;
      linkPositions[o + 3] = bx;
      linkPositions[o + 4] = by;

      /* Two gates multiplied.
         Distance: a link fades as its ends separate, so the cursor's push
         tears the lattice open and the springs knit it back — the connections
         answer the cursor without being driven by it.
         Phase: a slow travelling wave decides which patches are linked at all,
         which is what makes them read as states forming and letting go rather
         than as a permanent mesh. */
      const sx = bx - ax;
      const sy = by - ay;
      const span = Math.sqrt(sx * sx + sy * sy);
      const near = Math.max(0, 1 - span / LINK_MAX);

      const wave = reducedMotion
        ? 0.55
        : 0.5 + 0.5 * Math.sin(time * 0.45 + linkPhase[l] * 6.2831 + ax * 0.006 + ay * 0.004);
      const gate = Math.max(0, (wave - 0.82) / 0.18);

      const lit = near * near * gate * opacity.current * 0.6;

      linkColors[o] = LINK.r * lit;
      linkColors[o + 1] = LINK.g * lit;
      linkColors[o + 2] = LINK.b * lit;
      linkColors[o + 3] = LINK.r * lit;
      linkColors[o + 4] = LINK.g * lit;
      linkColors[o + 5] = LINK.b * lit;
    }

    (wireGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (wireGeometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <group>
      {/* Hairlines first, so the dots sit on top of their own connections. */}
      <lineSegments ref={wires} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[grid.linkPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[grid.linkColors, 3]} />
        </bufferGeometry>
        {/* Brightness carries the alpha: on black, under additive blending, a
            dimmed colour and a lowered opacity are the same picture — and
            per-vertex colour is available where per-vertex alpha is not. */}
        <lineBasicMaterial
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      <points ref={dots} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[grid.position, 3]} />
          <bufferAttribute attach="attributes-aTwinkle" args={[grid.twinkle, 1]} />
          <bufferAttribute attach="attributes-aDepth" args={[grid.depth, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={dotVertex}
          fragmentShader={dotFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export default function LatticeField() {
  useGlobalPointer();
  const reducedMotion = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 -z-30" aria-hidden>
      <Canvas
        // One world unit per CSS pixel, so spacing, reach and dot size are all
        // written in the units they are described in.
        orthographic
        camera={{ position: [0, 0, 10], zoom: 1 }}
        dpr={[1, 2]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ pointerEvents: "none" }}
        fallback={null}
      >
        <Lattice reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
