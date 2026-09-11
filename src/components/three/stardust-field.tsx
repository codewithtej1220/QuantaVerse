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
 * keeps it. It is nudged by a slow flow field built as the curl of a stream
 * function, which is what keeps the sky evenly populated: a curl has zero
 * divergence, so the dust circulates without ever collecting in one place and
 * abandoning another. Motes that leave one edge come back in the other, which
 * is what lets them drift forever without draining out of the frame.
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
/* One mote per this many square pixels. The reference is not a handful of
   bright stars on black — what makes it read as a sky is the sheer count of
   faint ones filling the space between the bright ones, so this number is low
   and the faint majority is carried by the alpha floor rather than by size. */
const AREA_PER_MOTE = 170;
const MIN_MOTES = 900;
const MAX_MOTES = 14000;

/** How far the cursor reaches, in pixels. */
const REACH = 230;
/** Tangential push — the swirl. This is most of what you feel. */
const SWIRL = 380;
/** Inward pull, so the swirl has a centre. The one term here that is not
    incompressible — a radial flow has somewhere for dust to end up — so it is
    small enough that the circulation redistributes faster than it collects.
    The swirl itself is free: a purely tangential field has zero divergence. */
const GATHER = 22;
/** Share of the cursor's own velocity handed to the dust around it. */
const CARRY = 1.7;
/** A flick should not fire a mote across the screen. Pixels per second. */
const CURSOR_CLAMP = 1500;

/** Ambient drift, in pixels per second. Applied to position, not velocity. */
const FLOW_SPEED = 13;
/** Whole cells each flow octave fits across the field. Integers on purpose. */
const FLOW_CELLS = [
  { mx: 2, my: 2, weight: 1 },
  { mx: 3, my: 5, weight: 0.42 },
];
/** Per-frame velocity retention at 60fps. High, so motion carries. */
const DAMPING = 0.94;

/* Both ends run pale, because in the reference the blue lives in the gas and
   the stars on top of it are white — the faint ones are dimmer, not bluer.
   Tinting the far end properly blue, which is what this used to do, turns the
   faint majority into blue specks and the sky into confetti. */
const DOT_NEAR = new THREE.Color("#f2f8ff");
const DOT_FAR = new THREE.Color("#93b9e6");

/* The cloud: deep navy where it is thin, vivid blue through the body of it,
   and a cyan core where it piles up. Three stops rather than two because a
   two-stop nebula reads as a coloured fog, and what makes a real one look deep
   is that the brightest parts go a different hue, not just a lighter one. */
const NEB_DEEP = new THREE.Color("#0a1440");
const NEB_MID = new THREE.Color("#1552c8");
const NEB_HOT = new THREE.Color("#4fe0ff");

/* Value noise, and the octave sum built on it. Written once here as a GLSL
   string and once below in TypeScript, because the cloud is drawn on the GPU
   and the stars are clustered into it on the CPU — the two have to agree on
   where the bright regions are, or the sky ends up with its gas in one place
   and its stars in another. */
const NOISE = /* glsl */ `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.02; a *= 0.5; }
    return v;
  }
`;

const nebulaVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const nebulaFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uReduced;
  uniform vec2 uAspect;
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uHot;
` + NOISE + /* glsl */ `
  void main() {
    /* Low frequency on purpose. At 2.3 the cloud came out as one bright
       clump with black either side of it; the reference has gas across the
       whole frame and only varies how much. */
    vec2 p = vUv * uAspect * 1.65;

    /* base is the shape of the cloud and nothing else touches it — the CPU
       samples the same function to decide where to put stars, so warping or
       drifting it here would pull the gas off the stars sitting in it. */
    float base = fbm(p);

    /* The filaments are where the motion lives. A domain warp that turns very
       slowly, mixed in at a quarter weight, so the cloud keeps its shape while
       its edges keep moving. */
    float t = uReduced > 0.5 ? 0.0 : uTime * 0.014;
    vec2 q = vec2(fbm(p + 3.1 + t), fbm(p + 7.7 - t));
    float detail = fbm(p + q * 0.6);
    float n = base * 0.75 + detail * 0.25;

    /* Piled toward one corner, the way the reference brightens into the
       bottom left rather than sitting evenly across the frame. */
    /* Nearly flat. The weighting down the frame is still here but it is now
       a lean rather than a pile — the cloud covers the whole page and the
       noise, not the gradient, does the varying. A strong gradient gave one
       bright end and one dead one, which is a lit corner rather than a sky. */
    float corner = smoothstep(1.3, -0.2, vUv.y * 1.25 + vUv.x * 0.55);
    /* The ramp has to sit on the range the noise actually occupies. Five
       octaves at half gain can reach 0.97 in principle and essentially never
       do — the sum piles up around 0.5 and rarely clears 0.7 — so a ramp up to
       1.0 spends almost its whole length on values that never arrive, and
       everything real lands in the dim bottom of it. Mapping 0.28..0.70
       instead is the difference between a cloud you can see and a cloud that
       is technically being drawn. Clamped, because the corner weight can push
       past one and the cores are bright enough already. */
    float d = min(1.0, smoothstep(0.28, 0.70, n) * (0.78 + corner * 0.26));

    /* Deep navy is the body of it and cyan is only the cores. The first pass
       ran the cyan far too early and the whole cloud read as teal, which is
       the one colour the reference does not have in it. */
    vec3 col = mix(uDeep, uMid, smoothstep(0.0, 0.55, d));
    col = mix(col, uHot, smoothstep(0.82, 1.12, d));

    /* Additive on a near-black page, and deliberately dim: this sits under
       body copy on every route, so it has to read as depth rather than as a
       picture competing with the type. */
    gl_FragColor = vec4(col * d * uOpacity * 0.5, 1.0);
  }
