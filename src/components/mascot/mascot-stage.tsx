"use client";

import {
  Suspense,
  useEffect,
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
  mascotSnapshot,
  setAlertOpen,
  subscribeAlert,
  subscribeMascot,
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
    if (!ready) return;
    let frame = 0;
    let lastSide: Side = "right";
    let lastLevel: Level = "above";

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
  }, [ready, flying, targetX, targetY, x, y]);

  /* Escape closes an open notice, the way every other popover on the web does. */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAlertOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!ready) return null;

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
        {alert && !open && (
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

        {alert && open && (
          <div
            className={cn(
              "animate-rise pointer-events-auto absolute w-[clamp(15rem,21vw,19rem)]",
              align,
              vertical,
            )}
            role="dialog"
            aria-label={`${alert.title}, ${alert.where}`}
          >
            <Cloud tail={tail} caution>
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.14em] text-filament uppercase">
                  <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                  {alert.title} · {alert.where}
                </p>
                <button
                  type="button"
                  onClick={() => setAlertOpen(false)}
                  aria-label="Close"
                  className="-mt-1 -mr-1 grid size-6 shrink-0 place-items-center rounded-full text-dim transition-colors hover:bg-strata hover:text-paper focus-visible:outline-2 focus-visible:outline-filament"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
              <p
                className="mt-2 text-[13px] leading-relaxed text-paper"
                role="status"
                aria-live="polite"
              >
                {alert.message}
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-frost">
                {alert.fix}
              </p>
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAlertOpen(false);
                    openTutor(alert.ask);
                  }}
                  className="rounded-full bg-filament px-3.5 py-1.5 font-mono text-[10.5px] font-semibold tracking-[0.12em] text-void uppercase transition-colors hover:bg-filament/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-filament"
                >
                  Ask the tutor why
                </button>
                <button
                  type="button"
                  onClick={dismissAlert}
                  className="rounded-full border border-edge-hi px-3.5 py-1.5 font-mono text-[10.5px] tracking-[0.12em] text-frost uppercase transition-colors hover:border-paper/50 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-filament"
                >
                  Got it
                </button>
              </div>
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

/* The scallops. Centres as a share of the edge, sizes in pixels, so the
   silhouette stays a cloud at any height the text makes it. */
const TOP = [
  { at: 10, size: 34 },
  { at: 30, size: 46 },
  { at: 53, size: 40 },
  { at: 76, size: 48 },
];
const BOTTOM = [
  { at: 18, size: 36 },
  { at: 44, size: 42 },
  { at: 70, size: 34 },
];

/**
 * A thought cloud, rather than a box with a notch in it.
 *
 * Built as a union — a rounded body, a row of circles along the top and bottom,
 * one on each side — all filled with the same colour and outlined together by
 * `cloud-outline`, which traces only the silhouette they make as one shape. A
 * border on each piece would draw every seam between them, and the result would
 * be a pile of circles rather than a cloud.
 *
 * The trail of shrinking dots runs to the cat from whichever corner is nearest
 * it, which is the part of a thought bubble that says whose thought it is.
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
  const down = tail.startsWith("bottom");
  const right = tail.endsWith("right");
  const fill = "bg-nebula";

  const dots = [
    { size: 15, out: 13, inset: 26 },
    { size: 10, out: 26, inset: 14 },
    { size: 6, out: 35, inset: 5 },
  ];

  return (
    <div className="relative">
      <div
        aria-hidden
        className={cn(
          "absolute inset-0",
          caution ? "cloud-outline-caution" : "cloud-outline",
        )}
      >
        <span className={cn("absolute inset-0 rounded-[26px]", fill)} />
        {TOP.map((bump) => (
          <span
            key={`t${bump.at}`}
            className={cn("absolute rounded-full", fill)}
            style={{
              width: bump.size,
              height: bump.size,
              left: `calc(${bump.at}% - ${bump.size / 2}px)`,
              top: -bump.size * 0.36,
            }}
          />
        ))}
        {BOTTOM.map((bump) => (
          <span
            key={`b${bump.at}`}
            className={cn("absolute rounded-full", fill)}
            style={{
              width: bump.size,
              height: bump.size,
              left: `calc(${bump.at}% - ${bump.size / 2}px)`,
              bottom: -bump.size * 0.34,
            }}
          />
        ))}
        <span
          className={cn("absolute size-[34px] rounded-full", fill)}
          style={{ left: -12, top: "34%" }}
        />
        <span
          className={cn("absolute size-[30px] rounded-full", fill)}
          style={{ right: -10, top: "26%" }}
        />

        {/* The trail to the cat. */}
        {dots.map((dot) => (
          <span
            key={dot.size}
            className={cn("absolute rounded-full", fill)}
            style={{
              width: dot.size,
              height: dot.size,
              [right ? "right" : "left"]: dot.inset,
              [down ? "bottom" : "top"]: -(dot.out + dot.size),
            }}
          />
        ))}
      </div>

      <div className="relative px-4 py-3.5">{children}</div>
    </div>
  );
}
