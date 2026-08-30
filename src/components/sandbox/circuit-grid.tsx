"use client";

import { useState, type CSSProperties } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import { GATE_BY_ID } from "@/lib/data";
import { useReducedMotion } from "@/lib/pointer";
import type { Placement } from "@/lib/quantum";
import { cn } from "@/lib/utils";
import {
  BlockBody,
  ContactShadow,
  ControlDome,
  GATE_D,
  GATE_W,
  GUTTER,
  PERSPECTIVE,
  ROW_H,
  TargetRing,
  useDeckTilt,
  Z,
} from "./circuit-3d";
import { GATE_MIME, MATERIAL, TONE } from "./tone";

/**
 * The circuit workspace.
 *
 * A real circuit diagram — wires run left to right, columns are time steps, and
 * the classical register is drawn as a double line at the bottom so measurement
 * has somewhere to go — built as a machined deck standing in front of the page
 * rather than printed on it. The wire plane recedes, the gates are solid blocks
 * sitting proud of it, and the whole board turns towards the cursor, so the
 * depth is something you can look around rather than something drawn on.
 *
 * The 3D changes nothing about how the thing is operated: slots are still
 * buttons, so the workspace still works from the keyboard with the arm-then-place
 * mode in the palette, and still takes a drop from a dragged gate. That is the
 * reason none of this is a canvas.
 */

type Role = "single" | "control" | "target";
type Cell = { placement: Placement; role: Role } | null;

/** Depth of the classical register below the front face of a gate. */
const DROP_BACK = Z.gate - Z.register;