`;

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

    /* The floor matters more than the swing. A mote that fades to nearly
       nothing is a mote that is missing for half its cycle, and a sky where
       half the stars are missing at any moment reads as empty rather than as
       twinkling. */
    float twinkle = uReduced > 0.5
      ? 1.0
      : 0.70 + 0.30 * sin(uTime * 0.8 + aTwinkle * 6.2831);

    vAlpha = (0.48 + aDepth * 0.52) * twinkle;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
  }
`;

const dotFragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vTint;
  uniform float uOpacity;

  void main() {
    /* A star, not a dot.

       This used to hand back the square the rasteriser gives us, on the
       argument that under three pixels a falloff has nowhere to land. That was
       true and it was the wrong conclusion: the answer is not to drop the
       falloff, it is to give the sprite enough pixels to spend on one. A hard
       square reads as a tile at any size, and a field of them reads as noise
       on a screen rather than as a sky.

       Two gaussians. The wide one is the halo that makes a bright star look
       bright rather than merely large; the tight one is the core that keeps it
       a point instead of a smudge. Real starlight through a lens does exactly
       this, which is why one gaussian alone never looks right — too wide and
       every star is a blur, too tight and the sprite is a square again. */
    vec2 c = gl_PointCoord - 0.5;
    float r = dot(c, c) * 4.0;

    float halo = exp(-r * 3.2);
    float core = exp(-r * 16.0);
    /* The halo comes down as the count goes up. Each one is cheap on its own
       and they add, so a sky dense enough to read as a real one turns into a
       single grey wash at the halo weight a sparse sky can carry. */
    float star = halo * 0.24 + core * 0.82;

    // The corners of the quad are empty sky; do not pay to blend them.
    if (star < 0.004) discard;

    gl_FragColor = vec4(vTint, vAlpha * uOpacity * star);
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

/* The TypeScript half of NOISE above. Same constants, same lacunarity and
   gain, one octave shallower — the stars are clustered on the low frequencies
   and the fifth octave would not move a single one of them.

   It will not match the GPU bit for bit, because `sin` at these magnitudes is
   precision-sensitive and a shader is free to evaluate it at lower precision.
   It does not need to: the agreement that matters is which half of the screen
   the cloud is piled in, and that is carried by the first two octaves, where
   both agree closely. */
function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function vnoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
}

