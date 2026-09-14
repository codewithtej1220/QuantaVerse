"use client";

/**
 * The tour: the cat walks a new visitor round the whole site.
 *
 * Every stop is a page and one thing on it, named by a `data-tour` attribute
 * rather than a class or a heading's text — a class is styling and gets
 * renamed, a heading gets reworded, and either would quietly send the cat to
 * nothing. An attribute exists to be found.
 *
 * The same flight that takes the cat to a faulty gate takes it to each stop, so
 * the tour costs no second animation system and cannot drift from the one
 * learners already see. It is a module record with a subscription, like
 * `mascot.ts`, because the stop is read by the stage in the root layout, by a
 * conductor that moves between routes, and by nothing that shares a React
 * parent with either.
 *
 * Kept short on purpose. Eleven stops at a sentence or two each is about a
 * minute, which is roughly how long anybody will follow a guided tour of
 * anything; the stops that did not earn their place were cut rather than
 * shortened into something vaguer.
 */

export interface TourStop {
  /** The page the stop lives on. */
  route: string;
  /** The `data-tour` name of the element the cat points at. */
  target: string;
  title: string;
  text: string;
  /**
   * Stand under the element rather than beside it. For a control in a row of
   * controls, where beside it is always on top of the next one.
   */
  under?: boolean;
}

export const TOUR: TourStop[] = [
  {
    route: "/",
    target: "home",
    title: "Welcome aboard",
    text: "Everything here runs a real quantum simulation in your browser. I'll show you each part of the site — press Next, or use the arrow keys.",
  },
  {
    route: "/curriculum",
    target: "curriculum-deck",
    title: "Your path",
    text: "Your level, your streak and the one module to do next — all counted from circuits you actually pass, not pages you open.",
  },
  {
    route: "/curriculum",
    target: "curriculum-modules",
    title: "Eight modules",
    text: "They run in order, from a single qubit to Shor's algorithm. Each one is lessons with a video, a quick checkpoint and a graded lab.",
  },
  {
    route: "/curriculum/qubit-and-superposition",
    target: "lesson",
    title: "Inside a lesson",
    text: "Watch the video, read the theory, then pass the short checkpoint underneath to tick the lesson off.",
  },
  {
    route: "/algorithms",
    target: "algorithms",
    title: "Famous algorithms",
    text: "Grover, teleportation and more, built one gate at a time with the code and the state beside every step.",
  },
  {
    route: "/sandbox",
    target: "sandbox-palette",
    title: "The sandbox",
    text: "Drag a gate onto a wire, or click a gate and then a slot. The simulation updates the moment you place it.",
  },
  {
    route: "/sandbox",
    target: "sandbox-watching",
    title: "I watch your work",
    text: "Leave Watching on and I'll fly straight to any mistake in your circuit or your code, and tell you what's wrong.",
    under: true,
  },
  {
    route: "/sandbox",
    target: "sandbox-code",
    title: "Code and circuit agree",
    text: "Edit the Qiskit and the board redraws itself. Build from code runs anything the board can't draw.",
  },
  {
    route: "/lab",
    target: "lab",
    title: "The lab",
    text: "Two qubits you can steer by hand, with every gauge and graded check reading the same state.",
  },
  {
    route: "/network",
    target: "hub",
    title: "The hub",
    text: "Find mentors and peers by what they work on, and ask for help with a sentence about where you're stuck.",
  },
  {
    route: "/dashboard",
    target: "dashboard",
    title: "Your record",
    text: "Badges, streaks and skills, all counted from real work. That's the whole site — tap me whenever you're stuck.",
  },
];

/* A reload mid-tour picks up where it was, so the key is per tab. */
const STORAGE = "quantaverse.tour";
/* Whether this browser has taken the tour or turned it down, so the standing
   offer can stop. */
const SEEN = "quantaverse.tour-seen";

let index: number | null = null;
let restored = false;
const listeners = new Set<() => void>();

function announce() {
  for (const notify of listeners) notify();
}

function restore() {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const raw = window.sessionStorage.getItem(STORAGE);
    const saved = raw === null ? Number.NaN : Number(raw);
    if (Number.isInteger(saved) && saved >= 0 && saved < TOUR.length)
      index = saved;
  } catch {
    /* Storage can be refused outright; the tour simply starts from nothing. */
  }
}

function persist() {
  try {
    if (index === null) window.sessionStorage.removeItem(STORAGE);
    else window.sessionStorage.setItem(STORAGE, String(index));
  } catch {
    /* Nothing to do: a tour that cannot survive a reload still works. */
  }
}

export function subscribeTour(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** The stop the tour is on, or null when there is no tour. */
export function tourIndex(): number | null {
  restore();
  return index;
}

export function startTour() {
  restore();
  index = 0;
  persist();
  announce();
}

export function nextStop() {
  if (index === null) return;
  if (index >= TOUR.length - 1) {
    endTour();
    return;
  }
  index += 1;
  persist();
  announce();
}

export function previousStop() {
  if (index === null || index === 0) return;
  index -= 1;
  persist();
  announce();
}

/**
 * Stop the tour wherever it is.
 *
 * Leaving early counts as having seen it. Somebody who closed the tour has
 * answered the offer, and repeating it on every page after that is nagging; the
 * home page's greeting still offers it, for anybody who wants it after all.
 */
export function endTour() {
  if (index === null) return;
  index = null;
  try {
    window.localStorage.setItem(SEEN, "1");
  } catch {
    /* A standing offer that keeps appearing is the only cost. */
  }
  persist();
  announce();
}

export function tourSeen() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SEEN) === "1";
  } catch {
    return false;
  }
}

export function stopElement(stop: TourStop): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(`[data-tour="${stop.target}"]`);
}

/**
 * Where a stop's element is on screen, measured tight to what is in it.
 *
 * A heading is a block element as wide as its column, so its box says nothing
 * about where the words end — and a cat parked "beside the heading" by that box
 * would be parked beside an empty stretch of page. A range over the contents
 * measures the words and the controls themselves.
 *
 * Clipped to the element's own box, though, because contents are not always
 * inside it. The gate palette keeps its drag image parked at left −9999px so the
 * browser can snapshot it mid-drag; measured unclipped, the palette was eleven
 * thousand pixels wide, the cat took it for a full-width section, and it flew
 * to the top corner of the page instead of to the palette.
 *
 * The stops name small things — a heading, a label, a row of buttons — rather
 * than whole sections, for the same reason a person pointing at a page points
 * at a word and not at the page: a section as wide as the window has no side
 * to stand beside, and wherever the cat goes instead, it is covering some of it.
 */
export function locateStop(stop: TourStop): DOMRect | null {
  const element = stopElement(stop);
  if (!element) return null;
  const box = element.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(element);
  const tight = range.getBoundingClientRect();

  const left = Math.max(tight.left, box.left);
  const right = Math.min(tight.right, box.right);
  const top = Math.max(tight.top, box.top);
  const bottom = Math.min(tight.bottom, box.bottom);
  if (tight.width > 0 && right > left && bottom > top) {
    return new DOMRect(left, top, right - left, bottom - top);
  }
  return box.width > 0 || box.height > 0 ? box : null;
}
