import { authed } from "@/lib/auth";
import type { Challenge } from "@/lib/challenges";
import type { Lesson, TestQuestion } from "@/lib/lessons";
import type { LabStanding, Person } from "@/lib/professor";
import { pack, parseQiskitOps, simulate } from "@/lib/quantum";

/**
 * A professor's own modules.
 *
 * A professor writes one on the teaching page with everything a curriculum
 * module carries — lessons with theory, a video, a practice task and a
 * checkpoint quiz, notes, and a graded lab — and any part of it can be left
 * out. It goes to the students they have accepted into any of their classes;
 * the server decides who that is, and this file only asks.
 */

export interface OwnQuestion {
  prompt: string;
  options: string[];
  /** Index into `options`. */
  answer: number;
  because: string | null;
}

/** A lesson as the professor writes it. */
export interface OwnLessonDraft {
  title: string;
  summary: string | null;
  /** Paragraphs, separated by a blank line. */
  body: string | null;
  video_url: string | null;
  practice: string | null;
  quiz: OwnQuestion[];
  /** Where the lesson sat when the editor loaded it, so that students' ticks
      move with it when it moves. Absent for a lesson added since. */
  origin?: number | null;
}

export interface OwnLabOp {
  gate: string;
  wires: number[];
}

export interface OwnLabDraft {
  title: string;
  goal: string | null;
  why: string | null;
  qubits: number;
  mode: "state" | "operation";
  ops: OwnLabOp[];
}

export interface OwnModuleContent {
  title: string;
  summary: string | null;
  lessons: OwnLessonDraft[];
  lab: OwnLabDraft | null;
}

/** A lesson as a student reads it. */
export interface OwnLessonView {
  title: string;
  summary: string | null;
  body: string[];
  video_url: string | null;
  practice: string | null;
  quiz: OwnQuestion[];
  minutes: number;
}

export interface OwnModuleView {
  slug: string;
  title: string;
  summary: string | null;
  professor: Person;
  lessons: OwnLessonView[];
  lab: OwnLabDraft | null;
  completed_lessons: number[];
  lab_progress: LabStanding | null;
  /** The viewer wrote it. */
  owner: boolean;
}

export interface OwnModuleCard {
  slug: string;
  title: string;
  summary: string | null;
  professor: Person;
  lessons: number;
  has_lab: boolean;
  percent: number;
}

export function fetchOwnModules() {
  return authed<OwnModuleCard[]>("/api/own-modules");
}

export function fetchOwnModule(slug: string) {
  return authed<OwnModuleView>(`/api/own-modules/${encodeURIComponent(slug)}`);
}

export function markOwnLesson(slug: string, index: number) {
  return authed<OwnModuleView>(
    `/api/own-modules/${encodeURIComponent(slug)}/lessons/${index}`,
    "POST",
  );
}

export function unmarkOwnLesson(slug: string, index: number) {
  return authed<OwnModuleView>(
    `/api/own-modules/${encodeURIComponent(slug)}/lessons/${index}`,
    "DELETE",
  );
}

/* ------------------------------------------------------------------ */
/* Reading one                                                          */

/** The student-side lesson, in the shape the curriculum's lesson bodies read. */
export function asLesson(lesson: OwnLessonView): Lesson {
  return {
    title: lesson.title,
    summary: lesson.summary ?? "",
    minutes: lesson.minutes,
    body: lesson.body,
    practice: lesson.practice ?? undefined,
    video: lesson.video_url ? { url: lesson.video_url } : undefined,
  };
}

export function asQuiz(lesson: OwnLessonView): TestQuestion[] {
  return lesson.quiz.map((question) => ({
    prompt: question.prompt,
    options: question.options,
    answer: question.answer,
    because: question.because ?? "",
  }));
}

/* The server names a CNOT the way Qiskit does; the simulator here calls it
   by its long name. */
const toBoard = (op: OwnLabOp) => ({
  gate: op.gate === "cx" ? "cnot" : op.gate,
  wires: op.wires,
});

