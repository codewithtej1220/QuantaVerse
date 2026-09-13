"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { mascot, mascotGaze, type MascotPose } from "@/lib/mascot";
import { pointerState } from "@/lib/pointer";

/**
 * The cat in the box.
 *
 * Vector art, built as geometry rather than drawn into a texture: flat circles,
 * triangles and sectors on `meshBasicMaterial`, which takes no light at all. An
 * unlit material is the whole trick — the moment a mascot picks up a specular
 * highlight it stops looking like an illustration and starts looking like a
 * cheap 3D model of an illustration.
 *
 * The depth is layered rather than modelled. Everything is a flat plane parked
 * at its own Z, so the box front occludes the cat's middle, the ears sit behind
 * the head, and a few degrees of tilt reveal the stack. That is the 2.5D read:
 * it holds its silhouette like a sticker but parallaxes like an object.
 *
 * Nothing in here re-renders. Pose, pointer and the burst counter are all read
 * from module records inside the frame loop.
 */

/* ---- palette ----------------------------------------------------------
 *
 * The first cut of this was a bright cornflower box with saturated orange
 * eyes, straight off the reference. It was right about the character and
 * wrong about the room: this site is black with exactly one accent, and a
 * primary-blue box on it read as a sticker peeled off a different app.
 *
 * So the crate is built from the same anodised teal the gate blocks on the
 * circuit board are milled from, and the accent is the site's own cyan. The
 * amber survives only in the pupils and the ear insides, where it is warm
 * enough to keep the cat from going monochrome and small enough not to
 * fight the page.
 */
const CRATE = "#123840";
const CRATE_DARK = "#0b242a";
const CRATE_LIP = "#2fe4ff";
const BLACK = "#0c0d11";
const CYAN = "#2fe4ff";
const AMBER = "#ff8c2b";
const CREAM = "#e8f9ff";
/**
 * The stroke.
 *
 * A black cat on a black page is a pair of floating eyes — the silhouette does
 * not exist until something separates it from the ground. Flat illustration
 * solves this the same way every time: draw the shape once, larger, in a
 * stroke colour, and put it behind the fill. Cool rather than neutral grey, so
 * it reads as light spilling off the blue box it is sitting in.
 */
const RIM = "#333a49";

/** A triangle, for ears and the radiation blades that want hard corners. */
function triangle(a: [number, number], b: [number, number], c: [number, number]) {
  const shape = new THREE.Shape();
  shape.moveTo(a[0], a[1]);
  shape.lineTo(b[0], b[1]);
  shape.lineTo(c[0], c[1]);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/** A rounded rectangle, which is most of what a flat illustration is made of. */
function roundedRect(w: number, h: number, r: number) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(shape);
}

