"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import {
  pointerSpeed,
  pointerState,
  secondsSinceClick,
  useGlobalPointer,
  useReducedMotion,
} from "@/lib/pointer";
import { markBooted } from "@/lib/boot";
import { takeBurst } from "@/lib/burst";
import { dwell, FILM_STOPS, FILM_TRACK, trackOnScreen, trackProgress } from "@/lib/scroll";

/**
 * The field.
 *
 * Twenty thousand points, behind the entire page, that are the page's one
 * continuous piece of motion. They do two things at once:
 *
 *   The cursor tears through them. Points near the pointer are pushed out,
 *   dragged around tangentially and lifted toward the camera, so the field
 *   opens a moving wake rather than politely nudging. A fast flick throws it
 *   further than a slow drift because the pointer's own speed is a uniform.
 *   A click fires a shockwave ring outward — a measurement collapsing the
 *   field.
 *
 *   Scroll re-forms them. The same twenty thousand points hold four different
 *   shapes, and the scroll position through the film section is what mixes
 *   between them: a formless cloud, a sphere, a circuit, a histogram. It is
 *   the arc the curriculum teaches — superposition, a defined state, gates,
 *   measurement — with the particles never being replaced, only rearranged,
 *   which is the whole point about a quantum state.
 *
 * All of it happens in the vertex shader. The cursor and the scroll are two
 * uniform writes per frame; nothing here allocates, and nothing here re-renders
 * a React component.
 */

const COUNT = 23_000;

/** How loudly the field plays on the page it is mounted on. */
export type FieldIntensity = "full" | "ambient" | "quiet";

/**
 * The field is the same field everywhere; only its presence changes.
 *
 * The landing page is the field's own page and it runs at full strength, bursts
 * included: there the flashes punctuate a scroll-driven film, and the type they
 * sit behind is display-sized.
 *
 * Reading pages get the cloud and the cursor wake but none of the events. A
 * burst is a light going off behind body copy, and it does not matter how good
 * it looks if it lands on the paragraph someone is halfway through. The texture
 * is what stops the page being plain; the flashing is not.
 *
 * The two working pages get less again. The circuit deck on them already
 * answers the cursor, and a wake tearing open behind a board that is
 * simultaneously tilting is one mouse driving two things at once — it reads as
 * noise rather than as depth, and it costs the deck the parallax that was the
 * whole point of building it. Dropping the count also leaves the GPU to the
 * simulator, which is what a student is actually there for.
 */
const PRESENCE: Record<
  FieldIntensity,
  {
    count: number;
    /** Ceiling on the opacity ramp. */
    gain: number;
    /** How dim it settles to once the reading starts. */
    floor: number;
    /** Whether clicks throw a shockwave and bursts fire on their own. */
    bursts: boolean;
    /** How hard the cursor bites. */
    bite: number;
    /**
     * Whether the document itself re-forms the field.
     *
     * The landing page has a pinned track to scrub against. A reading page has
     * no such thing, so its own scroll is the scrubber: the same five
     * formations, spread across the whole page instead of across four screens
     * of a film.
     */
    scrub: boolean;
    dpr: [number, number];
  }
> = {
  full: { count: COUNT, gain: 1, floor: 0.34, bursts: true, bite: 1, scrub: false, dpr: [1, 1.6] },
  ambient: {
    count: 16_000,
    gain: 0.82,
    /* High enough that the formations are legible shapes rather than a hint of
       one. The field is cyan points on black and the copy over it is near
       white, so the two never come close to competing — the thing that had to
       be restrained was the bursts, not the brightness. */
    floor: 0.46,
    bursts: false,
    bite: 0.85,
    scrub: true,
    dpr: [1, 1.5],
  },
  quiet: {
    count: 14_000,
    gain: 0.78,
    floor: 0.36,
    bursts: false,
    bite: 0.8,
    /* The working pages hold the cloud, and that — not the brightness — is the
       whole of what makes them quiet. The first cut of this dimmed them almost
       to nothing on the theory that the field would compete with the circuit
       deck, which was wrong twice over: the deck sits on an opaque panel the
       field cannot reach through, and these pages are mostly *not* deck. The
       header, the margins and the space around the arena are ordinary page,
       and dimming those just made the lab look switched off.

       What genuinely cannot happen here is a shape assembling itself behind a
       circuit a student is building, or a burst going off mid-measurement. So
       the cloud stays a cloud and the events stay away. */
    scrub: false,
    dpr: [1, 1.4],
  },
};

type Presence = (typeof PRESENCE)[FieldIntensity];