/** The lab, in the shape the sandbox's graded studio takes. */
export function asChallenge(module: OwnModuleView): Challenge | null {
  if (!module.lab) return null;
  return {
    slug: module.slug,
    title: module.lab.title || `${module.title} lab`,
    level: 1,
    goal: module.lab.goal ?? "Build the circuit your professor set.",
    why: module.lab.why ?? "",
    qubits: module.lab.qubits,
    mode: module.lab.mode,
    ops: module.lab.ops.map(toBoard),
    setBy: module.professor.display_name,
  };
}

/* ------------------------------------------------------------------ */
/* Writing one                                                          */

export const MAX_LESSONS = 30;
export const MAX_QUESTIONS = 10;
export const MAX_OPTIONS = 6;
export const MAX_LAB_QUBITS = 4;
export const MAX_LAB_GATES = 40;

export function blankLesson(): OwnLessonDraft {
  return {
    title: "",
    summary: null,
    body: null,
    video_url: null,
    practice: null,
    quiz: [],
    origin: null,
  };
}

export function blankQuestion(): OwnQuestion {
  return { prompt: "", options: ["", ""], answer: 0, because: null };
}

export function blankLab(): OwnLabDraft {
  return { title: "", goal: null, why: null, qubits: 2, mode: "state", ops: [] };
}

/** Saved content, ready to edit: every lesson remembers where it started. */
export function toDraft(
  content: OwnModuleContent | null,
  fallback: { title: string; summary: string | null },
): OwnModuleContent {
  const base = content ?? { ...fallback, lessons: [], lab: null };
  return {
    title: base.title,
    summary: base.summary,
    lessons: base.lessons.map((lesson, index) => ({ ...lesson, origin: index })),
    lab: base.lab,
  };
}

/** The answer circuit as the lines a professor would type. */
export function opsToCode(ops: OwnLabOp[]): string {
  return ops
    .map((op) =>
      op.gate === "cx" || op.gate === "cnot"
        ? `qc.cx(${op.wires[0]}, ${op.wires[1]})`
        : `qc.${op.gate}(${op.wires[0]})`,
    )
    .join("\n");
}

