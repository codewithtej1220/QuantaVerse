"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ExternalLink,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserMinus,
  X,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { ActionButton, ActionLink } from "@/components/site/action";
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
  initialsOf,
  removeOwnModule,
  removeStudent,
  setTaughtModules,
  sinceWhen,
  type ClassStudent,
  type ModuleChoice,
  type ProfessorDashboard,
  type TaughtModule,
} from "@/lib/professor";
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

const SMALL =
  "inline-flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[11.5px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon disabled:cursor-not-allowed disabled:opacity-50";

const FIELD =
  "h-11 w-full border border-edge bg-strata px-3.5 text-[14px] text-paper placeholder:text-dim outline-none transition-colors focus:border-photon";

const reason = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

function Initials({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-strata font-mono text-frost ring-1 ring-edge-hi",
        size === "sm" ? "size-8 text-[11px]" : "size-10 text-[12.5px]",
      )}
    >
      {initialsOf(name)}
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
        return (
          <label
            key={module.slug}
            className={cn(
              "flex cursor-pointer items-center gap-3 border px-3 py-2.5 transition-colors",
              on ? "border-photon bg-photon/[0.07]" : "border-edge hover:border-edge-hi",
            )}
          >
            <input
              type="checkbox"
              checked={on}
              onChange={() => onToggle(module.slug)}
              disabled={disabled}
              className="size-3.5 shrink-0 accent-photon"
            />
            <span className="ket shrink-0 text-[12px] text-photon">{module.ket}</span>
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
          <p className="mt-4 text-[14px] text-collapse">{loadError}</p>
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

  return (
    <Frame>
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-edge pb-7">
        <div className="max-w-2xl">
          <p className="eyebrow">Teaching</p>
          <h1 className="mt-3 display-2">{professor.display_name}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-frost">
            {professor.institution ? `${professor.institution} · ` : ""}@{professor.handle}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
          {[
            ["Students", totals.students],
            ["Waiting", totals.requests],
            ["Modules", data.modules.length],
            ["Notes", totals.notes],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">
                {label}
              </dt>
              <dd
                className={cn(
                  "mt-1 text-[28px] leading-none font-medium tabular-nums",
                  label === "Waiting" && Number(value) > 0 ? "text-photon" : "text-paper",
                )}
              >
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
            "mt-6 text-[13.5px]",
            flash.tone === "error" ? "text-collapse" : "text-photon",
          )}
        >
          {flash.text}
        </p>
      )}

      <Requests data={data} busy={busy} act={act} />

      <section className="mt-12">
        <TeachingEditor data={data} busy={busy} act={act} />
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
              />
            ))}
          </div>
        )}
      </section>
    </Frame>
  );
}

type Act = (key: string, work: () => Promise<ProfessorDashboard>, said: string) => Promise<boolean>;

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
      <h2 id="requests-title" className="eyebrow">
        Waiting to join · {data.requests.length}
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
              <li key={request.id} className="panel rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <Initials name={request.student.display_name} />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-paper">
                        {request.student.display_name}
                      </p>
                      <p className="truncate font-mono text-[11.5px] text-dim">
                        @{request.student.handle}
                        {request.student.institution && (
                          <span className="text-frost"> · {request.student.institution}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className={cn("flex shrink-0 gap-2", busy === key && "opacity-50")}>
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
                      className={cn(
                        SMALL,
                        "border-photon bg-photon/10 text-photon hover:bg-photon/20",
                      )}
                    >
                      <Check className="size-3.5" aria-hidden />
                      accept
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
                      className={cn(
                        SMALL,
                        "border-edge text-frost hover:border-paper hover:text-paper",
                      )}
                    >
                      <X className="size-3.5" aria-hidden />
                      decline
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-[13px] text-frost">
                  wants to join <span className="text-paper">{request.module_title}</span>
                </p>
                {request.note && (
                  <p className="mt-2 border-l-2 border-edge-hi pl-3 text-[13.5px] leading-relaxed text-frost italic">
                    {request.note}
                  </p>
                )}
                <p className="mt-2 font-mono text-[11px] text-dim">
                  asked {sinceWhen(request.created_at)}
                </p>
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
}: {
  data: ProfessorDashboard;
  busy: string | null;
  act: Act;
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
        <h2 className="eyebrow">Your modules · {data.modules.length}</h2>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setChosen(current);
              setEditing(true);
            }}
            className={cn(SMALL, "border-edge text-frost hover:border-paper hover:text-paper")}
          >
            <Pencil className="size-3.5" aria-hidden />
            change modules
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
      <OwnModuleForm busy={busy} act={act} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * A module the professor names themselves.
 *
 * The eight are the site's course; a syllabus is bigger than that. This adds a
 * heading of their own — a week of lectures, a seminar, a paper the class is
 * reading — with their notes under it.
 */
