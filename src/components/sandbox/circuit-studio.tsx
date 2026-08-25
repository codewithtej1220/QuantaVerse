"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, RotateCcw, Trash2 } from "lucide-react";

import {
  ApiError,
  fetchHealth,
  gradeCircuit,
  introspectCode,
  runSimulation,
  type GradeResponse,
  type HealthResponse,
  type SimulationResponse,
} from "@/lib/api";
import { challengeIR, type Challenge } from "@/lib/challenges";
import { clearCircuit, describeCircuit, publishCircuit } from "@/lib/circuit-store";
import { GATE_BY_ID } from "@/lib/data";
import { fromCircuitIR, histogramToCounts, toCircuitIR } from "@/lib/ir";
import { PRESETS, presetPlacements, type Preset } from "@/lib/presets";
import {
  fromQiskit,
  sampleShots,
  simulate,
  toQiskit,
  type Placement,
} from "@/lib/quantum";
import { cn } from "@/lib/utils";

import { ChallengeCard } from "./challenge-card";
import { CircuitGrid } from "./circuit-grid";
import { CodePane, type BuildNote } from "./code-pane";
import { EnginePicker, type Engine } from "./engine-picker";
import { GatePalette } from "./gate-palette";
import { StatePanel } from "./state-panel";

/**
 * The sandbox, wired end to end.
 *
 * One source of truth — the placement list — drives the diagram, the Qiskit
 * pane and the simulator. Editing the code parses back into placements, so the
 * two panes are two views of the same circuit rather than two documents that
 * happen to agree.
 *
 * Shots can be sampled here in the tab or on the optional FastAPI service by
 * Qiskit, Cirq or PennyLane. All four agree on qubit 0 as the least significant
 * bit, so the histogram means the same thing whichever engine filled it.
 *
 * With a `challenge`, the same studio becomes a graded exercise: the grid opens
 * empty and the API marks the submission against the module's reference circuit.
 */

const COLUMNS = 10;
const SHOTS = 1024;
const QUBIT_OPTIONS = [2, 3, 4];
const GRID_LIMITS = {
  minQubits: QUBIT_OPTIONS[0],
  maxQubits: QUBIT_OPTIONS[QUBIT_OPTIONS.length - 1],
  columns: COLUMNS,
};

