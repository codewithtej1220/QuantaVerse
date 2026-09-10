"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { pointerState, useGlobalPointer, useReducedMotion } from "@/lib/pointer";
import { markBooted } from "@/lib/boot";

/**
 * The stardust.
 *
 * This replaces a lattice, and the reason is worth writing down because the
 * lattice was built to a written spec and still came out wrong.
 *
 * That version laid points on a jittered grid, gave each one a home, and
 * sprang it back after the cursor pushed it away. Two things followed, and both
 * are what made it read as "dots" rather than as dust. A grid survives jitter —
 * the eye finds the rows again at any offset short of total randomness, so it
 * looked like graph paper no matter how much the points were scattered. And a
 * point with a home is only ever displaced from it: between cursor passes the
 * whole field is perfectly still, which is the one thing dust never is.
 *
 * So there is no grid and there are no homes. Every mote carries a velocity and
 * keeps it. It is nudged by a slow flow field — a cheap curl, two sines over
 * position and time — which never repeats and never settles, so the field
 * drifts on its own whether or not anybody is looking at it. Motes that leave
 * one edge come back in the other, which is what lets them drift forever
 * without draining out of the frame.
 *
 * The cursor stirs rather than shoves. Inside its radius a mote gets a
 * tangential push (dust swirls around a moving hand, it does not flee radially
 * from it), a much weaker inward pull so the swirl has something to orbit, and
 * a share of the cursor's own velocity — that last term is the one that makes
 * the dust travel *with* the pointer instead of away from it. All three are
 * scaled by the mote's depth, so the bright near ones answer hardest and the
 * dim far ones barely stir, and the field comes apart into layers as you move
 * through it.
 *
 * Nothing here springs back, because nothing has anywhere to spring back to.
 * The stirred dust simply keeps going, and the flow field slowly takes it over
 * again. That is the difference between disturbing a surface and moving through
 * a medium.
 */

/** One mote per this many square pixels. */
const AREA_PER_MOTE = 660;
const MIN_MOTES = 500;
const MAX_MOTES = 6000;

/** How far the cursor reaches, in pixels. */
const REACH = 230;
/** Tangential push — the swirl. This is most of what you feel. */
const SWIRL = 380;
/** Inward pull, so the swirl has a centre. Deliberately far weaker. */
const GATHER = 95;
/** Share of the cursor's own velocity handed to the dust around it. */
const CARRY = 1.7;
/** A flick should not fire a mote across the screen. Pixels per second. */
const CURSOR_CLAMP = 1500;

/** Ambient flow acceleration. Sets the resting drift speed with DAMPING. */
const DRIFT = 45;
/** Per-frame velocity retention at 60fps. High, so motion carries. */
const DAMPING = 0.94;

const DOT_NEAR = new THREE.Color("#9fdcff");
const DOT_FAR = new THREE.Color("#2b6fa8");

const dotVertex = /* glsl */ `
  attribute float aTwinkle;
  attribute float aDepth;
  attribute float aSize;
  varying float vAlpha;
  varying vec3 vTint;

  uniform float uTime;
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform float uReduced;

  void main() {
    /* Depth is a fiction — the field is flat — but it is what stops a scatter
       of identical points reading as noise. Size, brightness and colour all
       come off it together, so a mote reads as near or far rather than as
       bigger or smaller, and the same value drives how hard it answers the
       cursor on the CPU side. */
    vTint = mix(uFar, uNear, aDepth);

    float twinkle = uReduced > 0.5
      ? 1.0
      : 0.55 + 0.45 * sin(uTime * 0.8 + aTwinkle * 6.2831);

    vAlpha = (0.38 + aDepth * 0.62) * twinkle;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
  }
`;

const dotFragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vTint;
  uniform float uOpacity;

  void main() {
    /* No round-sprite maths. Under about three pixels a falloff has nowhere to
       land and only turns every mote into a grey smear, so the square the
       rasteriser gives us is the mote, and the shape is carried by size and
       brightness instead. */
    gl_FragColor = vec4(vTint, vAlpha * uOpacity);
  }
