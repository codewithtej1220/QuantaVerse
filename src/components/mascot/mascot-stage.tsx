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
  say,
  setAlertOpen,
  subscribeAlert,
  subscribeMascot,
  subscribeMascotRoom,
  type AlertState,
  type MascotSpeech,
} from "@/lib/mascot";
import { useGlobalPointer, useReducedMotion } from "@/lib/pointer";
import {
  TOUR,
  endTour,
  locateStop,
  nextStop,
  previousStop,
  startTour,
  subscribeTour,
  tourIndex,
} from "@/lib/tour";
import { openTutor } from "@/lib/tutor-bus";
import { cn } from "@/lib/utils";
import { BadgeBurst } from "./badge-burst";
import { QuantumCat } from "./quantum-cat";

/**
 * The tutor, on every page — in the corner, until it has somewhere to be.
 *
 * Mounted in the root layout, which is the whole reason it survives a route
 * change: the WebGL context is never torn down and the cat is simply still there.
 * The canvas is sized to the cat rather than being a full-screen sheet with the
 * cat flown around inside it; that earlier arrangement converted one anchor into
 * world units and pixels by two different routes, and the art ended up hundreds
 * of pixels from its own hit target. Art, button and bubble are one box.
 *
 * That box travels for two reasons. A fault — a gate that does nothing, a line
 * of Qiskit the board had to skip — sends it to the fault with a caution notice.
 * A tour sends it round the site, one stop at a time. Both are the same flight:
 * `x` and `y` are springs chasing a target re-measured every frame, because the
 * thing being pointed at scrolls with the page, and a cat parked by a rectangle
 * measured once would be parked by nothing a moment later.
 *
 * Only the cat shrinks and banks on the way. The bubble used to be inside the
 * same transform, so while the cat was out on the page its text was drawn at
 * three quarters of its size, and every lean into a turn tilted the sentence
 * along with the cat. The bubble is a sibling now, kept upright and full size,
 * and moved each frame to sit against wherever the smaller cat actually is.
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

/** Smaller while it is out on the page, so it points at a thing without sitting on the next one. */
const FLY_SCALE = 0.74;
/** Clear of the fixed nav. */
const NAV_CLEARANCE = 80;
const EDGE = 12;
const GAP = 14;
/** Close enough to count as there, in pixels. */
const ARRIVAL = 18;
/** The space between a bubble and the cat: the `mb-5` / `mt-5` it is placed with. */
const BUBBLE_GAP = 20;
/* How tall each kind of bubble usually is, for choosing where it opens before it
   has been drawn and can be measured. Once it is on screen its real height is
   used; these only stop a bubble opening on one side and jumping to the other
   in its first frame. */
const TYPICAL_HEIGHT = { tour: 210, notice: 150, pill: 44, speech: 140 };
/** How long a tour stop may take to find its element before the stop is shown anyway. */
const STOP_PATIENCE_MS = 6000;

type Side = "left" | "right";
type Level = "above" | "below";

function clamp(value: number, low: number, high: number) {
  return Math.min(Math.max(value, low), Math.max(low, high));
}

/**
 * Where the cat stands to point at a rectangle, as the centre of the smaller
 * cat, and which way its bubble would rather open.
 *
 * Beside it when there is room, level with its top — the whole of something
 * short, and the part the reader is looking at of something tall. Failing
 * that, under its right-hand end, or over it, and on top of it only when
 * neither fits in the window. It used to go straight on top — inside the
 * right-hand end of anything wide — and the right-hand end of a wide thing is
 * where its buttons are: the cat sat squarely on the curriculum's "start
 * tracking".
 *
 * The bubble opens away from the thing pointed at. Beside or over it, that is
 * upward; under it, downward — a cloud opening upward from a cat underneath
 * would sit on the very line the cat came to point out.
 */
