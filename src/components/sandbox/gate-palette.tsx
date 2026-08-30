"use client";

import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import { GATES } from "@/lib/data";
import { useReducedMotion } from "@/lib/pointer";
import { cn } from "@/lib/utils";
import { ContactShadow, SlabBody, TRAY_PERSPECTIVE, useDeckTilt } from "./circuit-3d";
import { GATE_MIME, MATERIAL, TONE } from "./tone";

/**
 * The gate palette.
 *
 * Two ways in, because drag-and-drop alone would lock out keyboard and touch
 * users: drag a card onto a wire, or click a card to arm it and then click a
 * slot. The armed state is visible, so the second mode never feels like a
 * hidden mechanic.
 *
 * The cards are cut from the same stock as the gates on the board, and the tray
 * turns on the same pointer. That continuity is the point: you pick a part up
 * out of a tray of parts and set it down on a board, and at no stage does the
 * thing in your hand change what it is made of.
 *
 * A card also answers to the pointer on its own — it leans towards wherever on
 * its face the cursor is, rises to meet a hover, and sinks under a press. All
 * of that is CSS reading two custom properties, so none of it re-renders React
 * while the pointer is moving.
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
  const reduced = useReducedMotion();
  const tray = useDeckTilt(!reduced);

  /* Only one card can be under the pointer at a time, so one cached rectangle
     serves all eight — and caching it on the way in keeps the move handler,
     which fires on every pointer event, off the layout entirely. */
  const face = useRef<DOMRect | null>(null);

  /* The thing that follows the cursor during a drag.

     A browser makes its own drag image by snapshotting the dragged element,
     and it cannot snapshot these cards: they are 3D — a face translated on Z
     over a stack of slab layers inside a preserve-3d parent — and what comes
     back is blank. So the palette carries one flat stand-in off-screen, styled
     as the gate about to be dropped, and hands it over at dragstart. */
  const ghost = useRef<HTMLDivElement>(null);

  const grip = (event: ReactPointerEvent<HTMLElement>) => {
    face.current = event.currentTarget.getBoundingClientRect();
  };

  const lean = (event: ReactPointerEvent<HTMLElement>) => {
    const box = face.current;
    if (!box) return;
    const card = event.currentTarget;
    card.style.setProperty("--cx", (((event.clientX - box.left) / box.width) * 2 - 1).toFixed(3));
    card.style.setProperty("--cy", (((event.clientY - box.top) / box.height) * 2 - 1).toFixed(3));
  };

  const level = (event: ReactPointerEvent<HTMLElement>) => {
    face.current = null;
    event.currentTarget.style.setProperty("--cx", "0");
    event.currentTarget.style.setProperty("--cy", "0");
  };

  const tilt = reduced
    ? "rotateX(6deg) rotateY(-3deg)"
    : "rotateX(calc(6deg + var(--py) * -5deg)) rotateY(calc(var(--px) * 7deg))";

  return (
    /* A container, not the viewport. This palette is used at three widths —
       a half-page column, the lab bench, and the full-screen bench — and
       viewport breakpoints got all three wrong at once: they put four cards
       across a thousand pixels in the takeover while packing eight into a
       narrow column. */
    <div className="@container w-full">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Gate palette</p>
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
      <div
        ref={tray}
        className="relative mt-3 rounded-xl bg-void px-6 py-7"
        style={{ "--px": "0", "--py": "0" } as CSSProperties}
      >
        <div
          style={{
            perspective: `${TRAY_PERSPECTIVE}px`,
            perspectiveOrigin: reduced
              ? "50% 50%"
              : "calc(50% + var(--px) * 8%) calc(50% + var(--py) * 8%)",
          }}
        >
          <div
            className="grid grid-cols-4 gap-3 transform-3d @2xl:grid-cols-8"
            style={{ transform: tilt }}
          >
            {GATES.map((gate) => {
              const tone = TONE[gate.tone];
              const material = MATERIAL[gate.tone];
              const isArmed = armed === gate.id;

              return (
                <div
                  key={gate.id}
                  className="group relative transform-3d hover:[--shade:1.4] focus-within:[--shade:1.4]"
                >
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
                        stand.textContent = gate.id === "cnot" ? "CX" : gate.symbol;
                        stand.className = cn(GHOST, tone.border, tone.text);
                        event.dataTransfer.setDragImage(stand, GHOST_SIZE / 2, GHOST_SIZE / 2);
                      }

                      onArm(gate.id);
                    }}
                    onDragEnd={() => onArm(null)}
                    onClick={() => onArm(isArmed ? null : gate.id)}
                    onPointerEnter={reduced ? undefined : grip}
                    onPointerMove={reduced ? undefined : lean}
                    onPointerLeave={reduced ? undefined : level}
                    aria-pressed={isArmed}
                    aria-label={
                      gate.name.toLowerCase().includes("gate") ? gate.name : `${gate.name} gate`
                    }
                    style={
                      {
                        /* At rest the card sits on the tray — its back face is
                           the tray surface. Armed, it is out of the tray and in
                           your hand, which is why it stays up there until you
                           spend it on a slot. */
                        "--lift": isArmed ? "78px" : `${CARD_D}px`,
                        transform:
                          "translateZ(calc(var(--lift) + var(--boost, 0px)))" +
                          " rotateY(calc(var(--cx, 0) * 11deg))" +
                          " rotateX(calc(var(--cy, 0) * -11deg))",
                      } as CSSProperties
                    }
                    className={cn(
                      "relative flex w-full cursor-grab flex-col items-center gap-1 border py-3",
                      "transform-3d transition-transform duration-150 ease-out",
                      "active:cursor-grabbing",
                      // Rises to a hover, sinks under a press. The press has to
                      // come after the hover here, or it never gets a chance to
                      // win — you are always hovering a control you are pressing.
                      "hover:[--boost:28px] focus-visible:[--boost:28px]",
                      "active:[--boost:-14px]",
                      "focus-visible:outline-2 focus-visible:outline-offset-4",
                      tone.border,
                      tone.ring,
                      isArmed ? tone.glow : "bg-nebula",
                    )}
                  >
                    <SlabBody depth={CARD_D} material={material} />

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
                      {gate.arity === 2 ? "2q" : "1q"}
                    </span>
                  </button>

                  {/* Reference card: the matrix, because that is what the gate
                      is. It opens in front of the tray rather than on it, so a
                      raised neighbour cannot stand in front of the reading. */}
                  <div
                    className={cn(
                      "panel pointer-events-none absolute top-full left-1/2 mt-3 w-56 p-4",
                      "opacity-0 transition-opacity duration-150",
                      "group-hover:opacity-100 group-focus-within:opacity-100",
                    )}
                    style={{ transform: "translate(-50%, 0) translateZ(96px)" }}
                    role="tooltip"
                  >
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-medium text-paper">{gate.name}</span>
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
                    <p className="mt-2.5 text-[11.5px] leading-snug text-frost">{gate.blurb}</p>
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