export function CircuitGrid({
  qubits,
  columns,
  placements,
  armed,
  onPlace,
  onRemove,
  expanded = false,
  onToggleExpand,
}: {
  qubits: number;
  columns: number;
  placements: Placement[];
  armed: string | null;
  onPlace: (gateId: string, wire: number, column: number) => void;
  onRemove: (id: string) => void;
  /** Set while the board is filling the screen. */
  expanded?: boolean;
  /** Omit it and no takeover control is drawn: the board is simply inline. */
  onToggleExpand?: () => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  // Someone who asked for less motion gets the board held at a fixed angle: the
  // depth is the point and it survives being still, the cursor tracking is not.
  const reduced = useReducedMotion();
  const stage = useDeckTilt(!reduced);

  const grid: Cell[][] = Array.from({ length: qubits }, () => Array<Cell>(columns).fill(null));
  for (const p of placements) {
    if (p.column >= columns) continue;
    if (p.gate === "cnot" && p.wires.length === 2) {
      const [c, t] = p.wires;
      if (c < qubits) grid[c][p.column] = { placement: p, role: "control" };
      if (t < qubits) grid[t][p.column] = { placement: p, role: "target" };
    } else if (p.wires[0] < qubits) {
      grid[p.wires[0]][p.column] = { placement: p, role: "single" };
    }
  }

  const measuredColumns = placements.filter((p) => p.gate === "m").map((p) => p.column);
  const steps = Array.from({ length: columns }, (_, i) => i);

  /* The board leans back a little even at rest, so it reads as an object on a
     bench from the first frame, and swings eleven degrees either side of that as
     the pointer crosses it. Eleven is the ceiling: past it the near column of
     blocks is magnified enough to climb over the wire labels beside it. */
  const deck = reduced
    ? "rotateX(8deg) rotateY(-5deg)"
    : "rotateX(calc(8deg + var(--py) * -8deg)) rotateY(calc(var(--px) * 11deg))";

  return (
    <div
      ref={stage}
      className="relative overflow-hidden rounded-xl bg-void"
      style={{ "--px": "0", "--py": "0" } as CSSProperties}
    >
      {/* The takeover control, over the board rather than in a toolbar: it
          belongs to the circuit, and the circuit is used on two pages that frame
          it differently. Sitting on the stage, it travels with the thing it
          changes. */}
      {onToggleExpand && (
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-label={expanded ? "Close the circuit bench" : "Open the circuit bench"}
          className={cn(
            "absolute top-3 right-3 z-10 inline-flex items-center gap-2 border px-3 py-1.5",
            "font-mono text-[11px] tracking-[0.14em] uppercase transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
            expanded
              ? "border-edge bg-nebula text-frost hover:border-photon hover:text-photon"
              : "border-photon bg-photon/10 text-photon hover:bg-photon/20",
          )}
        >
          {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          {expanded ? "close" : "bench"}
        </button>
      )}

      {/* Generous padding: a block standing 76px off the deck needs somewhere to
          lean into, and this is the one element on the page that clips. */}
      <div className="overflow-x-auto px-8 py-12 sm:px-14">
        <div
          className="min-w-[660px]"
          style={{
            perspective: `${PERSPECTIVE}px`,
            // Moving the vanishing point with the pointer is the cue that sells
            // it: the board is not spinning in place, you are moving your head.
            perspectiveOrigin: reduced
              ? "50% 50%"
              : "calc(50% + var(--px) * 10%) calc(50% + var(--py) * 8%)",
          }}
        >
          <div className="relative transform-3d" style={{ transform: deck }}>
            {/* The plate: the board the wires are cut into and the step numbers
                are printed on, ending above the classical rail because the rail
                is not part of the quantum register.

                It carries a pool of light that follows the pointer, which is the
                only thing on the deck saying where the lamp is — and therefore
                the thing that makes the blocks look lit rather than pasted on. */}
            <span
              aria-hidden
              className="pointer-events-none absolute rounded-sm border border-edge"
              style={{
                top: -10,
                left: -22,
                right: -22,
                bottom: 44,
                transform: `translateZ(${Z.plate}px)`,
                background:
                  "radial-gradient(55% 75% at calc(50% + var(--px) * 26%) calc(50% + var(--py) * 26%), rgba(47,228,255,0.14), rgba(47,228,255,0) 68%), linear-gradient(180deg, #181818, #060606)",
              }}
            />

            {/* Time-step ruler, printed on the plate. */}
            <div className="flex transform-3d" style={{ paddingLeft: GUTTER }}>
              {steps.map((c) => (
                <span
                  key={c}
                  className="flex-1 pb-4 text-center font-mono text-[11px] tracking-[0.1em] text-dim"
                  style={{ transform: `translateZ(${Z.ruler}px)` }}
                >
                  {c + 1}
                </span>
              ))}
            </div>

            <div className="transform-3d">
              {grid.map((row, w) => (
                <div key={w} className="flex items-center transform-3d" style={{ height: ROW_H }}>
                  <div
                    className="shrink-0 pr-8 text-right"
                    style={{
                      width: GUTTER,
                      transform: `translateZ(${Z.label}px)`,
                    }}
                  >
                    <span className="block font-mono text-[11px] leading-tight text-frost">
                      q{w}
                    </span>
                    <span className="ket block text-[11px] leading-tight text-photon">|0⟩</span>
                  </div>

                  {row.map((cell, c) => {
                    const key = `${w}-${c}`;
                    const hovered = hover === key;
                    const gate = cell ? GATE_BY_ID[cell.placement.gate] : null;
                    const tone = gate ? TONE[gate.tone] : null;
                    const material = gate ? MATERIAL[gate.tone] : null;

                    /* A measured qubit sends its bit back and down into the
                       classical plane, so the drop line is a line in three
                       dimensions: it leaves the front of the block and lands
                       in the plane the register sits in, well behind it. */
                    const fall = (qubits - w - 0.5) * ROW_H + 14;
                    const dropAngle = (Math.atan2(DROP_BACK, fall) * 180) / Math.PI;

                    return (
                      <div
                        key={c}
                        className={cn(
                          "relative flex h-full flex-1 items-center justify-center transform-3d",
                          // Approaching a gate lifts it further out of the board
                          // and spreads its shadow, which is the whole grammar of
                          // "this is in front of the page" in two properties.
                          "hover:[--boost:34px] hover:[--shade:1.35]",
                          "focus-within:[--boost:34px] focus-within:[--shade:1.35]",
                        )}
                        style={{ "--lift": `${Z.gate}px` } as CSSProperties}
                      >
                        {/* The wire. */}
                        <span
                          aria-hidden
                          className="absolute inset-x-0 top-1/2 h-px bg-edge-hi"
                          style={{
                            transform: `translateY(-50%) translateZ(${Z.wire}px)`,
                          }}
                        />

                        {/* CNOT connector: a rod in the air between two blocks,
                            not a line on the board. */}
                        {cell?.role === "control" && (
                          <span
                            aria-hidden
                            className="absolute left-1/2 w-0.5 bg-photon"
                            style={{
                              transform: `translateX(-50%) translateZ(${Z.gate}px)`,
                              ...(cell.placement.wires[1] > cell.placement.wires[0]
                                ? {
                                    top: "50%",
                                    height:
                                      (cell.placement.wires[1] - cell.placement.wires[0]) * ROW_H,
                                  }
                                : {
                                    bottom: "50%",
                                    height:
                                      (cell.placement.wires[0] - cell.placement.wires[1]) * ROW_H,
                                  }),
                            }}
                          />
                        )}

                        {/* Measurement dropline into the classical register. */}
                        {gate?.id === "m" && (
                          <span
                            aria-hidden
                            className="absolute top-1/2 left-1/2 w-px bg-collapse"
                            style={{
                              height: Math.hypot(fall, DROP_BACK),
                              transformOrigin: "top center",
                              transform: `translateX(-50%) translateZ(${Z.gate}px) rotateX(${-dropAngle}deg)`,
                            }}
                          />
                        )}

                        {!cell && (
                          <button
                            type="button"
                            onDragOver={(event) => {
                              if (event.dataTransfer.types.includes(GATE_MIME)) {
                                event.preventDefault();
                                setHover(key);
                              }
                            }}
                            onDragLeave={() => setHover((h) => (h === key ? null : h))}
                            onDrop={(event) => {
                              event.preventDefault();
                              const id = event.dataTransfer.getData(GATE_MIME);
                              setHover(null);
                              if (id) onPlace(id, w, c);
                            }}
                            onClick={() => armed && onPlace(armed, w, c)}
                            aria-label={`Empty slot, qubit ${w}, step ${c + 1}`}
                            style={{
                              width: GATE_W,
                              height: GATE_W,
                              transform: `translateZ(${
                                hovered ? Z.slotArmed + 16 : armed ? Z.slotArmed : Z.slot
                              }px)`,
                              /* Arming a gate raises every socket to meet it, in
                                 a wave across the board rather than forty things
                                 jumping at once. */
                              transitionDelay: armed && !hovered ? `${c * 16 + w * 30}ms` : "0ms",
                            }}
                            className={cn(
                              "relative border duration-300 ease-out",
                              "transition-[transform,background-color,border-color]",
                              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                              hovered
                                ? "border-photon bg-photon/15"
                                : armed
                                  ? "border-dashed border-edge-hi bg-strata/70 hover:border-photon hover:bg-photon/10"
                                  : "border-transparent hover:border-edge-hi hover:bg-strata",
                            )}
                          />
                        )}

                        {cell && gate && tone && material && cell.role === "single" && (
                          <>
                            <ContactShadow />
                            <button
                              type="button"
                              onClick={() => onRemove(cell.placement.id)}
                              aria-label={`Remove ${gate.name} on qubit ${w}, step ${c + 1}`}
                              style={{
                                width: GATE_W,
                                height: GATE_W,
                                transform: "translateZ(calc(var(--lift) + var(--boost, 0px)))",
                              }}
                              className={cn(
                                "relative transform-3d transition-transform duration-300 ease-out",
                                // Offset far enough to clear the front face,
                                // which stands eleven pixels nearer than the
                                // plane the ring is drawn on.
                                "focus-visible:outline-2 focus-visible:outline-offset-4",
                                tone.ring,
                              )}
                            >
                              <span className="absolute inset-0 transform-3d animate-land">
                                <BlockBody material={material} />
                                <span
                                  className={cn(
                                    "absolute inset-0 grid place-items-center border bg-nebula",
                                    "font-mono text-lg font-semibold",
                                    tone.border,
                                    tone.text,
                                  )}
                                  style={{
                                    transform: `translateZ(${GATE_D / 2}px)`,
                                    backgroundImage:
                                      "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 60%)",
                                  }}
                                >
                                  {gate.symbol}
                                </span>
                              </span>
                            </button>
                          </>
                        )}

                        {cell && cell.role === "control" && (
                          <>
                            <ContactShadow width={22} />
                            <button
                              type="button"
                              onClick={() => onRemove(cell.placement.id)}
                              aria-label={`Remove CNOT control on qubit ${w}, step ${c + 1}`}
                              style={{
                                width: GATE_W,
                                height: GATE_W,
                                transform: "translateZ(calc(var(--lift) + var(--boost, 0px)))",
                              }}
                              className="relative transform-3d transition-transform duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-photon"
                            >
                              <span className="absolute inset-0 transform-3d animate-land">
                                <ControlDome />
                              </span>
                            </button>
                          </>
                        )}

                        {cell && cell.role === "target" && (
                          <>
                            <ContactShadow width={32} />
                            <button
                              type="button"
                              onClick={() => onRemove(cell.placement.id)}
                              aria-label={`Remove CNOT target on qubit ${w}, step ${c + 1}`}
                              style={{
                                width: GATE_W,
                                height: GATE_W,
                                transform: "translateZ(calc(var(--lift) + var(--boost, 0px)))",
                              }}
                              className="relative transform-3d transition-transform duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-photon"
                            >
                              <span className="absolute inset-0 transform-3d animate-land">
                                <TargetRing>
                                  <span className="relative block size-4">
                                    <span className="absolute top-1/2 left-0 h-px w-full bg-photon" />
                                    <span className="absolute top-0 left-1/2 h-full w-px bg-photon" />
                                  </span>
                                </TargetRing>
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Classical register: measurement has to land somewhere, and it
                lands in the plane furthest from the reader. */}
            <div
              className="flex items-start transform-3d"
              style={{ height: 34, transform: `translateZ(${Z.register}px)` }}
            >
              <div className="shrink-0 pt-2 pr-8 text-right" style={{ width: GUTTER }}>
                <span className="font-mono text-[11px] text-collapse">c{qubits}</span>
              </div>
              {steps.map((c) => (
                <div key={c} className="relative h-full flex-1">
                  <span className="absolute inset-x-0 top-3 h-px bg-edge-hi" />
                  <span className="absolute inset-x-0 top-[14px] h-px bg-edge-hi" />
                  {measuredColumns.includes(c) && (
                    <span className="absolute top-[7px] left-1/2 h-[14px] w-px -translate-x-1/2 bg-collapse" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
