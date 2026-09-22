"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import type { SimulationResult } from "@/lib/quantum";
import { cn } from "@/lib/utils";

const BlochCanvas = dynamic(() => import("@/components/three/bloch-canvas"), {
  ssr: false,
  loading: () => null,
});

/**
 * The read-out.
 *
 * Nothing here is mocked: the histogram, the Bloch vector and the amplitude
 * expression all come from the same eight-amplitude statevector the circuit
 * produced. That is why a Bell pair shows q0's vector collapsed to a point —
 * an entangled qubit genuinely has no Bloch vector of its own.
 */

/**
 * A component of the Bloch vector, printed.
 *
 * Values that are zero to three decimal places are snapped to a positive zero.
 * Floating point produces −1e−17 readily — H then T leaves it on ⟨σz⟩ — and
 * `toFixed(3)` renders that as "-0.000", which reads to a learner as a real
 * negative quantity too small to see rather than as the exact zero it is.
 */
function axisValue(value: number) {
  return (Math.abs(value) < 5e-4 ? 0 : value).toFixed(3);
}

function purityNote(length: number) {
  if (length > 0.999) return { text: "Pure state", tone: "text-photon" };
  if (length < 0.02) return { text: "Maximally mixed · fully entangled", tone: "text-collapse" };
  return { text: `|r| = ${length.toFixed(2)} · partially entangled`, tone: "text-paper" };
}

function formatState(result: SimulationResult) {
  const terms = result.amplitudes
    .map((a, i) => ({ ...a, i, mag: Math.hypot(a.re, a.im) }))
    .filter((t) => t.mag > 1e-6)
    .sort((a, b) => b.mag - a.mag);

  if (!terms.length) return "0";

  const shown = terms.slice(0, 6).map((t) => {
    const phase = Math.atan2(t.im, t.re);
    const phaseText =
      Math.abs(phase) < 1e-6 ? "" : ` e^(i${(phase / Math.PI).toFixed(2)}π)`;
    return `${t.mag.toFixed(3)}${phaseText}|${result.labels[t.i]}⟩`;
  });

  return shown.join("  +  ") + (terms.length > 6 ? `  + ${terms.length - 6} more` : "");
}

