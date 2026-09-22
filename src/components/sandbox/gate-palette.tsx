"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import { GATES } from "@/lib/data";
import { releaseDrag, watchDrag } from "@/lib/mascot";
import { cn } from "@/lib/utils";
import { ContactShadow, SlabBody, TRAY_PERSPECTIVE } from "./circuit-3d";
import { GATE_MIME, MATERIAL, TONE } from "./tone";

/**
 * The gate palette.
 *
 * Two ways in, because drag-and-drop alone would lock out keyboard and touch
 * users: drag a card onto a wire, or click a card to arm it and then click a
 * slot. The armed state is visible, so the second mode never feels like a
 * hidden mechanic.
 *
 * The cards are cut from the same stock as the gates on the board, so a part
 * does not change what it is made of between the tray and the wire.
 *
 * Nothing here moves. An earlier version had the tray turning on the pointer
 * and every card leaning toward the cursor, rising to a hover and sinking under
 * a press — which was a pleasure to build and a distraction to work next to.
 * This is a tray of parts you are reaching into while thinking about a circuit,
 * and a tray that reacts to the cursor crossing it competes with the thought.
 * The depth stays, because that is what makes the cards read as parts; the
 * motion is gone. Arming a gate is now said in colour alone.
 */

/** How thick a tray card is. Thinner than a gate: it is a chip, not a block. */
const CARD_D = 20;

/**
 * The drag stand-in.
 *
 * Deliberately flat and deliberately plain: it is a picture of the gate in
 * transit, so it wants to read at a glance against whatever it is passing over,
 * and anything with depth on it would land us back where we started. Parked
 * off-screen rather than hidden — `display: none` has nothing to snapshot.
 */
const GHOST_SIZE = 56;
const GHOST = [
  "fixed top-0 left-[-9999px] z-[-1] grid place-items-center border bg-nebula",
  "font-mono text-lg font-semibold",
].join(" ");

