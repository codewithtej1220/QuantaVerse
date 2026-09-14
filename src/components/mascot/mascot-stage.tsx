"use client";

import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Canvas } from "@react-three/fiber";
import {
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
} from "framer-motion";
import { TriangleAlert, X } from "lucide-react";

import { revealLine } from "@/lib/code-editor";
import {
  alertSnapshot,
  dismissAlert,
  hush,
  mascotAttention,
  mascotOffer,
  mascotSeat,
  mascotPresent,
  mascotSnapshot,
  setAlertOpen,
  subscribeAlert,
  subscribeMascot,
  subscribeMascotRoom,
  type AlertState,
  type MascotSpeech,
} from "@/lib/mascot";
import { useGlobalPointer, useReducedMotion } from "@/lib/pointer";
import { openTutor } from "@/lib/tutor-bus";
import { cn } from "@/lib/utils";
import { BadgeBurst } from "./badge-burst";
import { QuantumCat } from "./quantum-cat";

/**
 * The tutor, on every page — in the corner, until something is wrong.
 *
 * Mounted in the root layout, which is the whole reason it survives a route
 * change: the WebGL context is never torn down and the cat is simply still there.
 * The canvas is sized to the cat rather than being a full-screen sheet with the
 * cat flown around inside it; that earlier arrangement converted one anchor into
 * world units and pixels by two different routes, and the art ended up hundreds
 * of pixels from its own hit target. Art, button and bubble are one box.
 *
 * That box now moves. When the sandbox finds a fault — a gate that does nothing,
 * a line of Qiskit the board had to skip — the cat leaves the corner, crosses
 * the page to it, and sits beside it with a caution notice. The remark it used
 * to make from the far side of the window said *what* was wrong and left the
 * reader to go and find *where*; now it is at the where. The notice is small on
 * purpose, and opening it is the reader's choice: a cat that crossed the page
 * and then covered the fault with a paragraph would have made the thing it came
 * to point at harder to see.
 *
 * The whole flight is one transform on this box. `x` and `y` are springs chasing
 * a target that is re-measured every frame, because the thing being pointed at
 * scrolls with the page, and a cat parked by a rectangle measured once would be
 * parked by nothing a moment later.
 */

const SILENT: MascotSpeech = {
  text: "",
  eyebrow: null,
  streaming: false,
  offer: false,
};
const NO_ALERT: AlertState = { alert: null, open: false };

const neverChanges = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** Smaller while it is out on the page, so it points at the fault without sitting on the next one. */
const FLY_SCALE = 0.74;
/** Clear of the fixed nav. */
const NAV_CLEARANCE = 80;
const EDGE = 12;
const GAP = 14;
/** Close enough to the fault to count as there, in pixels. */
const ARRIVAL = 18;

type Side = "left" | "right";
type Level = "above" | "below";

