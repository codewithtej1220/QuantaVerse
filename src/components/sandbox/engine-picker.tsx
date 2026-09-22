"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, WifiOff } from "lucide-react";

import type { BackendId, HealthResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Which simulator samples the shots.
 *
 * This used to be four small buttons in a row, which cost a third of the
 * toolbar and said nothing: the labels were four lowercase words, and what each
 * engine actually *is* — whose framework, which version, whether it is even
 * installed on the host — lived in a `title` attribute nobody hovers. On a page
 * whose job is teaching, a control that hides the interesting part is the wrong
 * control.
 *
 * So it is one button naming what is loaded, opening a panel that gives each
 * engine a row worth reading: who makes it, what it is for, the exact version
 * answering right now, and how long it took the last time you ran on it. That
 * last column is the reason this is more than a dropdown — after two runs the
 * panel is showing measurements from this session, so "which engine" stops
 * being an arbitrary pick and becomes something the learner has evidence about.
 *
 * The browser engine is always first and always available: it needs no server,
 * and it is what draws the exact bars no matter which engine is loaded.
 */

export type Engine = "browser" | BackendId;

interface Spec {
  id: Engine;
  label: string;
  /** Whose it is. Shown small, beside the name. */
  maker: string;
  blurb: string;
}

const ENGINES: Spec[] = [
  {
    id: "browser",
    label: "Browser",
    maker: "this tab",
    blurb:
      "A statevector simulator written for this site. Needs no server, and it draws the exact bars whichever engine is loaded.",
  },
  {
    id: "qiskit",
    label: "Qiskit",
    maker: "IBM",
    blurb: "Sampled by Aer — the simulator IBM ships with the SDK their hardware runs on.",
  },
  {
    id: "cirq",
    label: "Cirq",
    maker: "Google",
    blurb: "Builds a circuit as moments scheduled against a named device.",
  },
  {
    id: "pennylane",
    label: "PennyLane",
    maker: "Xanadu",
    blurb: "A differentiable simulator — the one that treats a circuit as something trainable.",
  },
];

/** Milliseconds, at the precision the number deserves. */
function formatMs(ms: number) {
  if (ms < 1) return "<1 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function EnginePicker({
  engine,
  onChange,
  health,
  probing,
  disabled,
  timings,
}: {
  engine: Engine;
  onChange: (engine: Engine) => void;
  health: HealthResponse | null;
  probing: boolean;
  disabled?: boolean;
  /** Milliseconds the last run took on each engine, this session. */
  timings?: Partial<Record<Engine, number>>;
}) {
  const [open, setOpen] = useState(false);
  /* Which row the keyboard is on. Separate from the selection: you can walk the
     list without loading anything, the way a native select behaves. */
  const [active, setActive] = useState(0);
  /**
   * Pixels the panel has to slide to stay on screen.
   *
   * It hangs off the right edge of its trigger, which is right for the toolbar
   * at full width. But the toolbar wraps, and once it does this control can end
   * up on the left of a narrow window with a 368px panel hanging off the left
   * edge of the screen — measured at -147px, which is most of the first column
   * of text gone. So it is measured on open and slid back inside.
   *
   * A stale value between openings is harmless: the measurement below reads the
   * anchor and the panel's width, neither of which the shift moves, so the
   * first pass after reopening is already correct — and it runs in a layout
   * effect, before paint.
   */
  const [shift, setShift] = useState(0);
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const offline = !probing && !health;

  const versionOf = (id: Engine) =>
    id === "browser" ? "no install, no account" : (health?.backends?.[id]?.version ?? null);

  const ready = (id: Engine) =>
    id === "browser" ? true : Boolean(health?.backends?.[id]?.installed);

  const current = ENGINES.find((spec) => spec.id === engine) ?? ENGINES[0];

  /* Measured before paint, so the panel is never seen in the wrong place. The
     first render after opening still has `shift` at zero, which is exactly the
     unshifted box this needs to measure. */
  useLayoutEffect(() => {
    if (!open) return;

    /* Computed from the anchor rather than from the panel's own shifted box, so
       the answer is absolute: the same call gives the same result whatever
       shift is already applied, and widening the window puts the panel back
       against its trigger instead of leaving it stranded where it last fitted. */
    const fit = () => {
      const node = panel.current;
      const box = anchor.current?.getBoundingClientRect();
      if (!node || !box) return;

      const gutter = 12;
      const unshiftedLeft = box.right - node.offsetWidth;

      if (unshiftedLeft < gutter) setShift(gutter - unshiftedLeft);
      else if (box.right > window.innerWidth - gutter) {
        setShift(window.innerWidth - gutter - box.right);
      } else setShift(0);
    };

    fit();
    panel.current?.focus();

    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    /* Pointerdown rather than click: a drag that starts inside the panel and
       releases outside it is not a dismissal. */
    const onPointerDown = (event: PointerEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  };

  /** Walk to the next selectable row, stepping over anything the host lacks. */
  const step = (from: number, direction: 1 | -1) => {
    for (let i = 1; i <= ENGINES.length; i += 1) {
      const next = (from + direction * i + ENGINES.length * 2) % ENGINES.length;
      if (ready(ENGINES[next].id)) return next;
    }
    return from;
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => step(index, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => step(index, -1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(step(-1, 1));
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(step(0, -1));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const spec = ENGINES[active];
      if (ready(spec.id)) {
        onChange(spec.id);
        close();
      }
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={anchor}>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Simulation engine: ${current.label}`}
        onClick={() => {
          setActive(Math.max(0, ENGINES.findIndex((spec) => spec.id === engine)));
          setOpen((was) => !was);
        }}
        onKeyDown={(event) => {
          // Opening straight onto the list, the way a native select does.
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            setActive(Math.max(0, ENGINES.findIndex((spec) => spec.id === engine)));
            setOpen(true);
          }
        }}
        className={cn(
          "flex items-center gap-2 border border-edge px-2.5 py-2 transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open ? "border-edge-hi bg-strata" : "hover:border-edge-hi hover:bg-strata",
        )}
      >
        {probing ? (
          <Loader2 className="size-3 shrink-0 animate-spin text-frost" />
        ) : offline ? (
          <WifiOff className="size-3 shrink-0 text-dim" />
        ) : (
          // A lit contact, the way a rack module shows it is seated.
          <span className="size-1.5 shrink-0 rounded-full bg-photon" aria-hidden />
        )}
        <span className="font-mono text-[11px] tracking-[0.12em] text-frost uppercase">Engine</span>
        <span className="font-mono text-[12px] text-paper">{current.label.toLowerCase()}</span>
        <ChevronDown
          className={cn("size-3 shrink-0 text-frost transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Simulation engine"
          aria-activedescendant={`engine-${ENGINES[active].id}`}
          tabIndex={-1}
          ref={panel}
          onKeyDown={onKeyDown}
          style={{ right: -shift }}
          className={cn(
            "panel animate-rise absolute top-full z-30 mt-2 origin-top-right rounded-xl",
            "w-[min(23rem,calc(100vw-2.5rem))] overflow-hidden focus:outline-none",
          )}
        >
          <div className="border-b border-edge px-3.5 py-2.5">
            <p className="eyebrow">Simulation engine</p>
            <p className="mt-1 text-[12px] leading-relaxed text-frost">
              {offline
                ? "The API is not answering, so only the in-tab simulator is available. Start it with: uvicorn app.main:app --reload"
                : "Who samples the shots. The exact bars stay the browser's either way."}
            </p>
          </div>

          <ul className="flex flex-col">
            {ENGINES.map((spec, index) => {
              const available = ready(spec.id);
              const selected = spec.id === engine;
              const version = versionOf(spec.id);
              const took = timings?.[spec.id];

              return (
                <li key={spec.id}>
                  <button
                    id={`engine-${spec.id}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={!available}
                    onMouseEnter={() => available && setActive(index)}
                    onClick={() => {
                      onChange(spec.id);
                      close();
                    }}
                    className={cn(
                      "flex w-full flex-col gap-1 border-t border-edge px-3.5 py-3 text-left",
                      "transition-colors first:border-t-0",
                      "disabled:cursor-not-allowed disabled:opacity-45",
                      available && index === active && "bg-strata",
                      selected && "bg-photon/8",
                    )}
                  >
                    <span className="flex items-baseline gap-2">
                      {/* The seated marker, in the accent, so the loaded engine
                          is findable without reading any of the rows. */}
                      <span
                        className={cn(
                          "size-1.5 shrink-0 -translate-y-px rounded-full",
                          selected ? "bg-photon" : "bg-edge-hi",
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          "font-mono text-[13px]",
                          selected ? "text-photon" : "text-paper",
                        )}
                      >
                        {spec.label}
                      </span>
                      <span className="font-mono text-[11px] tracking-[0.1em] text-dim uppercase">
                        {spec.maker}
                      </span>
                      {selected && <Check className="ml-auto size-3.5 shrink-0 text-photon" />}
                    </span>

                    <span className="pl-3.5 text-[12px] leading-relaxed text-frost">
                      {spec.blurb}
                    </span>

                    <span className="flex items-baseline gap-3 pl-3.5 font-mono text-[11px] text-dim">
                      <span className="min-w-0 truncate">
                        {available
                          ? version
                          : offline
                            ? "the API is not answering"
                            : "not installed on the API host"}
                      </span>
                      {/* Measured here, this session — which is the whole
                          argument for opening this panel a second time. */}
                      {took !== undefined && (
                        <span className="ml-auto shrink-0 text-frost tabular-nums">
                          last run {formatMs(took)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
