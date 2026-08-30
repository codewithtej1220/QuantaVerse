"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The circuit, given the whole screen.
 *
 * The board is a wide instrument — ten time steps and a label gutter want about
 * seven hundred and seventy pixels — and on the sandbox it lives in a column
 * roughly five hundred across, so it scrolls sideways to show half of itself.
 * No amount of spacing fixes that. This is the one place the deck gets the room
 * it was drawn for, and it is also where building by dragging stops being
 * fiddly, because the drop targets are finally full size and all on screen at
 * once.
 *
 * It renders through a portal onto the body rather than in place. Every page
 * wrapper on this site clips its own horizontal overflow, and a fixed layer
 * underneath one of those is asking to be clipped by it. Going through the body
 * remounts the children, which costs nothing here: the circuit itself lives in
 * the studio above, so the placements, the armed gate and the generated code all
 * survive the trip in both directions.
 */
export function Bench({
  expanded,
  onExit,
  children,
}: {
  expanded: boolean;
  onExit: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!expanded) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit();
    };
    document.addEventListener("keydown", onKey);

    // The page behind must not scroll under the overlay.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [expanded, onExit]);

  if (!expanded) return <>{children}</>;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Circuit bench"
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-void p-5 lg:p-8"
    >
      <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="eyebrow">Circuit bench</p>
        <p className="font-mono text-[11px] text-frost">
          drag a gate onto a wire, or click one to arm it
          <span className="mx-2 text-dim">·</span>
          <kbd className="border border-edge px-1.5 py-0.5 text-[10.5px] text-frost">esc</kbd> to
          close
        </p>
      </div>

      {/* `my-auto` rather than `justify-center`: it centres the bench in
          whatever room is left over and collapses to nothing when there is
          none, where centring a taller-than-screen column would push its top
          out of reach above the scroll. */}
      <div className="my-auto flex w-full flex-col gap-5 py-6">{children}</div>
    </div>,
    document.body,
  );
}
