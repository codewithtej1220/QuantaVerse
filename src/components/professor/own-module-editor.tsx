"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  FlaskConical,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { AREA, FIELD, SMALL, type Act } from "@/components/professor/styles";
import { ActionButton } from "@/components/site/action";
import { MODE_LABEL, type GradeMode } from "@/lib/challenges";
import {
  MAX_LAB_QUBITS,
  MAX_LESSONS,
  MAX_OPTIONS,
  MAX_QUESTIONS,
  blankLab,
  blankLesson,
  blankQuestion,
  cleanContent,
  codeToOps,
  opsToCode,
  outcomesOf,
  toDraft,
  type OwnLabDraft,
  type OwnLessonDraft,
  type OwnModuleContent,
  type OwnQuestion,
} from "@/lib/own-modules";
import { saveOwnModule, type TaughtModule } from "@/lib/professor";
import { cn } from "@/lib/utils";

/**
 * Writing a module of one's own.
 *
 * Everything a curriculum module has, in the order a student meets it: the
 * lessons — each with its theory, a video, a practice task and a checkpoint
 * quiz — then the graded lab. Every part may be left blank, and what is blank
 * is left out of the page students see: a professor who has only a video and
 * a quiz this week publishes a lesson that is a video and a quiz, not one with
 * empty boxes where the rest would go.
 *
 * Notes are not written here. They are uploaded under the module, as for any
 * module the professor teaches, and the lessons offer them to a student who
 * would rather read than watch.
 */

const LABEL = "font-mono text-[11px] tracking-[0.14em] text-frost uppercase";
const ICON =
  "grid size-8 place-items-center rounded-md text-frost transition-colors hover:bg-strata hover:text-paper focus-visible:outline-2 focus-visible:outline-photon disabled:pointer-events-none disabled:opacity-30";

