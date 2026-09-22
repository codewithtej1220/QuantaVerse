"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ChevronDown, Play, RotateCcw, Trash2 } from "lucide-react";

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
import { ProactiveToggle } from "@/components/sandbox/proactive-toggle";
import {
  WorkspaceTabs,
  type WorkspaceTab,
} from "@/components/sandbox/workspace-tabs";
import { useAuth } from "@/components/auth/auth-provider";
import { readSession } from "@/lib/auth";
import { type Challenge } from "@/lib/challenges";
import { gradeLocally } from "@/lib/challenge-grade";
import { checkCircuit, type CircuitIssue } from "@/lib/circuit-check";
import {
  clearCircuit,
  describeCircuit,
  publishCircuit,
} from "@/lib/circuit-store";
import { GATE_BY_ID } from "@/lib/data";
import { fromCircuitIR, histogramToCounts, toCircuitIR } from "@/lib/ir";
import { PRESETS, presetPlacements, type Preset } from "@/lib/presets";
import {
  fromQiskit,
  parseQiskitOps,
  sampleShots,
  simulateSteps,
  toQiskit,
  type Placement,
} from "@/lib/quantum";
import { checkCode } from "@/lib/code-check";
import {
  caretLine,
  locateEditor,
  locateLine,
  markCode,
  washLine,
} from "@/lib/code-editor";
import {
  alertSnapshot,
  celebrate,
  clearAlerts,
  hush,
  mascot,
  mascotOffer,
  mascotSnapshot,
  noteEdit,
  reportFault,
  reportFaults,
  say,
  setPose,
  subscribeAlert,
  type AlertState,
  type MascotAlert,
} from "@/lib/mascot";
import { cn } from "@/lib/utils";

import { Bench } from "./bench";
import { ChallengeCard } from "./challenge-card";
import { CircuitGrid } from "./circuit-grid";
import { CodePane, type BuildNote } from "./code-pane";
import { EnginePicker, type Engine } from "./engine-picker";
import { GatePalette } from "./gate-palette";
import { StatePanel } from "./state-panel";
import { StepThrough } from "./step-through";

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
/* How many times a run samples the circuit — a choice, not a constant. One shot
   shows that a measurement is a single random outcome, a hundred show the noise
   the shot-noise lesson is about, and thousands show the counts settling onto
   the exact bars beside them. */
const SHOT_OPTIONS = [1, 10, 100, 1024, 4096, 8192];
const DEFAULT_SHOTS = 1024;
const QUBIT_OPTIONS = [2, 3, 4];
const GRID_LIMITS = {
  minQubits: QUBIT_OPTIONS[0],
  maxQubits: QUBIT_OPTIONS[QUBIT_OPTIONS.length - 1],
  columns: COLUMNS,
};
/* How the board's own remarks are signed, so one can be taken back without
   silencing anything else the cat is saying. */
const NOTE_EYEBROW = "one small thing";
const SOLVED_EYEBROW = "looks right";
const NO_ALERT: AlertState = { alert: null, open: false };

/**
 * The general checks, read against a lab.
 *
 * Every one of them is a statement about the state from |0…0⟩, which is
 * exactly what a state lab marks — so there they all stand. An operation lab
 * marks the whole operation, and there the same statements are false alarms: a
 * CNOT that "never fires" from |00⟩ fires on the inputs that matter, and a
 * Hadamard pair that cancels is often where the oracle meets the diffuser in a
 * perfectly good build. Only a measurement in the middle is wrong on any lab.
 *
 * A board the lab would pass has nothing wrong with it at all, whatever the
 * general checks think of its tidiness. And an idle wire is only worth a word
 * when the lab needs that wire — "drop the register a qubit" is the wrong
 * advice on a lab that fixes its register.
 */
function forLab(
  issues: CircuitIssue[],
  challenge: Challenge,
  reading: GradeResponse,
): CircuitIssue[] {
  if (reading.passed) return [];
  const needed = new Set(challenge.ops.flatMap((op) => op.wires));
  return issues.flatMap((issue): CircuitIssue[] => {
    if (issue.kind === "idle-qubit") {
      if (!needed.has(issue.wire)) return [];
      return [
        {
          ...issue,
          message: `Nothing touches q${issue.wire} yet, and this lab needs it.`,
          fix: `The goal has q${issue.wire} doing something, so at least one gate has to land on it.`,
        },
      ];
    }
    if (challenge.mode === "operation" && issue.kind !== "after-measure") {
      return [];
    }
    return [issue];
  });
}

