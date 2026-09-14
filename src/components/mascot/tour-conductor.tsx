"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";

import { mascotPresent, subscribeMascotRoom } from "@/lib/mascot";
import { prefersReducedMotion } from "@/lib/pointer";
import {
  TOUR,
  endTour,
  locateStop,
  nextStop,
  previousStop,
  stopElement,
  subscribeTour,
  tourIndex,
} from "@/lib/tour";

/**
 * Moves the reader between the tour's pages, and brings each stop into view.
 *
 * The stage decides where the cat sits; this decides what is on screen for it
 * to sit beside. Two jobs, kept apart because they run on different clocks: the
 * stage measures every frame, while this acts once per stop — navigate if the
 * stop is on another page, wait for its element to render, then scroll to it.
 *
 * The wait is a poll rather than a mutation observer. A route can take a second
 * to compile in development and a moment to hydrate in production, and "keep
 * looking every tenth of a second for a few seconds" handles both without
 * knowing anything about either.
 */
export function TourConductor() {
  const saved = useSyncExternalStore(subscribeTour, tourIndex, () => null);
  /* The tour is the cat's, and there is no cat on a phone. A tour left running
     in a window since narrowed past that would otherwise go on navigating from
     page to page, and taking the arrow keys, with nothing on screen to say why.
     It is paused rather than ended, and carries on if the window widens again. */
  const present = useSyncExternalStore(
    subscribeMascotRoom,
    mascotPresent,
    () => false,
  );
  const index = present ? saved : null;
  const path = usePathname();
  const router = useRouter();
  const stop = index === null ? null : TOUR[index];

  /* The stop whose page has been reached. Going to a stop's page is the tour's
     doing; leaving it afterwards, by a link or the back button, is the
     reader's — and a tour that answered that by dragging them back to where it
     wanted them would be a tour nobody could get out of except by finding the
     close button. Leaving ends it instead. */
  const reached = useRef<number | null>(null);

  useEffect(() => {
    if (index === null || !stop) {
      reached.current = null;
      return;
    }
    if (path === stop.route) {
      reached.current = index;
      return;
    }
    if (reached.current === index) {
      endTour();
      return;
    }
    router.push(stop.route);
  }, [index, stop, path, router]);

  useEffect(() => {
    if (!stop || path !== stop.route) return;
    let cancelled = false;
    let tries = 0;

    const bring = () => {
      if (cancelled) return;
      const element = stopElement(stop);
      if (!element) {
        tries += 1;
        if (tries < 80) window.setTimeout(bring, 100);
        return;
      }
      /* Centred when it fits and has room beside it for the cat, and pinned
         under the nav otherwise. A tall section centred would put its middle
         on screen and its top, which is what the cat is pointing at, far above
         it; and a wide one centred leaves too little window under it for the
         cat and its cloud, which is where the cat goes when there is no beside.

         Measured the way the stage measures it — tight to what is in it — so
         the two agree about whether there is room beside it. A row of filter
         buttons is a full-width box with a few words in it. */
      const rect = locateStop(stop) ?? element.getBoundingClientRect();
      const width = document.documentElement.clientWidth || window.innerWidth;
      const fits =
        !stop.under &&
        rect.height < window.innerHeight * 0.55 &&
        rect.width < width - 280;
      const top = fits
        ? window.scrollY + rect.top - (window.innerHeight - rect.height) / 2
        : window.scrollY + rect.top - 120;
      window.scrollTo({
        top: Math.max(0, top),
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });

      /* Some stops render twice: the curriculum deck is a "reading your
         record" line until the record arrives, and the page moves when it
         does. A look again shortly after catches the element being replaced
         and brings the one that stayed. */
      window.setTimeout(() => {
        if (!cancelled && stopElement(stop) !== element) bring();
      }, 900);
    };

    bring();
    return () => {
      cancelled = true;
    };
  }, [stop, path]);

  /* Arrows to move, Escape to leave — unless the reader is typing, in which
     case the keys belong to what they are typing in. */
  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
          target.closest(".monaco-editor"))
      ) {
        return;
      }
      if (event.key === "ArrowRight") nextStop();
      else if (event.key === "ArrowLeft") previousStop();
      else if (event.key === "Escape") endTour();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index]);

  return null;
}
