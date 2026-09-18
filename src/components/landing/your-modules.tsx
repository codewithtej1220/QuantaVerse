"use client";

import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { ModuleByline } from "@/components/curriculum/module-byline";
import { ActionLink } from "@/components/site/action";
import { Zone } from "@/components/three/stage";
import type { ModuleProgress, ProgressResponse } from "@/lib/auth";
import { MODULES } from "@/lib/data";
import { useLiveProgress } from "@/lib/quest";
import { cn } from "@/lib/utils";

/**
 * The modules for this visitor.
 *
 * Signed in, it is the learner's own path: the modules they are part-way
 * through, the one the server recommends next and why, then whatever else is
 * open to them — at most three, because a short list is a decision and a long
 * one is a catalogue. Signed out, there is nothing to personalise from, so it
 * says so and shows where everybody starts.
 *
 * A professor is not following the path, so they get the modules they teach
 * instead — their classes — and the way to their teaching page.
 */

interface Pick {
  slug: string;
  ket: string;
  title: string;
  label: string;
  why: string;
  percent: number | null;
  lessons: string | null;
  lab: string | null;
  action: string;
}

const SHOWN = 3;

/* The server's reason is a fragment written to follow a "·" on the dashboard;
   on a card of its own it reads as a sentence. */
function sentence(text: string): string {
  if (!text) return text;
  const capital = text[0].toUpperCase() + text.slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}

function fromProgress(data: ProgressResponse): Pick[] {
  const picks: Pick[] = [];
  const add = (row: ModuleProgress, label: string, why: string) => {
    if (picks.some((pick) => pick.slug === row.slug)) return;
    picks.push({
      slug: row.slug,
      ket: row.ket,
      title: row.title,
      label,
      why,
      percent: row.percent,
      lessons: `${row.lessons_completed}/${row.lessons} lessons`,
      lab: row.challenge
        ? row.challenge.passed
          ? `lab passed · ${Math.round(row.challenge.best_score * 100)}%`
          : row.challenge.attempts > 0
            ? `lab · best ${Math.round(row.challenge.best_score * 100)}%`
            : null
        : null,
      action: row.percent > 0 ? "Continue" : "Start",
    });
  };

  /* What is already under way comes first, furthest along first. */
  data.modules
    .filter((row) => row.percent > 0 && row.percent < 100)
    .sort((a, b) => b.percent - a.percent)
    .forEach((row) =>
      add(
        row,
        "Continue",
        `You are ${row.percent}% of the way through — pick up where you stopped.`,
      ),
    );

  /* Then the server's recommendation, with its own reason. */
  const next = data.up_next;
  if (next) {
    const row = data.modules.find((item) => item.slug === next.module_slug);
    if (row) add(row, "Up next", sentence(next.reason));
  }

  /* Then whatever else is open, in the order it builds. */
  data.modules
    .filter((row) => row.state === "available")
    .forEach((row) =>
      add(
        row,
        "Open to you",
        `Ready when you are: ${row.lessons} lessons, about ${row.minutes} minutes.`,
      ),
    );

  /* Everything done: the modules are for revisiting now. */
  if (!picks.length) {
    data.modules
      .filter((row) => row.state === "mastered")
      .forEach((row) =>
        add(row, "Mastered", "Finished — worth a second pass before the next exam."),
      );
  }

  return picks.slice(0, SHOWN);
}

/* A professor's modules are the ones they teach, all of them: it is their list
   of classes, not a recommendation to be trimmed. */
function taught(slugs: string[]): Pick[] {
  return slugs.flatMap((slug) => {
    const entry = MODULES.find((item) => item.slug === slug);
    return entry
      ? [
          {
            slug: entry.slug,
            ket: entry.ket,
            title: entry.title,
            label: "You teach",
            why: "Your class on this module: students ask to join, you decide who is in.",
            percent: null,
            lessons: `${entry.lessons} lessons · ${entry.minutes} min`,
            lab: null,
            action: "Open",
          },
        ]
      : [];
  });
}

function starters(): Pick[] {
  return MODULES.slice(0, SHOWN).map((module, index) => ({
    slug: module.slug,
    ket: module.ket,
    title: module.title,
    label: index === 0 ? "Start here" : "Then",
    why: module.summary,
    percent: null,
    lessons: `${module.lessons} lessons · ${module.minutes} min`,
    lab: null,
    action: "Start",
  }));
}