function fbm(x: number, y: number) {
  let v = 0;
  let amp = 0.5;
  for (let i = 0; i < 4; i += 1) {
    v += amp * vnoise(x, y);
    x *= 2.02;
    y *= 2.02;
    amp *= 0.5;
  }
  return v;
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

  /* Same mapping the cloud shader uses, so a sample here lands on the part of
     the cloud that will be drawn there. */
  const aspect = Math.max(1, width / height);
  const density = (x: number, y: number) => {
    const u = x / width + 0.5;
    const v = y / height + 0.5;
    return fbm(u * aspect * 2.3, v * 2.3);
  };

  for (let i = 0; i < count; i += 1) {
    /* Rejection sampling against the cloud. A uniform scatter is the thing
       that makes a generated starfield look generated: real ones clump, and
       they clump *where the gas is*. Eight tries, then take what we have —
       capping it keeps a mote in a thin region instead of looping, which is
       what leaves the dark areas with a scatter of their own rather than
       scrubbing them empty. */
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      x = (rand() - 0.5) * width;
      y = (rand() - 0.5) * height;
      const d = density(x, y);
      if (rand() < 0.38 + d * d * 0.9) break;
    }

    position[i * 3] = x;
    position[i * 3 + 1] = y;
    position[i * 3 + 2] = 0;

    /* Squared, so most motes sit far and faint and only a handful come near
       and bright. A uniform spread of depths gives a field of medium-grey dots
       with no sense of distance in it at all; cubing it goes too far the other
       way and leaves almost nothing legible between the few bright ones.

       The floor on the size is the thing that decides whether the field looks
       populated. gl_PointSize is in *device* pixels, so on a 2x display a mote
       of 0.8 is under half a CSS pixel — the rasteriser gives it a sliver of
       coverage, the blend gives that sliver a fraction of its alpha, and the
       result is a mote that exists in the buffer and not on the screen. Most
       of the sky sits near this floor, so the floor is most of the sky.

       These are larger than the visible star, not equal to it. The sprite is
       two gaussians and spends its outer half on a halo that fades to nothing,
       so a mote drawn at eight pixels reads as a point of two or three with a
       glow around it. Sized to the dot you want, the falloff has no room and
       you are back to squares. */
    const d = rand();
    depth[i] = d * d;
    size[i] = 2.4 + depth[i] * 6.2;
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
  const nebula = useRef<THREE.ShaderMaterial>(null);
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

  const nebulaUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uReduced: { value: reducedMotion ? 1 : 0 },
      uAspect: { value: new THREE.Vector2(1, 1) },
      uDeep: { value: NEB_DEEP },
      uMid: { value: NEB_MID },
      uHot: { value: NEB_HOT },
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

    const cloud = nebula.current;
    if (cloud) {
      cloud.uniforms.uTime.value = time;
      cloud.uniforms.uOpacity.value = opacity.current;
      /* Fed the viewport's aspect so the noise is sampled on square cells:
         without it the cloud stretches with the window and the filaments read
         as horizontal streaks on a wide monitor. */
      cloud.uniforms.uAspect.value.set(Math.max(1, viewport.width / viewport.height), 1);
    }

    const positions = (geometry.getAttribute("position") as THREE.BufferAttribute)
      .array as Float32Array;
    const { velocity } = s;
    const { count, depth } = dust;

    const halfW = dust.width / 2;
    const halfH = dust.height / 2;

    /* The flow, as the curl of a stream function: for psi = sin(a)cos(b) the
       curl is (-ky sin(a) sin(b), -kx cos(a) cos(b)), whose divergence cancels
       exactly for any kx and ky — the two partials are equal and opposite. The
       k factors have to stay in the components; dropping them is only correct
       when kx equals ky, and that cannot also be periodic on a box that is not
       square.

       Periodic is the other half, and it is the half that actually bit. A
       divergence-free field still empties the screen if its period does not
       divide the wrap box: a mote crossing the seam re-enters at an unrelated
       phase, so the seam is a source on one side and a sink on the other even
       though the interior is clean. Whole numbers of cells across the field
       make the wrap continuous. Measured across two simulated minutes: with a
       non-dividing period a fifth of the cells ended up empty; with this, none
       do, and the spread sits at the noise floor for a random scatter. */
    const tau = Math.PI * 2;
    const flow = FLOW_CELLS.map((c, i) => ({
      kx: (tau * c.mx) / dust.width,
      ky: (tau * c.my) / dust.height,
      weight: c.weight,
      wa: 0.055 - i * 0.14,
      wb: 0.045 + i * 0.115,
    }));
    const flowNorm = 1 / Math.max(flow[0].kx, flow[0].ky);

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

      /* The ambient flow moves the mote directly; only what the cursor gave it
         lives in the velocity. Adding the flow as an acceleration instead —
         which is what this did — puts inertia between the mote and the field,
         the mote's velocity lags the streamline it is on, and that lag is
         enough compressibility on its own to empty the middle of the screen.
         Measured: as an acceleration, a fifth of the sky was bare after two
         minutes no matter how clean the field was. Advected, nothing drains. */
      let fx = 0;
      let fy = 0;
      if (!reducedMotion) {
        for (let o = 0; o < flow.length; o += 1) {
          const c = flow[o];
          const a = c.kx * x + time * c.wa;
          const b = c.ky * y - time * c.wb;
          fx -= c.ky * c.weight * Math.sin(a) * Math.sin(b);
          fy -= c.kx * c.weight * Math.cos(a) * Math.cos(b);
        }
        fx *= flowNorm;
        fy *= flowNorm;
      }

      x += (fx * FLOW_SPEED + vx) * step;
      y += (fy * FLOW_SPEED + vy) * step;

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
    <>
      {/* The cloud, behind everything. renderOrder rather than depth: both
          layers write no depth and blend additively, so the only thing that
          decides which lands first is the order they are drawn in. */}
      <mesh
        renderOrder={-1}
        frustumCulled={false}
        position={[0, 0, -1]}
        scale={[viewport.width, viewport.height, 1]}
      >
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={nebula}
          uniforms={nebulaUniforms}
          vertexShader={nebulaVertex}
          fragmentShader={nebulaFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <points ref={dots} renderOrder={0} frustumCulled={false}>
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
    </>
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
