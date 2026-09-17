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

import { ALGORITHM_BY_SLUG } from "@/lib/algorithms";
import { CHALLENGES, CHALLENGE_BY_SLUG } from "@/lib/challenges";

export interface Line {
  text: string;
  eyebrow: string;
  /** Typed into the tutor when the reader takes the offer. */
  ask?: string;
  /** Offer to walk the reader round the whole site. */
  tour?: boolean;
}

/** The standing invitation, so it is obvious the cat is a button. */
export const INVITE: Line = {
  text: "Stuck? Tap me and I'll read whatever is on your screen before I answer.",
  eyebrow: "your tutor",
  tour: true,
};

const GUIDE: Record<string, Line> = {
  "/": {
    text: "New here? I can show you round the whole site in about a minute — or start with the curriculum.",
    eyebrow: "where to start",
    ask: "What should I learn first?",
    tour: true,
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
  "/algorithms": {
    text: "Five algorithms that beat the classical way of doing it, each one actually running. Ask me which is worth your time first.",
    eyebrow: "the shelf",
    ask: "Which of these algorithms should I understand first?",
  },
  "/network": {
    text: "Mentors and peers, with what each of them works on. Ask me who to approach about a topic and I will tell you honestly which of them are examples.",
    eyebrow: "the hub",
    ask: "Who here could help me with quantum algorithms?",
  },
  /* True signed in or out. It said "your record" to every visitor, and a
     signed-out visitor is looking at a sample the page itself labels as a
     learner who does not exist — the cat should not contradict the page. */
  "/dashboard": {
    text: "Nothing here is self-reported: every figure is counted from circuits that passed, not lessons opened. Ask me what to practise next.",
    eyebrow: "the record",
    ask: "What should I practise next?",
  },
};

export function guideFor(path: string): Line | null {
  if (GUIDE[path]) return GUIDE[path];
  if (path.startsWith("/curriculum/")) {
    /* Two modules have no lab, so "every module ends with a circuit to
       finish" was untrue on exactly the pages where a learner would go
       looking for one. */
    const challenge = CHALLENGE_BY_SLUG[path.slice("/curriculum/".length)];
    return {
      text: challenge
        ? `Read it, then build it — this module ends with lab ${challenge.level} of ${CHALLENGES.length}, "${challenge.title}".`
        : "Read it, then check yourself — this module has no graded lab, so the checkpoint under each lesson is the test.",
      eyebrow: "module",
      ask: "Explain this module simply.",
    };
  }
  if (path.startsWith("/algorithms/")) {
    /* Named, because "this algorithm" is a worse offer than "Grover". The
       walkthrough replaces this the moment the reader steps, so the line only
       has to cover the frame before anything has happened. */
    const found = ALGORITHM_BY_SLUG[path.split("/")[2] ?? ""];
    if (found) {
      return {
        text: `${found.name}, in ${found.stages.length} stages. Play them through and tap me on whichever one stops making sense.`,
        eyebrow: "walkthrough",
        ask: `Explain ${found.name} to me simply, in plain language.`,
      };
    }
    return {
      text: "Every circuit here runs on the same simulator as the sandbox. Step through one and ask me about any gate in it.",
      eyebrow: "walkthrough",
      ask: "What is this algorithm doing?",
    };
  }
  if (path.startsWith("/sandbox/")) {
    /* Said per lab, because the two marking modes accept different things and
       the old line promised the lenient one everywhere — "a different route
       to the same state still passes" is exactly wrong on an algorithm lab. */
    const challenge = CHALLENGE_BY_SLUG[path.slice("/sandbox/".length)];
    if (challenge) {
      return {
        text:
          challenge.mode === "state"
            ? `Lab ${challenge.level} of ${CHALLENGES.length}, marked on the state you reach — any route there passes. I'll point out a mistake I can prove, and say when the board is right.`
            : `Lab ${challenge.level} of ${CHALLENGES.length}, marked on every input — landing on the answer from |0…0⟩ is not enough. I'll say when the board does the whole job.`,
        eyebrow: "graded lab",
        ask: `How should I approach the lab "${challenge.title}"?`,
      };
    }
  }
  return null;
}
