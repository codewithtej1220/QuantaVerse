"use client";

/**
 * Where the cat is, what it is doing, and what it is saying.
 *
 * The mascot lives in the root layout so it can survive a route change, which
 * means nothing that wants to talk to it is anywhere near it in the tree. This
 * is the same trick `circuit-store` plays for the tutor: one module-level
 * record, a subscription for the parts React has to draw, and direct reads for
 * the parts the frame loop wants sixty times a second.
 *
 * The split matters. `pose` and `anchor` are read inside `useFrame` and must
 * never cause a render — a cat that re-rendered React on every frame of its own
 * float would cost more than everything else on the page put together. `speech`
 * is the opposite: it is DOM text, so it is a subscription.
 */

export type MascotPose =
  /** Floating, watching the pointer. The resting state. */
  | "idle"
  /** The box rattling while the model reads the circuit. */
  | "thinking"
  /** Snapped upright to deliver an answer. */
  | "resolving"
  /** Straining, for the long classical-versus-quantum benchmarks. */
  | "working"
  /** Slumped, for a streak that has gone to zero. */
  | "distressed"
  /** Bouncing, for a passed assessment. */
  | "celebrating"
  /** Leaning in and waving, for a fault it has spotted in the circuit. */
  | "flagging";

/**
 * Where on the viewport the cat should sit, in normalised coordinates.
 *
 * Screen space rather than world space on purpose: every caller thinks in terms
 * of "the bottom-right corner" or "peeking in from the left", and none of them
 * should have to know the camera's field of view to say so.
 */
export interface MascotAnchor {
  /** 0 is the left edge, 1 the right. */
  x: number;
  /** 0 is the top, 1 the bottom. */
  y: number;
  /** Multiplier on the resting size. */
  scale: number;
}

export const ANCHORS = {
  /**
   * Home. Bottom right, and it stays there.
   *
   * An earlier version had it roaming — peeking from whichever edge you were
   * not reading toward, ducking out on the hero, tucking low on the sandbox.
   * It was clever and it was wrong: a guide you have to look for is a guide
   * nobody asks. It sits in one place, the place a help button has sat on
   * every website for fifteen years, and it is always the same size.
   */
  home: { x: 0.925, y: 0.84, scale: 1 },
  /** Front and centre, for a moment that has earned it. */
  stage: { x: 0.5, y: 0.62, scale: 1.5 },
  /** Parked off the bottom edge. */
  away: { x: 0.925, y: 1.35, scale: 1 },
} as const satisfies Record<string, MascotAnchor>;

export interface MascotSpeech {
  /** Empty string means no bubble. */
  text: string;
  /** Shown smaller above the text — "reading your circuit", say. */
  eyebrow: string | null;
  /** True while the text is still arriving token by token. */
  streaming: boolean;
  /** Show the "tap to ask" affordance. False mid-answer, when it is noise. */
  offer: boolean;
}

interface MascotState {
  pose: MascotPose;
  anchor: MascotAnchor;
  speech: MascotSpeech;
  /** Bumped to fire a one-shot badge burst out of the box. */
  burst: number;
  /** Whether the cat is on screen at all. */
  visible: boolean;
}

const SILENT: MascotSpeech = {
  text: "",
  eyebrow: null,
  streaming: false,
  offer: false,
};

/**
 * The question a tap should carry into the tutor.
 *
 * Set by the director from the page's guide line, read by the stage on click.
 * Kept out of `speech` because it survives the bubble closing: the offer is a
 * property of where you are, not of what is currently on screen.
 */
export const mascotOffer: { ask: string | null } = { ask: null };

/* Read directly by the frame loop; never copied into React state. */
export const mascot: MascotState = {
  pose: "idle",
  anchor: ANCHORS.home,
  speech: SILENT,
  burst: 0,
  visible: true,
};

/* ---------------- the part React draws ---------------- */

type Listener = () => void;
const listeners = new Set<Listener>();

function announce() {
  for (const notify of listeners) notify();
}

export function subscribeMascot(notify: Listener) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** A stable snapshot, so `useSyncExternalStore` can tell when to re-render. */
export function mascotSnapshot() {
  return mascot.speech;
}

