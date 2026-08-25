"use client";

import { useEffect, useState } from "react";
import { MousePointer2 } from "lucide-react";

import { formatRadians, getReadout, subscribeReadout, type BlochReadout } from "@/lib/bloch-store";
import { cn } from "@/lib/utils";

/**
 * The instrument panel for the hero's sphere.
 *
 * It exists so the 3D reads as an instrument rather than an ornament: the
 * visitor can see that their cursor is preparing a real state, written in the
 * notation they are about to learn.
 */
export function StateReadout({ className }: { className?: string }) {
  const [state, setState] = useState<BlochReadout>(getReadout);

  useEffect(() => subscribeReadout(setState), []);

  const a0 = Math.cos(state.theta / 2);
  const a1 = Math.sin(state.theta / 2);
  const p0 = state.p0 * 100;
  const p1 = 100 - p0;

  return (
    <div className={cn("glass w-full max-w-md rounded-xl p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">Live state · q0</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-photon/85 uppercase">
          <span className="size-1.5 animate-breathe rounded-full bg-photon" />
          Coherent
        </span>
      </div>

      {/* The state written the way the curriculum writes it. */}
      <p className="math mt-3 text-[1.15rem] leading-tight text-paper tabular-nums">
        <span className="text-frost/60">|ψ⟩ =</span> {a0.toFixed(2)}
        <span className="text-photon">|0⟩</span>
        <span className="text-frost/60"> + </span>
        {a1.toFixed(2)}
        <span className="text-frost/45 italic">
          e<sup className="text-[0.62em]">i{formatRadians(state.phi)}</sup>
        </span>
        <span className="text-phase">|1⟩</span>
      </p>

      <div className="mt-4 grid gap-2.5">
        {[
          { label: "P(|0⟩)", value: p0, tone: "bg-photon", text: "text-photon" },
          { label: "P(|1⟩)", value: p1, tone: "bg-phase", text: "text-phase" },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className={cn("ket w-14 shrink-0 text-[13px]", row.text)}>{row.label}</span>
            <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#101835]">
              <span
                className={cn("absolute inset-y-0 left-0 rounded-full", row.tone)}
                style={{ width: `${row.value}%` }}
              />
            </span>
            <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-frost/85">
              {row.value.toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-white/8 pt-3 font-mono text-[11px] text-frost/60">
        <span>
          θ <span className="text-paper/85 tabular-nums">{formatRadians(state.theta)}</span>
        </span>
        <span>
          φ <span className="text-paper/85 tabular-nums">{formatRadians(state.phi)}</span>
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-photon/70">
          <MousePointer2 className="size-3" />
          Move to prepare · click to measure
        </span>
      </div>
    </div>
  );
}
