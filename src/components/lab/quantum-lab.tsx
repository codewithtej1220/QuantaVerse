"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Activity, Radiation, RotateCcw } from "lucide-react";

import { Arena } from "@/components/lab/arena";
import { ProfessorConsole } from "@/components/lab/professor-console";
import { CircuitGrid } from "@/components/sandbox/circuit-grid";
import { GatePalette } from "@/components/sandbox/gate-palette";
import { EntangledRig, concurrenceOf } from "@/components/three/entangled-rig";
import { fireBurst } from "@/lib/burst";
import { simulate, type Placement } from "@/lib/quantum";
import { pushStudentFrame, useGhostTarget, useLinkTeardown, vectorOf } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

const BlochCanvas = dynamic(() => import("@/components/three/bloch-canvas"), { ssr: false });

const COLUMNS = 8;
const MAX_QUBITS = 3;

let seq = 0;
const nextId = () => `p${(seq += 1)}`;

/**
 * The collaborative workspace.
 *
 * One circuit drives everything on the page: the gyroscopes, the measurement
 * cloud, the graded checks and the telemetry going to an instructor are all
 * reading the same statevector, so nothing here can disagree with anything else
 * on screen. That is worth more than it sounds — the usual failure of a page
 * like this is four widgets each maintaining their own idea of the state.
 */