/* ---------------- the API every caller uses ---------------- */

export function setPose(pose: MascotPose) {
  mascot.pose = pose;
}

export function moveTo(anchor: MascotAnchor) {
  mascot.anchor = anchor;
}

export function setVisible(visible: boolean) {
  if (mascot.visible === visible) return;
  mascot.visible = visible;
  announce();
}

/**
 * Whether this machine can draw the cat at all.
 *
 * The tutor's launcher pill hides when it can, since the cat is that same
 * button with a face on and the two would stack in the same corner. Asked as a
 * synchronous capability question rather than by subscribing to "has the cat
 * painted yet": that signal fires exactly once, on the first frame, and if the
 * scene got there before the pill subscribed the pill never heard and never
 * stood down. There is no race in asking the browser what it supports.
 */
let webgl: boolean | null = null;

export function canDrawMascot() {
  if (webgl !== null) return webgl;
  if (typeof document === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    webgl = Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    webgl = false;
  }
  return webgl;
}

/**
 * Say something.
 *
 * Passing an empty string closes the bubble. `streaming` keeps the caret
 * blinking while tokens are still arriving, which is the difference between a
 * bubble that looks alive and one that looks stuck.
 */
export function say(
  text: string,
  options: {
    eyebrow?: string | null;
    streaming?: boolean;
    offer?: boolean;
  } = {},
) {
  mascot.speech = {
    text,
    eyebrow: options.eyebrow ?? null,
    streaming: options.streaming ?? false,
    offer: options.offer ?? false,
  };
  announce();
}

export function hush() {
  mascot.speech = SILENT;
  announce();
}

/** Pop the badges out of the box. One shot; the scene reads the counter. */
export function celebrate() {
  mascot.burst += 1;
  setPose("celebrating");
}

/* ---------------- what the cat is looking at ---------------- */

/**
 * The thing currently being carried across the screen, in pointer space.
 *
 * At rest the eyes track the pointer, read straight from `pointer.ts`. A drag
 * is the one gesture where that breaks: the browser stops firing `pointermove`
 * the instant a drag begins and fires `dragover` instead, so through the whole
 * of picking a gate up and carrying it to a wire — precisely the moment the cat
 * should look most attentive — the eyes sit frozen wherever the gate was lifted
 * from. These are the coordinates from the events that do still fire.
 *
 * `held` is also what earns the head turn. Rolling the eyes is the right
 * response to a pointer wandering past; turning to follow is the right response
 * to somebody carrying something, and a head that swung at every stray mouse
 * move would read as twitchy rather than interested.
 */
export const mascotGaze: { x: number; y: number; held: boolean } = {
  x: 0,
  y: 0,
  held: false,
};

function trackDrag(event: DragEvent) {
  /* Chrome stamps the last `drag` of a gesture at the origin. Taken at face
     value the cat snaps to the top-left corner just as the gate lands. */
  if (!event.clientX && !event.clientY) return;
  mascotGaze.x = (event.clientX / window.innerWidth) * 2 - 1;
  mascotGaze.y = 1 - (event.clientY / window.innerHeight) * 2;
  mascotGaze.held = true;
}

/** A gate has left the palette. Follow it until it lands. */
export function watchDrag() {
  document.addEventListener("dragover", trackDrag);
  document.addEventListener("drag", trackDrag);
}

/** Safe to call unmatched — removing a listener that is not there is a no-op. */
export function releaseDrag() {
  document.removeEventListener("dragover", trackDrag);
  document.removeEventListener("drag", trackDrag);
  mascotGaze.held = false;
}

/* ---------------- where the cat is, and what it is watching ---------------- */

/**
 * The cat's own position on screen, in pointer space (-1…1, y up).
 *
 * The eyes aim along the line from here to whatever they are looking at. It used
 * to be two constants for the bottom-right corner, which was true for as long as
 * the cat never left it. It leaves it now, so the stage writes its real centre
 * here as it moves, and the frame loop reads it like everything else — no
 * render between the cat moving and its eyes knowing it has.
 */
