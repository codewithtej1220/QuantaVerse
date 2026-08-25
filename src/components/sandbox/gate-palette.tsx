"use client";

import { GATES } from "@/lib/data";
import { cn } from "@/lib/utils";
import { GATE_MIME, TONE } from "./tone";

/**
 * The gate palette.
 *
 * Two ways in, because drag-and-drop alone would lock out keyboard and touch
 * users: drag a card onto a wire, or click a card to arm it and then click a
 * slot. The armed state is visible, so the second mode never feels like a
 * hidden mechanic.
 */
export function GatePalette({
  armed,
  onArm,
}: {
  armed: string | null;
  onArm: (gateId: string | null) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Gate palette</p>
        <p className="font-mono text-[10.5px] text-frost/50">
          {armed ? "click a slot to place" : "drag, or click to arm"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-4 xl:grid-cols-8">
        {GATES.map((gate) => {
          const tone = TONE[gate.tone];
          const isArmed = armed === gate.id;
          return (
            <div key={gate.id} className="group relative">
              <button
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(GATE_MIME, gate.id);
                  event.dataTransfer.setData("text/plain", gate.symbol);
                  event.dataTransfer.effectAllowed = "copy";
                  onArm(gate.id);
                }}
                onDragEnd={() => onArm(null)}
                onClick={() => onArm(isArmed ? null : gate.id)}
                aria-pressed={isArmed}
                aria-label={
                  gate.name.toLowerCase().includes("gate") ? gate.name : `${gate.name} gate`
                }
                className={cn(
                  "flex w-full cursor-grab flex-col items-center gap-1 rounded-lg border py-2.5",
                  "transition-[transform,box-shadow,background-color] duration-150 active:cursor-grabbing",
                  "focus-visible:outline-2 focus-visible:outline-offset-2",
                  tone.border,
                  tone.ring,
                  isArmed
                    ? cn(tone.bg, tone.glow, "-translate-y-0.5")
                    : "bg-[#0a1020] hover:-translate-y-0.5 hover:bg-white/4",
                )}
              >
                <span className={cn("font-mono text-base leading-none font-semibold", tone.text)}>
                  {gate.id === "cnot" ? "CX" : gate.symbol}
                </span>
                <span className="font-mono text-[9px] tracking-[0.1em] text-frost/50 uppercase">
                  {gate.arity === 2 ? "2q" : "1q"}
                </span>
              </button>

              {/* Reference card: the matrix, because that is what the gate is. */}
              <div
                className={cn(
                  "glass pointer-events-none absolute top-full left-1/2 z-30 mt-2 w-56 -translate-x-1/2 rounded-lg p-3",
                  "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100",
                )}
                role="tooltip"
              >
                <p className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-medium text-paper">{gate.name}</span>
                  <span className={cn("font-mono text-[11px]", tone.text)}>
                    {gate.id === "cnot" ? "cx" : gate.id}
                  </span>
                </p>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <span className="text-lg leading-none text-frost/40">[</span>
                  <span className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11px] text-frost/85">
                    {gate.matrix.flat().map((cell, i) => (
                      <span key={i} className="text-center tabular-nums">
                        {cell}
                      </span>
                    ))}
                  </span>
                  <span className="text-lg leading-none text-frost/40">]</span>
                </div>
                <p className="mt-2.5 text-[11.5px] leading-snug text-frost/65">{gate.blurb}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
