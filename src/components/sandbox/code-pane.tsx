"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Check, Copy, Loader2, RotateCcw, Terminal } from "lucide-react";

import { cn } from "@/lib/utils";

const MonacoInner = dynamic(() => import("./monaco-inner"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <span className="font-mono text-[11px] tracking-[0.18em] text-frost/40 uppercase">
        loading editor
      </span>
    </div>
  ),
});

export interface BuildNote {
  text: string;
  failed: boolean;
  /** Anything the program printed. */
  stdout?: string;
}

/**
 * The Qiskit pane.
 *
 * Two ways to run it. As you type, a small parser in this tab recognises the
 * handful of calls the diagram can draw, so the grid follows immediately. Press
 * build from code and the file goes to the API, which executes it with the real
 * Qiskit — loops, functions, numpy — and returns the circuit it actually built.
 * The header says which direction is currently driving so the binding never
 * feels like magic.
 */
export function CodePane({
  code,
  onChange,
  onRegenerate,
  onBuild,
  edited,
  building,
  note,
  canBuild,
}: {
  code: string;
  onChange: (next: string) => void;
  onRegenerate: () => void;
  onBuild: () => void;
  edited: boolean;
  building: boolean;
  note: BuildNote | null;
  /** False when there is no API to run the code on. */
  canBuild: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="glass flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/8 px-4 py-2.5">
        <span className="flex items-center gap-2 rounded-md border border-photon/25 bg-photon/8 px-2.5 py-1 font-mono text-[11px] text-photon">
          circuit.py
        </span>
        <span
          className={cn(
            "font-mono text-[10px] tracking-[0.14em] uppercase",
            edited ? "text-collapse/80" : "text-frost/45",
          )}
        >
          {edited ? "edited · diagram follows the code" : "generated from the diagram"}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onBuild}
            disabled={building || !canBuild}
            title={canBuild ? undefined : "Running the file needs the QuantaVerse API"}
            className={cn(
              "flex items-center gap-1.5 rounded-md border border-photon/35 bg-photon/8 px-2.5 py-1.5",
              "font-mono text-[10.5px] tracking-[0.1em] text-photon uppercase transition-colors",
              "hover:bg-photon/16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
              "disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-frost/40",
            )}
          >
            {building ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Terminal className="size-3.5" />
            )}
            {building ? "running" : "build from code"}
          </button>

          {edited && (
            <button
              type="button"
              onClick={onRegenerate}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[10.5px] tracking-[0.1em] text-frost/70 uppercase transition-colors hover:bg-white/6 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
            >
              <RotateCcw className="size-3.5" />
              regenerate
            </button>
          )}
          <button
            type="button"
            onClick={copy}
            aria-label="Copy the circuit source"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[10.5px] tracking-[0.1em] text-frost/70 uppercase transition-colors hover:bg-white/6 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
          >
            {copied ? (
              <Check className="size-3.5 text-photon" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>

      <div className="min-h-[360px] flex-1 bg-[#05080f]">
        <MonacoInner value={code} onChange={onChange} />
      </div>

      {/* What the API made of the file, verbatim. */}
      {note && (
        <div
          className={cn(
            "border-t px-4 py-2.5",
            note.failed ? "border-collapse/25 bg-collapse/6" : "border-photon/20 bg-photon/5",
          )}
          role="status"
        >
          <p
            className={cn(
              "font-mono text-[10.5px] leading-relaxed",
              note.failed ? "text-collapse/90" : "text-photon/85",
            )}
          >
            {note.text}
          </p>
          {note.stdout && (
            <pre className="mt-2 max-h-24 overflow-auto border-l-2 border-white/12 pl-2.5 font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap text-frost/65">
              {note.stdout}
            </pre>
          )}
        </div>
      )}

      <p className="border-t border-white/8 px-4 py-2.5 font-mono text-[10.5px] leading-relaxed text-frost/45">
        Drawn as you type: <span className="text-frost/70">qc.h/x/y/z/s/t(q)</span> ·{" "}
        <span className="text-frost/70">qc.cx(c, t)</span> ·{" "}
        <span className="text-frost/70">qc.measure(...)</span>. Anything else — loops, functions,
        numpy — needs <span className="text-photon/70">build from code</span>.
      </p>
    </div>
  );
}