export const mascotSeat = { x: 0.86, y: -0.78 };

/** A point the cat should keep its eyes on — the fault it has flown to. */
export const mascotAttention = { x: 0, y: 0, on: false };

/* ---------------- faults it flies to ---------------- */

export type AlertSource = "circuit" | "code";

/**
 * Something wrong on the page, somewhere specific.
 *
 * The remark in the corner used to be the whole of it: a sentence about a cell
 * or a line, delivered from the far side of the window, which left the reader
 * to go and find what it meant. An alert carries the one thing that remark was
 * missing — where — as a function rather than a position, because the page
 * scrolls, the editor scrolls inside it, and a rectangle measured once is
 * pointing at the wrong place a second later.
 */
export interface MascotAlert {
  /** The same fault found again keeps the same key, so nothing flies twice. */
  key: string;
  source: AlertSource;
  /** "Circuit fault", "Code error" — what kind of trouble, in two words. */
  title: string;
  /** Where, briefly: "q2 · step 1", "line 8". */
  where: string;
  message: string;
  fix: string;
  /** Carried into the tutor if the reader asks. */
  ask: string;
  /** The fault's place on screen right now, or null if it has none. */
  locate: () => DOMRect | null;
}

export interface AlertState {
  alert: MascotAlert | null;
  /** Whether the reader has opened the notification to read it. */
  open: boolean;
}

let alertState: AlertState = { alert: null, open: false };

/* One pending fault per surface, and one cat. When both have something, the
   surface the reader touched last wins — somebody typing Qiskit wants the
   cat at the line, not at a cell on the board they have not looked at. */
const pending: Record<AlertSource, MascotAlert | null> = {
  circuit: null,
  code: null,
};
/* A fault the reader said "got it" to stays quiet until it changes or goes. */
const dismissed: Record<AlertSource, string | null> = {
  circuit: null,
  code: null,
};
let lastEdited: AlertSource = "circuit";

function publishAlert() {
  const other: AlertSource = lastEdited === "code" ? "circuit" : "code";
  const next = pending[lastEdited] ?? pending[other];
  if (next === alertState.alert) return;
  const same = Boolean(
    next && alertState.alert && next.key === alertState.alert.key,
  );
  alertState = { alert: next, open: same ? alertState.open : false };
  if (next) {
    if (mascot.pose !== "celebrating") mascot.pose = "flagging";
  } else if (mascot.pose === "flagging") {
    mascot.pose = "idle";
  }
  announce();
}

export function subscribeAlert(notify: Listener) {
  return subscribeMascot(notify);
}

export function alertSnapshot() {
  return alertState;
}

/** Which surface the reader just changed, so a tie goes to the right one. */
export function noteEdit(source: AlertSource) {
  lastEdited = source;
}

/**
 * Tell the cat what is wrong on one surface — or, with null, that nothing is.
 *
 * Idempotent on purpose: the watchers call this after every debounced edit
 * whether or not anything changed, and the same fault reported twice is
 * refreshed in place rather than sending the cat home and back again.
 */
export function reportFault(source: AlertSource, alert: MascotAlert | null) {
  if (!alert) {
    dismissed[source] = null;
    if (!pending[source]) return;
    pending[source] = null;
    publishAlert();
    return;
  }
  if (dismissed[source] === alert.key) return;
  pending[source] = alert;
  if (alertState.alert && alertState.alert.key === alert.key) {
    alertState = { alert, open: alertState.open };
    announce();
    return;
  }
  publishAlert();
}

/** "Got it." The cat goes home and this fault stays quiet until it changes. */
export function dismissAlert() {
  const current = alertState.alert;
  if (!current) return;
  dismissed[current.source] = current.key;
  pending[current.source] = null;
  publishAlert();
}

export function setAlertOpen(open: boolean) {
  if (!alertState.alert || alertState.open === open) return;
  alertState = { ...alertState, open };
  announce();
}

/** Everything off — leaving the page, or turning watching off. */
export function clearAlerts() {
  pending.circuit = null;
  pending.code = null;
  dismissed.circuit = null;
  dismissed.code = null;
  publishAlert();
}
