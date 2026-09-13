"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { ANCHORS, hush, mascot, mascotOffer, moveTo, say, setPose, setVisible } from "@/lib/mascot";
import { guideFor, INVITE } from "@/lib/mascot-lines";

/**
 * Where the cat should be, given what the reader is doing.
 *
 * Mounted once beside the stage. It owns placement only — never the pose during
 * a conversation, because the tutor is mid-sentence and would fight it. Poses it
 * does set are the ambient ones: the resting float, and getting out of the way.
 *
 * The rule it encodes: the cat belongs at the edge of whatever you are reading.
 * On a long reading page it rides the side you are not reading toward and ducks
 * out entirely at the very top, where the page is making its own first
 * impression and does not need a mascot in front of it.
 */

/** Pages already greeted this session. */
const greeted = new Set<string>();

/** Poses something else owns. The director must not stomp on them.

    `flagging` is in here for the same reason the rest are: the sandbox has
    spotted a fault in the circuit in front of the reader and is pointing at it,
    and a standing invitation to ask a question is a strictly worse thing to
    have on screen than a specific remark about their own work. */
const BUSY = new Set(["thinking", "resolving", "working", "celebrating", "flagging"]);

export function MascotDirector() {
  const path = usePathname();

  /* It lives in one corner and stays visible. There is no scroll listener any
     more: the previous version moved the cat between edges as you read, which
     meant the one control on the page that answers questions was somewhere
     different every time you looked for it. */
  useEffect(() => {
    moveTo(ANCHORS.home);
    setVisible(true);
  }, [path]);

  /* The guide speaks on arrival, then falls back to a standing invitation.
     The fallback is the important half: an invitation that expires is one most
     readers never see, and the whole point is that tapping the cat is
     discoverable without anyone explaining it. */
  useEffect(() => {
    const line = guideFor(path);
    mascotOffer.ask = line?.ask ?? null;

    const timers: number[] = [];

    /* The page's own line is said once per session. Marked only once it has
       actually spoken: in development React runs effects twice, and claiming
       the page up front meant the first pass cancelled its own timer and the
       second found the page already claimed, so nothing was ever said. */
    if (line && !greeted.has(path)) {
      timers.push(
        window.setTimeout(() => {
          if (BUSY.has(mascot.pose)) return;
          greeted.add(path);
          say(line.text, { eyebrow: line.eyebrow, offer: Boolean(line.ask) });
        }, 1100),
      );
      timers.push(
        window.setTimeout(() => {
          if (BUSY.has(mascot.pose)) return;
          say(INVITE.text, { eyebrow: INVITE.eyebrow, offer: true });
        }, 11_000),
      );
    } else {
      timers.push(
        window.setTimeout(() => {
          if (BUSY.has(mascot.pose)) return;
          say(INVITE.text, { eyebrow: INVITE.eyebrow, offer: true });
        }, 1400),
      );
    }

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      hush();
    };
  }, [path]);

  /* Leaving a page cancels whatever the cat was mid-way through saying, so it
     does not arrive on the next route still holding the last one's pose. */
  useEffect(() => {
    return () => {
      if (BUSY.has(mascot.pose)) setPose("idle");
    };
  }, [path]);

  return null;
}