function spotFor(
  rect: DOMRect,
  {
    w,
    h,
    right,
    bottom,
    under: prefersUnder,
  }: { w: number; h: number; right: number; bottom: number; under: boolean },
): { cx: number; cy: number; opens: Level } {
  const level = rect.top + Math.min(rect.height, 180) / 2;
  const end = Math.min(rect.right, right) - w / 2;
  const under = {
    cx: end,
    cy: rect.bottom + GAP + h / 2,
    opens: "below",
  } as const;
  const over = { cx: end, cy: rect.top - GAP - h / 2, opens: "above" } as const;
  const fitsUnder = under.cy + h / 2 <= bottom - EDGE;
  const fitsOver = over.cy - h / 2 >= NAV_CLEARANCE;

  if (prefersUnder && fitsUnder) return under;
  if (rect.right + GAP + w <= right)
    return { cx: rect.right + GAP + w / 2, cy: level, opens: "above" };
  if (rect.left - GAP - w >= EDGE)
    return { cx: rect.left - GAP - w / 2, cy: level, opens: "above" };
  if (fitsUnder) return under;
  if (fitsOver) return over;
  return { cx: end - GAP, cy: level, opens: "above" };
}

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
  const stopIndex = useSyncExternalStore(subscribeTour, tourIndex, () => null);
  /* No cat on a phone — and so none of its furniture either. Rendering the box
     without the art left an invisible tap target in the corner and a notice
     flying about with nobody attached to it. */
  const present = useSyncExternalStore(
    subscribeMascotRoom,
    mascotPresent,
    () => false,
  );

  useGlobalPointer();

  const home = useRef<HTMLDivElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  /* The layer the bubbles are drawn in, so the loop can measure whichever one
     is showing. */
  const bubbles = useRef<HTMLDivElement>(null);

  const stop = stopIndex === null ? null : TOUR[stopIndex];
  /* The tour outranks a fault: somebody who asked to be shown round is not
     helped by being pulled off to a gate halfway through. The fault waits. */
  const away = Boolean(stop || alert);

  /* Where the cat is going, and the springs that get it there. */
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const spring = reducedMotion
    ? { stiffness: 1000, damping: 100 }
    : { stiffness: 64, damping: 14, mass: 0.9 };
  const x = useSpring(targetX, spring);
  const settledY = useSpring(targetY, spring);
  /* A hop over the vertical spring, so a flight arcs rather than sliding in a
     straight line like a window being dragged. */
  const hop = useMotionValue(0);
  const y = useTransform(() => settledY.get() + hop.get());
  /* The cat's own size and lean — applied to the cat alone. */
  const catScale = useSpring(
    1,
    reducedMotion
      ? { stiffness: 1000, damping: 100 }
      : { stiffness: 170, damping: 20 },
  );
  const rotate = useTransform(useVelocity(x), [-900, 0, 900], [-9, 0, 9]);
  /* Where the bubble has to sit to touch the shrunken cat rather than the box
     the cat used to fill. Written every frame from the same numbers. */
  const bubbleX = useMotionValue(0);
  const bubbleY = useMotionValue(0);

  /* Which way the bubble opens, so it never opens off the edge of the window. */
  const [side, setSide] = useState<Side>("right");
  const [level, setLevel] = useState<Level>("above");
  /* Anything said out on the page waits for the cat to land — a bubble that
     appeared as the flight began would open towards where the cat was going
     and hang off the edge of the window the whole way there. */
  const [arrived, setArrived] = useState(false);
  /* The cat's box width at this breakpoint, measured by the loop — the trail
     aims at the middle of the cat, and render may not read a ref to find it. */
  const [catWidth, setCatWidth] = useState(146);
  /* Whether the cat is out on the page at its smaller size. Not the same as
     having an alert: a fault with no place on screen right now — its editor
     unmounted, its cell scrolled out of the board — is flagged from home, at
     full size, rather than by a shrunken cat sitting in the corner saying
     nothing. */
  const [small, setSmall] = useState(false);

  const flightKey = stop ? `tour:${stopIndex}` : (alert?.key ?? null);

  /* A hop on every departure, every return and every stop. Not on re-measures:
     those are the page scrolling under a cat already where it should be. */
  const previousKey = useRef<string | null>(null);
  useEffect(() => {
    if (previousKey.current === flightKey) return;
    previousKey.current = flightKey;
    if (reducedMotion) return;
    const controls = animate(hop, [0, -64, 0], {
      duration: 0.95,
      ease: "easeInOut",
    });
    return () => controls.stop();
  }, [flightKey, hop, reducedMotion]);

  /* The measuring loop. Cheap when there is nothing to chase: a few numbers per
     frame to keep the cat's seat current for its eyes. */
  useEffect(() => {
    if (!ready || !present) return;
    let frame = 0;
    /* What the loop last told React, starting from "nothing yet" rather than
       from a guess — so the first frame always writes the truth, even when
       React still holds a value from before the loop last restarted. */
    let lastSide: Side | null = null;
    let lastLevel: Level | null = null;
    let lastArrived: boolean | null = null;
    let lastSmall: boolean | null = null;
    let lastStop: number | null = null;
    let lastWidth = 0;
    let stopStartedAt = 0;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const anchor = home.current?.getBoundingClientRect();
      if (!anchor) return;

      if (Math.round(anchor.width) !== lastWidth) {
        lastWidth = Math.round(anchor.width);
        setCatWidth(lastWidth);
      }

      /* The page's width, not the window's: `innerWidth` counts the scrollbar,
         and a cat clamped to it sat partly underneath the scrollbar, ten pixels
         out from where the corner it came from says the edge is. */
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const vh = document.documentElement.clientHeight || window.innerHeight;
      const homeX = anchor.left + anchor.width / 2;
      const homeY = anchor.top + anchor.height / 2;

      const index = tourIndex();
      const touring = index !== null;
      if (index !== lastStop) {
        lastStop = index;
        stopStartedAt = performance.now();
      }
      const { alert: current, open: reading } = alertSnapshot();
      const rect = touring
        ? locateStop(TOUR[index])
        : current
          ? current.locate()
          : null;

      /* The bubble showing now, measured, or the usual height of the one about
         to be — whichever there is. */
      const drawn = bubbles.current?.firstElementChild;
      const measured = drawn instanceof HTMLElement && drawn.offsetHeight > 0;
      const bubbleHeight = measured
        ? drawn.offsetHeight
        : touring
          ? TYPICAL_HEIGHT.tour
          : current
            ? reading
              ? TYPICAL_HEIGHT.notice
              : TYPICAL_HEIGHT.pill
            : TYPICAL_HEIGHT.speech;
      /* Its width, the same way — the clamps each bubble is drawn with. */
      const bubbleWidth = measured
        ? drawn.offsetWidth
        : touring
          ? clamp(vw * 0.21, 248, 304)
          : current
            ? reading
              ? clamp(vw * 0.18, 216, 272)
              : 240
            : clamp(vw * 0.17, 200, 264);

      /* An open tutor panel is the right-hand edge of the page as far as the
         cat is concerned: parked under it, the cat would be pointing at a fault
         nobody can see, from behind the conversation about it. */
      const panel = document
        .querySelector("[data-tutor-panel]")
        ?.getBoundingClientRect();
      const right =
        panel && panel.width > 0 && panel.left > vw * 0.4
          ? panel.left - EDGE
          : vw - EDGE;

      let nextSide: Side = lastSide ?? "right";
      let nextLevel: Level = lastLevel ?? "above";
      let nextSmall = lastSmall ?? catScale.get() < 1;
      let landed = false;

      if (rect) {
        nextSmall = true;
        const w = anchor.width * FLY_SCALE;
        const h = anchor.height * FLY_SCALE;
        const spot = spotFor(rect, {
          w,
          h,
          right,
          bottom: vh,
          under: touring && TOUR[index].under === true,
        });
        const cx = clamp(spot.cx, EDGE + w / 2, right - w / 2);
        const cy = clamp(spot.cy, NAV_CLEARANCE + h / 2, vh - EDGE - h / 2);
        const opens = spot.opens;

        /* The cat shrinks towards its feet, so the box's centre sits above the
           smaller cat's. Aim the box so the cat — not the box — lands on cy. */
        targetX.set(cx - homeX);
        targetY.set(cy - (1 - FLY_SCALE) * (anchor.height / 2) - homeY);

        mascotAttention.x = ((rect.left + rect.width / 2) / vw) * 2 - 1;
        mascotAttention.y = 1 - ((rect.top + rect.height / 2) / vh) * 2;
        mascotAttention.on = true;

        /* The bubble reaches out from the cat away from what it is pointing
           at, the same as it opens away from it vertically. It used to reach
           towards the middle of the window, which from a cat beside a heading
           meant straight back across the paragraph under the heading, while
           the empty side of the page went unused. "left" and "right" name the
           edge the bubble is pinned to, so reaching right is pinning left. */
        const catLeft = cx - w / 2;
        const catRight = cx + w / 2;
        const reachRight = catLeft + bubbleWidth <= right;
        const reachLeft = catRight - bubbleWidth >= EDGE;
        const pastIt = cx >= rect.left + rect.width / 2;
        nextSide =
          pastIt && reachRight
            ? "left"
            : !pastIt && reachLeft
              ? "right"
              : reachRight && !reachLeft
                ? "left"
                : reachLeft && !reachRight
                  ? "right"
                  : cx < vw * 0.5
                    ? "left"
                    : "right";
        /* On the side away from the target when the bubble fits there, on the
           other side when it fits there instead, and wherever there is more
           room when it fits on neither — decided from the bubble's real height,
           so a two-line pill near the top of the window is not sent underneath
           to make room for a paragraph it does not have. */
        const room = {
          above: cy - h / 2 - BUBBLE_GAP - NAV_CLEARANCE,
          below: vh - EDGE - (cy + h / 2 + BUBBLE_GAP),
        };
        const toward: Level = opens === "above" ? "below" : "above";
        nextLevel =
          room[opens] >= bubbleHeight
            ? opens
            : room[toward] >= bubbleHeight
              ? toward
              : room.above >= room.below
                ? "above"
                : "below";

        landed =
          Math.hypot(x.get() - targetX.get(), settledY.get() - targetY.get()) <
            ARRIVAL && Math.abs(hop.get()) < 4;
      } else if (touring) {
        /* Between pages, or while a page renders, the stop has nothing to point
           at yet. Hold still rather than going home and flying back out — and if
           the element never turns up, say the stop from wherever the cat is
           rather than leaving the tour with no way to carry on. */
        mascotAttention.on = false;
        const onItsPage = window.location.pathname === TOUR[index].route;
        landed =
          onItsPage && performance.now() - stopStartedAt > STOP_PATIENCE_MS;
        const seatX = homeX + x.get();
        nextSide = seatX < vw * 0.5 ? "left" : "right";
      } else {
        /* Home: nothing wrong, or something wrong with no place on screen to
           point at. The second still gets its notice — from the corner, at full
           size — once the cat is back there. */
        targetX.set(0);
        targetY.set(0);
        mascotAttention.on = false;
        nextSide = "right";
        nextLevel = "above";
        nextSmall = false;
        landed =
          current !== null &&
          Math.hypot(x.get(), settledY.get()) < ARRIVAL &&
          Math.abs(hop.get()) < 4;
      }

      if (nextSmall !== lastSmall) {
        lastSmall = nextSmall;
        catScale.set(nextSmall ? FLY_SCALE : 1);
        setSmall(nextSmall);
      }
      if (landed !== lastArrived) {
        lastArrived = landed;
        setArrived(landed);
      }
      if (nextSide !== lastSide) {
        lastSide = nextSide;
        setSide(nextSide);
      }
      if (nextLevel !== lastLevel) {
        lastLevel = nextLevel;
        setLevel(nextLevel);
      }

      /* Keep the bubble against the cat the reader can see. Scaled towards its
         feet, the cat pulls in by (1 − s)·w/2 at each side and drops by
         (1 − s)·h at the top; its bottom edge does not move. */
      const s = catScale.get();
      const inset = ((1 - s) * anchor.width) / 2;
      bubbleX.set(nextSide === "right" ? -inset : inset);
      bubbleY.set(nextLevel === "above" ? (1 - s) * anchor.height : 0);

      mascotSeat.x = ((homeX + x.get()) / vw) * 2 - 1;
      mascotSeat.y =
        1 - ((homeY + y.get() + ((1 - s) * anchor.height) / 2) / vh) * 2;
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      mascotAttention.on = false;
    };
  }, [
    ready,
    present,
    targetX,
    targetY,
    x,
    y,
    settledY,
    hop,
    catScale,
    bubbleX,
    bubbleY,
  ]);

  /* Escape folds an open notice back into its pill, the way popovers do. The
     tour's own keys live with the tour conductor. */
  useEffect(() => {
    if (!open || stop) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAlertOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, stop]);

  /* Each stop's controls take focus when the cat lands, so a keyboard reader
     can go round the whole site on Enter alone. */
  useEffect(() => {
    if (stop && arrived) nextButton.current?.focus({ preventScroll: true });
  }, [stop, arrived]);

  if (!ready || !present) return null;

  const align = side === "right" ? "right-0" : "left-0";
  const vertical = level === "above" ? "bottom-full mb-5" : "top-full mt-5";
  const tail: Tail =
    level === "above"
      ? side === "right"
        ? "bottom-right"
        : "bottom-left"
      : side === "right"
        ? "top-right"
        : "top-left";
  /* The trail aims at the middle of the cat as drawn, which is smaller out on
     the page than it is at home. */
  const catHalf = (catWidth * (small ? FLY_SCALE : 1)) / 2;

  const showAlert = !stop && alert && arrived;
  const talking = !away && speech.text.length > 0;
  const last = stopIndex !== null && stopIndex === TOUR.length - 1;

  const openAlert = () => {
    if (!alert) return;
    setAlertOpen(true);
    if (alert.line) revealLine(alert.line);
    /* A fault scrolled out of the window is brought back into it. The cat
       waits at the edge nearest the fault, which says which way it is, but a
       notice read beside nothing explains nothing — opening it is the reader
       asking to see the thing it is about. */
    const rect = alert.locate();
    const height = document.documentElement.clientHeight || window.innerHeight;
    if (
      rect &&
      rect.height < height - NAV_CLEARANCE &&
      (rect.top < NAV_CLEARANCE || rect.bottom > height)
    ) {
      window.scrollBy({
        top: rect.top + rect.height / 2 - (height + NAV_CLEARANCE) / 2,
        behavior: reducedMotion ? "auto" : "smooth",
      });
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

      {/* At home it sits under the tutor panel (z-40) and the nav (z-50). Out on
          the page it rises above both, and above the full-screen circuit bench
          (z-50): a cat flagging a fault from underneath the board it is about
          has flagged nothing. The wrapper takes no pointer events; only the
          cat's button and what it says opt back in. */}
      <motion.div
        className={cn(
          "pointer-events-none fixed right-4 bottom-5 sm:right-6 sm:bottom-7",
          small || stop ? "z-[55]" : "z-30",
        )}
        style={{ x, y }}
      >
        <motion.div
          ref={bubbles}
          className="pointer-events-none absolute inset-0"
          style={{ x: bubbleX, y: bubbleY }}
        >
          {stop && arrived && (
            <div
              key={stopIndex}
              className={cn(
                "animate-rise pointer-events-auto absolute w-[clamp(15.5rem,21vw,19rem)]",
                align,
                vertical,
              )}
              role="dialog"
              aria-label={`Tour, stop ${(stopIndex ?? 0) + 1} of ${TOUR.length}: ${stop.title}`}
            >
              <Cloud tail={tail} catHalf={catHalf}>
                <div className="flex items-start justify-between gap-2">
                  <p className="eyebrow text-filament">{stop.title}</p>
                  <button
                    type="button"
                    onClick={endTour}
                    aria-label="End the tour"
                    title="End the tour"
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
                  {stop.text}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="font-mono text-[10.5px] text-dim tabular-nums">
                    {(stopIndex ?? 0) + 1} / {TOUR.length}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {stopIndex !== null && stopIndex > 0 && (
                      <button
                        type="button"
                        onClick={previousStop}
                        className="rounded-full px-2.5 py-1 font-mono text-[10.5px] tracking-[0.12em] text-frost uppercase transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-filament"
                      >
                        Back
                      </button>
                    )}
                    <button
                      ref={nextButton}
                      type="button"
                      onClick={() => {
                        if (last) {
                          nextStop();
                          say(
                            "That's the whole site. Tap me whenever you're stuck — I'll read whatever is on your screen first.",
                            {
                              eyebrow: "tour complete",
                              offer: true,
                            },
                          );
                          return;
                        }
                        nextStop();
                      }}
                      className="rounded-full bg-filament px-3 py-1 font-mono text-[10.5px] font-semibold tracking-[0.12em] text-void uppercase transition-colors hover:bg-filament/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-filament"
                    >
                      {last ? "Finish" : "Next →"}
                    </button>
                  </span>
                </div>
              </Cloud>
            </div>
          )}

          {showAlert && !open && (
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

          {showAlert && open && (
            <div
              className={cn(
                "animate-rise pointer-events-auto absolute w-[clamp(13.5rem,18vw,17rem)]",
                align,
                vertical,
              )}
              role="dialog"
              aria-label={`${alert.title}, ${alert.where}`}
            >
              {/* One sentence and one way forward. The fix explained at length is
                  the tutor's job; the squiggle in the editor carries the full
                  sentence on hover for anybody who never opens this. */}
              <Cloud tail={tail} catHalf={catHalf} caution>
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
              past a 146px cat and across whatever the reader was looking at. */}
          {talking && (
            <div
              className={cn(
                "animate-rise pointer-events-auto absolute w-[clamp(12.5rem,17vw,16.5rem)]",
                align,
                vertical,
              )}
            >
              <Cloud tail={tail} catHalf={catHalf}>
                {speech.eyebrow && (
                  <p className="eyebrow mb-1.5 text-filament">
                    {speech.eyebrow}
                  </p>
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
                {(speech.offer || speech.tour) && (
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    {speech.offer && (
                      <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.12em] text-filament uppercase">
                        tap me to ask <span aria-hidden>&rarr;</span>
                      </span>
                    )}
                    {speech.tour && (
                      <button
                        type="button"
                        onClick={() => {
                          hush();
                          startTour();
                        }}
                        className="rounded-full bg-filament px-3 py-1 font-mono text-[10.5px] font-semibold tracking-[0.12em] text-void uppercase transition-colors hover:bg-filament/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-filament"
                      >
                        Show me around
                      </button>
                    )}
                  </div>
                )}
              </Cloud>
            </div>
          )}
        </motion.div>

        {/* The cat, and the button over it. One box, so what you see and what
            you press cannot drift apart — and the only thing here that shrinks
            and leans, so the words above it never do. */}
        <motion.div
          className="relative size-[124px] sm:size-[146px]"
          style={{ scale: catScale, rotate, transformOrigin: "50% 100%" }}
        >
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
              stop
                ? "Your tour guide"
                : alert
                  ? `${alert.title}: open the details`
                  : "Ask the tutor"
            }
            onClick={() => {
              /* On a tour the cloud carries the controls, and a stray tap on the
                 cat should not skip a stop. Out on the page for a fault, the cat
                 is the notice. At home it is the way into the tutor. */
              if (stop) {
                nextButton.current?.focus();
                return;
              }
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
        </motion.div>
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

/**
 * Three shrinking dots from the cloud towards the middle of the cat.
 *
 * Measured from the edge the cloud shares with the cat, so the last dot lands
 * over the cat's centre whether the cat is its full size at home or shrunk out
 * on the page — the trail used to assume the full size, and pointed past a
 * small cat's shoulder.
 */
function trail(w: number, h: number, tail: Tail, catHalf: number) {
  const right = tail.endsWith("right");
  const down = tail.startsWith("bottom");
  const x = (fromEdge: number) => (right ? w - fromEdge : fromEdge);
  const y = (out: number) => (down ? h + out : -out);
  return [
    { r: 6, cx: x(Math.max(10, catHalf - 24)), cy: y(11) },
    { r: 4.2, cx: x(Math.max(10, catHalf - 12)), cy: y(25) },
    { r: 2.8, cx: x(catHalf), cy: y(36) },
  ];
}

/**
 * A thought cloud: an even ring of puffs, and a trail of dots to the cat.
 *
 * One SVG path generated from the box's measured size, so the puffs are the
 * same size and evenly spaced however much text is inside, and the outline is a
 * single stroke with no seams to hide. Measured in a layout effect, so the
 * outline is in place before the first paint, and observed afterwards, because
 * a streamed answer grows the box a word at a time.
 */
function Cloud({
  children,
  tail,
  catHalf,
  caution = false,
}: {
  children: ReactNode;
  tail: Tail;
  catHalf: number;
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
      {/* A box-shadow on a plain element behind the outline, not a CSS filter on
          the SVG: a filtered layer composites underneath the circuit board's 3D
          gates, which then paint straight through the cloud and its text. */}
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
          {trail(size.w, size.h, tail, catHalf).map((dot) => (
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