export function MascotStage() {
  const ready = useSyncExternalStore(neverChanges, onClient, onServer);
  const reducedMotion = useReducedMotion();
  const speech = useSyncExternalStore(
    subscribeMascot,
    mascotSnapshot,
    () => SILENT,
  );
  const { alert, open } = useSyncExternalStore(
    subscribeAlert,
    alertSnapshot,
    () => NO_ALERT,
  );
  /* No cat on a phone — and so none of its furniture either. Rendering the
     box without the art left an invisible tap target in the corner and, now,
     a notice flying about with nobody attached to it. */
  const present = useSyncExternalStore(
    subscribeMascotRoom,
    mascotPresent,
    () => false,
  );

  useGlobalPointer();

  const home = useRef<HTMLDivElement>(null);

  /* Where the cat is going, and the springs that get it there. */
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const spring = reducedMotion
    ? { stiffness: 1000, damping: 100 }
    : { stiffness: 64, damping: 14, mass: 0.9 };
  const x = useSpring(targetX, spring);
  const settledY = useSpring(targetY, spring);
  /* A hop layered over the vertical spring, so a flight arcs instead of
     sliding in a straight line like a window being dragged. */
  const hop = useMotionValue(0);
  const y = useTransform(() => settledY.get() + hop.get());
  const scale = useSpring(
    1,
    reducedMotion
      ? { stiffness: 1000, damping: 100 }
      : { stiffness: 170, damping: 20 },
  );
  /* Banking into the turn: a little lean in the direction of travel. */
  const rotate = useTransform(useVelocity(x), [-900, 0, 900], [-9, 0, 9]);

  /* Which way the bubble opens, so it never opens off the edge of the window. */
  const [side, setSide] = useState<Side>("right");
  const [level, setLevel] = useState<Level>("above");
  /* The notice waits for the cat to land. It used to appear the moment the
     fault was found, with the cat still in its corner — and it opens towards
     where the cat is going, so for the whole flight it hung off the edge of the
     window. A cat that crosses the page and then says something is also simply
     how this should read. */
  const [arrived, setArrived] = useState(false);

  const alertKey = alert?.key ?? null;
  const flying = Boolean(alert);

  /* A hop on every departure and every return. Not on re-measures — those are
     the page scrolling under a cat that is already where it should be. */
  const previousKey = useRef<string | null>(null);
  useEffect(() => {
    if (previousKey.current === alertKey) return;
    previousKey.current = alertKey;
    scale.set(alertKey ? FLY_SCALE : 1);
    if (reducedMotion) return;
    const controls = animate(hop, [0, -64, 0], {
      duration: 0.95,
      ease: "easeInOut",
    });
    return () => controls.stop();
  }, [alertKey, hop, scale, reducedMotion]);

  /* The measuring loop. Cheap when there is nothing to chase: a few numbers
     per frame to keep the cat's seat current for its eyes. */
  useEffect(() => {
    if (!ready || !present) return;
    let frame = 0;
    let lastSide: Side = "right";
    let lastLevel: Level = "above";
    let lastArrived = false;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const anchor = home.current?.getBoundingClientRect();
      if (!anchor) return;

      const homeX = anchor.left + anchor.width / 2;
      const homeY = anchor.top + anchor.height / 2;
      const rect = flying ? (alertSnapshot().alert?.locate() ?? null) : null;

      let nextSide: Side = "right";
      let nextLevel: Level = "above";

      if (rect) {
        const w = anchor.width * FLY_SCALE;
        const h = anchor.height * FLY_SCALE;
        let cx = rect.right + GAP + w / 2;
        let cy = rect.top + rect.height / 2;

        /* Beside the fault if there is room, the other side if not, and below
           it as the last resort — never on top of it. */
        if (cx + w / 2 > window.innerWidth - EDGE) {
          const left = rect.left - GAP - w / 2;
          if (left - w / 2 >= EDGE) cx = left;
          else {
            cx = rect.left + rect.width / 2;
            cy = rect.bottom + GAP + h / 2;
          }
        }
        cx = Math.min(
          Math.max(cx, EDGE + w / 2),
          window.innerWidth - EDGE - w / 2,
        );
        cy = Math.min(
          Math.max(cy, NAV_CLEARANCE + h / 2),
          window.innerHeight - EDGE - h / 2,
        );

        targetX.set(cx - homeX);
        targetY.set(cy - homeY);

        mascotAttention.x =
          ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1;
        mascotAttention.y =
          1 - ((rect.top + rect.height / 2) / window.innerHeight) * 2;
        mascotAttention.on = true;

        /* A bubble opens away from the nearer edge, and below the cat when the
           cat is too near the top for anything to fit above it. */
        nextSide = cx < window.innerWidth * 0.5 ? "left" : "right";
        nextLevel = cy - h / 2 < NAV_CLEARANCE + 190 ? "below" : "above";
      } else {
        targetX.set(0);
        targetY.set(0);
        mascotAttention.on = false;
      }

      /* Landed: the spring has caught its target and the hop has come back
         down. Measured on the settled value, so the arc does not count. */
      const landed =
        Boolean(rect) &&
        Math.hypot(x.get() - targetX.get(), settledY.get() - targetY.get()) <
          ARRIVAL &&
        Math.abs(hop.get()) < 4;
      if (landed !== lastArrived) {
        lastArrived = landed;
        setArrived(landed);
      }

      const seatX = homeX + x.get();
      const seatY = homeY + y.get();
      mascotSeat.x = (seatX / window.innerWidth) * 2 - 1;
      mascotSeat.y = 1 - (seatY / window.innerHeight) * 2;

      if (nextSide !== lastSide) {
        lastSide = nextSide;
        setSide(nextSide);
      }
      if (nextLevel !== lastLevel) {
        lastLevel = nextLevel;
        setLevel(nextLevel);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      mascotAttention.on = false;
    };
  }, [ready, present, flying, targetX, targetY, x, y, settledY, hop]);

  /* Escape closes an open notice, the way every other popover on the web does. */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAlertOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!ready || !present) return null;

  const talking = !alert && speech.text.length > 0;
  /* The bubble opens away from whichever edge the cat is nearest. */
  const align = side === "right" ? "right-0" : "left-0";
  const vertical = level === "above" ? "bottom-full mb-5" : "top-full mt-5";
  const tail =
    level === "above"
      ? side === "right"
        ? "bottom-right"
        : "bottom-left"
      : side === "right"
        ? "top-right"
        : "top-left";

  const openAlert = () => {
    if (!alert) return;
    setAlertOpen(true);
    if (alert.source === "code") {
      const line = Number(alert.where.replace(/\D+/g, ""));
      if (line) revealLine(line);
    }
  };

  return (
    <>
      {/* Home, measured. Never transformed, so its rectangle is always where the
          cat returns to, at whatever size the breakpoint gives it. */}
      <div
        ref={home}
        aria-hidden
        className="pointer-events-none invisible fixed right-4 bottom-5 size-[124px] sm:right-6 sm:bottom-7 sm:size-[146px]"
      />

      {/* Below the tutor panel (z-40) and the nav (z-50). The wrapper takes no
          pointer events; only the cat's button, the notice and the cloud opt
          back in, so the page underneath stays entirely usable. */}
      <motion.div
        className="pointer-events-none fixed right-4 bottom-5 z-30 sm:right-6 sm:bottom-7"
        style={{ x, y, scale, rotate }}
      >
        {alert && arrived && !open && (
          <div
            className={cn(
              "animate-rise pointer-events-auto absolute",
              align,
              vertical,
            )}
          >
            <button
              type="button"
              onClick={openAlert}
              aria-label={`${alert.title}, ${alert.where}. Open for details.`}
              className={cn(
                "flex items-center gap-2.5 rounded-full border border-filament/70 bg-void/95 py-1.5 pr-3.5 pl-1.5",
                "shadow-[0_12px_30px_rgb(0_0_0/0.55)] transition-colors hover:border-filament hover:bg-nebula",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-filament",
              )}
            >
              <span className="relative grid size-7 shrink-0 place-items-center rounded-full bg-filament text-void">
                <TriangleAlert
                  className="size-4"
                  strokeWidth={2.4}
                  aria-hidden
                />
                {/* The ring carries information, which is what earns it the
                    motion: there is something here waiting to be opened. */}
                <span
                  aria-hidden
                  className="animate-flag absolute inset-0 rounded-full border-2 border-filament"
                />
              </span>
              <span className="text-left leading-tight whitespace-nowrap">
                <span className="block font-mono text-[10px] tracking-[0.16em] text-filament uppercase">
                  {alert.title}
                </span>
                <span className="block text-[12.5px] text-paper">
                  {alert.where}
                  <span className="text-dim"> · tap for details</span>
                </span>
              </span>
            </button>
          </div>
        )}

        {alert && arrived && open && (
          <div
            className={cn(
              "animate-rise pointer-events-auto absolute w-[clamp(13.5rem,18vw,17rem)]",
              align,
              vertical,
            )}
            role="dialog"
            aria-label={`${alert.title}, ${alert.where}`}
          >
            {/* One sentence and one way forward. The fix used to sit under the
                message as a second paragraph with two buttons below it, which
                turned a notice into a panel — and a learner who wants the fix
                explained is better served by the tutor explaining it than by a
                paragraph that assumes they already follow. The squiggle in the
                editor still carries the full sentence on hover. */}
            <Cloud tail={tail} caution>
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-filament uppercase">
                  <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                  {alert.where}
                </p>
                <button
                  type="button"
                  onClick={dismissAlert}
                  aria-label="Dismiss — send the cat home"
                  title="Dismiss"
                  className="-mt-1 -mr-1.5 grid size-6 shrink-0 place-items-center rounded-full text-dim transition-colors hover:bg-strata hover:text-paper focus-visible:outline-2 focus-visible:outline-filament"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
              <p
                className="mt-1.5 text-[13px] leading-relaxed text-paper"
                role="status"
                aria-live="polite"
              >
                {alert.message}
              </p>
              <button
                type="button"
                onClick={() => {
                  setAlertOpen(false);
                  openTutor(alert.ask, { send: true });
                }}
                className="group mt-2.5 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.12em] text-filament uppercase transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-filament"
              >
                Ask the tutor why
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  &rarr;
                </span>
              </button>
            </Cloud>
          </div>
        )}

        {/* Kept narrow on purpose. At 26vw it reached about 336px, hanging far
            past a 146px cat and across whatever the reader was looking at. It
            is an aside from a mascot, not a panel. */}
        {talking && (
          <div
            className={cn(
              "animate-rise pointer-events-auto absolute w-[clamp(12.5rem,17vw,16.5rem)]",
              align,
              vertical,
            )}
          >
            <Cloud tail={tail}>
              {speech.eyebrow && (
                <p className="eyebrow mb-1.5 text-filament">{speech.eyebrow}</p>
              )}
              <p
                className="text-[13px] leading-relaxed text-paper"
                role="status"
                aria-live="polite"
              >
                {speech.text}
                {speech.streaming && (
                  <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] animate-pulse bg-filament align-middle" />
                )}
              </p>
              {speech.offer && (
                <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] tracking-[0.12em] text-filament uppercase">
                  tap to ask <span aria-hidden>&rarr;</span>
                </p>
              )}
            </Cloud>
          </div>
        )}

        {/* The cat, and the button over it. One box, so what you see and what
            you press cannot drift apart. */}
        <div className="relative size-[124px] sm:size-[146px]">
          <Canvas
            dpr={[1, 1.75]}
            orthographic
            /* The cat stands about 2.4 world units tall. At 146 CSS pixels the
               zoom decides how much world fits, so 34 leaves a margin rather
               than cropping the ears and the base of the crate. */
            camera={{ position: [0, 0, 10], zoom: 34 }}
            gl={{ antialias: true, alpha: true }}
            style={{ pointerEvents: "none" }}
            fallback={null}
          >
            <Suspense fallback={null}>
              <QuantumCat reducedMotion={reducedMotion}>
                <BadgeBurst reducedMotion={reducedMotion} />
              </QuantumCat>
            </Suspense>
          </Canvas>

          <button
            type="button"
            aria-label={
              alert ? `${alert.title}: open the details` : "Ask the tutor"
            }
            onClick={() => {
              /* Out on the page, the cat is the notice — pressing it opens what
                 it came to say. At home it is the way into the tutor, carrying
                 whatever question this page makes worth asking. */
              if (alert) {
                if (open) setAlertOpen(false);
                else openAlert();
                return;
              }
              hush();
              openTutor(mascotOffer.ask ?? undefined);
            }}
            className={cn(
              "pointer-events-auto absolute inset-0 cursor-pointer rounded-2xl",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-filament",
            )}
          />
        </div>
      </motion.div>
    </>
  );
}

