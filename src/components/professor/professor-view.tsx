"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Hourglass,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserMinus,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { OwnModuleEditor } from "@/components/professor/own-module-editor";
import { FIELD, SMALL, TINT, type Act } from "@/components/professor/styles";
import { ActionButton, ActionLink } from "@/components/site/action";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { ApiError } from "@/lib/api";
import {
  deleteModuleNote,
  describeSize,
  fetchModuleNotes,
  uploadedNoteUrl,
  uploadModuleNote,
  type UploadedNote,
} from "@/lib/notes";
import {
  addOwnModule,
  answerRequest,
  fetchProfessorDashboard,
  removeOwnModule,
  removeStudent,
  setTaughtModules,
  sinceWhen,
  type ClassStudent,
  type ModuleChoice,
  type ProfessorDashboard,
  type TaughtModule,
} from "@/lib/professor";
import { TONE, moduleTone } from "@/lib/tone";
import { cn } from "@/lib/utils";

/**
 * A professor's home: the students waiting to join, and each class ranked.
 *
 * Requests come first because they are the only thing here that is waiting on
 * the professor; everything below them is to read. Every action answers with
 * the whole dashboard, so the page shows what the server now holds rather than
 * a guess at it.
 *
 * The rankings only ever contain students the professor accepted. Accepting a
 * request is the student's consent to be seen, so a professor never gets a
 * league table of people who did not ask to be in it.
 */

const reason = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

/** A module, named in its own colour. */
function ModuleChip({ slug, title }: { slug: string; title: string }) {
  const tone = TONE[moduleTone(slug)];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12.5px] font-semibold",
        tone.soft,
        tone.text,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", tone.solid)} />
      {title}
    </span>
  );
}

/* The top three are told apart at a glance — gold, silver, bronze — and the
   rest are only numbered, so the eye goes to the head of the class first. */
const MEDAL = [
  "bg-amber-400/20 text-amber-200 ring-amber-400/45",
  "bg-slate-300/15 text-slate-100 ring-slate-300/40",
  "bg-orange-400/15 text-orange-200 ring-orange-400/40",
];

function Rank({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "grid size-7 place-items-center rounded-full text-[12px] font-semibold tabular-nums",
        rank <= 3 ? cn("ring-1", MEDAL[rank - 1]) : "text-dim",
      )}
    >
      {rank}
    </span>
  );
}

/* ------------------------------------------------------------------ */

export function ProfessorView() {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <Frame>
        <p className="flex items-center gap-2 text-[14px] text-frost">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Checking your account…
        </p>
      </Frame>
    );
  }

  if (!user) {
    return (
      <Frame>
        <p className="eyebrow">Teaching</p>
        <h1 className="mt-3 display-2">For professors</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-frost">
          Sign in to your teaching account to answer students asking to join your classes, see who
          is furthest ahead on each module you teach, and upload notes for them to read instead of
          the videos.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <ActionLink href="/professor/login">Professor sign in</ActionLink>
          <ActionLink href="/professor/register" variant="outline">
            Create a teaching account
          </ActionLink>
        </div>
      </Frame>
    );
  }

  if (user.role !== "professor") return <StudentAccount />;

  return <Dashboard />;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="mx-auto max-w-[1180px] px-5 lg:px-10">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A student's account, on the teaching page                           */

/* A teaching account is made on the Professor tab at sign-up, the way a
   student's is made on the Student tab; an existing account does not change
   role. So a student who lands here is told so, and offered the way to a
   teaching account, rather than shown a dashboard that could only refuse. */
function StudentAccount() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const switchAccount = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      router.push("/professor/register");
    }
  };

  return (
    <Frame>
      <p className="eyebrow">Teaching</p>
      <h1 className="mt-3 display-2">This is a student account</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-frost">
        You are signed in as {user?.display_name} (@{user?.handle}). Teaching accounts are made on
        the Professor tab when you sign up. Sign out and create one — this account keeps its lessons
        and badges as they are.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <ActionButton type="button" disabled={busy} onClick={switchAccount}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <GraduationCap className="size-4" aria-hidden />
          )}
          Sign out and create a teaching account
        </ActionButton>
        <ActionLink href="/dashboard" variant="outline">
          Back to your dashboard
        </ActionLink>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Choosing modules                                                    */

