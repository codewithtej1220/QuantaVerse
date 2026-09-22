"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Activity, Radiation, RotateCcw } from "lucide-react";

import { Arena } from "@/components/lab/arena";
import { Bench } from "@/components/sandbox/bench";
import { ProfessorConsole } from "@/components/lab/professor-console";
import { CircuitGrid } from "@/components/sandbox/circuit-grid";
import { GatePalette } from "@/components/sandbox/gate-palette";
import { EntangledRig, concurrenceOf } from "@/components/three/entangled-rig";
import { fireBurst } from "@/lib/burst";
import { collapse, simulate, type Placement } from "@/lib/quantum";
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
  const [bench, setBench] = useState(false);
  const [qubits, setQubits] = useState(2);
  const [impulse, setImpulse] = useState(0);
  /**
   * The measurement standing on the state, if one has been taken.
   *
   * It carries the wire as well as the outcome because a measurement is about
   * a specific qubit: measuring q0 of a Bell pair determines q1 too, and the
   * page has to be able to show that rather than just recolour a label.
   */
  const [measured, setMeasured] = useState<{ at: number; wire: number; outcome: 0 | 1 } | null>(
    null,
  );
  const [focus, setFocus] = useState(0);
  const [disrupted, setDisrupted] = useState(0);

  const ghost = useGhostTarget();
  useLinkTeardown();

  const raw = useMemo(() => simulate(placements, qubits), [placements, qubits]);
  /* The state as it stands: the circuit's, projected onto whatever has been
     measured. The gyroscopes, the tether and the instructor's feed all read
     this, so a collapse is felt across the page rather than being a caption
     under one corner of it.
     The Arena deliberately does not: it grades the circuit, and the task is to
     build one that reaches a state. Failing someone for measuring the Bell
     pair they were just asked to build would punish them for using the other
     control on the page. */
  const result = useMemo(
    () => (measured ? collapse(raw, qubits, measured.wire, measured.outcome) : raw),
    [raw, measured, qubits],
  );
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
    /* Sampled from the state as it is now, which is why measuring an already
       collapsed qubit returns the same answer every time — p0 is 0 or 1 by
       then. That repeatability is the whole point of the control. */
    const outcome: 0 | 1 = Math.random() < p0 ? 0 : 1;
    setMeasured({ at: performance.now() / 1000, wire: focus, outcome });
    setImpulse((n) => n + 1);
  };

  /* The one way the register changes, whether from the buttons under the board
     or from picking an Arena task of another width. */
  const resize = (n: number) => {
    setQubits(n);
    setPlacements((current) => current.filter((p) => p.wires.every((w) => w < n)));
    setFocus((f) => Math.min(f, n - 1));
    setMeasured(null);
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
    <div className="space-y-5">
      {/* The instrument, and the task it is being judged against. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
        <div
          className={cn(
            "relative min-w-0 border border-edge bg-nebula transition-colors",
            disrupted > 0 && "border-frost",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-edge px-5 py-3">
            <p className="font-mono text-[11px] tracking-[0.18em] text-frost uppercase">
              {pairView ? "Two-qubit rig" : "Gyroscope"}
            </p>
            <div className="flex items-center gap-4 font-mono text-[11px] text-dim tabular-nums">
              <span>
                q<span className="text-paper">{focus}</span> · P(|0⟩){" "}
                <span className="text-photon">{p0.toFixed(3)}</span>
              </span>
              {pairView && (
                <span>
                  C{" "}
                  <span className={tension > 0.02 ? "text-photon" : "text-dim"}>
                    {tension.toFixed(2)}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Taller than it was. The rig is the thing this page is for, and at
              340px it was a strip of instrument under a stack of controls. */}
          {pairView ? (
            <EntangledRig
              bloch={result.bloch}
              ghost={ghost ? vectorOf(ghost.theta, ghost.phi) : null}
              focus={focus}
              className="h-[420px] w-full"
            />
          ) : (
            <BlochCanvas
              vector={vector}
              ghost={ghost ? vectorOf(ghost.theta, ghost.phi) : null}
              cloud={{ p0, measuredAt: measured?.at ?? null, outcome: measured?.outcome ?? 0 }}
              impulse={impulse}
              className="h-[420px] w-full"
            />
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-edge px-5 py-3.5">
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
                q{measured.wire} collapsed to{" "}
                <span className="ket text-photon">|{measured.outcome}⟩</span>
                {qubits > 1 && <span className="ml-2 text-dim">· the register moved with it</span>}
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

        <div className="flex min-w-0 flex-col gap-5">
          <ProfessorConsole focus={vector} />
          <Arena
            placements={placements}
            qubits={qubits}
            onVerdict={onVerdict}
            onRegister={resize}
          />
        </div>
      </div>

      {/* The bench, across the full page.

          It used to sit in the left column, which is a little over half the
          width — and the deck is a wide instrument. A ten-step circuit had to
          be scrolled sideways to see five of its steps, under a palette folded
          into four columns of two. Neither of those is a layout problem you can
          fix with spacing; the panel simply needed the width it always wanted,
          and moving it down here also evens out two columns that were running
          six hundred pixels apart in height. */}
      <div className="border border-edge bg-nebula p-4 lg:p-5">
        <Bench expanded={bench} onExit={() => setBench(false)}>
          <GatePalette armed={armed} onArm={setArmed} />

          <div className="mt-5">
            <CircuitGrid
              qubits={qubits}
              columns={COLUMNS}
              placements={placements}
              armed={armed}
              onPlace={place}
              onRemove={remove}
              expanded={bench}
              onToggleExpand={() => setBench((open) => !open)}
            />
          </div>
        </Bench>

        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-edge pt-4">
          <span className="font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">
            Register
          </span>
          <span className="flex items-center gap-1.5">
            {Array.from({ length: MAX_QUBITS }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => resize(n)}
                className={cn(
                  "border px-2.5 py-1 font-mono text-[11px] transition-colors",
                  n === qubits
                    ? "border-photon text-photon"
                    : "border-edge text-dim hover:text-frost",
                )}
              >
                {n}
              </button>
            ))}
          </span>
          <span className="ml-auto flex items-center gap-5 font-mono text-[11px] text-dim tabular-nums">
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
              Clear
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