function Field({
  label,
  optional,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: ReactNode;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className={cn(LABEL, "flex flex-wrap items-baseline gap-x-2")}>
        {label}
        {optional && <span className="text-dim normal-case tracking-normal">optional</span>}
      </label>
      {children}
      {hint && <p className="text-[12px] leading-relaxed text-dim">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface Start {
  draft: OwnModuleContent;
  code: string;
  key: string;
}

const keyOf = (draft: OwnModuleContent, code: string) =>
  JSON.stringify([draft, draft.lab ? code : null]);

/**
 * The module as last saved, ready to edit. `typed` is the answer circuit as
 * the professor wrote it, kept — comments, spacing and all — as long as it
 * still reads as the circuit that was saved.
 */
function startFrom(module: TaughtModule, typed?: string): Start {
  const draft = toDraft(module.content, { title: module.title, summary: module.summary });
  const saved = draft.lab?.ops ?? [];
  const keep =
    typed !== undefined &&
    draft.lab !== null &&
    JSON.stringify(codeToOps(typed, draft.lab.qubits).ops) === JSON.stringify(saved);
  const code = keep ? typed : opsToCode(saved);
  return { draft, code, key: keyOf(draft, code) };
}

const hasWords = (value: string | null) => Boolean(value && value.trim());

function partsOf(lesson: OwnLessonDraft) {
  const parts: string[] = [];
  if (hasWords(lesson.body)) parts.push("theory");
  if (hasWords(lesson.video_url)) parts.push("video");
  if (hasWords(lesson.practice)) parts.push("practice");
  if (lesson.quiz.length) {
    parts.push(`${lesson.quiz.length} ${lesson.quiz.length === 1 ? "question" : "questions"}`);
  }
  return parts;
}

export function OwnModuleEditor({
  module,
  busy,
  act,
  onClose,
}: {
  module: TaughtModule;
  busy: string | null;
  act: Act;
  onClose: () => void;
}) {
  const [start] = useState(() => startFrom(module));
  const [draft, setDraft] = useState(start.draft);
  const [code, setCode] = useState(start.code);
  const [baseline, setBaseline] = useState(start.key);
  /* A lab switched off by mistake comes back as it was. */
  const [parked, setParked] = useState<OwnLabDraft | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  /* Set by a save that was refused. From then on the list is read afresh on
     every edit, so each problem goes as it is fixed rather than waiting for
     the next press of Save to be taken back. */
  const [tried, setTried] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const id = useId();

  const dirty = keyOf(draft, code) !== baseline;
  const problems = tried ? cleanContent(draft, code).problems : [];
  const saving = busy === `save-own-${module.own_id}`;

  /* Leaving the page with unsaved writing asks first. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setLessons = (update: (lessons: OwnLessonDraft[]) => OwnLessonDraft[]) =>
    setDraft((current) => ({ ...current, lessons: update(current.lessons) }));

  const updateLesson = (index: number, patch: Partial<OwnLessonDraft>) =>
    setLessons((lessons) =>
      lessons.map((lesson, at) => (at === index ? { ...lesson, ...patch } : lesson)),
    );

  const addLesson = () => {
    if (draft.lessons.length >= MAX_LESSONS) return;
    setOpen(draft.lessons.length);
    setLessons((lessons) => [...lessons, blankLesson()]);
  };

  const moveLesson = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= draft.lessons.length) return;
    setLessons((lessons) => {
      const next = [...lessons];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setOpen((current) => (current === index ? target : current === target ? index : current));
  };

  const removeLesson = (index: number) => {
    const lesson = draft.lessons[index];
    const name = lesson.title.trim() || `Lesson ${index + 1}`;
    const written = hasWords(lesson.title) || partsOf(lesson).length > 0;
    if (
      written &&
      !window.confirm(
        lesson.origin != null
          ? `Remove “${name}”? Students who finished it lose that tick when you save.`
          : `Remove “${name}”?`,
      )
    ) {
      return;
    }
    setLessons((lessons) => lessons.filter((_, at) => at !== index));
    setOpen((current) =>
      current === null || current < index ? current : current === index ? null : current - 1,
    );
  };

  const setLab = (lab: OwnLabDraft | null) => setDraft((current) => ({ ...current, lab }));

  const toggleLab = (on: boolean) => {
    if (on) {
      setLab(parked ?? blankLab());
    } else {
      setParked(draft.lab);
      setLab(null);
    }
  };

  const save = async () => {
    const cleaned = cleanContent(draft, code);
    setTried(cleaned.problems.length > 0);
    if (cleaned.problems.length || module.own_id === null) return;
    const ownId = module.own_id;
    const typed = code;
    const saved = await act(
      `save-own-${ownId}`,
      async () => {
        const next = await saveOwnModule(ownId, cleaned.content);
        /* Start again from what the server now holds, so each lesson's
           starting place is where it is now — a second save must not move
           students' ticks by the first save's reordering. */
        const entry = next.modules.find((row) => row.own_id === ownId);
        if (entry) {
          const fresh = startFrom(entry, typed);
          setDraft(fresh.draft);
          setCode(fresh.code);
          setBaseline(fresh.key);
          setOpen((current) =>
            current !== null && current < fresh.draft.lessons.length ? current : null,
          );
        }
        return next;
      },
      `${cleaned.content.title} is saved. Your students see this version now.`,
    );
    if (saved) setSavedOnce(true);
  };

  const close = () => {
    if (dirty && !window.confirm("Close the editor without saving? Your changes will be lost.")) {
      return;
    }
    onClose();
  };

  return (
    <div className="mt-6 border-t border-edge pt-6">
      <p className="max-w-2xl text-[13.5px] leading-relaxed text-frost">
        Write it the way a curriculum module is laid out: lessons, each with its theory, a video, a
        practice task and a checkpoint quiz, then a graded lab. Leave out whatever you don&rsquo;t
        need — blank parts don&rsquo;t appear on the page your students see.
      </p>

      {/* The module */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Module name" htmlFor={`${id}-title`}>
          <input
            id={`${id}-title`}
            className={FIELD}
            value={draft.title}
            maxLength={120}
            onChange={(event) => {
              const title = event.target.value;
              setDraft((current) => ({ ...current, title }));
            }}
            placeholder="Week 9 — Quantum error correction"
          />
        </Field>
        <Field label="One line about it" optional htmlFor={`${id}-summary`}>
          <input
            id={`${id}-summary`}
            className={FIELD}
            value={draft.summary ?? ""}
            maxLength={300}
            onChange={(event) => {
              const summary = event.target.value;
              setDraft((current) => ({ ...current, summary }));
            }}
            placeholder="Surface codes, and what a logical qubit costs"
          />
        </Field>
      </div>

      {/* The lessons */}
      <section className="mt-8" aria-labelledby={`${id}-lessons`}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h4 id={`${id}-lessons`} className={LABEL}>
            Lessons · {draft.lessons.length}
          </h4>
          <p className="text-[12px] text-dim">In the order students read them.</p>
        </div>

        {draft.lessons.length === 0 ? (
          <p className="mt-3 text-[13.5px] leading-relaxed text-frost">
            No lessons yet. A module can be only a lab, or only notes — or add a lesson below.
          </p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2.5">
            {draft.lessons.map((lesson, index) => (
              <LessonCard
                key={index}
                lesson={lesson}
                index={index}
                count={draft.lessons.length}
                open={open === index}
                onToggle={() => setOpen(open === index ? null : index)}
                onChange={(patch) => updateLesson(index, patch)}
                onMove={(by) => moveLesson(index, by)}
                onRemove={() => removeLesson(index)}
              />
            ))}
          </ol>
        )}

        <button
          type="button"
          onClick={addLesson}
          disabled={draft.lessons.length >= MAX_LESSONS}
          className={cn(SMALL, "mt-3 border-edge-hi text-paper hover:border-photon")}
        >
          <Plus className="size-3.5" aria-hidden />
          add a lesson
        </button>
      </section>

      {/* The lab */}
      <section className="mt-8" aria-labelledby={`${id}-lab`}>
        <h4 id={`${id}-lab`} className={LABEL}>
          Lab assessment
        </h4>
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={draft.lab !== null}
            onChange={(event) => toggleLab(event.target.checked)}
            className="mt-1 size-3.5 shrink-0 accent-photon"
          />
          <span className="text-[14px] leading-relaxed text-paper">
            End the module with a graded circuit lab
            <span className="block text-[12.5px] text-frost">
              Students build it in the sandbox; Qiskit marks it against your answer circuit, and
              every attempt shows in your table.
            </span>
          </span>
        </label>
        {draft.lab && (
          <LabEditor
            lab={draft.lab}
            code={code}
            moduleTitle={draft.title.trim() || module.title}
            onChange={(patch) =>
              setDraft((current) =>
                current.lab ? { ...current, lab: { ...current.lab, ...patch } } : current,
              )
            }
            onCode={setCode}
          />
        )}
      </section>

      {/* Saving. Pinned to the bottom of the screen while the editor is on it,
          because a module with six lessons open is longer than a screen and
          the button that saves it should not be at the end of it. */}
      <div className="sticky bottom-0 z-10 -mx-5 mt-8 border-t border-edge bg-nebula/95 px-5 py-3.5 backdrop-blur lg:-mx-6 lg:px-6">
        {problems.length > 0 && (
          <div role="alert" className="mb-3 text-[13px] text-collapse">
            <p className="font-medium">Not saved yet — fix these first:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton type="button" disabled={busy !== null || !dirty} onClick={save}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            Save module
          </ActionButton>
          <ActionButton type="button" variant="outline" onClick={close}>
            Close editor
          </ActionButton>
          <span
            role="status"
            className={cn("ml-1 text-[12.5px]", dirty ? "text-frost" : "text-photon")}
          >
            {dirty ? "Unsaved changes" : savedOnce ? "Saved — students see this version" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A lesson                                                            */

function LessonCard({
  lesson,
  index,
  count,
  open,
  onToggle,
  onChange,
  onMove,
  onRemove,
}: {
  lesson: OwnLessonDraft;
  index: number;
  count: number;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<OwnLessonDraft>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const parts = partsOf(lesson);
  const title = lesson.title.trim() || `Lesson ${index + 1}`;
  const words = lesson.body?.trim() ? lesson.body.trim().split(/\s+/).length : 0;

  return (
    <li
      className={cn(
        "rounded-xl border transition-colors",
        open ? "border-edge-hi bg-void/40" : "border-edge",
      )}
    >
      <div className="flex items-center gap-2 py-1.5 pr-2 pl-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          className="flex min-w-0 flex-1 items-center gap-3 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
        >
          <span className="shrink-0 font-mono text-[11px] tracking-[0.14em] text-dim tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0">
            <span
              className={cn(
                "block truncate text-[14.5px]",
                lesson.title.trim() ? "text-paper" : "text-frost",
              )}
            >
              {title}
            </span>
            <span className="block truncate font-mono text-[10.5px] tracking-[0.08em] text-dim">
              {parts.length ? parts.join(" · ") : "nothing written yet"}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "ml-auto size-4 shrink-0 text-frost transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        <span className="flex shrink-0 items-center">
          <button
            type="button"
            className={ICON}
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label={`Move ${title} up`}
            title="Move up"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={ICON}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
            aria-label={`Move ${title} down`}
            title="Move down"
          >
            <ArrowDown className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={cn(ICON, "hover:text-collapse")}
            onClick={onRemove}
            aria-label={`Remove ${title}`}
            title="Remove lesson"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </span>
      </div>

      {open && (
        <div id={`${id}-body`} className="space-y-5 border-t border-edge px-3 pt-5 pb-5 sm:px-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Title"
              optional
              htmlFor={`${id}-title`}
              hint={`Left blank, it is called “Lesson ${index + 1}”.`}
            >
              <input
                id={`${id}-title`}
                className={FIELD}
                value={lesson.title}
                maxLength={140}
                onChange={(event) => onChange({ title: event.target.value })}
                placeholder="Why we need codes at all"
              />
            </Field>
            <Field label="One line under the title" optional htmlFor={`${id}-summary`}>
              <input
                id={`${id}-summary`}
                className={FIELD}
                value={lesson.summary ?? ""}
                maxLength={300}
                onChange={(event) => onChange({ summary: event.target.value })}
                placeholder="A qubit cannot be copied, so it cannot be backed up either"
              />
            </Field>
          </div>

          <Field
            label="Theory"
            optional
            htmlFor={`${id}-theory`}
            hint={
              <>
                Separate paragraphs with a blank line.
                {words > 0 && (
                  <span className="text-frost">
                    {" "}
                    {words} {words === 1 ? "word" : "words"} · about{" "}
                    {Math.max(1, Math.ceil(words / 200))} min to read
                  </span>
                )}
              </>
            }
          >
            <textarea
              id={`${id}-theory`}
              className={cn(AREA, "max-h-[36rem] min-h-44 resize-y field-sizing-content")}
              value={lesson.body ?? ""}
              maxLength={20_000}
              onChange={(event) => onChange({ body: event.target.value })}
              placeholder={
                "Noise flips qubits the way it flips bits, and it also flips phases…\n\nSo a code has to catch both kinds of error without looking at the state it protects."
              }
            />
          </Field>

          <Field
            label="Video link"
            optional
            htmlFor={`${id}-video`}
            hint="A YouTube or Vimeo link, or a link straight to a video file. It plays above the theory."
          >
            <input
              id={`${id}-video`}
              type="url"
              inputMode="url"
              className={FIELD}
              value={lesson.video_url ?? ""}
              maxLength={500}
              onChange={(event) => onChange({ video_url: event.target.value })}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </Field>

          <Field
            label="Practice task"
            optional
            htmlFor={`${id}-practice`}
            hint="Something to try in the sandbox, shown in its own box after the theory."
          >
            <textarea
              id={`${id}-practice`}
              className={cn(AREA, "max-h-60 min-h-20 resize-y field-sizing-content")}
              value={lesson.practice ?? ""}
              maxLength={600}
              onChange={(event) => onChange({ practice: event.target.value })}
              placeholder="Build a Bell pair, then add a CNOT onto a third qubit and measure the parity."
            />
          </Field>

          <QuizEditor quiz={lesson.quiz} onChange={(quiz) => onChange({ quiz })} />
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Its checkpoint                                                      */

function QuizEditor({
  quiz,
  onChange,
}: {
  quiz: OwnQuestion[];
  onChange: (quiz: OwnQuestion[]) => void;
}) {
  const id = useId();
  const update = (index: number, patch: Partial<OwnQuestion>) =>
    onChange(quiz.map((question, at) => (at === index ? { ...question, ...patch } : question)));

  const removeOption = (index: number, option: number) => {
    const question = quiz[index];
    const options = question.options.filter((_, at) => at !== option);
    /* The right answer stays the same answer, wherever it now sits. */
    const answer =
      question.answer === option
        ? 0
        : question.answer > option
          ? question.answer - 1
          : question.answer;
    update(index, { options, answer });
  };

  return (
    <fieldset className="space-y-3">
      <legend className={cn(LABEL, "flex flex-wrap items-baseline gap-x-2")}>
        Checkpoint quiz
        <span className="text-dim normal-case tracking-normal">optional</span>
      </legend>
      <p className="-mt-1 text-[12px] leading-relaxed text-dim">
        Passing it — more than half right — marks the lesson done. With no questions, students mark
        it done themselves.
      </p>

      {quiz.map((question, index) => {
        const name = `${id}-q${index}`;
        return (
          <div key={index} className="well rounded-lg p-3 sm:p-3.5">
            <div className="flex items-start gap-2">
              <span className="mt-3 shrink-0 font-mono text-[11px] text-dim tabular-nums">
                Q{index + 1}
              </span>
              <textarea
                aria-label={`Question ${index + 1}`}
                className={cn(AREA, "min-h-11 flex-1 resize-y bg-nebula py-2 field-sizing-content")}
                rows={2}
                value={question.prompt}
                maxLength={400}
                onChange={(event) => update(index, { prompt: event.target.value })}
                placeholder="What does a parity check tell you about two qubits?"
              />
              <button
                type="button"
                className={cn(ICON, "mt-1.5 hover:text-collapse")}
                onClick={() => onChange(quiz.filter((_, at) => at !== index))}
                aria-label={`Remove question ${index + 1}`}
                title="Remove question"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>

            <div
              role="radiogroup"
              aria-label={`Answers to question ${index + 1} — pick the right one`}
              className="mt-3 space-y-2 sm:pl-7"
            >
              {question.options.map((option, at) => {
                const right = question.answer === at;
                return (
                  <div key={at} className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name={name}
                      checked={right}
                      onChange={() => update(index, { answer: at })}
                      aria-label={`Answer ${at + 1} is the right one`}
                      className="size-3.5 shrink-0 accent-photon"
                    />
                    <input
                      aria-label={`Answer ${at + 1}`}
                      className={cn(
                        FIELD,
                        "h-9 flex-1 bg-nebula text-[13.5px]",
                        right && "border-photon/60",
                      )}
                      value={option}
                      maxLength={200}
                      onChange={(event) =>
                        update(index, {
                          options: question.options.map((value, position) =>
                            position === at ? event.target.value : value,
                          ),
                        })
                      }
                      placeholder={
                        at === 0 ? "Whether they agree, and nothing else" : "Another answer"
                      }
                    />
                    <span
                      className={cn(
                        "hidden w-12 shrink-0 font-mono text-[10px] tracking-[0.12em] uppercase sm:block",
                        right ? "text-photon" : "text-transparent",
                      )}
                      aria-hidden
                    >
                      right
                    </span>
                    <button
                      type="button"
                      className={cn(ICON, "size-7 hover:text-collapse")}
                      disabled={question.options.length <= 2}
                      onClick={() => removeOption(index, at)}
                      aria-label={`Remove answer ${at + 1}`}
                      title="Remove answer"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </div>
                );
              })}
              {question.options.length < MAX_OPTIONS && (
                <button
                  type="button"
                  onClick={() => update(index, { options: [...question.options, ""] })}
                  className="inline-flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.12em] text-frost uppercase hover:text-paper"
                >
                  <Plus className="size-3" aria-hidden />
                  another answer
                </button>
              )}
            </div>

            <div className="mt-3 sm:pl-7">
              <input
                aria-label={`Why the answer to question ${index + 1} is right`}
                className={cn(FIELD, "h-9 bg-nebula text-[13px]")}
                value={question.because ?? ""}
                maxLength={600}
                onChange={(event) => update(index, { because: event.target.value })}
                placeholder="Why it's right — shown after answering (optional)"
              />
            </div>
          </div>
        );
      })}

      {quiz.length < MAX_QUESTIONS && (
        <button
          type="button"
          onClick={() => onChange([...quiz, blankQuestion()])}
          className={cn(SMALL, "border-edge text-frost hover:border-paper hover:text-paper")}
        >
          <Plus className="size-3.5" aria-hidden />
          add a question
        </button>
      )}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* The lab                                                             */

function LabEditor({
  lab,
  code,
  moduleTitle,
  onChange,
  onCode,
}: {
  lab: OwnLabDraft;
  code: string;
  moduleTitle: string;
  onChange: (patch: Partial<OwnLabDraft>) => void;
  onCode: (code: string) => void;
}) {
  const id = useId();
  const read = codeToOps(code, lab.qubits);
  const outcomes = read.ops.length && !read.problems.length ? outcomesOf(read.ops, lab.qubits) : [];
  const zeros = "0".repeat(lab.qubits);

  return (
    <div className="mt-5 space-y-5 rounded-xl border border-edge-hi bg-void/40 p-4 sm:p-5">
      <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-photon uppercase">
        <FlaskConical className="size-3.5" aria-hidden />
        The lab · the assessment
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Lab title"
          optional
          htmlFor={`${id}-title`}
          hint={`Left blank, it is called “${moduleTitle} lab”.`}
        >
          <input
            id={`${id}-title`}
            className={FIELD}
            value={lab.title}
            maxLength={120}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="Catch a bit flip"
          />
        </Field>
        <div className="space-y-1.5">
          <p className={LABEL} id={`${id}-qubits`}>
            Qubits
          </p>
          <div
            role="group"
            aria-labelledby={`${id}-qubits`}
            className="inline-flex border border-edge"
          >
            {Array.from({ length: MAX_LAB_QUBITS }, (_, at) => at + 1).map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={lab.qubits === count}
                onClick={() => onChange({ qubits: count })}
                className={cn(
                  "h-11 w-12 font-mono text-[13px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-photon",
                  lab.qubits === count
                    ? "bg-photon font-semibold text-void"
                    : "text-frost hover:bg-strata hover:text-paper",
                )}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Field
        label="What to build"
        optional
        htmlFor={`${id}-goal`}
        hint="The task, as students read it at the top of the lab."
      >
        <textarea
          id={`${id}-goal`}
          className={cn(AREA, "max-h-60 min-h-20 resize-y field-sizing-content")}
          value={lab.goal ?? ""}
          maxLength={600}
          onChange={(event) => onChange({ goal: event.target.value })}
          placeholder="Encode q0 into three qubits so that a single bit flip on any one of them can be corrected."
        />
      </Field>

      <Field
        label="A hint"
        optional
        htmlFor={`${id}-why`}
        hint="Shown under the task — why it is worth building, or the nudge a stuck student needs."
      >
        <textarea
          id={`${id}-why`}
          className={cn(AREA, "max-h-60 min-h-16 resize-y field-sizing-content")}
          value={lab.why ?? ""}
          maxLength={600}
          onChange={(event) => onChange({ why: event.target.value })}
          placeholder="Two CNOTs copy the basis state, not the qubit — that is the whole trick."
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className={LABEL}>Marked on</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["state", "operation"] as GradeMode[]).map((mode) => (
            <label
              key={mode}
              className={cn(
                "flex cursor-pointer items-start gap-3 border px-3.5 py-3 transition-colors",
                lab.mode === mode
                  ? "border-photon bg-photon/[0.07]"
                  : "border-edge hover:border-edge-hi",
              )}
            >
              <input
                type="radio"
                name={`${id}-mode`}
                checked={lab.mode === mode}
                onChange={() => onChange({ mode })}
                className="mt-1 size-3.5 shrink-0 accent-photon"
              />
              <span>
                <span className="block text-[13.5px] text-paper first-letter:uppercase">
                  {MODE_LABEL[mode].name}
                </span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-frost">
                  {MODE_LABEL[mode].detail}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Answer circuit"
        htmlFor={`${id}-code`}
        hint="In Qiskit, one gate a line — qc.h(0), qc.x(1), qc.cx(0, 1). H, X, Y, Z, S, T and CX. Students never see it; it is what the grader marks their circuit against."
      >
        <textarea
          id={`${id}-code`}
          className={cn(
            AREA,
            "max-h-[28rem] min-h-32 resize-y font-mono text-[13px] field-sizing-content",
          )}
          value={code}
          spellCheck={false}
          onChange={(event) => onCode(event.target.value)}
          placeholder={"qc.h(0)\nqc.cx(0, 1)"}
        />
      </Field>

      {/* What the grader will make of it, so a typo in the key is found now
          rather than by a class of students who cannot pass. */}
      <div className="well rounded-lg px-3.5 py-3 text-[12.5px] leading-relaxed">
        {read.problems.length > 0 ? (
          <ul className="space-y-0.5 text-collapse">
            {read.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : read.ops.length === 0 ? (
          <p className="text-dim">Write the answer circuit and it is read back here.</p>
        ) : (
          <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt className="font-mono text-[10.5px] tracking-[0.14em] text-dim uppercase">
              Reads as
            </dt>
            <dd className="font-mono text-paper">
              {read.ops
                .map((op) =>
                  op.gate === "cx"
                    ? `CX q${op.wires[0]}→q${op.wires[1]}`
                    : `${op.gate.toUpperCase()} q${op.wires[0]}`,
                )
                .join(" · ")}
              <span className="text-dim">
                {" "}
                ({read.ops.length} {read.ops.length === 1 ? "gate" : "gates"})
              </span>
            </dd>
            <dt className="font-mono text-[10.5px] tracking-[0.14em] text-dim uppercase">
              From |{zeros}⟩
            </dt>
            <dd className="font-mono text-paper">
              {outcomes
                .map((row) => `|${row.label}⟩ ${Math.round(row.probability * 1000) / 10}%`)
                .join(" · ")}
            </dd>
          </dl>
        )}
        {read.measured && (
          <p className="mt-1.5 text-dim">
            Measurements are left out: the lab is marked on the circuit itself.
          </p>
        )}
      </div>
    </div>
  );
}