/** Flat, unlit, and out of the tone mapper so the colour is the colour. */
function Flat({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return (
    <meshBasicMaterial
      color={color}
      toneMapped={false}
      transparent={opacity < 1}
      opacity={opacity}
      side={THREE.DoubleSide}
    />
  );
}

/**
 * The trefoil, drawn the way the actual standard draws it: a central disc and
 * three sixty-degree blades at a hundred and twenty degrees apart, with a gap
 * between the disc and the blades.
 */
function RadiationMark({ z }: { z: number }) {
  const blades = useMemo(() => [0, 1, 2].map((i) => (i * Math.PI * 2) / 3 + Math.PI / 2), []);
  return (
    <group position={[0, 0, z]}>
      <mesh>
        <circleGeometry args={[0.3, 32]} />
        <Flat color={CYAN} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <circleGeometry args={[0.075, 24]} />
        <Flat color={BLACK} />
      </mesh>
      {blades.map((angle) => (
        <mesh key={angle} position={[0, 0, 0.001]}>
          <ringGeometry args={[0.115, 0.3, 24, 1, angle - Math.PI / 6, Math.PI / 3]} />
          <Flat color={BLACK} />
        </mesh>
      ))}
    </group>
  );
}

/** One eye: a big orange disc, a pupil that chases the cursor, one highlight. */
function Eye({ x, look }: { x: number; look: React.RefObject<THREE.Group | null> }) {
  return (
    <group position={[x, 0.34, 0.06]}>
      <mesh>
        <circleGeometry args={[0.235, 32]} />
        <Flat color={CYAN} />
      </mesh>
      <mesh position={[0, 0, 0.0005]}>
        <circleGeometry args={[0.165, 32]} />
        <Flat color={AMBER} />
      </mesh>
      <group ref={look}>
        <mesh position={[0, 0, 0.001]}>
          <circleGeometry args={[0.105, 24]} />
          <Flat color={BLACK} />
        </mesh>
        <mesh position={[0.05, 0.055, 0.002]}>
          <circleGeometry args={[0.036, 16]} />
          <Flat color={CREAM} />
        </mesh>
      </group>
    </group>
  );
}

/** A shape and its stroke: the same geometry twice, the back one grown. */
function Stroked({
  geometry,
  color,
  position = [0, 0, 0],
  weight = 1.07,
}: {
  geometry: THREE.BufferGeometry;
  color: string;
  position?: [number, number, number];
  weight?: number;
}) {
  return (
    <group position={position}>
      <mesh geometry={geometry} scale={weight} position={[0, 0, -0.01]}>
        <Flat color={RIM} />
      </mesh>
      <mesh geometry={geometry}>
        <Flat color={color} />
      </mesh>
    </group>
  );
}

/** Where the corner the cat is pinned to lands in pointer space, -1 to 1. */
const CORNER_X = 0.86;
const CORNER_Y = -0.78;

const EAR_L = triangle([-0.52, 0.42], [-0.24, 0.86], [-0.11, 0.4]);
const EAR_R = triangle([0.52, 0.42], [0.24, 0.86], [0.11, 0.4]);
const EAR_L_IN = triangle([-0.44, 0.45], [-0.27, 0.72], [-0.18, 0.44]);
const EAR_R_IN = triangle([0.44, 0.45], [0.27, 0.72], [0.18, 0.44]);

export function QuantumCat({
  reducedMotion = false,
  children,
}: {
  reducedMotion?: boolean;
  /** Rendered inside the moving root, so it travels with the cat. */
  children?: React.ReactNode;
}) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const boxGroup = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const lidL = useRef<THREE.Mesh>(null);
  const lidR = useRef<THREE.Mesh>(null);
  const pupilL = useRef<THREE.Group>(null);
  const pupilR = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);

  const blink = useRef({ next: 2.4, closing: 0 });
  const shake = useRef(0);

  const boxFront = useMemo(() => roundedRect(1.86, 1.18, 0.08), []);
  const boxSide = useMemo(() => roundedRect(0.42, 1.18, 0.06), []);
  const headShape = useMemo(() => roundedRect(1.16, 1.0, 0.42), []);
  const bodyShape = useMemo(() => roundedRect(1.24, 0.9, 0.3), []);

  useFrame((state, delta) => {
    const step = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const pose: MascotPose = mascot.pose;

    const node = root.current;
    if (!node) return;

    /* No flying any more. The cat owns a small canvas pinned to the corner, so
       it is simply centred in it — the anchor arithmetic that used to place it
       in a full-screen sheet was the source of the drift between the art and
       its own hit target. It still damps its scale, because appearing is worth
       a beat. */
    const wanted = mascot.visible ? 1 : 0.001;
    node.scale.setScalar(node.scale.x + (wanted - node.scale.x) * (1 - Math.exp(-step * 5)));

    /* ---- the poses ---- */
    const calm = reducedMotion ? 0 : 1;
    let bob = Math.sin(time * 1.5) * 0.06 * calm;
    let lean = Math.sin(time * 0.9) * 0.05 * calm;
    let rattle = 0;
    let squash = 1;

    if (pose === "thinking") {
      // The box rattles; the cat inside stays still, which is funnier and also
      // reads as "the machine is working" rather than "the cat is panicking".
      shake.current = Math.min(1, shake.current + step * 6);
      rattle = Math.sin(time * 42) * 0.05 * shake.current * calm;
      bob *= 0.3;
    } else {
      shake.current = Math.max(0, shake.current - step * 4);
    }

    if (pose === "resolving") {
      // Snap upright and hold: no float, a slight lift, leaning in to teach.
      bob = 0.12;
      lean = -0.08;
    }

    if (pose === "working") {
      // Straining: a fast squat, and the whole box shudders under the load.
      const strain = Math.sin(time * 5.2);
      squash = 1 - Math.abs(strain) * 0.09;
      bob = -Math.abs(strain) * 0.1;
      rattle = Math.sin(time * 30) * 0.02 * calm;
    }

    if (pose === "distressed") {
      // Slumped and slowly listing, eyes down. Sad, not broken.
      bob = -0.14 + Math.sin(time * 0.8) * 0.02 * calm;
      lean = 0.16 + Math.sin(time * 0.5) * 0.03 * calm;
      squash = 0.94;
    }

    if (pose === "flagging") {
      /* Waving: a quick rock side to side with a small lift, fast enough to
         catch peripheral vision and stopping short of the celebration hop so
         the two never read as the same thing. Being noticed is the entire job
         of this pose — it fires while somebody is looking at the board, not
         at the cat. */
      const wave = Math.sin(time * 7.5);
      lean = wave * 0.26 * calm;
      bob = 0.08 + Math.abs(wave) * 0.05 * calm;
      squash = 1.02;
    }

    if (pose === "celebrating") {
      const hop = Math.abs(Math.sin(time * 6.5));
      bob = hop * 0.36;
      squash = 1 + hop * 0.08;
      lean = Math.sin(time * 13) * 0.12;
    }

    node.rotation.z += (lean - node.rotation.z) * (1 - Math.exp(-step * 5));

    if (body.current) {
      body.current.position.y += (bob - body.current.position.y) * (1 - Math.exp(-step * 8));
      body.current.scale.y += (squash - body.current.scale.y) * (1 - Math.exp(-step * 8));
    }
    if (boxGroup.current) {
      boxGroup.current.rotation.z = rattle;
      boxGroup.current.position.x = rattle * 0.35;
    }

    /* ---- eyes follow whatever is worth following ---- */
    /* The pointer, unless something is being carried, in which case the thing
       being carried. A drag suppresses `pointermove` for its whole duration,
       so without this the eyes freeze the moment a gate is picked up. */
    const carrying = mascotGaze.held;
    const lookX = carrying ? mascotGaze.x : pointerState.x;
    const lookY = carrying ? mascotGaze.y : pointerState.y;

    if (pupilL.current && pupilR.current) {
      /* Both are in viewport space, and the cat's own place in that space is
         now fixed by CSS rather than computed — it is pinned to the
         bottom-right corner. These two numbers mirror that placement, so the
         vector between them is the direction to look, with no raycast and no
         layout read inside the frame loop. */
      let dx = lookX - CORNER_X;
      let dy = lookY - CORNER_Y;
      const reach = Math.hypot(dx, dy) || 1;
      const gaze = Math.min(1, reach) / reach;
      dx *= gaze * 0.075;
      dy *= gaze * 0.075;

      if (pose === "distressed") {
        // Looking at the floor, not at you. That is the whole joke.
        dx = 0;
        dy = -0.06;
      }
      if (pose === "thinking") dy += Math.sin(time * 3) * 0.02;

      for (const pupil of [pupilL.current, pupilR.current]) {
        pupil.position.x += (dx - pupil.position.x) * (1 - Math.exp(-step * 9));
        pupil.position.y += (dy - pupil.position.y) * (1 - Math.exp(-step * 9));
      }
    }

    /* ---- blink ---- */
    blink.current.next -= step;
    if (blink.current.next <= 0) {
      blink.current.closing = 1;
      blink.current.next = 2.2 + Math.random() * 3.4;
    }
    blink.current.closing = Math.max(0, blink.current.closing - step * 7);
    const lidDrop = reducedMotion ? 0 : Math.sin(blink.current.closing * Math.PI) * 0.5;
    for (const lid of [lidL.current, lidR.current]) {
      if (lid) lid.scale.y = Math.max(0.001, lidDrop);
    }

    /* ---- tail ---- */
    if (tail.current) {
      const swish = pose === "distressed" ? 0.4 : pose === "celebrating" ? 3.4 : 1.3;
      tail.current.rotation.z = Math.sin(time * swish) * 0.3 * calm;
    }

    /* ---- head: tilt for character, turn to follow a gate ---- */
    if (head.current) {
      const tilt = pose === "thinking" ? Math.sin(time * 2.4) * 0.12 : lookX * 0.05;
      head.current.rotation.z += (tilt - head.current.rotation.z) * (1 - Math.exp(-step * 6));

      /* A turn of the head, not just a glance, and only while a gate is
         actually in transit. The shapes are flat, so rotating the group
         foreshortens the face — which is the point: it reads as the cat
         squaring up to what you are doing rather than as a sprite sliding. */
      const turn = carrying ? THREE.MathUtils.clamp(lookX - CORNER_X, -1, 1) * 0.3 : 0;
      const dip = carrying ? THREE.MathUtils.clamp(lookY - CORNER_Y, -1, 1) * -0.16 : 0;
      head.current.rotation.y += (turn - head.current.rotation.y) * (1 - Math.exp(-step * 7));
      head.current.rotation.x += (dip - head.current.rotation.x) * (1 - Math.exp(-step * 7));
    }
  });

  /* Phones, where a mascot in the corner is a nuisance rather than a companion.
     Measured against the window, not `size`: `size` is the canvas, and the
     canvas is now 146px wide by design — checking that hid the cat on every
     device, because the cat's own box is always smaller than a phone. */
  const tiny = typeof window !== "undefined" && window.innerWidth < 480;

  return (
    /* Named, because the speech bubble finds it by name and projects it. This
       is the node that actually moves, so it is the one worth tracking. */
    <group ref={root} name="mascot-anchor" visible={!tiny}>
      {children}
      <group ref={body}>
        {/* --- the cat, behind the box --- */}
        <group position={[0, 0.52, -0.2]}>
          <group ref={tail} position={[0.62, -0.5, -0.05]}>
            <mesh position={[0.16, 0.1, -0.01]} rotation={[0, 0, -0.5]}>
              <capsuleGeometry args={[0.105, 0.5, 4, 12]} />
              <Flat color={RIM} />
            </mesh>
            <mesh position={[0.16, 0.1, 0]} rotation={[0, 0, -0.5]}>
              <capsuleGeometry args={[0.085, 0.5, 4, 12]} />
              <Flat color={BLACK} />
            </mesh>
          </group>

          <Stroked geometry={bodyShape} color={BLACK} position={[0, -0.34, -0.02]} />

          <group ref={head}>
            <Stroked geometry={EAR_L} color={BLACK} position={[0, 0, -0.01]} weight={1.11} />
            <Stroked geometry={EAR_R} color={BLACK} position={[0, 0, -0.01]} weight={1.11} />
            <mesh geometry={EAR_L_IN} position={[0, 0, 0.005]}>
              <Flat color={AMBER} />
            </mesh>
            <mesh geometry={EAR_R_IN} position={[0, 0, 0.005]}>
              <Flat color={AMBER} />
            </mesh>

            <Stroked geometry={headShape} color={BLACK} position={[0, 0.26, 0.02]} weight={1.06} />

            <Eye x={-0.28} look={pupilL} />
            <Eye x={0.28} look={pupilR} />

            {/* Lids: black bars that scale down over the eyes to blink. */}
            <mesh ref={lidL} position={[-0.28, 0.34, 0.09]}>
              <planeGeometry args={[0.52, 0.52]} />
              <Flat color={BLACK} />
            </mesh>
            <mesh ref={lidR} position={[0.28, 0.34, 0.09]}>
              <planeGeometry args={[0.52, 0.52]} />
              <Flat color={BLACK} />
            </mesh>

            {/* Nose and whiskers, the two details that make it a cat. */}
            <mesh position={[0, 0.06, 0.06]} rotation={[0, 0, Math.PI]}>
              <circleGeometry args={[0.05, 3]} />
              <Flat color={CYAN} />
            </mesh>
            {[-1, 1].map((s) =>
              [0.02, -0.06].map((yy) => (
                <mesh key={`${s}-${yy}`} position={[s * 0.44, yy + 0.04, 0.05]}>
                  <planeGeometry args={[0.34, 0.017]} />
                  <Flat color={CREAM} opacity={0.75} />
                </mesh>
              )),
            )}
          </group>
        </group>

        {/* --- the box, in front, so the cat sits inside it --- */}
        <group ref={boxGroup} position={[0, -0.42, 0]}>
          <mesh geometry={boxSide} position={[-1.02, 0.02, -0.08]} rotation={[0, 0.42, 0]}>
            <Flat color={CRATE_DARK} />
          </mesh>
          <mesh geometry={boxSide} position={[1.02, 0.02, -0.08]} rotation={[0, -0.42, 0]}>
            <Flat color={CRATE_DARK} />
          </mesh>

          <mesh geometry={boxFront} position={[0, 0, 0.1]}>
            <Flat color={CRATE} />
          </mesh>
          {/* The open lip of the box, catching the light from above. */}
          <mesh position={[0, 0.61, 0.11]}>
            <planeGeometry args={[1.86, 0.09]} />
            <Flat color={CRATE_LIP} />
          </mesh>

          <RadiationMark z={0.12} />
        </group>
      </group>
    </group>
  );
}