export function StatePanel({
  result,
  qubits,
  shots,
  shotCount,
  stepLabel = null,
}: {
  result: SimulationResult;
  qubits: number;
  shots: number[] | null;
  shotCount: number;
  /**
   * Set while the transport is parked part-way through the circuit.
   *
   * Every number in this panel then describes that moment rather than the
   * finished circuit, and a read-out that does not say so is a read-out that
   * will be screenshotted as the answer.
   */
  stepLabel?: string | null;
}) {
  const [selected, setSelected] = useState(0);
  const wire = Math.min(selected, qubits - 1);
  const vector = result.bloch[wire] ?? { x: 0, y: 0, z: 1 };
  const length = Math.hypot(vector.x, vector.y, vector.z);
  const note = purityNote(length);
  const tight = result.probabilities.length > 8;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      {/* Bloch sphere for one qubit at a time. */}
      <section className="panel flex flex-col overflow-hidden rounded-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-edge px-4 py-2.5">
          <p className="eyebrow">
            Bloch sphere
            {stepLabel && <span className="ml-2 text-photon">· {stepLabel}</span>}
          </p>
          <div className="flex gap-1" role="group" aria-label="Choose a qubit">
            {Array.from({ length: qubits }, (_, q) => (
              <button
                key={q}
                type="button"
                onClick={() => setSelected(q)}
                aria-pressed={wire === q}
                className={cn(
                  "rounded-md px-2 py-1 font-mono text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                  wire === q
                    ? "bg-photon text-void"
                    : "text-frost hover:bg-strata hover:text-paper",
                )}
              >
                q{q}
              </button>
            ))}
          </div>
        </header>

        <BlochCanvas vector={vector} className="h-[248px] w-full" />

        <dl className="grid grid-cols-3 gap-px border-t border-edge text-center">
          {(
            [
              ["x", vector.x],
              ["y", vector.y],
              ["z", vector.z],
            ] as const
          ).map(([axis, value]) => (
            <div key={axis} className="px-2 py-2.5">
              <dt className="font-mono text-[11px] tracking-[0.16em] text-frost uppercase">
                ⟨σ{axis}⟩
              </dt>
              <dd className="mt-1 font-mono text-[13px] text-paper tabular-nums">
                {axisValue(value)}
              </dd>
            </div>
          ))}
        </dl>
        <p
          className={cn(
            "border-t border-edge px-4 py-2.5 font-mono text-[11px] tracking-[0.1em] uppercase",
            note.tone,
          )}
        >
          {note.text}
        </p>
      </section>

      {/* Measurement probabilities. */}
      <section className="panel flex flex-col overflow-hidden rounded-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-4 py-2.5">
          <p className="eyebrow">
            Measurement probability
            {stepLabel && <span className="ml-2 text-photon">· {stepLabel}</span>}
          </p>
          <p className="flex items-center gap-3 font-mono text-[11px] tracking-[0.12em] uppercase">
            <span className="flex items-center gap-1.5 text-frost">
              <span className="h-2 w-3 amplitude-fill" />
              exact
            </span>
            {shots && (
              <span className="flex items-center gap-1.5 text-frost">
                <span className="h-2 w-3 border border-edge-hi" />
                {shotCount.toLocaleString("en-IN")} shots
              </span>
            )}
          </p>
        </header>

        <div className="flex-1 px-4 pt-6 pb-2">
          <div className="relative h-[212px]">
            {/* Probability axis. */}
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
              <div
                key={tick}
                className="absolute inset-x-0 flex items-center gap-2"
                style={{ bottom: `${tick * 100}%` }}
              >
                <span className="w-7 shrink-0 text-right font-mono text-[11px] text-frost tabular-nums">
                  {(tick * 100).toFixed(0)}
                </span>
                <span className="h-px flex-1 bg-edge" />
              </div>
            ))}

            <div className="absolute inset-y-0 right-0 left-9 flex items-end gap-[3px]">
              {result.probabilities.map((p, i) => {
                const sampled = shots ? shots[i] / Math.max(1, shotCount) : null;
                return (
                  <div
                    key={i}
                    className="group relative flex h-full flex-1 items-end justify-center gap-[2px]"
                  >
                    {p > 0.004 && (
                      <span
                        className="absolute w-full text-center font-mono text-[11px] text-frost tabular-nums"
                        style={{ bottom: `calc(${p * 100}% + 6px)` }}
                      >
                        {(p * 100).toFixed(1)}
                      </span>
                    )}
                    <span
                      className={cn(
                        "amplitude-fill w-full max-w-[26px] transition-[height] duration-500 ease-out",
                        sampled !== null && "max-w-[18px]",
                      )}
                      style={{ height: `${Math.max(p * 100, p > 0 ? 0.8 : 0)}%` }}
                    />
                    {sampled !== null && (
                      <span
                        className="w-full max-w-[12px] border border-b-0 border-edge-hi bg-strata transition-[height] duration-500 ease-out"
                        style={{ height: `${Math.max(sampled * 100, sampled > 0 ? 0.8 : 0)}%` }}
                      />
                    )}

                    {/* Exact vs sampled, on hover — shot noise is the lesson here. */}
                    <span
                      className="panel pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 rounded-md px-2 py-1.5 text-center font-mono text-[11px] whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100"
                      role="tooltip"
                    >
                      <span className="ket block text-[11px] text-paper">
                        |{result.labels[i]}⟩
                      </span>
                      <span className="block text-photon">{(p * 100).toFixed(2)}% exact</span>
                      {shots && (
                        <span className="block text-collapse">
                          {shots[i].toLocaleString("en-IN")} of{" "}
                          {shotCount.toLocaleString("en-IN")}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex gap-[3px] pl-9">
            {result.labels.map((label) => (
              <span
                key={label}
                className={cn(
                  "ket flex-1 text-center text-frost",
                  tight ? "text-[11px]" : "text-[12px]",
                )}
              >
                |{label}⟩
              </span>
            ))}
          </div>
        </div>

        <div className="border-t border-edge px-4 py-3">
          <p className="eyebrow">State vector</p>
          <p className="math mt-1.5 overflow-x-auto text-[15px] leading-snug whitespace-nowrap text-paper">
            |ψ⟩ = {formatState(result)}
          </p>
        </div>
      </section>
    </div>
  );
}