function Card({ pick }: { pick: Pick }) {
  return (
    <Link
      href={`/curriculum/${pick.slug}`}
      className="panel group flex h-full flex-col gap-4 rounded-2xl p-5 transition-colors hover:border-photon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon sm:p-6"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="ket text-[15px] text-photon">{pick.ket}</span>
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-[0.14em] uppercase",
            pick.label === "Continue" || pick.label === "Up next" || pick.label === "You teach"
              ? "border-photon/60 bg-photon/10 text-photon"
              : "border-edge-hi text-frost",
          )}
        >
          {pick.label}
        </span>
      </span>

      <span>
        <span className="block font-display text-[1.45rem] leading-tight font-extrabold tracking-[-0.02em] text-paper">
          {pick.title}
        </span>
        <ModuleByline slug={pick.slug} className="mt-3" />
      </span>

      <span className="text-[13.5px] leading-relaxed text-frost">{pick.why}</span>

      <span className="mt-auto flex flex-col gap-2.5">
        {pick.percent !== null && (
          <span className="flex items-center gap-3">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-strata">
              <span
                className="block h-full rounded-full bg-photon"
                style={{ width: `${pick.percent}%` }}
              />
            </span>
            <span className="font-mono text-[12px] text-paper tabular-nums">{pick.percent}%</span>
          </span>
        )}
        <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11.5px] text-dim">
            {pick.lessons}
            {pick.lab && (
              <span className="flex items-center gap-1 text-photon">
                <FlaskConical className="size-3" aria-hidden />
                {pick.lab}
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.12em] text-photon uppercase">
            {pick.action}
            <ArrowRight
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </span>
      </span>
    </Link>
  );
}

export function YourModules() {
  const { user } = useAuth();
  const { data, ready, signedIn } = useLiveProgress();
  const teaching = user?.role === "professor";
  const teachesNothing = teaching && user.teaches.length === 0;

  /* Nothing until the account is known, so a signed-in visitor never sees the
     starter cards flash up and get replaced. If their progress cannot be
     loaded, the starters are still a sensible place to point them. */
  let picks: Pick[] | null = null;
  if (ready) {
    const personal = teaching ? taught(user.teaches) : signedIn && data ? fromProgress(data) : [];
    picks = personal.length ? personal : starters();
  }
  const waiting = !ready;

  const heading = teaching
    ? teachesNothing
      ? "Pick the modules you teach."
      : "The modules you teach."
    : signedIn
      ? "Picked for where you are."
      : "Sign in, and this is your path.";
  const lede = teaching
    ? teachesNothing
      ? "Nothing is assigned to you yet. Choose your modules on your teaching page and students can start asking to join your classes."
      : "Each one is a class. Students ask to join, you accept them, and you can see who is furthest ahead and upload notes for the module — all from your teaching page."
    : signedIn
      ? "What you are part-way through, the module to open next and why, and what else is open to you — worked out from the lessons you have finished and the labs you have passed."
      : "Once you are signed in, this shows the modules you are part-way through and the one to open next, worked out from your own lessons and labs. Everyone starts here.";

  return (
    <section className="relative mx-auto max-w-[1440px] px-5 py-24 lg:px-10 lg:py-32">
      <div className="grid items-center gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <header>
          <p className="eyebrow">Your modules</p>
          <h2 className="display-2 mt-5 max-w-2xl text-paper">{heading}</h2>
          <p className="body-text mt-6 max-w-lg">{lede}</p>
          {teaching ? (
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href="/professor">Open your teaching page</ActionLink>
            </div>
          ) : (
            !signedIn && (
              <div className="mt-8 flex flex-wrap gap-3">
                <ActionLink href="/login">Sign in</ActionLink>
                <ActionLink href="/register" variant="outline">
                  Create an account
                </ActionLink>
              </div>
            )
          )}
        </header>
        <Zone
          id="register-pair"
          focus="pair"
          scale={1.15}
          className="h-[14rem] w-full lg:h-[18rem]"
        />
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {picks
          ? picks.map((pick) => <Card key={pick.slug} pick={pick} />)
          : Array.from({ length: SHOWN }, (_, index) => (
              <div
                key={index}
                aria-hidden
                className={cn("panel h-[19rem] rounded-2xl", waiting && "animate-pulse")}
              />
            ))}
      </div>

      <p className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
        <ActionLink href="/curriculum" variant="outline">
          See every module
        </ActionLink>
        <span className="text-[13.5px] text-frost">
          A lock is a suggested order, never a paywall.
        </span>
      </p>
    </section>
  );
}
