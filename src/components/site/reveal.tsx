"use client";

import { createElement, useCallback, type ReactNode } from "react";

/**
 * A container whose children rise into place the first time it is scrolled to.
 *
 * It renders the element the caller asks for, with the caller's classes and
 * nothing else — no extra wrapper. That matters more than it sounds: the two
 * places this is used are a `ul` inside a divided list and a run of spaced
 * sections, and slipping a `div` inside either would change the layout it is
 * decorating. Swap the tag for this and the DOM is the shape it already was.
 *
 * The work is one attribute. The observer marks the container, and CSS in
 * `globals.css` animates the direct children off that mark, staggered by an
 * index written onto each child once — so a list of eight rows costs one
 * observer, one attribute change and no per-item React state.
 *
 * All of it hangs off the ref callback, which React 19 lets return its own
 * cleanup. There is no ref object and no effect: the element arriving is the
 * only event this component cares about.
 *
 * It fires once and disconnects. A reveal that replayed every time you scrolled
 * back up would stop being an arrival and start being a flicker.
 */
export function Reveal({
  as = "div",
  className,
  step,
  children,
}: {
  as?: "div" | "ul" | "ol" | "dl" | "section";
  className?: string;
  /** Milliseconds between one child arriving and the next. */
  step?: number;
  children: ReactNode;
}) {
  const watch = useCallback((node: HTMLElement | null) => {
    if (!node) return;

    Array.from(node.children).forEach((child, i) => {
      (child as HTMLElement).style.setProperty("--i", String(i));
    });

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          node.dataset.reveal = "shown";
          observer.disconnect();
        }
      },
      // A margin off the bottom, so a row arrives once it is properly on the
      // page rather than the instant its first pixel clears the fold.
      { rootMargin: "0px 0px -12% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return createElement(
    as,
    {
      ref: watch,
      className,
      "data-reveal": "idle",
      style: step ? { "--reveal-step": `${step}ms` } : undefined,
    },
    children,
  );
}