export function QuantumLab() {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [armed, setArmed] = useState<string | null>(null);
  const [qubits, setQubits] = useState(2);
  const [impulse, setImpulse] = useState(0);
  const [measured, setMeasured] = useState<{ at: number; outcome: 0 | 1 } | null>(null);
  const [focus, setFocus] = useState(0);
  const [disrupted, setDisrupted] = useState(0);

  const ghost = useGhostTarget();
  useLinkTeardown();

  const result = useMemo(() => simulate(placements, qubits), [placements, qubits]);
  // Memoised because the effect below depends on it: the fallback literal is a
  // fresh object every render, which would re-run the publish check each time.
  const vector = useMemo(() => result.bloch[focus] ?? { x: 0, y: 0, z: 1 }, [result, focus]);
  const p0 = Math.max(0, Math.min(1, (1 + vector.z) / 2));
  const tension = concurrenceOf(result.bloch);

  const publishedFor = useRef("");

  useEffect(() => {
    // A frame per state change, not per animation frame: the instructor is
    // watching a circuit being built, not a render loop.
    const key = `${placements.length}:${result.depth}:${qubits}:${focus}:${vector.x.toFixed(3)}:${vector.y.toFixed(3)}:${vector.z.toFixed(3)}`;
    if (publishedFor.current === key) return;
    publishedFor.current = key;
    const r = Math.hypot(vector.x, vector.y, vector.z);
    pushStudentFrame({
      bloch: result.bloch,
      qubits,
      depth: result.depth,
      gateCount: result.gateCount,
      probabilities: result.probabilities,
      purity: (1 + r * r) / 2,
      focus,
    });
  }, [placements, result, qubits, focus, vector]);

  const place = (gateId: string, wire: number, column: number) => {
    setPlacements((current) => {
      const wires = gateId === "cnot" ? [wire, (wire + 1) % qubits] : [wire];
      if (gateId === "cnot" && qubits < 2) return current;
      const clash = current.some(
        (p) => p.column === column && p.wires.some((w) => wires.includes(w)),
      );
      if (clash) return current;
      return [...current, { id: nextId(), gate: gateId, column, wires }];
    });
    setArmed(null);
    setMeasured(null);
    setImpulse((n) => n + 1);
  };

  const remove = (id: string) => {
    setPlacements((current) => current.filter((p) => p.id !== id));
    setMeasured(null);
    setImpulse((n) => n + 1);
  };

  const measure = () => {
    const outcome: 0 | 1 = Math.random() < p0 ? 0 : 1;
    setMeasured({ at: performance.now() / 1000, outcome });
    setImpulse((n) => n + 1);
  };

  const reset = () => {
    setPlacements([]);
    setMeasured(null);
    setArmed(null);
    setImpulse((n) => n + 1);
  };

  /* Passing settles the instrument; failing knocks it. The scene is the
     feedback channel, so a result is felt as well as read. */
  const onVerdict = (passed: boolean) => {
    if (passed) {
      fireBurst({ size: 0.9 });
      setDisrupted(0);
    } else {
      setImpulse((n) => n + 1);
      setDisrupted((n) => n + 1);
    }
  };

  const pairView = qubits >= 2;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
      <div className="min-w-0">
        <div
          className={cn(
            "relative border border-edge bg-nebula transition-colors",
            disrupted > 0 && "border-frost",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-4 py-2.5">
            <p className="font-mono text-[11px] tracking-[0.18em] text-frost uppercase">
              {pairView ? "Two-qubit rig" : "Gyroscope"}
            </p>
            <div className="flex items-center gap-3 font-mono text-[11px] text-dim tabular-nums">
              <span>
                q<span className="text-paper">{focus}</span> · P(|0⟩){" "}
                <span className="text-photon">{p0.toFixed(3)}</span>
              </span>
              {pairView && (
                <span>
                  C <span className={tension > 0.02 ? "text-photon" : "text-dim"}>
                    {tension.toFixed(2)}
                  </span>
                </span>
              )}
            </div>
          </div>

          {pairView ? (
            <EntangledRig
              bloch={result.bloch}
              ghost={ghost ? vectorOf(ghost.theta, ghost.phi) : null}
              focus={focus}
              className="h-[340px] w-full"
            />
          ) : (
            <BlochCanvas
              vector={vector}
              ghost={ghost ? vectorOf(ghost.theta, ghost.phi) : null}
              cloud={{ p0, measuredAt: measured?.at ?? null, outcome: measured?.outcome ?? 0 }}
              impulse={impulse}
              className="h-[340px] w-full"
            />
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-edge px-4 py-3">
            <button
              type="button"
              onClick={measure}
              className="inline-flex items-center gap-2 bg-photon px-4 py-2 font-mono text-[11px] tracking-[0.16em] text-void uppercase transition-colors hover:bg-photon-hi"
            >
              <Radiation className="size-3.5" />
              Measure
            </button>
            {measured && (
              <p className="font-mono text-[11.5px] text-frost">
                collapsed to{" "}
                <span className="ket text-photon">|{measured.outcome}⟩</span>
              </p>
            )}
            <span className="ml-auto flex items-center gap-1.5">
              {Array.from({ length: qubits }, (_, q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setFocus(q)}
                  className={cn(
                    "border px-2.5 py-1 font-mono text-[11px] transition-colors",
                    q === focus
                      ? "border-photon text-photon"
                      : "border-edge text-dim hover:text-frost",
                  )}
                >
                  q{q}
                </button>
              ))}
            </span>
          </div>
        </div>

        <div className="mt-4 border border-edge bg-nebula p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <GatePalette armed={armed} onArm={setArmed} />
          </div>

          <div className="mt-4">
            <CircuitGrid
              qubits={qubits}
              columns={COLUMNS}
              placements={placements}
              armed={armed}
              onPlace={place}
              onRemove={remove}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-edge pt-3.5">
            <span className="font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">
              Register
            </span>
            {Array.from({ length: MAX_QUBITS }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setQubits(n);
                  setPlacements((current) => current.filter((p) => p.wires.every((w) => w < n)));
                  setFocus((f) => Math.min(f, n - 1));
                  setMeasured(null);
                }}
                className={cn(
                  "border px-2.5 py-1 font-mono text-[11px] transition-colors",
                  n === qubits ? "border-photon text-photon" : "border-edge text-dim hover:text-frost",
                )}
              >
                {n}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-4 font-mono text-[11px] text-dim tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <Activity className="size-3.5" />
                depth {result.depth}
              </span>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 tracking-[0.14em] uppercase hover:text-paper"
              >
                <RotateCcw className="size-3.5" />
                clear
              </button>
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <ProfessorConsole focus={vector} />
        <Arena placements={placements} qubits={qubits} onVerdict={onVerdict} />
      </div>
    </div>
  );
}
