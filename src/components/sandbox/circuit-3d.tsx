"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * The parts the circuit deck is machined from.
 *
 * The diagram is still a diagram — wires left to right, columns as time steps,
 * a classical register along the bottom — but it is built as an object standing
 * a few centimetres in front of the page rather than printed on it. The board
 * recedes, every gate is a solid block with walls you can see the sides of, and
 * the whole deck turns towards the cursor. The parallax is the part that does
 * the work: a shadow alone only ever says "this is a picture of something
 * raised", where a block that slides against its own shadow as you move says
 * the depth is real.
 *
 * It is CSS 3D rather than WebGL on purpose. The gates have to stay buttons —
 * focusable, labelled, drag-and-drop targets — and a canvas would cost every
 * one of those to draw the same picture.
 */

/** Depth in pixels, above (+) or below (−) the wire plane. */
export const Z = {
  register: -46,
  ruler: -10,
  plate: -12,
  wire: 5,
  shadow: 8,
  slot: 3,
  slotArmed: 34,
  /* The wire labels belong to the board, not to the parts standing on it: a
     label carried forward to gate depth is magnified by the same quarter as a
     block, and the left-hand column of them promptly swings out of the frame. */
  label: 10,
  gate: 76,
} as const;

/** A gate block, in millimetres of imaginary aluminium. */
export const GATE_W = 44;
export const GATE_D = 22;
export const ROW_H = 72;
/**
 * The wire label gutter.
 *
 * Wider than the two glyphs need, because a block in the first column is nearer
 * the eye than the label beside it and is magnified further by the short lens:
 * on a flat board they clear each other by seventeen pixels, and projected they
 * would overlap by twenty. The gap has to be cut in the layout, where the
 * perspective can then eat it.
 */
export const GUTTER = 96;

/**
 * Camera distance.
 *
 * Short enough that blocks near the edges of the board are visibly splayed
 * outwards: a long lens puts every block at the same angle, and the whole
 * scene collapses back into a flat picture with shading on it.
 */
export const PERSPECTIVE = 600;

/**
 * Camera distance for the gate tray.
 *
 * Longer than the board. The tray is a small, shallow object and the cards near
 * its ends are only sixty pixels wide: at the lens the board uses they splay
 * far enough to walk off the edge of their own well, and the eight of them stop
 * reading as one row of parts.
 */
export const TRAY_PERSPECTIVE = 900;

const clamp = (n: number) => Math.max(-1, Math.min(1, n));

/**
 * Turn the deck towards the pointer.
 *
 * The two damped numbers this writes — `--px` and `--py`, both −1…1 — drive
 * every depth cue on the board at once: the tilt, the perspective origin, and
 * the pool of light sliding across the plate. They are written straight to the
 * inline style of the stage inside a frame loop, because a board that
 * re-rendered React on every pointer move would stutter exactly when the
 * illusion depends on it being smooth.
 */
export function useDeckTilt(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = ref.current;
    if (!stage || !enabled) return;

    let box = stage.getBoundingClientRect();
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let frame = 0;
    let last = 0;

    const measure = () => {
      box = stage.getBoundingClientRect();
    };

    const settle = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      /* Damped against the clock, not the frame: the deck takes the same third
         of a second to swing whether the machine is managing 144Hz or dropping
         to 30. */
      const ease = 1 - Math.exp(-dt * 9);
      x += (targetX - x) * ease;
      y += (targetY - y) * ease;
      stage.style.setProperty("--px", x.toFixed(4));
      stage.style.setProperty("--py", y.toFixed(4));

      frame =
        Math.abs(targetX - x) + Math.abs(targetY - y) > 0.0015 ? requestAnimationFrame(settle) : 0;
    };

    const start = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(settle);
    };

    const onMove = (event: PointerEvent) => {
      /* Normalised against a box wider than the deck itself, so the board is
         already turning to meet a gate on its way over from the palette, and
         saturates just outside the frame rather than snapping at the edge. */
      targetX = clamp((event.clientX - (box.left + box.width / 2)) / (box.width * 0.8));
      targetY = clamp((event.clientY - (box.top + box.height / 2)) / (box.height * 1.5));
      start();
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      start();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    document.addEventListener("pointerleave", onLeave);
    const observer = new ResizeObserver(measure);
    observer.observe(stage);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      document.removeEventListener("pointerleave", onLeave);
      observer.disconnect();
    };
  }, [enabled]);

  return ref;
}

/** What a gate block is milled from. */
export interface Material {
  /** The four walls: anodised, and the faces that catch the turn. */
  wall: string;
  /** The lid, under the overhead light. */
  crown: string;
  /** The underside, in the shadow of the block itself. */
  base: string;
}

/**
 * The body of a gate: four walls and a lid, hung off the mid-plane of the block.
 *
 * The caller owns the front face — it carries the border, the symbol and the
 * focus ring — so this draws only the sides that appear as the deck turns.
 * There is no back face: nothing here rotates far enough to see one, and forty
 * slots worth of invisible geometry is forty elements the browser would
 * composite for nothing.
 */