/**
 * Drop a burst image here and it takes over the look.
 *
 * Path is served from `public/`, so `public/burst-sphere.png` becomes this.
 * If the file is absent the loader fails quietly and the procedural burst
 * carries on as before — the page never depends on the asset existing.
 */
const BURST_ART = "/burst-sphere.png";

/**
 * Where the two live bursts are and how old they are.
 *
 * Module-level because the points and the sprite are separate components in
 * separate frame callbacks and both need the same numbers; passing them
 * through React would re-render the canvas every frame.
 */
const bursts = {
  click: { origin: new THREE.Vector3(), age: 99, span: 5.0 },
  echo: { origin: new THREE.Vector3(), age: 99, span: 3.0 },
};

/**
 * How far the formed shapes sit above centre.
 *
 * The caption lives across the bottom of the film, so the shapes are lifted
 * out of it. The cloud is not lifted — it is supposed to be everywhere.
 */
const LIFT = 2.4;

/* ------------------------------------------------------------------ */
/* Formations                                                          */
/* ------------------------------------------------------------------ */

/** Deterministic pseudo-random, so the field is identical every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 4_294_967_296;
  };
}

/** Formless: a wide slab of drifting points, densest at the centre. */
function cloud(count: number) {
  const out = new Float32Array(count * 3);
  const rand = rng(7);
  for (let i = 0; i < count; i += 1) {
    // Two samples averaged gives a soft centre-weighted spread without
    // the cost of a real gaussian.
    out[i * 3] = ((rand() + rand()) - 1) * 19;
    out[i * 3 + 1] = ((rand() + rand()) - 1) * 11;
    out[i * 3 + 2] = ((rand() + rand()) - 1) * 7 - 2;
  }
  return out;
}

/**
 * One defined state: a shell, the way a Bloch sphere is drawn.
 *
 * Given real thickness rather than being a true surface. Sixteen thousand
 * points on a mathematically thin shell is a density no amount of alpha
 * tuning saves — they land on top of each other and additive blending turns
 * the whole thing into a flat white disc.
 */
function sphere(count: number, radius: number) {
  const out = new Float32Array(count * 3);
  const rand = rng(19);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const shell = radius * (0.7 + rand() * 0.3);
    out[i * 3] = Math.cos(theta) * r * shell;
    out[i * 3 + 1] = y * shell + LIFT;
    out[i * 3 + 2] = Math.sin(theta) * r * shell;
  }
  return out;
}

/**
 * Superposition: the one sphere separated into two.
 *
 * Points alternate between an upper lobe and a lower one, so the same register
 * is sitting in |0> and |1> at the same time rather than somewhere between
 * them. Splitting an existing sphere is the honest picture — no point is
 * created or destroyed on the way here, they only stop agreeing.
 */
function split(count: number, radius: number, gap: number) {
  const out = new Float32Array(count * 3);
  const rand = rng(23);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const lobe = i % 2 === 0 ? 1 : -1;
    const step = Math.floor(i / 2);
    const total = Math.max(1, Math.floor(count / 2));
    const y = 1 - (step / total) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * step;
    const shell = radius * (0.62 + rand() * 0.38);
    out[i * 3] = Math.cos(theta) * r * shell;
    out[i * 3 + 1] = y * shell + LIFT + lobe * gap;
    out[i * 3 + 2] = Math.sin(theta) * r * shell;
  }
  return out;
}

/**
 * A circuit: three wires and the gates sitting on them.
 *
 * Seven in ten points make the wires, the rest pack into gate outlines, so the
 * gates read as solid boxes against a thin line the way they do on paper.
 */
function circuit(count: number) {
  const out = new Float32Array(count * 3);
  const rand = rng(31);
  const wires = [3.4, 0, -3.4];
  const gates: Array<[x: number, y: number]> = [
    [-7.5, 3.4],
    [-1.5, 3.4],
    [-1.5, 0],
    [3.5, 0],
    [3.5, -3.4],
    [8.5, 3.4],
    [8.5, 0],
    [8.5, -3.4],
  ];
  const onWire = Math.floor(count * 0.7);

  for (let i = 0; i < count; i += 1) {
    if (i < onWire) {
      const y = wires[i % wires.length];
      out[i * 3] = (rand() * 2 - 1) * 12;
      out[i * 3 + 1] = y + LIFT + (rand() * 2 - 1) * 0.06;
      out[i * 3 + 2] = (rand() * 2 - 1) * 0.25;
    } else {
      const [gx, gy] = gates[(i - onWire) % gates.length];
      // Perimeter of a square: pick an edge, then a point along it.
      const half = 1.15;
      const edge = Math.floor(rand() * 4);
      const t = (rand() * 2 - 1) * half;
      const ox = edge === 0 ? t : edge === 1 ? half : edge === 2 ? t : -half;
      const oy = edge === 0 ? half : edge === 1 ? t : edge === 2 ? -half : t;
      out[i * 3] = gx + ox;
      out[i * 3 + 1] = gy + LIFT + oy;
      out[i * 3 + 2] = (rand() * 2 - 1) * 0.3;
    }
  }
  return out;
}