/* Lines that belong to a Qiskit file without being part of the circuit. */
const IGNORED_LINE =
  /^\s*(?:from\s+\S+\s+import\b|import\b|qc\s*=\s*QuantumCircuit\s*\(|qc\.(?:barrier|draw)\s*\(|print\s*\(|$)/;

/**
 * The answer circuit, read back from what the professor typed.
 *
 * The sandbox's own parser reads it, so a lab is marked against exactly the
 * circuit the studio would draw from the same text. That parser drops what it
 * cannot read without a word, which is right for a scratch pad and wrong for
 * an answer key: here, every line that does not become a gate is said.
 */
export function codeToOps(
  code: string,
  qubits: number,
): { ops: OwnLabOp[]; problems: string[]; measured: boolean } {
  const parsed = parseQiskitOps(code, MAX_LAB_QUBITS);
  const lines = new Set(parsed.map((op) => op.line));
  const problems: string[] = [];
  const ops: OwnLabOp[] = [];
  let measured = false;

  for (const op of parsed) {
    if (op.gate === "m") {
      measured = true;
      continue;
    }
    const outside = op.wires.find((wire) => wire >= qubits);
    if (outside !== undefined) {
      problems.push(
        `Line ${op.line} uses q${outside}, but the lab has ${qubits} ${qubits === 1 ? "qubit" : "qubits"}.`,
      );
      continue;
    }
    ops.push({ gate: op.gate === "cnot" ? "cx" : op.gate, wires: op.wires });
  }

  code.split("\n").forEach((raw, index) => {
    const line = raw.split("#")[0];
    if (lines.has(index + 1) || IGNORED_LINE.test(line)) return;
    problems.push(
      `Line ${index + 1} is not a gate the lab can use — H, X, Y, Z, S, T and CX, on q0 to q${MAX_LAB_QUBITS - 1}.`,
    );
  });

  if (ops.length > MAX_LAB_GATES) {
    problems.push(`That is ${ops.length} gates; a lab can have up to ${MAX_LAB_GATES}.`);
  }
  return { ops, problems, measured };
}

/** What the answer circuit does from |0…0⟩, as the outcomes it can give. */
export function outcomesOf(ops: OwnLabOp[], qubits: number) {
  const result = simulate(pack(ops.map(toBoard), qubits), qubits);
  return result.labels
    .map((label, index) => ({ label, probability: result.probabilities[index] }))
    .filter((row) => row.probability > 1e-9);
}

const blank = (value: string | null | undefined) => !value || !value.trim();
const text = (value: string | null | undefined) => (blank(value) ? null : value!.trim());

/**
 * The draft as the server takes it, and what is wrong with it.
 *
 * Anything left blank is left out: a lesson with nothing in it, a question
 * with nothing typed, an option nobody filled in. What is half-written is
 * said instead, because guessing which half was meant would publish a
 * question with one answer or a quiz marked against the wrong option.
 */
export function cleanContent(draft: OwnModuleContent, labCode: string) {
  const problems: string[] = [];
  const title = draft.title.trim();
  if (title.length < 2) problems.push("Give the module a name.");

  const lessons: OwnLessonDraft[] = [];
  draft.lessons.forEach((lesson, index) => {
    const where = `Lesson ${index + 1}`;
    const quiz: OwnQuestion[] = [];
    lesson.quiz.forEach((question, q) => {
      const filled = question.options
        .map((option, position) => ({ option: option.trim(), position }))
        .filter((row) => row.option);
      if (blank(question.prompt) && !filled.length && blank(question.because)) return;
      const label = `${where}, question ${q + 1}`;
      if (blank(question.prompt)) {
        problems.push(`${label} has answers but no question.`);
        return;
      }
      if (filled.length < 2) {
        problems.push(`${label} needs at least two answers to choose from.`);
        return;
      }
      if (new Set(filled.map((row) => row.option.toLowerCase())).size < filled.length) {
        problems.push(`${label} has the same answer twice.`);
        return;
      }
      const answer = filled.findIndex((row) => row.position === question.answer);
      if (answer === -1) {
        problems.push(`${label}: mark which answer is right.`);
        return;
      }
      quiz.push({
        prompt: question.prompt.trim(),
        options: filled.map((row) => row.option),
        answer,
        because: text(question.because),
      });
    });

    const video = text(lesson.video_url);
    if (video && !/^https?:\/\//i.test(video)) {
      problems.push(`${where}: a video link has to start with https://.`);
    }

    const empty =
      blank(lesson.title) &&
      blank(lesson.summary) &&
      blank(lesson.body) &&
      !video &&
      blank(lesson.practice) &&
      !quiz.length;
    if (empty && lesson.origin == null) return;

    lessons.push({
      title: lesson.title.trim(),
      summary: text(lesson.summary),
      body: text(lesson.body),
      video_url: video,
      practice: text(lesson.practice),
      quiz,
      origin: lesson.origin ?? null,
    });
  });

  let lab: OwnLabDraft | null = null;
  if (draft.lab) {
    const read = codeToOps(labCode, draft.lab.qubits);
    problems.push(...read.problems.map((problem) => `Lab: ${problem}`));
    if (!read.ops.length && !read.problems.length) {
      problems.push(
        "Lab: write its answer circuit — students are marked against it. Or switch the lab off.",
      );
    }
    lab = {
      title: draft.lab.title.trim(),
      goal: text(draft.lab.goal),
      why: text(draft.lab.why),
      qubits: draft.lab.qubits,
      mode: draft.lab.mode,
      ops: read.ops,
    };
  }

  return {
    content: { title, summary: text(draft.summary), lessons, lab } satisfies OwnModuleContent,
    problems,
  };
}