/* ------------------------------------------------------------------ */

type Tail = "bottom-right" | "bottom-left" | "top-right" | "top-left";

/** How far the line the puffs sit on is drawn inside the box. */
const PUFF_INSET = 11;
/** The width a puff aims for; each edge rounds to a whole number of them. */
const PUFF_WIDTH = 40;
/** How far every puff bulges past its chord — the same for all of them. */
const PUFF_RISE = 11;
/** Where the cat's head is, from the cloud's near edge, for the trail. */
const CAT_HALF = 73;

/**
 * An evenly scalloped outline around a box of any size.
 *
 * The line the puffs sit on is walked clockwise, and each edge is split into a
 * whole number of equal chords, with an arc over each one. The count comes from
 * the edge's length, so a wider cloud gets more puffs rather than stretched
 * ones, and every puff rises by the same distance — the radius is solved per
 * edge from the chord and that fixed rise, which is what makes a short side's
 * puffs look like a long side's instead of flatter or fatter.
 *
 * Arcs are swept clockwise throughout (sweep flag 1): walking clockwise, that
 * always bulges outward, whichever edge it is on.
 */
function cloudPath(w: number, h: number) {
  const x0 = PUFF_INSET;
  const y0 = PUFF_INSET;
  const x1 = w - PUFF_INSET;
  const y1 = h - PUFF_INSET;

  const edge = (length: number) => {
    const count = Math.max(1, Math.round(length / PUFF_WIDTH));
    const chord = length / count;
    const radius = (chord * chord) / 4 / (2 * PUFF_RISE) + PUFF_RISE / 2;
    return { count, chord, radius };
  };

  const across = edge(x1 - x0);
  const down = edge(y1 - y0);
  const arc = (r: number, x: number, y: number) =>
    ` A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;

  let d = `M ${x0} ${y0}`;
  for (let i = 1; i <= across.count; i += 1)
    d += arc(across.radius, x0 + across.chord * i, y0);
  for (let i = 1; i <= down.count; i += 1)
    d += arc(down.radius, x1, y0 + down.chord * i);
  for (let i = 1; i <= across.count; i += 1)
    d += arc(across.radius, x1 - across.chord * i, y1);
  for (let i = 1; i <= down.count; i += 1)
    d += arc(down.radius, x0, y1 - down.chord * i);
  return `${d} Z`;
}

/** Three shrinking dots from the cloud's near corner towards the cat's head. */
function trail(w: number, h: number, tail: Tail) {
  const right = tail.endsWith("right");
  const down = tail.startsWith("bottom");
  const x = (inset: number) => (right ? w - inset : inset);
  const y = (out: number) => (down ? h + out : -out);
  return [
    { r: 6, cx: x(CAT_HALF - 26), cy: y(11) },
    { r: 4.2, cx: x(CAT_HALF - 14), cy: y(25) },
    { r: 2.8, cx: x(CAT_HALF - 5), cy: y(36) },
  ];
}

/**
 * A thought cloud: an even ring of puffs, and a trail of dots to the cat.
 *
 * The first version stacked a dozen CSS circles of assorted sizes around a
 * rounded box and outlined the lot with drop-shadows. It read as a cloud from a
 * distance and as a lumpy one up close — the circles were placed by eye, so the
 * top row had four different sizes at uneven spacing, and the sides did not
 * match each other. It is one SVG path now, generated from the box's measured
 * size, so the puffs are the same size and evenly spaced however much text is
 * inside, and the outline is a single stroke with no seams to hide.
 *
 * Measured in a layout effect, so the outline is in place before the first
 * paint rather than arriving a frame after the text it surrounds, and observed
 * for size afterwards, because a streamed answer grows the box a word at a time.
 */
function Cloud({
  children,
  tail,
  caution = false,
}: {
  children: ReactNode;
  tail: Tail;
  caution?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => {
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      setSize((previous) =>
        previous && previous.w === w && previous.h === h ? previous : { w, h },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const stroke = caution ? "stroke-filament" : "stroke-edge-hi";

  return (
    <div ref={box} className="relative">
      {/* The shadow is a box-shadow on a plain element behind the outline, not a
          CSS filter on the SVG. A filtered layer here composites underneath the
          circuit board's 3D gates — the gates painted straight through the
          cloud and over its text — while a box-shadow, like the notice pill's,
          stacks where it is told to. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-2 rounded-[30px] shadow-[0_16px_36px_rgb(0_0_0/0.5)]"
      />
      {size && (
        <svg
          aria-hidden
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          className="pointer-events-none absolute inset-0 overflow-visible"
        >
          <path
            d={cloudPath(size.w, size.h)}
            className={cn("fill-nebula", stroke)}
            strokeWidth={1.25}
            strokeLinejoin="round"
          />
          {trail(size.w, size.h, tail).map((dot) => (
            <circle
              key={dot.r}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              className={cn("fill-nebula", stroke)}
              strokeWidth={1.25}
            />
          ))}
        </svg>
      )}
      <div className="relative px-5 py-4">{children}</div>
    </div>
  );
}
