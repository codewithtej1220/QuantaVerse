"use client";

/**
 * What the cat says, and what it offers to do about it.
 *
 * It is the tutor with a face on, so its lines are the tutor's job rather than
 * chatter: where you are, what this page is for, and the one question worth
 * asking here — which it will carry into the panel for you when tapped.
 *
 * The guide's rule is that every line points somewhere. A mascot that says
 * "hello!" is decoration. One that says "you are two gates from a Bell pair,
 * ask me why" is the thing people actually keep around.
 */

export interface Line {
  text: string;
  eyebrow: string;
  /** Typed into the tutor when the reader takes the offer. */
  ask?: string;
}

/** The standing invitation, so it is obvious the cat is a button. */
export const INVITE: Line = {
  text: "Stuck? Tap me and I'll read whatever is on your screen before I answer.",
  eyebrow: "your tutor",
};

const GUIDE: Record<string, Line> = {
  "/": {
    text: "New here? Start with the curriculum — eight modules, and the first needs no maths beyond a coin flip.",
    eyebrow: "where to start",
    ask: "What should I learn first?",
  },
  "/curriculum": {
    text: "Eight modules, indexed like a three-qubit register. The locks are a suggested order, not a paywall — you can open any of them.",
    eyebrow: "the map",
    ask: "Which module should I do next?",
  },
  "/sandbox": {
    text: "Drag a gate onto a wire and the statevector updates for real. Two gates gets you an entangled pair.",
    eyebrow: "the workbench",
    ask: "What does my circuit do?",
  },
  "/lab": {
    text: "Everything here reads one statevector — the gyroscopes, the graded checks and the telemetry cannot disagree.",
    eyebrow: "the lab",
    ask: "Are my two qubits entangled?",
  },
  "/dashboard": {
    text: "These numbers come from circuits that passed, not lessons you opened. Ask me what to practise.",
    eyebrow: "your record",
    ask: "What should I practise next?",
  },
};

export function guideFor(path: string): Line | null {
  if (GUIDE[path]) return GUIDE[path];
  if (path.startsWith("/curriculum/")) {
    return {
      text: "Read it, then build it — every module ends with a circuit to finish.",
      eyebrow: "module",
      ask: "Explain this module simply.",
    };
  }
  if (path.startsWith("/sandbox/")) {
    return {
      text: "This one is graded. It compares the amplitudes you produced, so a different route to the same state still passes.",
      eyebrow: "graded lab",
      ask: "How do I build this circuit?",
    };
  }
  return null;
}
