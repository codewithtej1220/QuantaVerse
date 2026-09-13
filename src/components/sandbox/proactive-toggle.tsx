"use client";

import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Whether the cat is allowed to speak first.
 *
 * On, it reads the board after every edit and says something when the circuit
 * has a fault that can be proved by looking at it — a gate stranded after a
 * measurement, a CNOT whose control is still |0⟩, a pair of Hadamards
 * cancelling each other out. Off, it answers only when asked.
 *
 * The control says which of those two it is doing rather than reading "on" and
 * "off", because the thing being switched is whether something interrupts you,
 * and that deserves a plainer label than a state word.
 */
export function ProactiveToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      title={
        on
          ? "The tutor speaks up when it spots a fault. Click to silence it."
          : "The tutor stays quiet until asked. Click to let it speak up."
      }
      className={cn(
        "group inline-flex h-9 items-center gap-2 rounded-lg border px-2.5 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
        on
          ? "border-filament/50 bg-filament/10 text-filament"
          : "border-edge text-frost hover:border-edge-hi hover:text-paper",
      )}
    >
      {on ? (
        <Eye className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <EyeOff className="size-3.5 shrink-0" aria-hidden />
      )}

      <span className="font-mono text-[11px] tracking-[0.12em] whitespace-nowrap uppercase">
        watching
      </span>

      {/* A real track, so the state is readable without parsing the label. */}
      <span
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          on ? "bg-filament/35" : "bg-edge",
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 550, damping: 32 }}
          className={cn(
            "absolute top-0.5 size-3 rounded-full",
            on ? "right-0.5 bg-filament" : "left-0.5 bg-frost",
          )}
        />
      </span>
    </button>
  );
}
