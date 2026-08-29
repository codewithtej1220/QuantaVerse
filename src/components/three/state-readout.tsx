"use client";

import { useEffect, useState } from "react";

import { formatRadians, getReadout, subscribeReadout, type BlochReadout } from "@/lib/bloch-store";
import { useGlobalPointer } from "@/lib/pointer";
import { useQubitDrive } from "@/lib/qubit-drive";
import { cn } from "@/lib/utils";

/**
 * The instrument panel for the hero's qubit.
 *
 * It exists so the 3D reads as an instrument rather than an ornament: the
 * visitor can see that their cursor is preparing a real state, written in the
 * notation they are about to learn. Every number on it is derived from the same
 * θ and φ the object is posed with, so there is nothing here to fake.
 */
export function StateReadout({ className }: { className?: string }) {
  const [state, setState] = useState<BlochReadout>(getReadout);

  // The panel runs the physics it displays, so "Live state" is true even on a
  // machine where WebGL never starts.
  useGlobalPointer();
  useQubitDrive();
  useEffect(() => subscribeReadout(setState), []);

  const a0 = Math.cos(state.theta / 2);
  const a1 = Math.sin(state.theta / 2);
  const p0 = state.p0 * 100;
  const p1 = 100 - p0;

  return (
    <div className={cn("panel w-full p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">Live state · q0</span>
        <span className="inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.14em] text-photon uppercase">
          <span className="size-1.5 animate-breathe bg-photon" />
          Coherent
        </span>
      </div>

      {/* The state written the way the curriculum writes it. */}
      <p className="math mt-4 text-[1.25rem] leading-tight text-paper tabular-nums">
        <span className="text-dim">|ψ⟩ =</span> {a0.toFixed(2)}
        <span className="text-photon">|0⟩</span>
        <span className="text-dim"> + </span>
        {a1.toFixed(2)}
        <span className="text-frost">
          e<sup className="text-[0.62em]">i{formatRadians(state.phi)}</sup>
        </span>
        <span className="text-paper">|1⟩</span>
      </p>

      <div className="mt-5 grid gap-3">
        {[
          { label: "P(|0⟩)", value: p0, tone: "bg-photon", text: "text-photon" },
          { label: "P(|1⟩)", value: p1, tone: "bg-paper", text: "text-paper" },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className={cn("ket w-16 shrink-0 text-[14px]", row.text)}>{row.label}</span>
            <span className="relative h-2 flex-1 overflow-hidden bg-strata">
              <span
                className={cn("absolute inset-y-0 left-0", row.tone)}
                style={{ width: `${row.value}%` }}
              />
            </span>
            <span className="w-14 shrink-0 text-right font-mono text-[13px] text-paper tabular-nums">
              {row.value.toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-edge pt-4 font-mono text-[12px] text-frost">
        <span>
          θ <span className="text-paper tabular-nums">{formatRadians(state.theta)}</span>
        </span>
        <span>
          φ <span className="text-paper tabular-nums">{formatRadians(state.phi)}</span>
        </span>
        <span className="ml-auto tracking-[0.12em] text-dim uppercase">
          Move to prepare
        </span>
      </div>
    </div>
  );
}
