"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  Circle,
  FlaskConical,
  Loader2,
  Pencil,
} from "lucide-react";

import {
  LessonBodies,
  type LessonProgress,
} from "@/components/curriculum/lesson-body";
import {
  ModuleNotesProvider,
  NotesShelf,
} from "@/components/curriculum/module-notes";
import {
  useOwnModule,
  type OwnModuleState,
} from "@/components/curriculum/use-own-module";
import { ActionButton, ActionLink } from "@/components/site/action";
import { ApiError } from "@/lib/api";
import {
  asLesson,
  asQuiz,
  markOwnLesson,
  type OwnModuleView,
} from "@/lib/own-modules";
import { initialsOf, type Person } from "@/lib/professor";
import { cn } from "@/lib/utils";

/**
 * A module a professor wrote, as their students take it.
 *
 * Laid out like the curriculum's own module pages — the same lesson bodies,
 * checkpoints, notes shelf and lab card — because to the student it is one
 * more module of their course, not a different kind of page. What differs is
 * where it comes from: it is fetched, because only the professor's class may
 * read it, and its byline is the professor's rather than the site's.
 */

export function OwnModulePage({ slug }: { slug: string }) {
  const state = useOwnModule(slug);
  if (state.kind !== "ready") {
    return (
      <OwnModuleStatus
        state={state}
        back={{ href: "/curriculum", label: "All modules" }}
      />
    );
  }
  return <ModuleBody view={state.view} replace={state.replace} />;
}