export function GatePalette({
  armed,
  onArm,
}: {
  armed: string | null;
  onArm: (gateId: string | null) => void;
}) {
  /* The thing that follows the cursor during a drag.

     A browser makes its own drag image by snapshotting the dragged element,
     and it cannot snapshot these cards: they are 3D — a face translated on Z
     over a stack of slab layers inside a preserve-3d parent — and what comes
     back is blank. So the palette carries one flat stand-in off-screen, styled
     as the gate about to be dropped, and hands it over at dragstart. */
  const ghost = useRef<HTMLDivElement>(null);

  /* A drag that ends with the palette gone never fires `dragend`, and the
     listeners it left behind would keep the cat staring at a stale point. */
  useEffect(() => releaseDrag, []);

  /* One fixed angle for the tray, the same for everybody. It is what gives the
     cards a lit face and a visible edge; it is not something the pointer gets
     to change. */
  const TILT = "rotateX(6deg) rotateY(-3deg)";

  return (
    /* A container, not the viewport. This palette is used at three widths —
       a half-page column, the lab bench, and the full-screen bench — and
       viewport breakpoints got all three wrong at once: they put four cards
       across a thousand pixels in the takeover while packing eight into a
       narrow column. */
    /* `relative z-20` is what lets a reference card leave the palette.
       translateZ only sorts a card against the other cards in the tray, because
       depth is meaningless once you are outside the tray's own 3D context —
       and the card opens downward into the panel that holds the circuit, which
       is a later sibling and therefore painted over the whole palette. Lifting
       the palette is the only thing that puts a card in front of it. */
    <div className="@container relative z-20 w-full">
      <div className="flex items-baseline justify-between gap-3">
        <p data-tour="sandbox-palette" className="eyebrow">
          Gate palette
        </p>
        <p className="font-mono text-[11px] text-frost">
          {armed ? "click a slot to place" : "drag, or click to arm"}
        </p>
      </div>

      <div
        ref={ghost}
        aria-hidden
        className={GHOST}
        style={{ width: GHOST_SIZE, height: GHOST_SIZE }}
      />

      {/* The tray. No clipping on it: a card near the end is meant to overhang
          its own well, and the reference card has to be able to open past it. */}
      <div className="relative mt-3 rounded-xl bg-void px-6 py-7">
        <div
          style={{
            perspective: `${TRAY_PERSPECTIVE}px`,
            perspectiveOrigin: "50% 50%",
          }}
        >
          <div
            className="grid grid-cols-4 gap-3 transform-3d @2xl:grid-cols-8"
            style={{ transform: TILT }}
          >
            {GATES.map((gate) => {
              const tone = TONE[gate.tone];
              const material = MATERIAL[gate.tone];
              const isArmed = armed === gate.id;

              return (
                <div key={gate.id} className="group relative transform-3d">
                  <ContactShadow inset="-46% -30%" depth={1} />

                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(GATE_MIME, gate.id);
                      event.dataTransfer.setData("text/plain", gate.symbol);
                      event.dataTransfer.effectAllowed = "copy";

                      /* Dress the stand-in as this gate and hand it over. It is
                         written imperatively because the browser snapshots it
                         inside this very event — React would not have
                         re-rendered in time for a state change to land. */
                      const stand = ghost.current;
                      if (stand) {
                        stand.textContent =
                          gate.id === "cnot" ? "CX" : gate.symbol;
                        stand.className = cn(GHOST, tone.border, tone.text);
                        event.dataTransfer.setDragImage(
                          stand,
                          GHOST_SIZE / 2,
                          GHOST_SIZE / 2,
                        );
                      }

                      onArm(gate.id);
                      // Let the cat follow the gate across the board.
                      watchDrag();
                    }}
                    onDragEnd={() => {
                      onArm(null);
                      releaseDrag();
                    }}
                    onClick={() => onArm(isArmed ? null : gate.id)}
                    aria-pressed={isArmed}
                    aria-label={
                      gate.name.toLowerCase().includes("gate")
                        ? gate.name
                        : `${gate.name} gate`
                    }
                    /* One height, always. The card sits on the tray whether it
                       is armed or not — being armed is said by the fill, which
                       is unmissable and does not move anything. */
                    style={
                      { transform: `translateZ(${CARD_D}px)` } as CSSProperties
                    }
                    className={cn(
                      "relative flex w-full cursor-grab flex-col items-center gap-1 border py-3",
                      "transform-3d transition-colors duration-150 ease-out",
                      "active:cursor-grabbing",
                      "focus-visible:outline-2 focus-visible:outline-offset-4",
                      tone.border,
                      tone.ring,
                      isArmed ? tone.glow : "bg-nebula",
                    )}
                  >
                    <SlabBody depth={CARD_D} material={material} />

                    {/* The armed fill, painted over the slab rather than under
                        it. `bg-photon` on the button itself does nothing here:
                        SlabBody lays eight opaque layers across `inset-0`, so
                        the button's own background has never been visible. The
                        old card got away with it because being armed was said by
                        a 78px lift out of the tray; with the motion gone, the
                        colour has to actually reach the face. */}
                    {isArmed && (
                      <span
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute inset-0",
                          tone.glow,
                        )}
                      />
                    )}

                    <span
                      className={cn(
                        "font-mono text-lg leading-none font-semibold",
                        isArmed ? "text-void" : tone.text,
                      )}
                    >
                      {gate.id === "cnot" ? "CX" : gate.symbol}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[11px] tracking-[0.1em] uppercase",
                        isArmed ? "text-void" : "text-frost",
                      )}
                    >
                      {gate.arity === 2 ? "2Q" : "1Q"}
                    </span>
                  </button>

                  {/* Reference card: the matrix, because that is what the gate
                      is. It opens in front of the tray rather than on it, so a
                      raised neighbour cannot stand in front of the reading. */}
                  <div
                    className={cn(
                      "panel pointer-events-none absolute top-full left-1/2 z-50 mt-3 w-56 p-4",
                      "opacity-0 transition-opacity duration-150",
                      "group-hover:opacity-100 group-focus-within:opacity-100",
                    )}
                    style={{ transform: "translate(-50%, 0) translateZ(96px)" }}
                    role="tooltip"
                  >
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-medium text-paper">
                        {gate.name}
                      </span>
                      <span className={cn("font-mono text-[11px]", tone.text)}>
                        {gate.id === "cnot" ? "cx" : gate.id}
                      </span>
                    </p>
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <span className="text-lg leading-none text-frost">[</span>
                      <span className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11px] text-frost">
                        {gate.matrix.flat().map((cell, i) => (
                          <span key={i} className="text-center tabular-nums">
                            {cell}
                          </span>
                        ))}
                      </span>
                      <span className="text-lg leading-none text-frost">]</span>
                    </div>
                    <p className="mt-2.5 text-[11.5px] leading-snug text-frost">
                      {gate.blurb}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
