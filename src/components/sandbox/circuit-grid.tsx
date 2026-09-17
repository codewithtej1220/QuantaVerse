"use client";

import { useState, type CSSProperties } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import { GATE_BY_ID } from "@/lib/data";
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
  flag = null,
  highlight = null,
  ghost,
  expanded = false,
  onToggleExpand,
}: {
  qubits: number;
  columns: number;
  placements: Placement[];
  armed: string | null;
  onPlace: (gateId: string, wire: number, column: number) => void;
  onRemove: (id: string) => void;
  /** The cell the tutor is currently taking issue with, if any. */
  flag?: { wire: number; column: number } | null;
  /**
   * Time steps to light up, for a walkthrough parked on them: one column, or an
   * inclusive range of them — a whole stage of an algorithm at once.
   */
  highlight?: number | readonly [number, number] | null;
  /**
   * Gates the circuit is heading towards but has not placed yet.
   *
   * A walkthrough builds its circuit up a step at a time, and a board that
   * simply grew would give the reader no idea how much was still coming. These
   * are drawn into the empty slots as dashed outlines: the shape of the
   * finished circuit is legible from the first step, and the difference between
   * a gate that is there and a gate that is coming is unmistakable.
   */
  ghost?: Placement[];
  /** Set while the board is filling the screen. */
  expanded?: boolean;
  /** Omit it and no takeover control is drawn: the board is simply inline. */
  onToggleExpand?: () => void;
}) {
  const [hover, setHover] = useState<string | null>(null);

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

  /* Same shape as `grid`, for the gates that have not arrived yet. */
  const ahead: Cell[][] = Array.from({ length: qubits }, () => Array<Cell>(columns).fill(null));
  for (const p of ghost ?? []) {
    if (p.column >= columns) continue;
    if (p.gate === "cnot" && p.wires.length === 2) {
      const [c, t] = p.wires;
      if (c < qubits) ahead[c][p.column] = { placement: p, role: "control" };
      if (t < qubits) ahead[t][p.column] = { placement: p, role: "target" };
    } else if (p.wires[0] < qubits) {
      ahead[p.wires[0]][p.column] = { placement: p, role: "single" };
    }
  }

  const measuredColumns = placements.filter((p) => p.gate === "m").map((p) => p.column);
  const steps = Array.from({ length: columns }, (_, i) => i);

  /* One angle, held, and only on one axis.

     It used to swing eleven degrees either side of a resting pose as the
     pointer crossed it. That is a fine thing to look at and a poor thing to
     work on — the board moves under the hand reaching for it — so it was
     fixed. But the resting pose it was fixed at still carried a five degree
     turn about Y, and that is the one rotation this particular object cannot
     afford. Rotating about Y puts one end of every wire nearer the camera than
     the other, and perspective then draws those wires as sloping lines. A
     circuit diagram *is* its horizontals: wires are the space axis and columns
     are the time axis, and a board whose wires run downhill reads as crooked
     rather than as deep.

     Rotating about X costs nothing in the same way, because a horizontal line
     stays horizontal however far you lean it away from you. So the lean stays
     and the turn goes: the plate recedes, the blocks still show a face and
     stand on their shadows, and every wire is level. */
  const DECK = "rotateX(6deg)";

  return (
    <div className="relative overflow-hidden rounded-xl bg-void">
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
          style={{
            /* Sized by the circuit rather than fixed at the sandbox's ten
               columns: the walkthroughs run longer than that, and a board
               whose columns shrink to fit draws gates that overlap their own
               neighbours. Below ten it holds the sandbox's width exactly, so
               nothing there moves. */
            minWidth: Math.max(660, columns * 66),
            perspective: `${PERSPECTIVE}px`,
            // Moving the vanishing point with the pointer is the cue that sells
            // it: the board is not spinning in place, you are moving your head.
            perspectiveOrigin: "50% 50%",
          }}
        >
          <div className="relative transform-3d" style={{ transform: DECK }}>
            {/* The plate: the board the wires are cut into and the step numbers
                are printed on, ending above the classical rail because the rail
                is not part of the quantum register.

                It carries a pool of light, which is the only thing on the deck
                saying where the lamp is — and therefore the thing that makes the
                blocks look lit rather than pasted on. The lamp is fixed above
                the middle of the board now rather than following the cursor,
                for the same reason the board itself no longer turns. */}
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
                  "radial-gradient(55% 75% at 50% 50%, rgba(47,228,255,0.14), rgba(47,228,255,0) 68%), linear-gradient(180deg, #181818, #060606)",
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
                    const coming = !cell ? ahead[w][c] : null;
                    const comingGate = coming ? GATE_BY_ID[coming.placement.gate] : null;
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
                        )}
                        style={{ "--lift": `${Z.gate}px` } as CSSProperties}
                      >
                        {/* The step a walkthrough is parked on. Drawn per
                            cell rather than as one tall band, because the board
                            is a 3D deck and a single element spanning the rows
                            would have to leave the cell's own transform to do
                            it. Behind the wire, so it reads as the column
                            being lit rather than as something laid over it. */}
                        {(typeof highlight === "number"
                          ? highlight === c
                          : highlight !== null &&
                            highlight !== undefined &&
                            c >= highlight[0] &&
                            c <= highlight[1]) && (
                          <span
                            aria-hidden
                            className="absolute inset-y-0 -left-px -right-px border-x border-photon/25 bg-photon/8"
                            style={{ transform: `translateZ(${Z.wire - 1}px)` }}
                          />
                        )}

                        {/* The wire. */}
                        <span
                          aria-hidden
                          className="absolute inset-x-0 top-1/2 h-px bg-edge-hi"
                          style={{
                            transform: `translateY(-50%) translateZ(${Z.wire}px)`,
                          }}
                        />

                        {/* Where the tutor is pointing.

                            The remark in the speech bubble names a wire and a
                            step, and a learner should not have to count columns
                            to find the cell it means. Amber because that is the
                            cat's own colour — the mark and the voice saying it
                            are visibly the same thing, and it is the one hue on
                            this board that no gate already uses. Sits above the
                            gate in Z so it rings a filled cell as readily as an
                            empty one, and takes no pointer events, so the slot
                            underneath is still a slot. */}
                        {flag && flag.wire === w && flag.column === c && (
                          <span
                            aria-hidden
                            /* What the cat flies to. The ring is already drawn
                               exactly on the faulty gate, so it is the one
                               element on the board that is, by definition,
                               where the fault is. */
                            data-mascot-target="circuit-fault"
                            className="pointer-events-none absolute grid place-items-center"
                            style={{
                              width: GATE_W + 12,
                              height: GATE_W + 12,
                              transform: `translateZ(${Z.gate + 2}px)`,
                            }}
                          >
                            <span className="absolute inset-0 rounded-[3px] border border-filament/55" />
                            <span className="animate-flag absolute inset-0 rounded-[3px] border border-filament" />
                          </span>
                        )}

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
                              "transition-[background-color,border-color]",
                              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                              hovered
                                ? "border-photon bg-photon/15"
                                : armed
                                  ? "border-dashed border-edge-hi bg-strata/70 hover:border-photon hover:bg-photon/10"
                                  : "border-transparent hover:border-edge-hi hover:bg-strata",
                            )}
                          />
                        )}

                        {/* A gate this circuit is going to place, but has not
                            yet. Dashed and unlit, so it reads as a plan rather
                            than as a component — and it takes no pointer
                            events, so the slot underneath is still a slot. */}
                        {comingGate && (
                          <span
                            aria-hidden
                            className={cn(
                              "pointer-events-none absolute grid place-items-center rounded-[3px]",
                              "border border-dashed border-edge-hi/70",
                            )}
                            style={{
                              width: GATE_W,
                              height: GATE_W,
                              transform: `translateZ(${Z.slot}px)`,
                            }}
                          >
                            <span className="font-mono text-[12px] text-dim/70">
                              {coming?.role === "control"
                                ? "●"
                                : coming?.role === "target"
                                  ? "⊕"
                                  : comingGate.symbol}
                            </span>
                          </span>
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
                                transform: "translateZ(var(--lift))",
                              }}
                              className={cn(
                                "relative transform-3d",
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
                                transform: "translateZ(var(--lift))",
                              }}
                              className="relative transform-3d focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-photon"
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
                                transform: "translateZ(var(--lift))",
                              }}
                              className="relative transform-3d focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-photon"
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