function OwnModuleForm({ busy, act }: { busy: string | null; act: Act }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    if (!name) return;
    const saved = await act(
      "own",
      () => addOwnModule(name, summary.trim() || null),
      `${name} is on your teaching page.`,
    );
    if (saved) {
      setTitle("");
      setSummary("");
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(SMALL, "mt-4 border-edge text-frost hover:border-paper hover:text-paper")}
      >
        <Plus className="size-3.5" aria-hidden />
        add a module of your own
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="panel mt-4 space-y-4 rounded-2xl p-5">
      <p className="max-w-2xl text-[13.5px] leading-relaxed text-frost">
        Anything you teach that is not one of the eight — a week of lectures, a seminar, a paper the
        class is reading. Name it and upload your notes under it.
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
  if (!lab) return <span className="text-dim">no lab</span>;
  if (lab.passed) {
    return (
      <span className="text-photon">
        <Check className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
        passed · {Math.round(lab.best_score * 100)}%
      </span>
    );
  }
  if (lab.attempts) {
    return (
      <span className="text-frost">
        best {Math.round(lab.best_score * 100)}% · {lab.attempts}{" "}
        {lab.attempts === 1 ? "try" : "tries"}
      </span>
    );
  }
  return <span className="text-dim">not tried</span>;
}