function ModulePicker({
  catalogue,
  chosen,
  onToggle,
  disabled,
}: {
  catalogue: ModuleChoice[];
  chosen: string[];
  onToggle: (slug: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {catalogue.map((module) => {
        const on = chosen.includes(module.slug);
        const tone = TONE[moduleTone(module.slug)];
        return (
          <label
            key={module.slug}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
              on ? cn(tone.border, tone.soft) : "border-edge hover:border-edge-hi",
            )}
          >
            <input
              type="checkbox"
              checked={on}
              onChange={() => onToggle(module.slug)}
              disabled={disabled}
              className="size-3.5 shrink-0 accent-photon"
            />
            <span className={cn("ket shrink-0 text-[12px]", tone.text)}>{module.ket}</span>
            <span className="min-w-0 text-[13px] leading-snug text-paper">{module.title}</span>
          </label>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The dashboard                                                       */

function Dashboard() {
  const [data, setData] = useState<ProfessorDashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "done" | "error"; text: string } | null>(null);
  const [generation, setGeneration] = useState(0);
  /* The one module being written, if any — held here so that adding a module
     can open it for writing straight away. */
  const [writing, setWriting] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchProfessorDashboard().then(
      (next) => {
        if (!live) return;
        setData(next);
        setLoadError(null);
      },
      (error) => live && setLoadError(reason(error, "your classes could not be loaded")),
    );
    return () => {
      live = false;
    };
  }, [generation]);

  const refresh = useCallback(() => setGeneration((count) => count + 1), []);

  /* Every action runs through here: one at a time, with its result said. */
  const act: Act = async (key, work, said) => {
    setBusy(key);
    setFlash(null);
    try {
      setData(await work());
      setFlash({ tone: "done", text: said });
      return true;
    } catch (error) {
      setFlash({ tone: "error", text: reason(error, "that did not go through") });
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return (
      <Frame>
        <p className="eyebrow">Teaching</p>
        {loadError ? (
          <p className="mt-4 text-[14px] text-bad">{loadError}</p>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-[14px] text-frost">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading your classes…
          </p>
        )}
      </Frame>
    );
  }

  const { professor, totals } = data;
  const counts = [
    { label: "Students", value: totals.students, icon: Users, tone: "text-cyan-300" },
    { label: "Waiting", value: totals.requests, icon: Hourglass, tone: "text-warn" },
    { label: "Modules", value: data.modules.length, icon: BookOpen, tone: "text-violet-300" },
    { label: "Notes", value: totals.notes, icon: FileText, tone: "text-emerald-300" },
  ];

  return (
    <Frame>
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-edge pb-8">
        <div className="flex min-w-0 items-center gap-4">
          <PersonAvatar
            name={professor.display_name}
            toneKey={professor.handle}
            src={professor.avatar_url}
            size="lg"
            className="size-14 text-[19px]"
          />
          <div className="min-w-0">
            <p className="eyebrow">Teaching</p>
            <h1 className="mt-1.5 display-2">{professor.display_name}</h1>
            <p className="mt-2 text-[14.5px] text-frost">
              {professor.institution ? `${professor.institution} · ` : ""}@{professor.handle}
            </p>
          </div>
        </div>
        <dl className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-4">
          {counts.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="panel rounded-xl px-4 py-3.5 sm:min-w-[8.5rem]">
              <dt className="flex items-center justify-between gap-3 text-[12.5px] font-medium text-frost">
                {label}
                <Icon className={cn("size-4", tone)} aria-hidden />
              </dt>
              <dd className={cn("mt-2 text-[28px] leading-none font-semibold tabular-nums", tone)}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {flash && (
        <p
          role={flash.tone === "error" ? "alert" : "status"}
          className={cn(
            "mt-6 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-[13.5px]",
            flash.tone === "error"
              ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
          )}
        >
          {flash.tone === "error" ? (
            <CircleAlert className="size-4 shrink-0" aria-hidden />
          ) : (
            <Check className="size-4 shrink-0" aria-hidden />
          )}
          {flash.text}
        </p>
      )}

      <Requests data={data} busy={busy} act={act} />

      <section className="mt-12">
        <TeachingEditor
          data={data}
          busy={busy}
          act={act}
          onAdded={(slug) => {
            setWriting(slug);
            window.setTimeout(
              () =>
                document
                  .getElementById(`class-${slug}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" }),
              60,
            );
          }}
        />
        {data.modules.length === 0 ? (
          <p className="mt-5 max-w-2xl text-[14px] leading-relaxed text-frost">
            You don&rsquo;t teach any modules yet. Pick the ones you teach and students will be able
            to ask to join your class on each of them.
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-6">
            {data.modules.map((module) => (
              <ClassPanel
                key={module.slug}
                module={module}
                busy={busy}
                act={act}
                onNotesChanged={refresh}
                writing={writing === module.slug}
                onWrite={(on) => setWriting(on ? module.slug : null)}
              />
            ))}
          </div>
        )}
      </section>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */

function Requests({
  data,
  busy,
  act,
}: {
  data: ProfessorDashboard;
  busy: string | null;
  act: Act;
}) {
  return (
    <section className="mt-10" aria-labelledby="requests-title">
      <h2
        id="requests-title"
        className="flex items-center gap-2.5 text-[18px] font-semibold tracking-[-0.01em] text-paper"
      >
        Waiting to join
        <span className={cn("pill", data.requests.length ? "text-warn" : "text-dim")}>
          {data.requests.length}
        </span>
      </h2>
      {data.requests.length === 0 ? (
        <p className="mt-3 text-[14px] text-frost">
          Nobody is waiting. Students ask to join from the page of a module you teach.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.requests.map((request) => {
            const key = `request-${request.id}`;
            return (
              <li
                key={request.id}
                className={cn(
                  "panel flex flex-col rounded-2xl p-5 transition-opacity",
                  busy === key && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <PersonAvatar
                      name={request.student.display_name}
                      toneKey={request.student.handle}
                      src={request.student.avatar_url}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[15.5px] font-semibold text-paper">
                        {request.student.display_name}
                      </p>
                      <p className="truncate text-[12.5px] text-dim">
                        @{request.student.handle}
                        {request.student.institution && ` · ${request.student.institution}`}
                      </p>
                    </div>
                  </div>
                  <span className="pill shrink-0 text-warn">
                    <Hourglass className="size-3" aria-hidden />
                    Waiting
                  </span>
                </div>

                <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13.5px] text-frost">
                  Wants to join
                  <ModuleChip slug={request.module_slug} title={request.module_title} />
                </p>
                {request.note && (
                  <p className="mt-3 rounded-xl bg-strata px-3.5 py-2.5 text-[13.5px] leading-relaxed text-paper">
                    &ldquo;{request.note}&rdquo;
                  </p>
                )}

                <div className="flex-1" aria-hidden />
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-edge pt-4">
                  <span className="mr-auto flex items-center gap-1.5 text-[12.5px] text-dim">
                    <Clock className="size-3.5" aria-hidden />
                    Asked {sinceWhen(request.created_at)}
                  </span>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      act(
                        key,
                        () => answerRequest(request.id, true),
                        `${request.student.display_name} is in your ${request.module_title} class.`,
                      )
                    }
                    className={cn(SMALL, TINT.go)}
                  >
                    <Check className="size-3.5" aria-hidden />
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      act(
                        key,
                        () => answerRequest(request.id, false),
                        `Declined ${request.student.display_name}'s request.`,
                      )
                    }
                    className={cn(SMALL, TINT.stop)}
                  >
                    <X className="size-3.5" aria-hidden />
                    Decline
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function TeachingEditor({
  data,
  busy,
  act,
  onAdded,
}: {
  data: ProfessorDashboard;
  busy: string | null;
  act: Act;
  onAdded: (slug: string) => void;
}) {
  const current = data.modules.map((module) => module.slug);
  /* Open from the start for a professor who teaches nothing yet: sign-up does
     not ask, so this is the first thing a new teaching account needs to do. */
  const [editing, setEditing] = useState(current.length === 0);
  const [chosen, setChosen] = useState<string[]>(current);

  const toggle = (slug: string) =>
    setChosen((list) =>
      list.includes(slug) ? list.filter((item) => item !== slug) : [...list, slug],
    );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[18px] font-semibold tracking-[-0.01em] text-paper">
          Your modules
          <span className="pill text-cyan-300">{data.modules.length}</span>
        </h2>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setChosen(current);
              setEditing(true);
            }}
            className={cn(SMALL, TINT.quiet)}
          >
            <Pencil className="size-3.5" aria-hidden />
            Change modules
          </button>
        )}
      </div>
      {editing && (
        <div className="panel mt-4 rounded-2xl p-5">
          <p className="mb-3 text-[13.5px] leading-relaxed text-frost">
            Dropping a module hides its class here and on the module page. Its students and requests
            are kept, and come back if you take the module on again.
          </p>
          <ModulePicker catalogue={data.catalogue} chosen={chosen} onToggle={toggle} />
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                if (
                  await act("modules", () => setTaughtModules(chosen), "Your modules are saved.")
                ) {
                  setEditing(false);
                }
              }}
            >
              {busy === "modules" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              Save modules
            </ActionButton>
            <ActionButton type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </ActionButton>
          </div>
        </div>
      )}
      <OwnModuleForm modules={data.modules} busy={busy} act={act} onAdded={onAdded} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * A module the professor adds themselves.
 *
 * The eight are the site's course; a syllabus is bigger than that. This names
 * one of their own — a week of lectures, a seminar, a paper the class is
 * reading — and opens it for writing: lessons, a quiz, a lab and notes, any of
 * which can wait or be left out.
 */
function OwnModuleForm({
  modules,
  busy,
  act,
  onAdded,
}: {
  modules: TaughtModule[];
  busy: string | null;
  act: Act;
  onAdded: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    if (!name) return;
    const before = new Set(modules.map((module) => module.slug));
    let added: string | null = null;
    const saved = await act(
      "own",
      async () => {
        const next = await addOwnModule(name, summary.trim() || null);
        added = next.modules.find((module) => module.own && !before.has(module.slug))?.slug ?? null;
        return next;
      },
      `${name} is on your teaching page. Write its lessons and lab below.`,
    );
    if (saved) {
      setTitle("");
      setSummary("");
      setOpen(false);
      if (added) onAdded(added);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn(SMALL, TINT.own, "mt-4")}>
        <Plus className="size-3.5" aria-hidden />
        Add a module of your own
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="panel mt-4 space-y-4 rounded-2xl p-5">
      <p className="max-w-2xl text-[13.5px] leading-relaxed text-frost">
        Anything you teach that is not one of the eight — a week of lectures, a seminar, a paper the
        class is reading. Name it, then write it like any module here: lessons with theory, videos,
        practice and checkpoint quizzes, a graded lab, and your notes. Every part is optional, and
        it goes to the students you have accepted into any of your classes.
      </p>
      <div className="space-y-1.5">
        <label
          htmlFor="own_title"
          className="font-mono text-[12px] tracking-[0.16em] text-frost uppercase"
        >
          Module name
        </label>
        <input
          id="own_title"
          className={FIELD}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Week 9 — Quantum error correction"
          maxLength={120}
          required
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="own_summary"
          className="font-mono text-[12px] tracking-[0.16em] text-frost uppercase"
        >
          One line about it <span className="text-dim">optional</span>
        </label>
        <input
          id="own_summary"
          className={FIELD}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Surface codes, and what a logical qubit costs"
          maxLength={300}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <ActionButton type="submit" disabled={busy !== null || !title.trim()}>
          {busy === "own" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          Add module
        </ActionButton>
        <ActionButton
          type="button"
          variant="outline"
          onClick={() => {
            setOpen(false);
            setTitle("");
            setSummary("");
          }}
        >
          Cancel
        </ActionButton>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

const SHOWN = 5;

function LabCell({ student }: { student: ClassStudent }) {
  const lab = student.lab;
  if (!lab) return <span className="text-dim">No lab</span>;
  const best = Math.round(lab.best_score * 100);
  if (lab.passed) {
    return (
      <span className="pill text-ok">
        <Check className="size-3" aria-hidden />
        Passed · {best}%
      </span>
    );
  }
  if (lab.attempts) {
    return (
      <span className="pill text-warn">
        Best {best}% · {lab.attempts} {lab.attempts === 1 ? "try" : "tries"}
      </span>
    );
  }
  return <span className="pill text-dim">Not tried</span>;
}

function ClassPanel({
  module,
  busy,
  act,
  onNotesChanged,
  writing,
  onWrite,
}: {
  module: TaughtModule;
  busy: string | null;
  act: Act;
  onNotesChanged: () => void;
  writing: boolean;
  onWrite: (on: boolean) => void;
}) {
  const [all, setAll] = useState(false);
  const students = all ? module.students : module.students.slice(0, SHOWN);
  /* A student is in a professor's own module through one of their other
     classes, so there is no place in this one to remove them from. */
  const removable = !module.own;
  const empty = module.own && module.lessons === 0 && !module.lab_title;
  const tone = TONE[moduleTone(module.slug)];

  return (
    <article className="panel rounded-2xl p-5 lg:p-6" aria-labelledby={`class-${module.slug}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            {module.own ? (
              <span className="pill text-grape">Your module</span>
            ) : (
              <span
                className={cn(
                  "ket rounded-lg px-2.5 py-1 text-[13px] font-medium",
                  tone.soft,
                  tone.text,
                )}
              >
                {module.ket}
              </span>
            )}
            {module.own ? (
              <>
                <span className="pill text-frost">
                  {module.lessons} {module.lessons === 1 ? "lesson" : "lessons"}
                </span>
                <span className={cn("pill", module.lab_title ? "text-ok" : "text-dim")}>
                  {module.lab_title ? "Graded lab" : "No lab"}
                </span>
                <span className="pill text-cyan-300">{module.students.length} started</span>
              </>
            ) : (
              <>
                <span className="pill text-cyan-300">
                  {module.students.length} {module.students.length === 1 ? "student" : "students"}
                </span>
                {module.pending > 0 && (
                  <span className="pill text-warn">{module.pending} waiting</span>
                )}
              </>
            )}
            <span className="pill text-frost">
              {module.notes} {module.notes === 1 ? "note" : "notes"}
            </span>
          </p>
          <h3
            id={`class-${module.slug}`}
            className="mt-3 text-[22px] font-semibold tracking-[-0.015em] text-paper"
          >
            {module.title}
          </h3>
          {module.own && module.summary && (
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-frost">
              {module.summary}
            </p>
          )}
        </div>
        {module.own ? (
          <div className="flex flex-wrap items-center gap-2">
            {!writing && (
              <button type="button" onClick={() => onWrite(true)} className={cn(SMALL, TINT.own)}>
                <Pencil className="size-3.5" aria-hidden />
                {empty ? "Write the module" : "Edit module"}
              </button>
            )}
            <Link href={`/curriculum/own/${module.slug}`} className={cn(SMALL, TINT.quiet)}>
              View as a student
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                if (module.own_id === null) return;
                if (
                  !window.confirm(
                    `Remove ${module.title}? Its lessons, lab and notes are deleted, and your students no longer see it.`,
                  )
                ) {
                  return;
                }
                void act(
                  `own-${module.own_id}`,
                  () => removeOwnModule(module.own_id as number),
                  `${module.title} is removed.`,
                );
              }}
              className={cn(SMALL, TINT.stop)}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Remove
            </button>
          </div>
        ) : (
          <Link href={`/curriculum/${module.slug}`} className={cn(SMALL, TINT.quiet)}>
            Module page
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>

      {writing ? (
        <OwnModuleEditor module={module} busy={busy} act={act} onClose={() => onWrite(false)} />
      ) : empty ? (
        /* Named, and nothing written under it yet. */
        <p className="mt-6 max-w-2xl text-[13.5px] leading-relaxed text-frost">
          Nothing for students to take yet. Write lessons — theory, a video, a practice task, a
          checkpoint quiz — and a graded lab, or just upload notes below; every part is optional. It
          goes to the students you have accepted into any of your classes.
        </p>
      ) : (
        <>
          <h4 className="mt-7 text-[13px] font-semibold text-frost">Top students</h4>
          {module.students.length === 0 ? (
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-frost">
              {module.own
                ? "Nobody has started it yet. It is on the curriculum page of every student you have accepted into one of your classes, and they appear here, ranked, once they begin."
                : "No students yet. They ask to join from this module\u2019s page, and appear here, ranked, once you accept them."}
            </p>
          ) : (
            /* relative: the table scrolls inside this box on a phone, and the
           screen-reader-only header is absolutely positioned — without a
           positioned box it escapes the scroller and widens the whole page. */
            <div className="relative mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b border-edge text-left text-[12px] font-medium text-dim">
                    <th scope="col" className="w-12 py-2.5 pr-3 font-medium">
                      #
                    </th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">
                      Student
                    </th>
                    <th scope="col" className="w-[26%] py-2.5 pr-3 font-medium">
                      Progress
                    </th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">
                      Lessons
                    </th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">
                      Lab
                    </th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">
                      Active
                    </th>
                    {removable && (
                      <th scope="col" className="w-10 py-2 font-normal">
                        <span className="sr-only">Remove</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {students.map((row) => (
                    <tr key={row.membership_id} className="border-b border-edge last:border-0">
                      <td className="py-3 pr-3">
                        <Rank rank={row.rank} />
                      </td>
                      <td className="py-3 pr-3">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <PersonAvatar
                            name={row.student.display_name}
                            toneKey={row.student.handle}
                            src={row.student.avatar_url}
                            size="sm"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-paper">
                              {row.student.display_name}
                            </span>
                            <span className="block truncate text-[12px] text-dim">
                              @{row.student.handle}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="flex items-center gap-2.5">
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-strata">
                            <span
                              className={cn("block h-full rounded-full", tone.solid)}
                              style={{ width: `${row.percent}%` }}
                            />
                          </span>
                          <span className="w-11 text-right text-[13px] font-semibold text-paper tabular-nums">
                            {row.percent}%
                          </span>
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-[13px] text-frost tabular-nums">
                        {row.lessons_completed}/{row.lessons_total}
                      </td>
                      <td className="py-3 pr-3 text-[12.5px]">
                        <LabCell student={row} />
                      </td>
                      <td className="py-3 pr-3 text-[13px] text-frost">
                        {sinceWhen(row.last_active)}
                      </td>
                      {removable && (
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            disabled={busy !== null}
                            title={`Remove ${row.student.display_name} from this class`}
                            aria-label={`Remove ${row.student.display_name} from this class`}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Remove ${row.student.display_name} from your ${module.title} class? They can ask to join again.`,
                                )
                              )
                                return;
                              void act(
                                `remove-${row.membership_id}`,
                                () => removeStudent(row.membership_id),
                                `${row.student.display_name} is no longer in your ${module.title} class.`,
                              );
                            }}
                            className="rounded-lg p-1.5 text-dim transition-colors hover:bg-rose-400/10 hover:text-rose-300 focus-visible:outline-2 focus-visible:outline-photon disabled:opacity-40"
                          >
                            <UserMinus className="size-4" aria-hidden />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {module.students.length > SHOWN && (
                <button
                  type="button"
                  onClick={() => setAll((value) => !value)}
                  className="mt-3 text-[13px] font-medium text-photon hover:text-paper"
                >
                  {all ? `Show the top ${SHOWN}` : `Show all ${module.students.length}`}
                </button>
              )}
            </div>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-dim">
            Ranked by how much of the module is done — lessons plus the lab — then by the
            lab&rsquo;s best score, then by who passed it first.
          </p>
        </>
      )}

      <NotesManager
        slug={module.slug}
        title={module.title}
        own={module.own}
        onChanged={onNotesChanged}
      />
    </article>
  );
}

/* ------------------------------------------------------------------ */

function NotesManager({
  slug,
  title,
  own,
  onChanged,
}: {
  slug: string;
  title: string;
  own: boolean;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState<UploadedNote[] | null>(null);
  const [maxBytes, setMaxBytes] = useState(20 * 1024 * 1024);
  const [generation, setGeneration] = useState(0);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "done" | "error"; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    let live = true;
    fetchModuleNotes(slug).then(
      (data) => {
        if (!live) return;
        setNotes(data.notes.filter((note) => note.mine));
        setMaxBytes(data.max_bytes);
      },
      (error) =>
        live && setMessage({ tone: "error", text: reason(error, "notes could not be loaded") }),
    );
    return () => {
      live = false;
    };
  }, [slug, generation]);

  const pick = (next: File | null) => {
    setMessage(null);
    setFile(null);
    if (!next) return;
    if (!(next.type === "application/pdf" || /\.pdf$/i.test(next.name))) {
      setMessage({ tone: "error", text: "Choose a PDF. Export or print the notes to PDF first." });
      return;
    }
    if (next.size > maxBytes) {
      setMessage({
        tone: "error",
        text: `That file is ${describeSize(next.size)}; the limit is ${describeSize(maxBytes)}.`,
      });
      return;
    }
    setFile(next);
    if (!noteTitle.trim()) {
      setNoteTitle(
        next.name
          .replace(/\.pdf$/i, "")
          .replace(/[_-]+/g, " ")
          .trim()
          .slice(0, 140),
      );
    }
  };

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !noteTitle.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const note = await uploadModuleNote(slug, file, { title: noteTitle.trim() });
      setMessage({
        tone: "done",
        text: `Uploaded “${note.title}”. Students see it on the module page.`,
      });
      setFile(null);
      setNoteTitle("");
      if (input.current) input.current.value = "";
      setOpen(false);
      setGeneration((count) => count + 1);
      onChanged();
    } catch (error) {
      setMessage({ tone: "error", text: reason(error, "the upload did not go through") });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (note: UploadedNote) => {
    if (!window.confirm(`Delete “${note.title}”? Students will no longer see it.`)) return;
    try {
      await deleteModuleNote(note.id);
      setGeneration((count) => count + 1);
      onChanged();
    } catch (error) {
      setMessage({ tone: "error", text: reason(error, "those notes could not be deleted") });
    }
  };

  const openNote = async (note: UploadedNote) => {
    const tab = window.open("about:blank", "_blank");
    try {
      const url = await uploadedNoteUrl(note.id);
      if (tab) tab.location.href = url;
    } catch (error) {
      tab?.close();
      setMessage({ tone: "error", text: reason(error, "those notes could not be opened") });
    }
  };

  return (
    <div className="mt-6 border-t border-edge pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-[13px] font-semibold text-frost">Your notes for this module</h4>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className={cn(SMALL, TINT.quiet)}>
            <Upload className="size-3.5" aria-hidden />
            Upload a PDF
          </button>
        )}
      </div>

      {notes === null ? (
        <p className="mt-2 text-[13px] text-dim">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="mt-2 text-[13.5px] text-frost">
          {own
            ? `None yet. Notes you upload show at the top of ${title}, and in each lesson for a student who would rather read than watch.`
            : `None yet. Students on ${title} can read the example notes until you add your own.`}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-edge">
          {notes.map((note) => (
            <li key={note.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300">
                  <FileText className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium text-paper">
                    {note.title}
                  </span>
                  <span className="block text-[12px] text-dim">
                    {sinceWhen(note.uploaded_at)} · {describeSize(note.size_bytes)}
                    {note.pages ? ` · ${note.pages} pages` : ""}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void openNote(note)}
                  className={cn(SMALL, TINT.quiet)}
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => void remove(note)}
                  className={cn(SMALL, TINT.stop)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form
          onSubmit={upload}
          className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        >
          <label className="flex flex-col gap-1.5" htmlFor={`${id}-file`}>
            <span className="text-[12.5px] text-frost">PDF, up to {describeSize(maxBytes)}</span>
            <input
              ref={input}
              id={`${id}-file`}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => pick(event.target.files?.[0] ?? null)}
              className="block w-full text-[13px] text-frost file:mr-3 file:border file:border-edge-hi file:bg-strata file:px-3 file:py-1.5 file:text-[12.5px] file:text-paper"
            />
          </label>
          <label className="flex flex-col gap-1.5" htmlFor={`${id}-title`}>
            <span className="text-[12.5px] text-frost">Title</span>
            <input
              id={`${id}-title`}
              className={FIELD}
              value={noteTitle}
              maxLength={140}
              onChange={(event) => setNoteTitle(event.target.value)}
              placeholder="Week 3 lecture notes"
              required
            />
          </label>
          <span className="flex gap-2">
            <ActionButton type="submit" disabled={busy || !file || !noteTitle.trim()}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )}
              Upload
            </ActionButton>
            <ActionButton type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </ActionButton>
          </span>
        </form>
      )}

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={cn("mt-3 text-[12.5px]", message.tone === "error" ? "text-bad" : "text-ok")}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