export function CircuitStudio({ challenge }: { challenge?: Challenge }) {
  const opening = challenge ? null : PRESETS[0];
  const [qubits, setQubits] = useState(challenge?.qubits ?? 3);
  const [placements, setPlacements] = useState<Placement[]>(() =>
    opening ? presetPlacements(opening) : [],
  );
  const [code, setCode] = useState(() =>
    toQiskit(opening ? presetPlacements(opening) : [], challenge?.qubits ?? 3),
  );
  const [armed, setArmed] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);
  const [preset, setPreset] = useState<Preset | null>(opening);
  const [shots, setShots] = useState<number[] | null>(null);
  const [running, setRunning] = useState(false);

  const [engine, setEngine] = useState<Engine>("browser");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [probing, setProbing] = useState(true);
  const [runNote, setRunNote] = useState<string | null>(null);

  const [building, setBuilding] = useState(false);
  const [buildNote, setBuildNote] = useState<BuildNote | null>(null);

  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  /** Keyed by the circuit that was graded, so an edit retires the verdict. */
  const [verdict, setVerdict] = useState<{ key: string; result: GradeResponse } | null>(null);

  const nextId = useRef(100);
  const runCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      // Leaving the sandbox: the tutor can no longer see a circuit.
      clearCircuit();
    },
    [],
  );

  /* Ask the API what it can run. Failure is expected — the sandbox works alone. */
  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setProbing(false));
    return () => controller.abort();
  }, []);

  const result = useMemo(() => simulate(placements, qubits), [placements, qubits]);

  /**
   * The circuit as the server sees it.
   *
   * Measurements are left out: the histogram endpoint then returns the whole
   * register, and the grader compares states before any read-out anyway.
   */
  const submission = useMemo(() => toCircuitIR(placements, qubits), [placements, qubits]);

  /* Hand the tutor the circuit that is actually on screen, measurements and all. */
  useEffect(() => {
    const ir = toCircuitIR(placements, qubits, { withMeasurements: true });
    publishCircuit({
      ir,
      summary: describeCircuit(ir, result.depth, result.gateCount),
      lessonId: challenge?.slug ?? preset?.id ?? null,
    });
  }, [placements, qubits, result.depth, result.gateCount, preset, challenge]);

  /** Circuit is the source: regenerate the code and invalidate the last run. */
  const applyCircuit = (next: Placement[], from: Preset | null = null) => {
    setPlacements(next);
    setCode(toQiskit(next, qubits));
    setEdited(false);
    setPreset(from);
    setShots(null);
    setRunNote(null);
    setBuildNote(null);
  };

  /** Code is the source: parse it, but leave the text exactly as typed. */
  const onCodeChange = (next: string) => {
    setCode(next);
    setPlacements(fromQiskit(next, qubits));
    setEdited(true);
    setPreset(null);
    setShots(null);
    setRunNote(null);
    setBuildNote(null);
  };

  const onPlace = (gateId: string, wire: number, column: number) => {
    const gate = GATE_BY_ID[gateId];
    if (!gate) return;

    let wires = [wire];
    if (gate.arity === 2) {
      // A CNOT needs a partner wire: prefer the one below, fall back above.
      const target = wire + 1 < qubits ? wire + 1 : wire - 1;
      if (target < 0) return;
      wires = [wire, target];
    }

    const busy = new Set(wires);
    const kept = placements.filter(
      (p) => p.column !== column || !p.wires.some((w) => busy.has(w)),
    );

    nextId.current += 1;
    applyCircuit([
      ...kept,
      { id: `g${nextId.current}`, gate: gateId, column, wires },
    ]);
    setArmed(null);
  };

  const onRemove = (id: string) => {
    applyCircuit(placements.filter((p) => p.id !== id));
  };

  const changeQubits = (next: number) => {
    const kept = placements.filter((p) => p.wires.every((w) => w < next));
    setQubits(next);
    setPlacements(kept);
    setCode(toQiskit(kept, next));
    setEdited(false);
    setShots(null);
    setRunNote(null);
    if (preset && preset.qubits !== next) setPreset(null);
  };

  /** Sample in this tab: deterministic per run, so the noise is reproducible. */
  const runLocally = useCallback(() => {
    setShots(sampleShots(result.probabilities, SHOTS, runCount.current * 7919 + 13));
    setRunning(false);
  }, [result.probabilities]);

  const run = () => {
    runCount.current += 1;
    setRunning(true);
    setShots(null);
    setRunNote(null);
    if (timer.current) clearTimeout(timer.current);

    if (engine === "browser") {
      // A short delay: 1,024 shots finish instantly, and instant is unreadable.
      timer.current = setTimeout(runLocally, 420);
      return;
    }

    runSimulation({
      circuit: submission,
      backend: engine,
      shots: SHOTS,
    })
      .then((response: SimulationResponse) => {
        setShots(histogramToCounts(response.histogram, qubits));
        setRunning(false);
        setRunNote(
          response.note ??
            `${response.framework_version} · ${response.shots.toLocaleString("en-IN")} shots in ${response.duration_ms.toFixed(0)} ms`,
        );
      })
      .catch((error: unknown) => {
        const reason = error instanceof ApiError ? error.message : "the API call failed";
        setRunNote(`${reason} — sampled in this tab instead.`);
        runLocally();
      });
  };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    setRunning(false);
    applyCircuit([]);
  };

  /**
   * Run the file with the real Qiskit and draw whatever it built.
   *
   * The in-tab parser only recognises single calls, so anything expressive — a
   * loop, a helper, numpy — leaves the diagram behind. This sends the source to
   * the sandboxed interpreter and loads the circuit it returns, which is the only
   * way the grid can be trusted to match code it cannot itself read.
   */
  const buildFromCode = () => {
    setBuilding(true);
    setBuildNote(null);

    introspectCode(code)
      .then((response) => {
        const printed = response.stdout.trim() || undefined;

        if (!response.ok || !response.circuit) {
          setBuildNote({
            text: response.error ?? "the code ran, but no QuantumCircuit came back",
            failed: true,
            stdout: printed,
          });
          return;
        }

        const outcome = fromCircuitIR(response.circuit, GRID_LIMITS);
        if (!outcome.ok) {
          setBuildNote({ text: `built, but not drawable — ${outcome.reason}`, failed: true, stdout: printed });
          return;
        }

        setQubits(outcome.qubits);
        setPlacements(outcome.placements);
        setPreset(null);
        setShots(null);
        setRunNote(null);
        // The code is the source of truth now; the diagram followed it.
        setEdited(true);
        setBuildNote({
          text: `qiskit built ${response.variable ?? "the circuit"} in ${response.duration_ms.toFixed(0)} ms — ${outcome.qubits} qubits, ${outcome.placements.length} gates on the grid`,
          failed: false,
          stdout: printed,
        });
      })
      .catch((error: unknown) => {
        setBuildNote({
          text: error instanceof ApiError ? error.message : "the API call failed",
          failed: true,
        });
      })
      .finally(() => setBuilding(false));
  };

  /** Send the grid to the grader, which rebuilds both circuits and compares them. */
  const check = () => {
    if (!challenge) return;
    const key = JSON.stringify(submission);
    setGrading(true);
    setGradeError(null);

    gradeCircuit({ target: challengeIR(challenge), submission })
      .then((result) => setVerdict({ key, result }))
      .catch((error: unknown) => {
        setGradeError(error instanceof ApiError ? error.message : "the check could not run");
      })
      .finally(() => setGrading(false));
  };

  /** A verdict only speaks for the circuit it was given. */
  const fresh =
    verdict && verdict.key === JSON.stringify(submission) ? verdict.result : null;

  const measured = placements.some((p) => p.gate === "m");

  return (
    <div className="space-y-4">
      {/* The graded task, when this studio is a module's circuit lab. */}
      {challenge && (
        <ChallengeCard
          challenge={challenge}
          verdict={fresh}
          error={gradeError}
          grading={grading}
          available={Boolean(health)}
          onCheck={check}
        />
      )}

      {/* Toolbar. */}
      <div className="glass flex flex-wrap items-center gap-x-2 gap-y-3 rounded-2xl px-3 py-3">
        {challenge ? (
          // Four of the five presets are the answer to a graded build, so a lab
          // page says where they went rather than quietly dropping the row.
          <p className="px-1 text-[12.5px] text-frost/55">
            <span className="eyebrow">Build it yourself</span>
            <span className="mx-2 text-frost/25">·</span>
            presets are hidden on a graded page — most of them are an answer
          </p>
        ) : (
          <>
            <p className="eyebrow px-1">Load</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setQubits(p.qubits);
                    const next = presetPlacements(p);
                    setPlacements(next);
                    setCode(toQiskit(next, p.qubits));
                    setEdited(false);
                    setPreset(p);
                    setShots(null);
                    setRunNote(null);
                  }}
                  aria-pressed={preset?.id === p.id}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                    preset?.id === p.id
                      ? "border-photon/55 bg-photon/12 text-photon"
                      : "border-white/10 text-frost/70 hover:border-white/20 hover:bg-white/5 hover:text-paper",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <EnginePicker
            engine={engine}
            onChange={(next) => {
              setEngine(next);
              setShots(null);
              setRunNote(null);
            }}
            health={health}
            probing={probing}
            disabled={running}
          />

          <div
            className="flex items-center gap-1 rounded-lg border border-white/10 p-1"
            role="group"
            aria-label="Register width"
          >
            <span className="px-1.5 font-mono text-[10px] tracking-[0.12em] text-frost/45 uppercase">
              qubits
            </span>
            {QUBIT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => changeQubits(n)}
                aria-pressed={qubits === n}
                className={cn(
                  "rounded-md px-2 py-1 font-mono text-[12px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                  qubits === n
                    ? "bg-phase/18 text-phase"
                    : "text-frost/55 hover:bg-white/6 hover:text-paper",
                )}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 font-mono text-[10.5px] tracking-[0.1em] text-frost/65 uppercase transition-colors hover:border-collapse/45 hover:text-collapse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collapse"
          >
            <Trash2 className="size-3.5" />
            clear
          </button>

          <button
            type="button"
            onClick={run}
            disabled={running}
            className={cn(
              "glow-photon flex items-center gap-2 rounded-lg border border-photon/50 bg-photon/12 px-3.5 py-2",
              "font-mono text-[11px] tracking-[0.12em] text-photon uppercase transition-[background-color,transform]",
              "hover:bg-photon/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {running ? (
              <RotateCcw className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            {running
              ? engine === "browser"
                ? "sampling"
                : `running on ${engine}`
              : `run ${SHOTS.toLocaleString("en-IN")} shots`}
          </button>
        </div>

        {/* What produced the last histogram, or why the fallback took over. */}
        {runNote && (
          <p className="w-full border-t border-white/8 px-1 pt-2.5 font-mono text-[10.5px] leading-relaxed text-frost/55">
            {runNote}
          </p>
        )}
      </div>

      {/* Two panes: build on the left, code on the right. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass flex min-w-0 flex-col gap-5 rounded-2xl p-4 lg:p-5">
          <GatePalette armed={armed} onArm={setArmed} />

          <div className="rounded-xl border border-white/8 bg-[#060a16]/70 p-3 pt-2">
            <CircuitGrid
              qubits={qubits}
              columns={COLUMNS}
              placements={placements}
              armed={armed}
              onPlace={onPlace}
              onRemove={onRemove}
            />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/8 pt-4 sm:grid-cols-4">
            {(
              [
                ["Depth", String(result.depth)],
                ["Gates", String(result.gateCount)],
                ["Register", `${qubits} · ${1 << qubits} states`],
                ["Readout", measured ? "measured" : "statevector"],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[9.5px] tracking-[0.16em] text-frost/40 uppercase">
                  {label}
                </dt>
                <dd className="mt-0.5 font-mono text-[13px] text-paper tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="text-[12.5px] leading-relaxed text-frost/65">
            {preset ? (
              <>
                <span className="text-paper">{preset.name}: </span>
                {preset.expect}
              </>
            ) : placements.length ? (
              "Click a placed gate to remove it. Two gates on different wires share a time step, which is what keeps the depth honest."
            ) : (
              "Empty register — every qubit is |0⟩. Drag a Hadamard onto q0 to start, or load a preset above."
            )}
          </p>
        </div>

        <CodePane
          code={code}
          onChange={onCodeChange}
          onRegenerate={() => {
            setCode(toQiskit(placements, qubits));
            setEdited(false);
            setBuildNote(null);
          }}
          onBuild={buildFromCode}
          edited={edited}
          building={building}
          note={buildNote}
          canBuild={Boolean(health)}
        />
      </div>

      <StatePanel result={result} qubits={qubits} shots={shots} shotCount={SHOTS} />
    </div>
  );
}