export function BlockBody({
  width = GATE_W,
  height = GATE_W,
  depth = GATE_D,
  material,
}: {
  width?: number;
  height?: number;
  depth?: number;
  material: Material;
}) {
  const walls: CSSProperties[] = [
    {
      width: depth,
      height,
      background: material.wall,
      transform: `translate(-50%,-50%) rotateY(90deg) translateZ(${width / 2}px)`,
    },
    {
      width: depth,
      height,
      background: material.wall,
      transform: `translate(-50%,-50%) rotateY(-90deg) translateZ(${width / 2}px)`,
    },
    {
      width,
      height: depth,
      background: material.crown,
      transform: `translate(-50%,-50%) rotateX(90deg) translateZ(${height / 2}px)`,
    },
    {
      width,
      height: depth,
      background: material.base,
      transform: `translate(-50%,-50%) rotateX(-90deg) translateZ(${height / 2}px)`,
    },
  ];

  return (
    <>
      {walls.map((style, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2"
          style={style}
        />
      ))}
    </>
  );
}

/**
 * The contact shadow a block drops onto the plate.
 *
 * Drawn as a gradient rather than a blurred box: a CSS filter would flatten the
 * element out of the 3D context it has to sit inside, and this only has to be
 * soft, not correct. It is wider than the block so a little penumbra shows even
 * head-on, and it sits just above the wire so the wire darkens under a gate.
 */
export function ContactShadow({
  width = GATE_W,
  inset,
  depth = Z.shadow,
}: {
  width?: number;
  /** For a part whose width the layout decides, e.g. a stretched tray card. */
  inset?: string;
  depth?: number;
}) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute rounded-full transition-transform duration-300"
      style={{
        ...(inset ? { inset } : { width: width * 2.1, height: width * 1.5 }),
        background:
          "radial-gradient(closest-side, rgba(0,0,0,0.95), rgba(0,0,0,0.6) 42%, rgba(0,0,0,0) 76%)",
        transform: `translateZ(${depth}px) scale(var(--shade, 1))`,
      }}
    />
  );
}

/**
 * A slab that does not know how wide it is.
 *
 * `BlockBody` hangs four walls at `translateZ(width / 2)`, which needs a number.
 * That is fine for a gate on the board, which is always 44px square, and no use
 * at all for a tray card stretched by a responsive grid. So this extrudes the
 * other way: a stack of `inset-0` layers running back from the face, each one
 * sized by the layout instead of by a constant.
 *
 * Head-on the stack hides behind the face. Off-axis every layer shows a sliver
 * down the near side, and those slivers are the wall. Each layer carries the
 * same top-to-bottom gradient, so the sliver along the top edge comes out lit
 * and the one along the bottom does not — the slab gets a lid and an underside
 * without either being an element of its own.
 */
export function SlabBody({ depth = GATE_D, material }: { depth?: number; material: Material }) {
  // Close enough together that the steps stay under a pixel at tray angles.
  const layers = Math.max(4, Math.round(depth / 2.5));
  return (
    <>
      {Array.from({ length: layers }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${material.crown}, ${material.wall} 45%, ${material.base})`,
            transform: `translateZ(${-depth * (1 - i / layers)}px)`,
          }}
        />
      ))}
    </>
  );
}

/* Back-to-front shading for the round parts, which have no flat wall to catch
   the light and would otherwise read as stickers. */
const DOME = ["#0b6b82", "#128aa6", "#1fc0e0", "#2fe4ff", "#8af2ff"];

/**
 * The CNOT control: a dome, stacked out of shrinking discs.
 *
 * Five discs on a quarter-circle profile read as a machined ball at any angle
 * this board reaches, and unlike four flat walls there is no corner to give the
 * trick away when the deck turns.
 */
export function ControlDome({ size = 16, depth = 14 }: { size?: number; depth?: number }) {
  return (
    <>
      {DOME.map((color, i) => {
        const t = i / (DOME.length - 1);
        const r = size * Math.sqrt(1 - (t * 0.94) ** 2);
        return (
          <span
            key={color}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 rounded-full"
            style={{
              width: r,
              height: r,
              background: color,
              transform: `translate(-50%,-50%) translateZ(${-depth / 2 + t * depth}px)`,
            }}
          />
        );
      })}
    </>
  );
}

/**
 * The CNOT target: an open circle-plus, extruded into a tube.
 *
 * Stacked rims again rather than walls — the rims stay concentric from straight
 * on and splay into a barrel as the deck turns, which is what a short length of
 * tube actually does.
 */
export function TargetRing({
  size = 30,
  depth = GATE_D,
  children,
}: {
  size?: number;
  depth?: number;
  children?: ReactNode;
}) {
  const rims = 5;
  return (
    <>
      {Array.from({ length: rims }, (_, i) => {
        const t = i / (rims - 1);
        const front = i === rims - 1;
        return (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 rounded-full border"
            style={{
              width: size,
              height: size,
              borderColor: front ? "#2fe4ff" : "#0b6b82",
              background: front ? "var(--color-nebula)" : "transparent",
              transform: `translate(-50%,-50%) translateZ(${-depth / 2 + t * depth}px)`,
            }}
          />
        );
      })}
      {/* The crosshair belongs on the front rim, not floating inside the tube. */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2"
        style={{ transform: `translate(-50%,-50%) translateZ(${depth / 2}px)` }}
      >
        {children}
      </span>
    </>
  );
}