/**
 * A measurement: four bars, the outcome of the circuit above.
 *
 * The heights are a Bell pair's real distribution — half the shots in |00⟩,
 * half in |11⟩, nothing in between — so the payoff of the sequence is a true
 * result and not a shape that happened to look good.
 */
function histogram(count: number) {
  const out = new Float32Array(count * 3);
  const rand = rng(53);
  const bars: Array<[x: number, height: number, weight: number]> = [
    [-8.4, 6.8, 0.47],
    [-2.8, 0.22, 0.03],
    [2.8, 0.22, 0.03],
    [8.4, 6.8, 0.47],
  ];
  const floor = -2.4;

  let cursor = 0;
  for (const [x, height, weight] of bars) {
    const take = Math.round(count * weight);
    for (let i = 0; i < take && cursor < count; i += 1, cursor += 1) {
      out[cursor * 3] = x + (rand() * 2 - 1) * 1.9;
      out[cursor * 3 + 1] = floor + rand() * height;
      out[cursor * 3 + 2] = (rand() * 2 - 1) * 1.9;
    }
  }
  // Anything left over from rounding joins the tallest bar.
  for (; cursor < count; cursor += 1) {
    out[cursor * 3] = -8.4 + (rand() * 2 - 1) * 1.9;
    out[cursor * 3 + 1] = floor + rand() * 6.8;
    out[cursor * 3 + 2] = (rand() * 2 - 1) * 1.9;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */

const vertexShader = /* glsl */ `
  uniform float uPhase;     // 0 cloud, 1 sphere, 2 split, 3 circuit, 4 histogram
  uniform vec3  uMouse;     // cursor, projected onto the z = 0 plane
  uniform float uPull;      // how hard the cursor is currently biting
  uniform float uSpeed;     // pointer speed, 0..1 — lengthens the wake
  uniform float uTime;
  uniform float uWave;      // seconds since the last click
  uniform vec3  uClick;     // where the click landed, not where the cursor is now
  uniform vec3  uEcho;      // where the field last decohered, or was cued to
  uniform float uEchoAge;   // seconds since that happened
  uniform float uEchoSpan;  // its radius, so a cued burst can be larger
  uniform float uReduced;
  uniform float uArt;      // 1 when a burst image is doing the lighting

  attribute vec3  aCloud;
  attribute vec3  aSphere;
  attribute vec3  aSplit;
  attribute vec3  aCircuit;
  attribute vec3  aHist;
  attribute float aSeed;
  attribute float aScale;
  attribute float aPair;

  varying float vGlow;
  varying float vFade;
  varying float vPacked;
  varying float vHeat;
  varying float vBurst;

  /**
   * A burst.
   *
   * Built to match one reference frame rather than invented: a contained
   * sphere, not an expanding ring. It opens fast to a fixed radius and then
   * holds there while it fades, because the thing in the reference is a
   * bubble sitting still, and anything that keeps growing reads as a shockwave
   * instead.
   *
   * Three parts, and they are lit separately because they are different
   * brightnesses in the reference:
   *   the rim   - points pulled onto the shell radius, which is what makes the
   *               edge a crisp continuous line instead of a soft falloff
   *   filaments - radial streaks through the interior, broken up by angle and
   *               pushed sideways by turbulence so they read as wisps
   *   the core  - a small dense centre left undisturbed so there is something
   *               to burn white
   */
  vec2 burst(vec2 pos, vec2 origin, float age, float span, float push,
             float seed, out float rim, out float fila, out float heat) {
    vec2  away = pos - origin;
    float d    = length(away) + 1e-4;
    vec2  dir  = away / d;
    vec2  perp = vec2(-dir.y, dir.x);
    float ang  = atan(away.y, away.x);

    // Opens quickly, then sits. Never runs off to infinity.
    float shell = span * (1.0 - exp(-age * 4.2));
    float life  = exp(-age * 0.68);

    // Angular structure. The power leaves gaps between rays; without it the
    // interior averages into a glow and the wisps disappear.
    float fil = 0.42
              + 0.30 * sin(ang * 9.0  + seed * 6.283)
              + 0.22 * sin(ang * 21.0 - seed * 12.4 + age * 1.1)
              + 0.16 * sin(ang * 43.0 + seed * 3.7);
    fil = pow(max(0.0, fil), 2.2);

    float inside  = smoothstep(shell, 0.0, d);
    /* Two windows on the same shell. The wide one decides which points get
       dragged onto it, the narrow one decides which get lit. Splitting them is
       what makes the rim a line: gathering from a broad band concentrates real
       density at one radius, and only the points that actually arrive there
       are bright. Lighting alone, without the gathering, leaves the edge as
       thin as the field happened to be. */
    float capture = exp(-pow(d - shell, 2.0) * 0.22);
    float nearRim = exp(-pow(d - shell, 2.0) * 2.4);

    // Curl-ish turbulence: two beating sines across radius and angle, applied
    // across the ray rather than along it, which is what bends straight spokes
    // into the wisps in the reference.
    float wisp = sin(ang * 13.0 + d * 2.3 + seed * 7.0 - age * 1.2)
               * sin(ang * 29.0 - d * 3.9 + seed * 3.3);

    // Hold the innermost points still so the core survives to be lit.
    float hold = smoothstep(0.0, 0.55, d);

    rim  = nearRim * (0.55 + 0.75 * fil) * life;
    fila = inside * fil * (0.6 + 0.5 * wisp) * life;
    heat = exp(-d * d * 7.0) * exp(-age * 0.9);

    vec2 toRim  = dir * (shell - d) * capture * 0.6;
    vec2 streak = dir * inside * fil * push * hold;
    vec2 turb   = perp * wisp * inside * fil * 1.1;

    return (toRim + streak + turb) * life;
  }

  void main() {
    // The morph. Sequential mixes, so the field is only ever between two
    // shapes at a time and never smears through a third.
    vec3 p = aCloud;
    p = mix(p, aSphere,  clamp(uPhase,        0.0, 1.0));
    p = mix(p, aSplit,   clamp(uPhase - 1.0,  0.0, 1.0));
    p = mix(p, aCircuit, clamp(uPhase - 2.0,  0.0, 1.0));
    p = mix(p, aHist,    clamp(uPhase - 3.0,  0.0, 1.0));

    // Ambient drift. Strongest while the field is formless and almost gone
    // once it has snapped into a shape that is supposed to be exact.
    float loose = 1.0 - clamp(uPhase, 0.0, 1.0) * 0.82;
    float t = uTime * 0.4 + aSeed * 84.0;
    p += vec3(sin(t), cos(t * 0.87), sin(t * 1.31)) * 0.5 * loose * (1.0 - uReduced * 0.85);

    /* The cursor.
       Driven mostly by how fast the pointer is moving, not by the fact that
       it exists. A cursor parked in the middle of the screen leaves a small
       dimple; a cursor thrown across it opens a wake three times as wide and
       drags a swirl behind it. Presence alone used to carve a permanent
       crater, and a crater with a rim of piled-up points additively blends
       itself straight to white. */
    vec2  toMouse = uMouse.xy - p.xy;
    float dist    = length(toMouse);
    float reach   = 3.4 + uSpeed * 1.3;
    float force   = uPull * (0.28 + uSpeed * 0.72);
    float bite    = force * exp(-(dist * dist) / (reach * reach));
    vec2  dir     = normalize(toMouse + vec2(1e-5));
    vec2  tangent = vec2(-dir.y, dir.x);

    /* Swirl belongs to slow movement, not fast.
       The tangential term used to grow with speed while the radial one stayed
       fixed, so a quick flick ended up spinning points nearly three times
       harder than it pushed them — a tornado. Inverted: a fast swipe shoulders
       the field aside, and the curl is what you get when you move gently
       through it. The wake still widens with speed, via reach and bite above. */
    float curl = 1.0 - uSpeed * 0.55;
    p.xy -= dir * bite * (1.7 + uSpeed * 1.0);
    p.xy += tangent * bite * 2.1 * curl;
    p.z  += bite * 1.3;

    // Click: a burst, thrown from where the click actually landed.
    float clickRim, clickFil, clickHeat;
    p.xy += burst(p.xy, uClick.xy, uWave, 5.0, 1.5, aSeed, clickRim, clickFil, clickHeat);
    p.z  += clickRim * 0.9;

    /* Spontaneous decoherence.
       Every few seconds somewhere in the field loses coherence on its own and
       the disturbance travels out from it. Same maths as the click ring, a
       third of the force, and nobody has to touch anything for it to happen —
       which is the point. A quantum state does not sit still waiting to be
       observed, and neither should the page. */
    float echoRim, echoFil, echoHeat;
    p.xy += burst(p.xy, uEcho.xy, uEchoAge, uEchoSpan, uEchoSpan * 0.3, aSeed + 0.37,
                  echoRim, echoFil, echoHeat);
    p.z  += echoRim * 0.6;

    /* Entangled pairs.
       Points are paired off two at a time in the buffer, and the buffer order
       has nothing to do with where they ended up, so the two members of a pair
       are always far apart on screen. Each pair brightens on its own schedule,
       and both members do it on the same frame — so what you see is two
       unrelated corners of the field flaring together. That is the one thing
       about entanglement worth showing rather than writing down. */
    float pairClock = fract(aPair * 61.0 + uTime * 0.055);
    float twin = exp(-pow(pairClock - 0.5, 2.0) * 2500.0) * (1.0 - uReduced);

    /* With artwork loaded the points still get shoved — the field has to
       react, or the sprite reads as a sticker laid over a photograph — but the
       glow is handed to the image so the two are not lit twice. */
    float burstLight = (clickRim * 0.95 + clickFil * 0.55 + echoRim * 0.62 + echoFil * 0.36)
                     * mix(1.0, 0.22, uArt);
    vBurst = clamp(burstLight * 1.3, 0.0, 1.0);
    /* Brightness is decoupled from displacement, and shrinks as you speed up.

       The wake is a hole being opened in the field, not a lamp being switched
       on. Both were previously driven by the same bite value, which also grows
       with pointer speed — so a fast sweep lit several thousand points at once
       across a six-unit radius and additive blending turned the lot into a
       single blue-white mass over the headline. Displacement below is
       untouched; only the light it throws is rationed, hardest exactly when
       the cursor is moving fastest. */
    float lit = bite * (0.42 - uSpeed * 0.22);
    vGlow  = clamp(lit + burstLight + twin * 0.55, 0.0, 1.0);
    vHeat  = clamp(clickHeat + echoHeat * 0.8, 0.0, 1.0);

    /* How tightly the field is currently packed. The cloud is spread over a
       volume forty units wide; every other formation squeezes the same
       sixteen thousand points into a fraction of that, and under additive
       blending a fraction of the volume is a multiple of the brightness. The
       fragment stage spends this to keep the four shapes reading at roughly
       one exposure. */
    vPacked = clamp(uPhase, 0.0, 1.0);

    vec4 view = modelViewMatrix * vec4(p, 1.0);
    vFade = clamp((view.z + 26.0) / 20.0, 0.0, 1.0);

    gl_Position = projectionMatrix * view;
    // Displacement is allowed to be violent; brightness is not. The wake is
    // read as a hole and a swirl, not as a floodlight, because there is a
    // headline behind this and it has to stay a headline.
    gl_PointSize = (1.3 + vGlow * 2.6 + vHeat * 3.2) * aScale * mix(1.0, 0.78, vPacked) * (330.0 / max(0.001, -view.z));
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3  uCalm;
  uniform vec3  uHot;
  uniform vec3  uCore;
  uniform float uOpacity;

  uniform vec3  uBurst;

  varying float vGlow;
  varying float vFade;
  varying float vPacked;
  varying float vHeat;
  varying float vBurst;

  void main() {
    // A round sprite with a soft edge, drawn rather than sampled — a texture
    // for this would be twenty thousand lookups a frame for one circle.
    vec2 offset = gl_PointCoord - 0.5;
    float falloff = 1.0 - smoothstep(0.08, 0.5, length(offset));
    if (falloff <= 0.001) discard;

    /* Ambient field first, then the burst's own blue over it, then the core.
       The burst is coloured separately from the field on purpose: the field is
       the site's cyan, and the reference's sphere is a deeper electric blue.
       Sharing one ramp would have meant picking one or losing the other. */
    vec3 tint = mix(uCalm, uHot, vGlow);
    tint = mix(tint, uBurst, vBurst);
    // Orange around a white centre, the way the reference core reads.
    vec3 hot = mix(uCore, vec3(1.0, 0.97, 0.92), smoothstep(0.5, 0.95, vHeat));
    tint = mix(tint, hot, smoothstep(0.0, 0.45, vHeat));
    float alpha = falloff * (0.21 + vGlow * 0.24 + vHeat * 0.45)
                * (0.3 + vFade * 0.7) * mix(1.0, 0.46, vPacked) * uOpacity;
    gl_FragColor = vec4(tint, alpha);
  }
`;

/* ------------------------------------------------------------------ */
/* The points                                                          */
/* ------------------------------------------------------------------ */

function Particles({
  reducedMotion,
  presence,
}: {
  reducedMotion: boolean;
  presence: Presence;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const points = useRef<THREE.Points>(null);
  const viewport = useThree((state) => state.viewport);

  const mouse = useRef(new THREE.Vector3());
  const click = useRef(new THREE.Vector3());
  const lastClick = useRef(-999);
  const echo = useRef(new THREE.Vector3(0, 0, 0));
  const echoAge = useRef(0);
  const echoGap = useRef(1.6);
  const echoSpan = useRef(3.0);
  const pull = useRef(0);
  const phase = useRef(0);
  const opacity = useRef(0);
  const pageSpan = useRef(1);
  const spanTick = useRef(0);

  const count = presence.count;
  const formations = useMemo(
    () => ({
      cloud: cloud(count),
      sphere: sphere(count, 4.6),
      split: split(count, 2.9, 3.1),
      circuit: circuit(count),
      hist: histogram(count),
      seeds: Float32Array.from({ length: count }, (_, i) => i / count),
      pairs: Float32Array.from({ length: count }, (_, i) => Math.floor(i / 2) / (count / 2)),
      scales: (() => {
        const rand = rng(97);
        // Cubed, so most points are small and a few are properly large.
        return Float32Array.from({ length: count }, () => 0.45 + Math.pow(rand(), 3) * 2.4);
      })(),
    }),
    [count],
  );

  const uniforms = useMemo(
    () => ({
      uPhase: { value: 0 },
      uMouse: { value: new THREE.Vector3() },
      uPull: { value: 0 },
      uSpeed: { value: 0 },
      uTime: { value: 0 },
      uWave: { value: 99 },
      uClick: { value: new THREE.Vector3() },
      uEcho: { value: new THREE.Vector3() },
      uEchoAge: { value: 99 },
      uEchoSpan: { value: 3.0 },
      uReduced: { value: reducedMotion ? 1 : 0 },
      uArt: { value: 0 },
      uOpacity: { value: 0 },
      uCalm: { value: new THREE.Color("#0b6a86") },
      uHot: { value: new THREE.Color("#4ed6ff") },
      uCore: { value: new THREE.Color("#ff8c2b") },
      uBurst: { value: new THREE.Color("#3d8bff") },
    }),
    [reducedMotion],
  );

  useFrame((state, delta) => {
    const shader = material.current;
    if (!shader) return;
    // The boot counter waits on a frame that actually reached the screen, not
    // on the component mounting — shader compilation happens in between.
    markBooted("field");
    const step = Math.min(delta, 1 / 30);

    // Cursor, projected onto the plane the field sits on.
    const targetX = pointerState.x * (viewport.width / 2) * 1.1;
    const targetY = pointerState.y * (viewport.height / 2) * 1.1;
    const chase = Math.min(1, step * 9);
    mouse.current.x += (targetX - mouse.current.x) * chase;
    mouse.current.y += (targetY - mouse.current.y) * chase;

    const wantPull = pointerState.active ? (reducedMotion ? 0.35 : presence.bite) : 0;
    pull.current += (wantPull - pull.current) * Math.min(1, step * 4);

    /* The film scrubs the formation. Everywhere else the field relaxes back
       to the cloud — a histogram hanging behind the pricing section is a
       shape with nothing to say there, and the return reads as the state
       going back into superposition once nobody is measuring it. */
    const onFilm = trackOnScreen(FILM_TRACK);
    let wantPhase = 0;
    if (onFilm) {
      wantPhase = dwell(trackProgress(FILM_TRACK), FILM_STOPS);
    } else if (presence.scrub) {
      /* The page is the scrubber. `dwell` is doing the same job it does on the
         film — holding each formation for most of its segment and moving
         quickly between them — so a reader gets a still shape to look at rather
         than a permanent smear halfway between two of them.

         scrollHeight forces a layout, so it is sampled a few times a second
         instead of sixty. scrollY does not, and is read every frame. */
      spanTick.current -= 1;
      if (spanTick.current <= 0) {
        spanTick.current = 20;
        pageSpan.current = Math.max(
          1,
          document.documentElement.scrollHeight - window.innerHeight,
        );
      }
      wantPhase = dwell(Math.min(1, window.scrollY / pageSpan.current), FILM_STOPS);
    }
    /* Catch-up scales with how far behind the field is. Scrolling normally
       keeps the gap tiny and gets the slow, smooth follow that stops the
       shapes juddering; throwing the scrollbar, hitting an anchor or landing
       mid-page on a reload opens a large gap and the field closes it in a few
       frames instead of lazily drifting there over a second. */
    const gap = Math.abs(wantPhase - phase.current);
    phase.current += (wantPhase - phase.current) * Math.min(1, step * (6 + gap * 16));

    /* Presence. Full strength over the hero and through the film, damped to a
       quiet haze behind the reading sections — a field at full brightness
       under body copy is a field competing with the words. */
    const scrolled = window.scrollY;
    const fold = Math.max(0, 1 - scrolled / (window.innerHeight * 1.1));
    const wantOpacity = Math.max(presence.floor, Math.max(fold, onFilm) * presence.gain);
    // Snap on the first frame. Ramping up from nothing means the field is
    // invisible for the half second a visitor spends forming their first
    // impression of the page, which is the half second it exists for.
    opacity.current =
      opacity.current === 0
        ? wantOpacity
        : opacity.current + (wantOpacity - opacity.current) * Math.min(1, step * 3);

    /* A cued burst wins over the spontaneous schedule: the two moments that
       ask for one are the page arriving and the circuit being measured, and
       neither should have to wait its turn behind a random event. */
    /* Real elapsed time, not the physics step. `step` is clamped to 1/30 so a
       long frame cannot fling the displacement maths across the screen — but
       spending that clamped value on a timer means the burst interval stretches
       on any machine below 30fps, and a slow laptop would see them arrive three
       times further apart than intended. The wider clamp here only guards
       against a tab coming back from the background. */
    echoAge.current += Math.min(delta, 0.25);
    const cue = takeBurst();
    if (presence.bursts && cue) {
      echoAge.current = 0;
      echoGap.current = 3.2 + Math.random() * 2.6;
      echoSpan.current = 5.0 * cue.size;
      echo.current.set(
        cue.x * viewport.width * 0.5,
        cue.y * viewport.height * 0.5,
        0,
      );
    } else if (presence.bursts && !reducedMotion && echoAge.current > echoGap.current) {
      echoAge.current = 0;
      /* Paced against how present the field is rather than on one fixed
         interval. A burst decays to nothing in about four seconds, so a flat
         five-to-ten second gap left the hero empty for most of it — but the
         same rate over the reading sections would be a light flashing behind
         body copy. Lively where the field is the subject, calm where it is
         the background. */
      echoGap.current = (2.4 + Math.random() * 2.6) / Math.max(0.5, opacity.current);
      echoSpan.current = 3.0;
      echo.current.set(
        (Math.random() * 2 - 1) * viewport.width * 0.45,
        (Math.random() * 2 - 1) * viewport.height * 0.45,
        0,
      );
    }

    // Snapshot the origin on the click itself; the old ring was measured from
    // the live cursor, so it chased the pointer instead of staying where the
    // click happened.
    if (pointerState.clickAt !== lastClick.current) {
      lastClick.current = pointerState.clickAt;
      click.current.copy(mouse.current);
    }

    bursts.click.origin.copy(click.current);
    bursts.click.age = secondsSinceClick();
    bursts.echo.origin.copy(echo.current);
    bursts.echo.age = echoAge.current;
    bursts.echo.span = echoSpan.current;

    shader.uniforms.uArt.value = artLoaded() ? 1 : 0;
    shader.uniforms.uClick.value.copy(click.current);
    shader.uniforms.uEchoSpan.value = echoSpan.current;
    shader.uniforms.uEcho.value.copy(echo.current);
    /* Quiet pages get no ripples at all: a light flashing behind a circuit a
       student is reading is the one thing an ambient layer must never do. */
    shader.uniforms.uEchoAge.value = presence.bursts ? echoAge.current : 99;
    shader.uniforms.uMouse.value.copy(mouse.current);
    shader.uniforms.uPull.value = pull.current;
    const speed = pointerSpeed();
    shader.uniforms.uSpeed.value = speed;
    shader.uniforms.uTime.value = state.clock.elapsedTime;
    shader.uniforms.uWave.value = presence.bursts ? secondsSinceClick() : 99;
    shader.uniforms.uPhase.value = phase.current;
    shader.uniforms.uOpacity.value = opacity.current;

    /* Parallax lean — weak, slow, and it lets go while you are moving.

       This was the tornado, and the local swirl was never the cause. The whole
       cloud was being yawed by cursor *position* at ±0.32 rad and chased with
       a ~0.45s time constant, so a fast traverse whipped sixteen thousand
       points through thirty-seven degrees of rotation. At the edges of a field
       nineteen units wide that is an enormous arc, and with the depth spread
       behind it the parallax reads as a rotating column.

       Three changes, all pulling the same way: a third of the travel, a third
       of the chase rate, and the chase releases as pointer speed rises — so a
       quick flick leaves the field where it is and it drifts back once your
       hand settles. The near-side/far-side cue survives; the spin does not. */
    const node = points.current;
    if (node && !reducedMotion) {
      const settle = 1 - speed * 0.8;
      const lean = Math.min(1, step * 0.8) * settle;
      const drift = Math.sin(state.clock.elapsedTime * 0.22) * 0.1;
      node.rotation.y += (pointerState.x * 0.1 + drift - node.rotation.y) * lean;
      node.rotation.x += (-pointerState.y * 0.06 - node.rotation.x) * lean;
    }
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[formations.cloud, 3]} />
        <bufferAttribute attach="attributes-aCloud" args={[formations.cloud, 3]} />
        <bufferAttribute attach="attributes-aSphere" args={[formations.sphere, 3]} />
        <bufferAttribute attach="attributes-aSplit" args={[formations.split, 3]} />
        <bufferAttribute attach="attributes-aCircuit" args={[formations.circuit, 3]} />
        <bufferAttribute attach="attributes-aHist" args={[formations.hist, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[formations.seeds, 1]} />
        <bufferAttribute attach="attributes-aScale" args={[formations.scales, 1]} />
        <bufferAttribute attach="attributes-aPair" args={[formations.pairs, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
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

/* ------------------------------------------------------------------ */
/* Burst artwork                                                       */
/* ------------------------------------------------------------------ */

let loadedArt: THREE.Texture | null = null;
let pendingArt: Promise<THREE.Texture | null> | null = null;

function artLoaded() {
  return loadedArt !== null;
}

/**
 * One request for the asset, ever.
 *
 * Guarding on the loaded texture alone is not enough: React invokes effects
 * twice in development, and the second pass runs long before the first load
 * resolves, so both see null and both fetch half a megabyte. The in-flight
 * promise is the thing that has to be shared.
 */
function loadArt(url: string) {
  if (loadedArt) return Promise.resolve(loadedArt);
  if (!pendingArt) {
    pendingArt = new Promise((resolve) => {
      new THREE.TextureLoader().load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          loadedArt = texture;
          resolve(texture);
        },
        undefined,
        // No asset. The procedural burst is the fallback, and it is fine.
        () => resolve(null),
      );
    });
  }
  return pendingArt;
}

/**
 * Loads the burst image if it is there, and shrugs if it is not.
 *
 * Deliberately not drei's useTexture, which suspends: a missing file would
 * hang the whole canvas inside its Suspense boundary rather than degrading to
 * the procedural burst.
 */
function useOptionalTexture(url: string) {
  const [texture, setTexture] = useState<THREE.Texture | null>(loadedArt);

  useEffect(() => {
    if (loadedArt) return;
    let alive = true;
    loadArt(url).then((loaded) => {
      if (alive && loaded) setTexture(loaded);
    });
    return () => {
      alive = false;
    };
  }, [url]);

  return texture;
}

function BurstPlane({
  which,
  texture,
  reducedMotion,
}: {
  which: "click" | "echo";
  texture: THREE.Texture;
  reducedMotion: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const node = mesh.current;
    if (!node) return;
    const state = bursts[which];
    const age = state.age;

    // Same timeline the shell uses: opens fast, holds, fades.
    const openness = 1 - Math.exp(-age * 4.2);
    const life = Math.exp(-age * 0.68);

    const material = node.material as THREE.MeshBasicMaterial;
    material.opacity = Math.max(0, life);
    node.visible = life > 0.01;
    if (!node.visible) return;

    node.position.copy(state.origin);
    const size = state.span * 2.4 * (0.4 + 0.6 * openness);
    node.scale.setScalar(size);
    if (!reducedMotion) node.rotation.z = age * 0.12;
  });

  return (
    <mesh ref={mesh} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

function BurstArt({ reducedMotion }: { reducedMotion: boolean }) {
  const texture = useOptionalTexture(BURST_ART);
  if (!texture) return null;
  return (
    <>
      <BurstPlane which="click" texture={texture} reducedMotion={reducedMotion} />
      <BurstPlane which="echo" texture={texture} reducedMotion={reducedMotion} />
    </>
  );
}

/* ------------------------------------------------------------------ */

export default function QuantumField({
  intensity = "full",
}: {
  intensity?: FieldIntensity;
}) {
  useGlobalPointer();
  const reduced = useReducedMotion();
  const [active, setActive] = useState(true);
  const presence = PRESENCE[intensity];

  useEffect(() => {
    const onVisibility = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-20" aria-hidden>
      <Canvas
        dpr={presence.dpr}
        frameloop={active ? "always" : "never"}
        camera={{ position: [0, 0, 20], fov: 46 }}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ pointerEvents: "none" }}
        fallback={null}
      >
        <Particles reducedMotion={reduced} presence={presence} />
        {presence.bursts && <BurstArt reducedMotion={reduced} />}
      </Canvas>
    </div>
  );
}