`;

interface Dust {
  count: number;
  /** Field extent the positions were generated for, and wrap against. */
  width: number;
  height: number;
  /** Point buffer, x/y/z interleaved — what the GPU reads. */
  position: Float32Array;
  size: Float32Array;
  twinkle: Float32Array;
  depth: Float32Array;
}

function buildDust(width: number, height: number): Dust {
  const count = Math.min(
    MAX_MOTES,
    Math.max(MIN_MOTES, Math.round((width * height) / AREA_PER_MOTE)),
  );

  const position = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const twinkle = new Float32Array(count);
  const depth = new Float32Array(count);

  /* Seeded, so a resize does not reshuffle the whole sky. */
  let seed = 0x9e3779b9;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 0x100000000;
  };

  for (let i = 0; i < count; i += 1) {
    position[i * 3] = (rand() - 0.5) * width;
    position[i * 3 + 1] = (rand() - 0.5) * height;
    position[i * 3 + 2] = 0;

    /* Squared, so most motes sit far and faint and only a handful come near
       and bright. A uniform spread of depths gives a field of medium-grey dots
       with no sense of distance in it at all; cubing it goes too far the other
       way and leaves almost nothing legible between the few bright ones. */
    const d = rand();
    depth[i] = d * d;
    size[i] = 0.8 + depth[i] * 2.0;
    twinkle[i] = rand();
  }

  return { count, width, height, position, size, twinkle, depth };
}

/** The mutable half. Held in a ref: the compiler forbids mutating a memo. */
interface Sim {
  owner: Dust;
  velocity: Float32Array;
  /** Cursor position last frame, in pixels, for its velocity. */
  lastX: number;
  lastY: number;
  primed: boolean;
}

function makeSim(dust: Dust): Sim {
  return {
    owner: dust,
    velocity: new Float32Array(dust.count * 2),
    lastX: 0,
    lastY: 0,
    primed: false,
  };
}

function Stardust({ reducedMotion }: { reducedMotion: boolean }) {
  const { viewport, size } = useThree();
  const dots = useRef<THREE.Points>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const sim = useRef<Sim | null>(null);
  const opacity = useRef(0);

  /* Rounded to 80px, so dragging a window edge does not reallocate a few
     thousand floats on every frame of the drag. */
  const w = Math.max(360, Math.round(size.width / 80) * 80);
  const h = Math.max(360, Math.round(size.height / 80) * 80);
  const dust = useMemo(() => buildDust(w + 160, h + 160), [w, h]);

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
    const geometry = dots.current?.geometry;
    if (!shader || !geometry) return;

    markBooted("field");
    const step = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    shader.uniforms.uTime.value = time;

    if (!sim.current || sim.current.owner !== dust) sim.current = makeSim(dust);
    const s = sim.current;

    /* Fade in once, then duck behind the reading sections. */
    const fold = Math.max(0, 1 - window.scrollY / (window.innerHeight * 1.4));
    const want = 0.5 + fold * 0.5;
    opacity.current =
      opacity.current === 0 ? want : opacity.current + (want - opacity.current) * Math.min(1, step * 3);
    shader.uniforms.uOpacity.value = opacity.current;

    const positions = (geometry.getAttribute("position") as THREE.BufferAttribute)
      .array as Float32Array;
    const { velocity } = s;
    const { count, depth } = dust;

    const halfW = dust.width / 2;
    const halfH = dust.height / 2;

    // Cursor, in the same pixel units the motes live in.
    const live = pointerState.active && !reducedMotion;
    const mx = live ? pointerState.x * (viewport.width / 2) : 0;
    const my = live ? pointerState.y * (viewport.height / 2) : 0;

    /* The cursor's own velocity, which is what the dust gets carried by. It is
       differenced here rather than read from the pointer store because the
       store keeps a scalar speed, and a swirl needs a direction. */
    let cvx = 0;
    let cvy = 0;
    if (live) {
      if (s.primed && step > 0) {
        cvx = (mx - s.lastX) / step;
        cvy = (my - s.lastY) / step;
        const mag = Math.hypot(cvx, cvy);
        if (mag > CURSOR_CLAMP) {
          cvx = (cvx / mag) * CURSOR_CLAMP;
          cvy = (cvy / mag) * CURSOR_CLAMP;
        }
      }
      s.lastX = mx;
      s.lastY = my;
      s.primed = true;
    } else {
      s.primed = false;
    }

    const damp = Math.pow(DAMPING, step * 60);
    const reach2 = REACH * REACH;

    for (let i = 0; i < count; i += 1) {
      const ix = i * 2;
      const iy = ix + 1;
      const px = i * 3;

      let x = positions[px];
      let y = positions[px + 1];
      let vx = velocity[ix];
      let vy = velocity[iy];

      if (!reducedMotion) {
        /* The flow field. Two sines over position and a slowly turning time
           term give a direction that varies smoothly across the screen and
           never repeats, which is enough to read as a current without the cost
           of real noise. */
        const angle =
          Math.sin(x * 0.0016 + time * 0.06) * 1.7 + Math.cos(y * 0.0014 - time * 0.05) * 1.7;
        vx += Math.cos(angle) * DRIFT * step;
        vy += Math.sin(angle) * DRIFT * step;
      }

      if (live) {
        const dx = x - mx;
        const dy = y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < reach2) {
          const d = Math.sqrt(d2) || 0.0001;
          const fall = 1 - d / REACH;
          /* Squared falloff and a depth weight together: the centre of the
             stir is violent, the rim barely moves, and the near motes lead the
             far ones so the field separates into layers as it turns. */
          const f = fall * fall * (0.35 + depth[i] * 0.9);

          const nx = dx / d;
          const ny = dy / d;

          // Tangential: the swirl.
          vx += -ny * SWIRL * f * step;
          vy += nx * SWIRL * f * step;
          // Inward: something for the swirl to orbit.
          vx -= nx * GATHER * f * step;
          vy -= ny * GATHER * f * step;
          // Carried along with the hand.
          vx += cvx * CARRY * f * step;
          vy += cvy * CARRY * f * step;
        }
      }

      vx *= damp;
      vy *= damp;
      velocity[ix] = vx;
      velocity[iy] = vy;

      x += vx * step;
      y += vy * step;

      // Off one edge, back in the other, so the drift never runs out of sky.
      if (x < -halfW) x += dust.width;
      else if (x > halfW) x -= dust.width;
      if (y < -halfH) y += dust.height;
      else if (y > halfH) y -= dust.height;

      positions[px] = x;
      positions[px + 1] = y;
    }

    (geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points ref={dots} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[dust.position, 3]} />
        <bufferAttribute attach="attributes-aTwinkle" args={[dust.twinkle, 1]} />
        <bufferAttribute attach="attributes-aDepth" args={[dust.depth, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[dust.size, 1]} />
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
  );
}

export default function StardustField() {
  useGlobalPointer();
  const reducedMotion = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 -z-30" aria-hidden>
      <Canvas
        // One world unit per CSS pixel, so reach, drift and mote size are all
        // written in the units they are described in.
        orthographic
        camera={{ position: [0, 0, 10], zoom: 1 }}
        dpr={[1, 2]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ pointerEvents: "none" }}
        fallback={null}
      >
        <Stardust reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
