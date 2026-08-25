"use client";

import { useState } from "react";

import { GATE_BY_ID } from "@/lib/data";
import type { Placement } from "@/lib/quantum";
import { cn } from "@/lib/utils";
import { GATE_MIME, TONE } from "./tone";

/**
 * The circuit workspace.
 *
 * A real circuit diagram: wires run left to right, columns are time steps, and
 * the classical register is drawn as a double line at the bottom so measurement
 * has somewhere to go. Slots are buttons, so the whole workspace is operable
 * from the keyboard with the palette's arm-then-place mode.
 */

const ROW_H = 60;

type Role = "single" | "control" | "target";
type Cell = { placement: Placement; role: Role } | null;

export function CircuitGrid({
  qubits,
  columns,
  placements,
  armed,
  onPlace,
  onRemove,
}: {
  qubits: number;
  columns: number;
  placements: Placement[];
  armed: string | null;
  onPlace: (gateId: string, wire: number, column: number) => void;
  onRemove: (id: string) => void;
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

  const measuredColumns = placements.filter((p) => p.gate === "m").map((p) => p.column);
  const steps = Array.from({ length: columns }, (_, i) => i);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px] pb-1">
        {/* Time-step ruler. */}
        <div className="flex pl-[56px]">
          {steps.map((c) => (
            <span
              key={c}
              className="flex-1 pb-2 text-center font-mono text-[9px] tracking-[0.1em] text-frost/30"
            >
              {c + 1}
            </span>
          ))}
        </div>

        {grid.map((row, w) => (
          <div key={w} className="flex items-center" style={{ height: ROW_H }}>
            <div className="w-[56px] shrink-0 pr-3 text-right">
              <span className="block font-mono text-[11px] leading-tight text-frost/75">q{w}</span>
              <span className="ket block text-[11px] leading-tight text-photon/55">|0⟩</span>
            </div>

            {row.map((cell, c) => {
              const key = `${w}-${c}`;
              const hovered = hover === key;
              const gate = cell ? GATE_BY_ID[cell.placement.gate] : null;
              const tone = gate ? TONE[gate.tone] : null;

              return (
                <div key={c} className="relative flex h-full flex-1 items-center justify-center">
                  {/* The wire. */}
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#6f8bd8]/28" />

                  {/* CNOT connector, drawn from the control down to the target. */}
                  {cell?.role === "control" && (
                    <span
                      className="absolute left-1/2 z-0 w-px -translate-x-1/2 bg-photon/70"
                      style={
                        cell.placement.wires[1] > cell.placement.wires[0]
                          ? {
                              top: "50%",
                              height: (cell.placement.wires[1] - cell.placement.wires[0]) * ROW_H,
                            }
                          : {
                              bottom: "50%",
                              height: (cell.placement.wires[0] - cell.placement.wires[1]) * ROW_H,
                            }
                      }
                    />
                  )}

                  {/* Measurement dropline into the classical register. */}
                  {gate?.id === "m" && (
                    <span
                      className="absolute left-1/2 z-0 w-px -translate-x-1/2 bg-collapse/45"
                      style={{ top: "50%", height: (qubits - w - 0.5) * ROW_H + 14 }}
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
                      className={cn(
                        "relative z-10 size-9 rounded-[7px] border transition-colors duration-150",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                        hovered
                          ? "border-photon/80 bg-photon/15 shadow-[0_0_20px_-4px_rgba(56,232,255,0.9)]"
                          : armed
                            ? "border-dashed border-white/18 bg-white/2 hover:border-photon/60 hover:bg-photon/8"
                            : "border-transparent hover:border-white/12 hover:bg-white/4",
                      )}
                    />
                  )}

                  {cell && gate && tone && cell.role === "single" && (
                    <button
                      type="button"
                      onClick={() => onRemove(cell.placement.id)}
                      aria-label={`Remove ${gate.name} on qubit ${w}, step ${c + 1}`}
                      className={cn(
                        "relative z-10 grid size-9 place-items-center rounded-[7px] border bg-[#0a1020]",
                        "font-mono text-sm font-semibold transition-transform duration-150",
                        "hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2",
                        tone.border,
                        tone.text,
                        tone.ring,
                        tone.glow,
                      )}
                    >
                      {gate.symbol}
                    </button>
                  )}

                  {cell && cell.role === "control" && (
                    <button
                      type="button"
                      onClick={() => onRemove(cell.placement.id)}
                      aria-label={`Remove CNOT control on qubit ${w}, step ${c + 1}`}
                      className="relative z-10 grid size-9 place-items-center rounded-[7px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
                    >
                      <span className="size-3 rounded-full bg-photon shadow-[0_0_14px_3px_rgba(56,232,255,0.6)]" />
                    </button>
                  )}

                  {cell && cell.role === "target" && (
                    <button
                      type="button"
                      onClick={() => onRemove(cell.placement.id)}
                      aria-label={`Remove CNOT target on qubit ${w}, step ${c + 1}`}
                      className="relative z-10 grid size-9 place-items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
                    >
                      <span className="relative grid size-7 place-items-center rounded-full border border-photon/75 bg-[#0a1020]">
                        <span className="absolute h-4 w-px bg-photon" />
                        <span className="absolute h-px w-4 bg-photon" />
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Classical register: measurement has to land somewhere. */}
        <div className="flex items-start" style={{ height: 34 }}>
          <div className="w-[56px] shrink-0 pt-2 pr-3 text-right">
            <span className="font-mono text-[11px] text-collapse/75">c{qubits}</span>
          </div>
          {steps.map((c) => (
            <div key={c} className="relative h-full flex-1">
              <span className="absolute inset-x-0 top-3 h-px bg-collapse/30" />
              <span className="absolute inset-x-0 top-[14px] h-px bg-collapse/30" />
              {measuredColumns.includes(c) && (
                <span className="absolute top-[7px] left-1/2 h-[14px] w-px -translate-x-1/2 bg-collapse/70" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