function ModuleBody({
  view,
  replace,
}: {
  view: OwnModuleView;
  replace: (view: OwnModuleView) => void;
}) {
  const [pending, setPending] = useState<number | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);

  const lessons = view.lessons.map(asLesson);
  const quizzes = view.lessons.map(asQuiz);
  const minutes = lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);
  const labHref = `/sandbox/own/${view.slug}`;
  const lab = view.lab
    ? {
        href: labHref,
        title: view.lab.title || `${view.title} lab`,
        goal: view.lab.goal ?? "Build the circuit your professor set.",
        mode: view.lab.mode,
      }
    : null;

  /* One-way, as the curriculum's is: a checkpoint passed, or a lesson with no
     checkpoint declared read, marks it; nothing on the page unmarks it. */
  const markDone = async (index: number) => {
    if (view.completed_lessons.includes(index)) return;
    setPending(index);
    setMarkError(null);
    try {
      replace(await markOwnLesson(view.slug, index));
    } catch (error) {
      setMarkError(
        error instanceof ApiError ? error.message : "that did not save",
      );
    } finally {
      setPending(null);
    }
  };

  const progress: LessonProgress = {
    isDone: (index) => view.completed_lessons.includes(index),
    markDone,
    pending,
    signedIn: true,
    error: markError,
  };

  return (
    <div className="min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
        <BackLink href="/curriculum">All modules</BackLink>

        {view.owner && (
          <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-edge-hi bg-strata/60 px-4 py-3 text-[13.5px] text-frost">
            <span>
              This is your module as your students see it. The quizzes and the
              lab work here too, so you can try them.
            </span>
            <Link
              href="/professor"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] text-photon uppercase hover:text-paper"
            >
              <Pencil className="size-3.5" aria-hidden />
              Edit it on your teaching page
            </Link>
          </p>
        )}

        <div className="mt-6 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div className="min-w-0">
            <header className="border-b border-edge pb-7">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-lg border border-photon bg-photon/10 px-2.5 py-1 font-mono text-[11px] tracking-[0.14em] text-photon uppercase">
                  From your professor
                </span>
                <span className="font-mono text-[11px] tracking-[0.16em] text-frost uppercase">
                  {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
                  {minutes > 0 && ` · ${minutes} min`}
                  {lab && " · graded lab"}
                </span>
              </div>
              <h1 className="mt-4 display-2">{view.title}</h1>
              {view.summary && (
                <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-frost">
                  {view.summary}
                </p>
              )}
              <Byline person={view.professor} className="mt-5" />
            </header>

            <ModuleNotesProvider slug={view.slug}>
              <NotesShelf />
              <LessonBodies
                slug={view.slug}
                lessons={lessons}
                quizzes={quizzes}
                progress={progress}
                lab={lab}
                videoOptional
              />
            </ModuleNotesProvider>

            {!lessons.length && !lab && (
              <section className="panel mt-8 rounded-2xl p-5">
                <p className="eyebrow">Nothing to take yet</p>
                <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-frost">
                  {view.owner
                    ? "Add lessons, a quiz or a lab to it from your teaching page — every part is optional. Notes you upload show above."
                    : `${view.professor.display_name} has not added lessons or a lab to this module yet. Any notes they upload show above.`}
                </p>
              </section>
            )}
          </div>

          <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
            {lessons.length > 0 && (
              <Outline
                titles={lessons.map((lesson) => lesson.title)}
                minutes={lessons.map((lesson) => lesson.minutes)}
                isDone={progress.isDone}
                labHref={lab ? labHref : null}
              />
            )}
            {(lessons.length > 0 || lab) && <Standing view={view} />}
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Before there is a module to show                                    */

/** Everything but the module itself: checking, signed out, closed, failed. */
export function OwnModuleStatus({
  state,
  back,
}: {
  state: Exclude<OwnModuleState, { kind: "ready" }>;
  back: { href: string; label: string };
}) {
  let body: ReactNode;
  if (state.kind === "checking" || state.kind === "loading") {
    body = (
      <p className="flex items-center gap-2 text-[14px] text-frost">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {state.kind === "checking"
          ? "Checking your account…"
          : "Loading the module…"}
      </p>
    );
  } else if (state.kind === "signed-out") {
    body = (
      <>
        <p className="eyebrow">From your professor</p>
        <h1 className="mt-3 display-2">Sign in to open this module</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-frost">
          A module your professor wrote is for their class. Sign in with the
          account you joined the class with, and it opens here.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <ActionLink href="/login">Sign in</ActionLink>
          <ActionLink href="/register" variant="outline">
            Create an account
          </ActionLink>
        </div>
      </>
    );
  } else if (state.kind === "closed") {
    body = (
      <>
        <p className="eyebrow">From your professor</p>
        <h1 className="mt-3 display-2">This module isn&rsquo;t open to you</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-frost">
          A module a professor writes goes to the students they have accepted
          into one of their classes. Ask to join a class from any module page;
          once your professor accepts, their modules appear on your curriculum.
        </p>
        <div className="mt-7">
          <ActionLink href="/curriculum">Back to the curriculum</ActionLink>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <p className="eyebrow">From your professor</p>
        <p className="mt-4 text-[14px] text-collapse">{state.error}</p>
        <ActionButton
          type="button"
          variant="outline"
          className="mt-5"
          onClick={state.retry}
        >
          Try again
        </ActionButton>
      </>
    );
  }

  return (
    <div className="min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
        <BackLink href={back.href}>{back.label}</BackLink>
        <div className="mt-6">{body}</div>
      </div>
    </div>
  );
}

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-frost uppercase transition-colors hover:text-photon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
    >
      <ArrowLeft className="size-3.5" />
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* The rail                                                            */

/** "Module by …", for a professor who is an account rather than a listing. */
export function Byline({
  person,
  className,
}: {
  person: Person;
  className?: string;
}) {
  const detail = [person.position, person.institution]
    .filter(Boolean)
    .join(" · ");
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {person.avatar_url ? (
        <Image
          src={person.avatar_url}
          alt=""
          width={44}
          height={44}
          className="size-11 shrink-0 rounded-full object-cover ring-1 ring-edge-hi ring-offset-2 ring-offset-nebula"
        />
      ) : (
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-full bg-strata font-mono text-[13px] text-frost ring-1 ring-edge-hi ring-offset-2 ring-offset-nebula"
        >
          {initialsOf(person.display_name)}
        </span>
      )}
      <span className="min-w-0 leading-snug">
        <span className="block truncate text-[15px] font-medium text-paper">
          <span className="text-frost">Module by </span>
          {person.display_name}
        </span>
        {detail && (
          <span className="block text-[12.5px] text-frost">{detail}</span>
        )}
      </span>
    </span>
  );
}