function ClassPanel({
  module,
  busy,
  act,
  onNotesChanged,
}: {
  module: TaughtModule;
  busy: string | null;
  act: Act;
  onNotesChanged: () => void;
}) {
  const [all, setAll] = useState(false);
  const students = all ? module.students : module.students.slice(0, SHOWN);

  return (
    <article className="panel rounded-2xl p-5 lg:p-6" aria-labelledby={`class-${module.slug}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-3">
            {module.own ? (
              <span className="rounded-lg border border-edge-hi px-2 py-1 font-mono text-[10.5px] tracking-[0.14em] text-frost uppercase">
                your module
              </span>
            ) : (
              <span className="ket rounded-lg border border-photon bg-photon/10 px-2 py-0.5 text-[13px] text-photon">
                {module.ket}
              </span>
            )}
            <span className="font-mono text-[11px] tracking-[0.14em] text-frost uppercase">
              {!module.own && (
                <>
                  {module.students.length} {module.students.length === 1 ? "student" : "students"}
                  {module.pending > 0 && ` · ${module.pending} waiting`} ·{" "}
                </>
              )}
              {module.notes} {module.notes === 1 ? "note" : "notes"}
            </span>
          </p>
          <h3 id={`class-${module.slug}`} className="mt-2.5 text-[21px] font-medium text-paper">
            {module.title}
          </h3>
          {module.own && module.summary && (
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-frost">
              {module.summary}
            </p>
          )}
        </div>
        {module.own ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (module.own_id === null) return;
              void act(
                `own-${module.own_id}`,
                () => removeOwnModule(module.own_id as number),
                `${module.title} is removed.`,
              );
            }}
            className={cn(SMALL, "border-edge text-frost hover:border-collapse hover:text-paper")}
          >
            <Trash2 className="size-3.5" aria-hidden />
            remove
          </button>
        ) : (
          <Link
            href={`/curriculum/${module.slug}`}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] text-frost uppercase transition-colors hover:text-photon"
          >
            module page
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>

      {module.own ? (
        /* Nothing on the site teaches this one, so there is no progress to
           rank and no class to join — only the professor's own notes below. */
        <p className="mt-6 max-w-2xl text-[13px] leading-relaxed text-dim">
          Your own module. Upload whatever your class reads for it; the site has no lessons or lab
          of its own here.
        </p>
      ) : (
        <>
          <h4 className="mt-6 font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">
            Top students
          </h4>
          {module.students.length === 0 ? (
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-frost">
              No students yet. They ask to join from this module&rsquo;s page, and appear here,
              ranked, once you accept them.
            </p>
          ) : (
            /* relative: the table scrolls inside this box on a phone, and the
           screen-reader-only header is absolutely positioned — without a
           positioned box it escapes the scroller and widens the whole page. */
            <div className="relative mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b border-edge-hi text-left font-mono text-[10.5px] tracking-[0.12em] text-dim uppercase">
                    <th scope="col" className="w-10 py-2 pr-3 font-normal">
                      #
                    </th>
                    <th scope="col" className="py-2 pr-3 font-normal">
                      Student
                    </th>
                    <th scope="col" className="w-[26%] py-2 pr-3 font-normal">
                      Progress
                    </th>
                    <th scope="col" className="py-2 pr-3 font-normal">
                      Lessons
                    </th>
                    <th scope="col" className="py-2 pr-3 font-normal">
                      {module.lab_title ? "Lab" : "Lab"}
                    </th>
                    <th scope="col" className="py-2 pr-3 font-normal">
                      Active
                    </th>
                    <th scope="col" className="w-10 py-2 font-normal">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((row) => (
                    <tr key={row.membership_id} className="border-b border-edge last:border-0">
                      <td
                        className={cn(
                          "py-2.5 pr-3 font-mono tabular-nums",
                          row.rank <= 3 ? "text-photon" : "text-frost",
                        )}
                      >
                        {row.rank}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Initials name={row.student.display_name} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-paper">
                              {row.student.display_name}
                            </span>
                            <span className="block truncate font-mono text-[11px] text-dim">
                              @{row.student.handle}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-2.5">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-strata">
                            <span
                              className="block h-full rounded-full bg-photon"
                              style={{ width: `${row.percent}%` }}
                            />
                          </span>
                          <span className="w-10 text-right font-mono text-[12px] text-paper tabular-nums">
                            {row.percent}%
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-[12px] text-frost tabular-nums">
                        {row.lessons_completed}/{row.lessons_total}
                      </td>
                      <td className="py-2.5 pr-3 text-[12.5px]">
                        <LabCell student={row} />
                      </td>
                      <td className="py-2.5 pr-3 text-[12.5px] text-frost">
                        {sinceWhen(row.last_active)}
                      </td>
                      <td className="py-2.5 text-right">
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
                          className="rounded-md p-1.5 text-dim transition-colors hover:text-collapse focus-visible:outline-2 focus-visible:outline-photon disabled:opacity-40"
                        >
                          <UserMinus className="size-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {module.students.length > SHOWN && (
                <button
                  type="button"
                  onClick={() => setAll((value) => !value)}
                  className="mt-3 font-mono text-[11px] tracking-[0.14em] text-photon uppercase hover:text-paper"
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

      <NotesManager slug={module.slug} title={module.title} onChanged={onNotesChanged} />
    </article>
  );
}

/* ------------------------------------------------------------------ */

function NotesManager({
  slug,
  title,
  onChanged,
}: {
  slug: string;
  title: string;
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
        <h4 className="font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">
          Your notes for this module
        </h4>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(SMALL, "border-edge-hi text-paper hover:border-photon")}
          >
            <Upload className="size-3.5" aria-hidden />
            upload a PDF
          </button>
        )}
      </div>

      {notes === null ? (
        <p className="mt-2 text-[13px] text-dim">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="mt-2 text-[13.5px] text-frost">
          None yet. Students on {title} can read the example notes until you add your own.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-edge">
          {notes.map((note) => (
            <li key={note.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-[14px] text-paper">{note.title}</span>
                <span className="block font-mono text-[11px] text-dim">
                  {sinceWhen(note.uploaded_at)} · {describeSize(note.size_bytes)}
                  {note.pages ? ` · ${note.pages} pages` : ""}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void openNote(note)}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10.5px] tracking-[0.1em] text-frost uppercase hover:bg-strata hover:text-paper"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  open
                </button>
                <button
                  type="button"
                  onClick={() => void remove(note)}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10.5px] tracking-[0.1em] text-frost uppercase hover:bg-strata hover:text-collapse"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  delete
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
          className={cn(
            "mt-3 text-[12.5px]",
            message.tone === "error" ? "text-collapse" : "text-photon",
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
