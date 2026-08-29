"use client";

import { Cpu, Loader2, MonitorSmartphone, ServerCog, WifiOff } from "lucide-react";

import type { BackendId, HealthResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Which simulator runs the shots.
 *
 * The browser engine is the default because it needs nothing installed. The
 * server engines are the real frameworks, and the picker greys out the ones the
 * API says are missing instead of failing at run time.
 */

export type Engine = "browser" | BackendId;

const SERVER_ENGINES: { id: BackendId; label: string }[] = [
  { id: "qiskit", label: "Qiskit" },
  { id: "cirq", label: "Cirq" },
  { id: "pennylane", label: "PennyLane" },
];

export function EnginePicker({
  engine,
  onChange,
  health,
  probing,
  disabled,
}: {
  engine: Engine;
  onChange: (engine: Engine) => void;
  health: HealthResponse | null;
  probing: boolean;
  disabled?: boolean;
}) {
  const offline = !probing && !health;

  return (
    <div
      className="flex max-w-full flex-wrap items-center gap-1 border border-edge p-1"
      role="group"
      aria-label="Simulation engine"
    >
      <span className="flex items-center gap-1.5 px-1.5 font-mono text-[11px] tracking-[0.12em] text-frost uppercase">
        {probing ? (
          <Loader2 className="size-3 animate-spin" />
        ) : offline ? (
          <WifiOff className="size-3 text-frost" />
        ) : (
          <ServerCog className="size-3 text-photon" />
        )}
        engine
      </span>

      <button
        type="button"
        onClick={() => onChange("browser")}
        aria-pressed={engine === "browser"}
        disabled={disabled}
        title="A statevector simulator running in this tab. No server needed."
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
          "disabled:cursor-not-allowed disabled:opacity-50",
          engine === "browser"
            ? "bg-photon/10 text-photon"
            : "text-frost hover:bg-strata hover:text-paper",
        )}
      >
        <MonitorSmartphone className="size-3" />
        browser
      </button>

      {SERVER_ENGINES.map(({ id, label }) => {
        const info = health?.backends?.[id];
        const ready = Boolean(info?.installed);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={engine === id}
            disabled={disabled || !ready}
            title={
              ready
                ? `Run the shots on the API with ${info?.version}.`
                : offline
                  ? "The QuantaVerse API is not answering. Start it with: uvicorn app.main:app --reload"
                  : `${label} is not installed on the API host.`
            }
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
              "disabled:cursor-not-allowed disabled:opacity-40",
              engine === id
                ? "bg-strata text-paper"
                : "text-frost hover:bg-strata hover:text-paper",
            )}
          >
            <Cpu className="size-3" />
            {label.toLowerCase()}
          </button>
        );
      })}
    </div>
  );
}