function Outline({
  titles,
  minutes,
  isDone,
  labHref,
}: {
  titles: string[];
  minutes: number[];
  isDone: (index: number) => boolean;
  labHref: string | null;
}) {
  const done = titles.filter((_, index) => isDone(index)).length;
  return (
    <nav className="panel rounded-2xl p-5" aria-label="Module outline">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Outline</p>
        <p className="font-mono text-[11px] text-frost tabular-nums">
          {done}/{titles.length}
        </p>
      </div>
      <ol className="mt-3 flex flex-col">
        {titles.map((title, index) => {
          const complete = isDone(index);
          return (
            <li key={`${index}:${title}`}>
              <a
                href={`#lesson-${index + 1}`}
                className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-strata focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-photon"
              >
                {complete ? (
                  <Check
                    className="mt-0.5 size-3.5 shrink-0 text-photon"
                    aria-hidden
                  />
                ) : (
                  <Circle
                    className="mt-0.5 size-3 shrink-0 text-frost"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "flex-1 text-[13px] leading-snug",
                    complete ? "text-frost" : "text-paper",
                  )}
                >
                  {title}
                </span>
                <span className="mt-0.5 shrink-0 font-mono text-[10.5px] text-dim tabular-nums">
                  {minutes[index]}m
                </span>
              </a>
            </li>
          );
        })}
        {labHref && (
          <li className="mt-1 border-t border-edge pt-1">
            <Link
              href={labHref}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-strata focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-photon"
            >
              <FlaskConical
                className="size-3.5 shrink-0 text-photon"
                aria-hidden
              />
              <span className="flex-1 text-[13px] text-photon">
                Lab — build it
              </span>
            </Link>
          </li>
        )}
      </ol>
    </nav>
  );
}

/** Where the student stands, counted the way the professor's table counts it. */
function Standing({ view }: { view: OwnModuleView }) {
  const lessons = view.lessons.length;
  const lab = view.lab_progress;
  const units = lessons + (view.lab ? 1 : 0);
  const done = view.completed_lessons.length + (lab?.passed ? 1 : 0);
  const percent = units ? Math.round((done / units) * 100) : 0;

  return (
    <div className="panel rounded-2xl p-5">
      <p className="eyebrow">Your progress</p>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-[34px] leading-none font-medium text-paper tabular-nums">
          {percent}%
        </span>
        <span className="text-[13px] text-frost">of the module</span>
      </p>
      <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-strata">
        <span
          className="block h-full rounded-full bg-photon transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </span>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <dt className="font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">
            Lessons
          </dt>
          <dd className="mt-1 font-mono text-[13px] text-paper tabular-nums">
            {view.completed_lessons.length}/{lessons}
          </dd>
        </div>
        {view.lab && (
          <div>
            <dt className="font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">
              Lab
            </dt>
            <dd
              className={cn(
                "mt-1 font-mono text-[13px]",
                lab?.passed ? "text-photon" : "text-paper",
              )}
            >
              {lab?.passed
                ? "passed"
                : lab?.attempts
                  ? `best ${Math.round(lab.best_score * 100)}%`
                  : "not tried"}
            </dd>
          </div>
        )}
      </dl>
      {!view.owner && (
        <p className="mt-4 text-[12px] leading-relaxed text-dim">
          Your professor sees this on their teaching page, because you are in
          their class.
        </p>
      )}
    </div>
  );
}