export function CircuitStudio({ challenge }: { challenge?: Challenge }) {
  const { user } = useAuth();
  /* A lab can ask for a longer board: a full Grover iteration is eighteen
     gates, and ten columns only hold it if the learner already knows which
     of them can share a step. */
  const columns = challenge?.columns ?? COLUMNS;
  const limits = { ...GRID_LIMITS, columns };
  const opening = challenge ? null : PRESETS[0];
  const [qubits, setQubits] = useState(challenge?.qubits ?? 3);
  const [placements, setPlacements] = useState<Placement[]>(() =>
    opening ? presetPlacements(opening) : [],
  );
  const [code, setCode] = useState(() =>
    toQiskit(opening ? presetPlacements(opening) : [], challenge?.qubits ?? 3),
  );
  const [armed, setArmed] = useState<string | null>(null);
  /* The board taken full screen. It is the only place a ten-step circuit
     fits without scrolling sideways, so it is where the dragging is done. */
  const [bench, setBench] = useState(false);
  const [edited, setEdited] = useState(false);
  const [touched, setTouched] = useState(false);
  const [preset, setPreset] = useState<Preset | null>(opening);
  const [shots, setShots] = useState<number[] | null>(null);
  const [shotsPerRun, setShotsPerRun] = useState(DEFAULT_SHOTS);
  const [running, setRunning] = useState(false);

  /**
   * Where the transport is parked, as an index into `steps`.
   *
   * `Infinity` means "the end", which is deliberate: it survives the circuit
   * growing. Parking on a numeric last index would leave the reader stranded
   * mid-circuit the moment they placed another gate, and the common case is
   * that you are looking at the finished state and want to keep looking at it.
   */
  const [stepAt, setStepAt] = useState(Number.POSITIVE_INFINITY);
  const [playing, setPlaying] = useState(false);

  const [engine, setEngine] = useState<Engine>("browser");
  /**
   * How long the last run took on each engine, in milliseconds.
   *
   * Kept so the engine panel can show measurements from this session rather
   * than four names with nothing to choose between them. Only ever sampling
   * cost — the frameworks report their own, and the browser is timed around the
   * same work — so the numbers sit in one column honestly.
   */
  const [timings, setTimings] = useState<Partial<Record<Engine, number>>>({});
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [probing, setProbing] = useState(true);
  const [runNote, setRunNote] = useState<string | null>(null);

  const [building, setBuilding] = useState(false);
  const [buildNote, setBuildNote] = useState<BuildNote | null>(null);

  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  /** Keyed by the circuit that was graded, so an edit retires the verdict. */
  const [verdict, setVerdict] = useState<{
    key: string;
    result: GradeResponse;
    /** Marked in this tab because the API could not be reached: not saved. */
    offline?: boolean;
  } | null>(null);

  /* ---- open circuits -------------------------------------------------
     A workspace is everything that belongs to one circuit: its register
     width, its gates, its code, and the results of the last time it was run.
     Rather than rewrite two dozen hooks to read out of an array, the live
     state above stays the active circuit and a switch snapshots it back into
     the list before loading the next one. Same behaviour, a fraction of the
     surface area to get wrong.

     Transient things — what is armed, where the step-through is paused — are
     deliberately not saved. They describe what you were doing a moment ago
     rather than what the circuit is, and restoring them would leave a tab
     half-way through an interaction nobody started. */
  interface Workspace {
    id: number;
    name: string;
    qubits: number;
    placements: Placement[];
    code: string;
    preset: Preset | null;
    edited: boolean;
    /* Whether anything has been placed, removed, loaded or typed on this board.
       Distinct from `edited`, which is only about the Qiskit text: dropping a
       gate on a wire regenerates that text and so clears `edited`, and a learner
       who has just built a circuit by hand is very much not untouched. */
    touched: boolean;
    shots: number[] | null;
    verdict: { key: string; result: GradeResponse; offline?: boolean } | null;
    runNote: string | null;
  }

  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => [
    {
      id: 1,
      name: challenge ? "attempt-1" : "circuit-1",
      qubits: challenge?.qubits ?? 3,
      placements: opening ? presetPlacements(opening) : [],
      code: toQiskit(
        opening ? presetPlacements(opening) : [],
        challenge?.qubits ?? 3,
      ),
      preset: opening,
      edited: false,
      touched: false,
      shots: null,
      verdict: null,
      runNote: null,
    },
  ]);
  const [active, setActive] = useState(0);
  const workspaceId = useRef(2);

  const snapshot = useCallback(
    (): Workspace => ({
      id: workspaces[active]?.id ?? 1,
      name: workspaces[active]?.name ?? "circuit-1",
      qubits,
      placements,
      code,
      preset,
      edited,
      touched,
      shots,
      verdict,
      runNote,
    }),
    [
      workspaces,
      active,
      qubits,
      placements,
      code,
      preset,
      edited,
      touched,
      shots,
      verdict,
      runNote,
    ],
  );

  const load = useCallback((space: Workspace) => {
    setQubits(space.qubits);
    setPlacements(space.placements);
    setCode(space.code);
    setPreset(space.preset);
    setEdited(space.edited);
    setTouched(space.touched);
    setShots(space.shots);
    setVerdict(space.verdict);
    setRunNote(space.runNote);
    // Not carried across: these describe an interaction, not a circuit.
    setArmed(null);
    setStepAt(Number.POSITIVE_INFINITY);
    setPlaying(false);
    setBuildNote(null);
    setGradeError(null);
  }, []);

  const selectWorkspace = (index: number) => {
    if (index === active) return;
    const saved = snapshot();
    setWorkspaces((all) => all.map((item, i) => (i === active ? saved : item)));
    const target = workspaces[index];
    if (target) load(target);
    setActive(index);
  };

  const createWorkspace = () => {
    const saved = snapshot();
    const width = challenge?.qubits ?? 3;
    const fresh: Workspace = {
      id: workspaceId.current++,
      name: `circuit-${workspaceId.current - 1}`,
      qubits: width,
      placements: [],
      code: toQiskit([], width),
      preset: null,
      edited: false,
      touched: false,
      shots: null,
      verdict: null,
      runNote: null,
    };
    setWorkspaces((all) => [
      ...all.map((item, i) => (i === active ? saved : item)),
      fresh,
    ]);
    setActive(workspaces.length);
    load(fresh);
  };

  const closeWorkspace = (index: number) => {
    if (workspaces.length < 2) return;
    const remaining = workspaces.filter((_, i) => i !== index);
    /* Closing a tab left of the active one shifts it; closing the active one
       falls back to its left neighbour, or to the new first tab. */
    const nextActive =
      index === active
        ? Math.max(0, index - 1)
        : active > index
          ? active - 1
          : active;
    setWorkspaces(remaining);
    setActive(nextActive);
    if (index === active) load(remaining[nextActive]);
  };

  const tabs: WorkspaceTab[] = workspaces.map((space, index) => ({
    id: space.id,
    name: space.name,
    gates: index === active ? placements.length : space.placements.length,
  }));

  /* ---- proactive help -------------------------------------------------
     On, the cat reads the board after every edit and says something when the
     circuit has a fault that can be proved by looking at it. Off, it only
     answers when spoken to.

     The detecting is done locally rather than by asking the tutor, and that
     is deliberate: this runs on every gate placed, a model round trip would
     cost a second and a request each time, and a mascot that occasionally
     cries wolf about a correct circuit is worse than one that stays quiet.
     Everything it flags is provable from the placements. Explaining a fault
     at length is still the tutor's job, and the offer attached to the remark
     is what hands it over. */
  const [proactive, setProactive] = useState(true);
  /* The tidiness note last made, so it is said once rather than after every
     edit, and taken back once it stops being true. */
  const advised = useRef<string | null>(null);
  /* The note's cell, which the board rings when there is no fault to ring.
     State rather than a ref, because unlike `advised` this one has to be drawn. */
  const [note, setNote] = useState<CircuitIssue | null>(null);
  /* The fault the cat is showing now. The board rings its cell and the editor
     washes its line, so the mark on the page and the cat beside it are always
     about the same fault — including after a dismissal moves the cat on to
     the next one, which a mark kept by this component alone would not follow. */
  const { alert: shown } = useSyncExternalStore(
    subscribeAlert,
    alertSnapshot,
    () => NO_ALERT,
  );

  useEffect(() => {
    if (!proactive) {
      /* Turning it off takes the last remark with it — but only a remark this
         board made. A celebration, or the tutor mid-answer, outlives the
         switch. */
      if (advised.current) {
        advised.current = null;
        setNote(null);
        if (mascotSnapshot().eyebrow === NOTE_EYEBROW) hush();
      }
      clearAlerts();
      markCode([]);
      return;
    }

    /* Waiting out the edit. Somebody mid-way through placing a CNOT has an
       inert control for about a second, and being told so while still
       reaching for the Hadamard is the definition of unhelpful. */
    const timer = setTimeout(() => {
      /* On a lab the general checks are read against the task. They judge a
         circuit by what it does to |0…0⟩, which on an algorithm lab is the
         wrong question: a correct Grover oracle has a CNOT whose control is
         |0⟩ on that input, and the cat used to fly to it and call it broken. */
      const reading = challenge
        ? gradeLocally(challenge, placements, qubits)
        : null;
      const general = checkCircuit(placements, qubits);
      const issues =
        challenge && reading ? forLab(general, challenge, reading) : general;
      const faults = issues.filter((issue) => issue.severity === "fault");
      /* When the circuit came from typed Qiskit, a fault is pointed at in the
         code — the line the reader actually wrote — because that is what they
         would have to change. The parser numbers each operation in the order
         `pack` placed it, so a placement's index is its line. */
      const ops = edited ? parseQiskitOps(code, qubits) : null;

      /* A fault is worth the trip: the cat crosses the page to it and waits
         beside it with a notice, rather than describing it from the corner.
         Every fault is reported, worst first, so that dismissing one moves the
         cat on to the next instead of leaving the rest unsaid. */
      reportFaults(
        "circuit",
        faults.map((fault): MascotAlert => {
          const cell = placements.find(
            (p) => p.column === fault.column && p.wires.includes(fault.wire),
          );
          const index = cell && ops ? /^p(\d+)-/.exec(cell.id) : null;
          const line = index ? ops?.[Number(index[1])]?.line : undefined;
          return {
            key: `circuit:${fault.kind}:${fault.wire}:${fault.column}`,
            source: "circuit",
            title: "Circuit fault",
            where: line
              ? `line ${line}`
              : `q${fault.wire} · step ${fault.column + 1}`,
            message: fault.message,
            fix: fault.fix,
            ask: `${fault.message} Why is that a problem, and what should I do instead?`,
            cell: { wire: fault.wire, column: fault.column },
            line,
            locate: line
              ? () => locateLine(line)
              : () =>
                  document
                    .querySelector('[data-mascot-target="circuit-fault"]')
                    ?.getBoundingClientRect() ?? null,
          };
        }),
      );

      /* Advice is not worth a flight. An idle wire is a tidiness note, and a
         cat that crossed the page to deliver one would be noise by the second
         time — so it is said from the corner, and only when nothing is
         actually wrong.

         It also waits until the learner has touched the board. The opening
         preset is a correct Bell pair on a three-wire register, so the one
         thing to say about it is that q2 is idle — which, said to somebody who
         has not yet placed a gate, is a stranger opening with a complaint
         about work they did not do. */
      let remark: {
        key: string;
        eyebrow: string;
        text: string;
        ask: string;
        issue: CircuitIssue | null;
      } | null = null;

      if (touched && !faults.length) {
        const advice = issues.find((issue) => issue.severity === "advice");
        if (challenge && reading?.passed) {
          /* A right answer, said once. The check is still the learner's to
             press — this is the cat noticing, not the mark. */
          remark = {
            key: "solved",
            eyebrow: SOLVED_EYEBROW,
            text: "That does it — this circuit meets the lab's goal. Press Check my circuit to have it marked.",
            ask: `My circuit for the lab "${challenge.title}" seems to work. Can you explain why it does?`,
            issue: null,
          };
        } else if (advice) {
          remark = {
            key: `${advice.kind}:${advice.wire}:${advice.column}`,
            eyebrow: NOTE_EYEBROW,
            text: `${advice.message} ${advice.fix}`,
            ask: `${advice.message} Why does that matter?`,
            issue: advice,
          };
        }
      }

      const key = remark?.key ?? null;
      if (key === advised.current) return;
      advised.current = key;
      setNote(remark?.issue ?? null);

      if (!remark) {
        /* Taken down once it no longer applies: a remark left on screen about
           a circuit that no longer has the problem reads as still true. */
        const said = mascotSnapshot().eyebrow;
        if (said === NOTE_EYEBROW || said === SOLVED_EYEBROW) hush();
        return;
      }
      if (mascot.pose === "celebrating") return;
      mascotOffer.ask = remark.ask;
      say(remark.text, { eyebrow: remark.eyebrow, offer: true });
    }, 750);

    return () => clearTimeout(timer);
  }, [proactive, placements, qubits, touched, code, edited, challenge]);

  /* ---- the code, watched the same way ------------------------------------
     The parser keeps what it can use and silently drops the rest, so a typo
     in a gate name, a qubit that does not exist or a CNOT from a wire to itself
     all simply vanish from the board. This says which line, and why.

     Only while the code is hand-typed: text generated from the board is
     correct by construction. A longer wait than the board's, because people
     pause mid-line when typing in a way they do not when dragging gates. */
  /* The text a build last failed on. A build failure is a fact about exactly
     that program, and it has to survive the static check below finding nothing
     wrong with it — typing and pressing Build inside the debounce would
     otherwise have the check's pending "all clear" arrive a moment later and
     wipe a failure the interpreter had just proved. */
  const buildFailedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!proactive || !edited) {
      markCode([]);
      if (buildFailedFor.current !== code) reportFault("code", null);
      return;
    }

    const timer = setTimeout(() => {
      const issues = checkCode(code, qubits, caretLine());
      /* A squiggle under every line with something wrong, the way an editor
         does; the cat goes to them one at a time. */
      markCode(issues);

      if (!issues.length) {
        if (buildFailedFor.current !== code) reportFault("code", null);
        return;
      }

      const lines = code.split("\n");
      reportFaults(
        "code",
        issues.map((issue): MascotAlert => {
          const text = (lines[issue.line - 1] ?? "").trim();
          return {
            /* Keyed on what the line says, not where it is: adding a line
               above a typo moves it, and the cat should glide down with it
               rather than go home and fly back out as though it were a new
               mistake. */
            key: `code:${issue.kind}:${text}`,
            source: "code",
            title:
              issue.kind === "not-drawable" ? "Not on the board" : "Code error",
            where: `line ${issue.line}`,
            message: issue.message,
            fix: issue.fix,
            ask: `Line ${issue.line} of my Qiskit is \`${text}\`. ${issue.message} Why does that happen, and how do I fix it?`,
            line: issue.line,
            locate: () => locateLine(issue.line),
          };
        }),
      );
    }, 1100);

    return () => clearTimeout(timer);
  }, [proactive, code, qubits, edited]);

  /* The line of whatever fault the cat is beside, washed in the editor. */
  useEffect(() => {
    washLine(shown?.line ?? null);
  }, [shown]);

  /* Leaving the sandbox takes every alert with it. A cat still pointing at a
     line of code on a page that no longer has an editor would be pointing at
     nothing. */
  useEffect(
    () => () => {
      clearAlerts();
      markCode([]);
      washLine(null);
    },
    [],
  );

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

  const steps = useMemo(
    () => simulateSteps(placements, qubits),
    [placements, qubits],
  );
  const stepIndex = Math.min(stepAt, steps.length - 1);
  const scrubbing = stepIndex < steps.length - 1;

  /* What the read-outs draw. Stepping rewinds the sphere, the histogram and
     the state expression together — they are three views of one state, so a
     transport that moved only one of them would be worse than none. */
  const result = steps[stepIndex].result;
  /* The finished circuit, regardless of where the transport is parked. The
     tutor, the grader and the server engines all want the whole circuit: a
     half-run circuit is not what the learner built. */
  const finalResult = steps[steps.length - 1].result;

  /**
   * The circuit as the server sees it.
   *
   * Measurements are left out: the histogram endpoint then returns the whole
   * register, and the grader compares states before any read-out anyway.
   */
  const submission = useMemo(
    () => toCircuitIR(placements, qubits),
    [placements, qubits],
  );
  /* The circuit as the grader needs it: every measurement kept where it was
     placed, because a gate after one is a different circuit from the same
     gates with the measurement at the end, and the statevector cannot tell. */
  const gradeable = useMemo(
    () => toCircuitIR(placements, qubits, { measurementSteps: true }),
    [placements, qubits],
  );

  /* Hand the tutor the circuit that is actually on screen, measurements and all. */
  useEffect(() => {
    const ir = toCircuitIR(placements, qubits, { withMeasurements: true });
    publishCircuit({
      ir,
      summary: describeCircuit(ir, finalResult.depth, finalResult.gateCount),
      lessonId: challenge?.slug ?? preset?.id ?? null,
      challengeSlug: challenge?.slug ?? null,
    });
  }, [
    placements,
    qubits,
    finalResult.depth,
    finalResult.gateCount,
    preset,
    challenge,
  ]);

  /** Circuit is the source: regenerate the code and invalidate the last run. */
  const applyCircuit = (next: Placement[], from: Preset | null = null) => {
    noteEdit("circuit");
    setPlacements(next);
    // A new circuit is a new take: park the transport at the end and stop.
    setStepAt(Number.POSITIVE_INFINITY);
    setPlaying(false);
    setCode(toQiskit(next, qubits));
    setEdited(false);
    setTouched(true);
    setPreset(from);
    setShots(null);
    setRunNote(null);
    setBuildNote(null);
  };

  /** Code is the source: parse it, but leave the text exactly as typed. */
  const onCodeChange = (next: string) => {
    noteEdit("code");
    setCode(next);
    setPlacements(fromQiskit(next, qubits));
    setEdited(true);
    setTouched(true);
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
    const started = performance.now();
    const sampled = sampleShots(
      finalResult.probabilities,
      shotsPerRun,
      runCount.current * 7919 + 13,
    );
    /* Timed around the sampling itself, not around the readability delay below
       it: this number is shown beside the frameworks' own, so it has to be the
       same measurement — work done, not time waited. */
    const took = performance.now() - started;
    setShots(sampled);
    setTimings((last) => ({ ...last, browser: took }));
    setRunning(false);
    setPose("idle");
  }, [finalResult.probabilities, shotsPerRun]);

  const run = () => {
    runCount.current += 1;
    setRunning(true);
    setShots(null);
    setRunNote(null);
    if (timer.current) clearTimeout(timer.current);
    // The cat takes the strain for as long as the sampling does.
    setPose("working");

    if (engine === "browser") {
      // A short delay: even thousands of shots finish instantly, and instant is
      // unreadable.
      timer.current = setTimeout(runLocally, 420);
      return;
    }

    runSimulation({
      circuit: submission,
      backend: engine,
      shots: shotsPerRun,
    })
      .then((response: SimulationResponse) => {
        setShots(histogramToCounts(response.histogram, qubits));
        setTimings((last) => ({ ...last, [engine]: response.duration_ms }));
        setRunning(false);
        setRunNote(
          response.note ??
            `${response.framework_version} · ${response.shots.toLocaleString("en-IN")} shots in ${response.duration_ms.toFixed(0)} ms`,
        );
        setPose("idle");
      })
      .catch((error: unknown) => {
        const reason =
          error instanceof ApiError ? error.message : "the API call failed";
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
  /* A build that failed is a code error the interpreter proved, which makes it
     the most certain thing this page can report — so it flies too. A traceback
     names its line when it has one; without one the cat goes to the top of the
     program rather than guessing. Network failures do not: those are not a
     mistake in anything the learner wrote. */
  const reportBuildFailure = (text: string) => {
    buildFailedFor.current = code;
    if (!proactive) return;
    const found = /line (\d+)/i.exec(text);
    const line = found ? Number(found[1]) : null;
    noteEdit("code");
    reportFault("code", {
      key: `build:${text}`,
      source: "code",
      title: "Build failed",
      where: line ? `line ${line}` : "your code",
      line: line ?? undefined,
      message: text,
      fix: line
        ? "Python stopped on that line before it could build a circuit, so the board has not changed. Fix that line and press Build from code again."
        : "Python could not turn this program into a circuit, so the board has not changed. Check the program runs top to bottom and ends with a QuantumCircuit.",
      ask: `I pressed Build from code and got: "${text}". What does that mean, and how do I fix my code?`,
      locate: () => (line ? locateLine(line) : null) ?? locateEditor(),
    });
  };

  const buildFromCode = () => {
    setBuilding(true);
    setBuildNote(null);

    introspectCode(code)
      .then((response) => {
        const printed = response.stdout.trim() || undefined;

        if (!response.ok || !response.circuit) {
          const text =
            response.error ?? "the code ran, but no QuantumCircuit came back";
          setBuildNote({ text, failed: true, stdout: printed });
          reportBuildFailure(text);
          return;
        }

        const outcome = fromCircuitIR(response.circuit, limits);
        if (!outcome.ok) {
          const text = `built, but not drawable — ${outcome.reason}`;
          setBuildNote({ text, failed: true, stdout: printed });
          reportBuildFailure(text);
          return;
        }

        setQubits(outcome.qubits);
        setPlacements(outcome.placements);
        setTouched(true);
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
          text:
            error instanceof ApiError ? error.message : "the API call failed",
          failed: true,
        });
      })
      .finally(() => setBuilding(false));
  };

  /**
   * Have the board marked.
   *
   * The server marks it against its own copy of the lab — the request names
   * the lab and carries only the learner's circuit, measurements in place. With
   * no API to reach, the same grader runs in this tab instead, and the card
   * says the result was not saved rather than refusing to mark anything.
   */
  const check = () => {
    if (!challenge) return;
    const key = JSON.stringify(gradeable);
    setGrading(true);
    setGradeError(null);

    const conclude = (result: GradeResponse, offline: boolean) => {
      setVerdict({ key, result, offline });
      if (result.passed) {
        /* Badges out of the box, and the cat says what was won. Passing is the
           one result that has earned an interruption. */
        celebrate();
        say(
          result.earned_badges.length
            ? `Passed. You earned ${result.earned_badges.join(" and ")}.`
            : offline
              ? "That passes — though with no API running, it has not been saved to your record."
              : "Passed — your circuit does exactly what the lab asks.",
          { eyebrow: "assessment" },
        );
        window.setTimeout(() => {
          setPose("idle");
          hush();
        }, 6500);
        return;
      }
      /* A failed check was asked for, so the cat may say why — and what it says
         is the grader's own reading of this board against this lab, which is
         the one piece of advice guaranteed to be about the task. */
      if (result.hint) {
        mascotOffer.ask = `The lab "${challenge.title}" asks: ${challenge.goal} The check says: ${result.hint} What am I missing?`;
        say(result.hint, { eyebrow: "not there yet", offer: true });
      }
    };

    /* Still asking whether the API is up is not an answer that it is down:
       a check pressed in the first second after the page opens goes to the
       server like any other, and an unreachable one is caught below. */
    if (!health && !probing) {
      conclude(gradeLocally(challenge, placements, qubits), true);
      setGrading(false);
      return;
    }

    gradeCircuit(
      { submission: gradeable, challenge_slug: challenge.slug },
      undefined,
      user ? readSession()?.access_token : null,
    )
      .then((result) => conclude(result, false))
      .catch((error: unknown) => {
        /* Unreachable is not a verdict on the circuit. Mark it here, and say
           it was not saved; a real refusal from the server is shown as is. */
        if (error instanceof ApiError && error.status === 0) {
          conclude(gradeLocally(challenge, placements, qubits), true);
          return;
        }
        setGradeError(
          error instanceof ApiError ? error.message : "the check could not run",
        );
      })
      .finally(() => setGrading(false));
  };

  /** A verdict only speaks for the circuit it was given. */
  const fresh =
    verdict && verdict.key === JSON.stringify(gradeable) ? verdict : null;

  const measured = placements.some((p) => p.gate === "m");

  return (
    <div className="space-y-4">
      {/* The graded task, when this studio is a module's circuit lab. */}
      {challenge && (
        <ChallengeCard
          challenge={challenge}
          verdict={fresh?.result ?? null}
          offline={fresh?.offline ?? (!health && !probing)}
          error={gradeError}
          grading={grading}
          onCheck={check}
        />
      )}

      {/* Toolbar. */}
      <div className="panel flex flex-wrap items-center gap-x-2 gap-y-3 rounded-2xl px-3 py-3">
        {challenge ? (
          // Four of the five presets are the answer to a graded build, so a lab
          // page says where they went rather than quietly dropping the row.
          <p className="px-1 text-[12.5px] text-frost">
            <span className="eyebrow">Build it yourself</span>
            <span className="mx-2 text-frost">·</span>
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
                      ? "border-photon bg-photon/10 text-photon"
                      : "border-edge text-frost hover:border-edge-hi hover:bg-strata hover:text-paper",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* The controls get a row of their own, centred: they are the page's
            instrument panel, and pushed into the far corner beside the presets
            they read as an afterthought. */}
        <div className="flex w-full flex-wrap items-center justify-center gap-2 border-t border-edge pt-3">
          <ProactiveToggle on={proactive} onChange={setProactive} />
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
            timings={timings}
          />

          {challenge ? (
            /* A lab fixes its register. The picker would only offer a way to
               be marked on the wrong number of qubits — though a program
               built from code can still change it, so there is a way back. */
            <div className="flex items-center gap-2 rounded-lg border border-edge px-2.5 py-1.5 font-mono text-[11px] tracking-[0.12em] text-frost uppercase">
              Qubits
              <span className="rounded-md bg-paper px-2 py-0.5 text-[12px] text-void">
                {challenge.qubits}
              </span>
              {qubits !== challenge.qubits ? (
                <button
                  type="button"
                  onClick={() => changeQubits(challenge.qubits)}
                  className="rounded-md border border-photon px-2 py-0.5 text-[11px] text-photon transition-colors hover:bg-photon/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
                >
                  yours is {qubits} · reset
                </button>
              ) : (
                <span className="normal-case tracking-normal text-dim">
                  set by the lab
                </span>
              )}
            </div>
          ) : (
            <div
              className="flex items-center gap-1 rounded-lg border border-edge p-1"
              role="group"
              aria-label="Register width"
            >
              <span className="px-1.5 font-mono text-[11px] tracking-[0.12em] text-frost uppercase">
                Qubits
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
                      ? "bg-paper text-void"
                      : "text-frost hover:bg-strata hover:text-paper",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1.5 border border-edge px-3 py-2.5 font-mono text-[12px] tracking-[0.1em] text-frost uppercase transition-colors hover:border-paper hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collapse"
          >
            <Trash2 className="size-3.5" />
            Clear
          </button>

          {/* How many shots, then go: one control, so the count sits against
              the button it changes. */}
          <div className="flex items-stretch">
            <label
              className={cn(
                "flex items-center gap-2 border border-r-0 border-edge px-2.5 transition-colors",
                "focus-within:border-photon hover:border-edge-hi hover:bg-strata",
              )}
            >
              <span className="font-mono text-[11px] tracking-[0.12em] text-frost uppercase">
                Shots
              </span>
              <span className="relative flex items-center">
                <select
                  value={shotsPerRun}
                  onChange={(event) => {
                    setShotsPerRun(Number(event.target.value));
                    setShots(null);
                    setRunNote(null);
                  }}
                  disabled={running}
                  aria-label="Shots per run"
                  className="cursor-pointer appearance-none bg-transparent py-2 pr-5 font-mono text-[12px] text-paper tabular-nums outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {SHOT_OPTIONS.map((count) => (
                    <option
                      key={count}
                      value={count}
                      className="bg-nebula text-paper"
                    >
                      {count.toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-0 size-3 text-frost"
                  aria-hidden
                />
              </span>
            </label>
            <button
              type="button"
              onClick={run}
              disabled={running}
              className={cn(
                // The one thing this page exists to do, so it is the one solid
                // accent control on it.
                "flex items-center gap-2 bg-photon px-4 py-2.5",
                "font-mono text-[12px] font-semibold tracking-[0.12em] text-void uppercase transition-colors",
                "hover:bg-photon-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                "disabled:cursor-not-allowed disabled:opacity-50",
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
                : "Run"}
            </button>
          </div>
        </div>

        {/* What produced the last histogram, or why the fallback took over. */}
        {runNote && (
          <p className="w-full border-t border-edge px-1 pt-2.5 font-mono text-[11px] leading-relaxed text-frost">
            {runNote}
          </p>
        )}
      </div>

      {/* Two panes: build on the left, code on the right. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel flex min-w-0 flex-col gap-5 rounded-2xl p-4 lg:p-5">
          <Bench expanded={bench} onExit={() => setBench(false)}>
            <WorkspaceTabs
              tabs={tabs}
              active={active}
              onSelect={selectWorkspace}
              onCreate={createWorkspace}
              onClose={closeWorkspace}
              onRename={(index, name) =>
                setWorkspaces((all) =>
                  all.map((item, i) =>
                    i === index ? { ...item, name } : item,
                  ),
                )
              }
            />

            <GatePalette armed={armed} onArm={setArmed} />

            {/* The grid frames itself: it is a lit stage with a board standing
                in it, not a diagram that needs a box drawn round it. */}
            <CircuitGrid
              qubits={qubits}
              columns={columns}
              placements={placements}
              armed={armed}
              onPlace={onPlace}
              onRemove={onRemove}
              flag={
                shown?.source === "circuit" && shown.cell ? shown.cell : note
              }
              expanded={bench}
              onToggleExpand={() => setBench((open) => !open)}
            />
          </Bench>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-edge pt-4 sm:grid-cols-4">
            {(
              [
                ["Depth", String(finalResult.depth)],
                ["Gates", String(finalResult.gateCount)],
                ["Register", `${qubits} · ${1 << qubits} states`],
                ["Readout", measured ? "measured" : "statevector"],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[11px] tracking-[0.16em] text-frost uppercase">
                  {label}
                </dt>
                <dd className="mt-0.5 font-mono text-[13px] text-paper tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <StepThrough
            steps={steps}
            at={stepIndex}
            onSeek={setStepAt}
            playing={playing}
            onPlaying={setPlaying}
            qubits={qubits}
          />

          <p className="text-[12.5px] leading-relaxed text-frost">
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

      <StatePanel
        result={result}
        qubits={qubits}
        shots={shots}
        /* Counted off the histogram itself: a tab switched back to keeps the
           run it had, which may have used a different number of shots. */
        shotCount={
          shots ? shots.reduce((total, count) => total + count, 0) : shotsPerRun
        }
        /* Named so the read-out cannot be mistaken for the finished circuit
           while the transport is parked mid-way through it. */
        stepLabel={
          scrubbing ? `step ${stepIndex} of ${steps.length - 1}` : null
        }
      />
    </div>
  );
}
