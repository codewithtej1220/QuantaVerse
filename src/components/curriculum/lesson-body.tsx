"use client";

import Link from "next/link";
import { FlaskConical } from "lucide-react";

import { LessonQuiz } from "@/components/curriculum/lesson-quiz";
import { LessonPlayer } from "@/components/curriculum/lesson-video";
import { useLessonToggle } from "@/components/curriculum/use-lesson-toggle";
import type { Lesson } from "@/lib/lessons";
import type { GradeMode } from "@/lib/challenges";
import { quizFor } from "@/lib/quizzes";

/**
 * The lessons, in reading order: watch it, read it, say you are done.
 *
 * No accordions. A module is read top to bottom once and scrolled back through
 * afterwards, and collapsing five of six sections hides exactly the material
 * somebody arrived for. The outline in the rail is the navigator; this is the
 * thing being navigated.
 *
 * Each lesson ends in a checkpoint, and passing it is what marks the lesson
 * complete — there is no self-declared tick. A button reading "I have read
 * this" costs nothing to press and tells the recommendation engine nothing;
 * more than half of four questions about the page you just read is weak
 * evidence rather than none.
 *
 * The lab is the last thing in the module, below every lesson, because it is
 * the one item here that is measured rather than claimed.
 */

/**
 * A displayed equation, treated as one.
 *
 * It used to be a `pre` set smaller than the prose, tucked against the left
 * margin like a code sample. Notation is not a code sample: it is the thing the
 * paragraphs around it are describing, and on a page of unbroken text it is
 * also the only place the eye is given to rest. So it is set larger than the
 * body, given room either side, labelled, and stood in a well of its own. A
 * page with three of these down it has a shape you can navigate by, which is
 * most of what separates theory that reads as structured from theory that
 * reads as a wall.
 */
function Notation({ lines, caption }: { lines: string[]; caption?: string }) {
  return (
    <figure className="mt-7">
      <div className="overflow-x-auto rounded-xl border border-edge bg-strata/50 px-6 py-5">
        <p className="mb-3.5 font-mono text-[10px] tracking-[0.18em] text-dim uppercase">
          Notation
        </p>
        <div className="flex flex-col gap-2.5">
          {/* Keyed by position, not by text: notation uses blank lines as
              spacers, and two of them share the key "" — React then warns it
              may drop or duplicate a row, which on a page of equations is a
              line of maths quietly going missing. A blank line is also given
              a non-breaking space, because an empty paragraph collapses to
              nothing and takes the spacing it was there to provide with it. */}
          {lines.map((line, index) => (
            <p
              key={index}
              className="font-mono text-[15.5px] leading-snug whitespace-pre text-paper"
            >
              {line || "\u00a0"}
            </p>
          ))}
        </div>
      </div>
      {caption && (
        <figcaption className="mt-2.5 text-[13px] leading-relaxed text-dim">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export function LessonBodies({
  slug,
  lessons,
  lab,
}: {
  slug: string;
  lessons: Lesson[];
  lab: {
    href: string;
    title: string;
    goal: string;
    level: number;
    of: number;
    mode: GradeMode;
  } | null;
}) {
  const { isDone, markDone, pending, signedIn, error } = useLessonToggle(slug);

  if (!lessons.length) return null;

  return (
    <section className="mt-10">
      <div className="flex flex-col gap-12">
        {lessons.map((lesson, index) => {
          const complete = signedIn && isDone(index);
          const busy = pending === index;

          return (
            <article
              key={lesson.title}
              id={`lesson-${index + 1}`}
              className="scroll-mt-28 border-t border-edge pt-8 first:border-0 first:pt-0"
            >
              <p className="font-mono text-[11px] tracking-[0.16em] text-dim uppercase">
                Lesson {String(index + 1).padStart(2, "0")} · {lesson.minutes}{" "}
                min
              </p>
              <h3
                data-tour={index === 0 ? "lesson" : undefined}
                className="mt-2.5 max-w-[22ch] text-[26px] leading-[1.15] font-medium text-balance text-paper sm:text-[30px]"
              >
                {lesson.title}
              </h3>
              {/* The standfirst, which is what it has always been — it was just
                  set in the tertiary tone at body size, so it read as a caption
                  that had drifted up the page rather than as the sentence
                  telling you what the next four paragraphs are for. */}
              <p className="mt-3 max-w-[52rem] text-[16.5px] leading-relaxed text-frost">
                {lesson.summary}
              </p>

              <LessonPlayer video={lesson.video} title={lesson.title} />

              {/* The theory.

                  Three things were making this hard to read and none of them
                  was the writing. It was set in `frost`, the *secondary* text
                  tone, when `paper` is the one the palette designates for body
                  copy — so the main material on the page was dimmer than the
                  furniture around it. The summary above it was in the tertiary
                  tone at body size, so it read as a caption that had drifted up
                  the page. And every paragraph was identical, so nothing said
                  where to start.

                  Colour and hierarchy were the fix. The measure is the
                  column's, on purpose: it ran narrow for a while and the page
                  read worse rather than better — a 500px ribbon of text under a
                  full-width video leaves the right half of every lesson empty,
                  and the eye spends the page noticing the gap instead of
                  reading. It now sets to the same width as the video above it
                  and the notation below it, so a lesson has one left edge and
                  one right edge the whole way down. */}
              <div className="mt-7 flex flex-col gap-5">
                {lesson.body.map((paragraph, i) => (
                  <p
                    key={paragraph.slice(0, 40)}
                    className={
                      i === 0
                        ? "text-[17px] leading-[1.72] text-paper"
                        : "text-[16px] leading-[1.75] text-paper"
                    }
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              {lesson.notation && (
                <Notation
                  lines={lesson.notation.lines}
                  caption={lesson.notation.caption}
                />
              )}

              {lesson.code && (
                <figure className="mt-7">
                  <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-dim uppercase">
                    In Qiskit
                  </p>
                  <pre className="overflow-x-auto rounded-xl bg-sheet px-5 py-4 font-mono text-[13px] leading-relaxed text-void">
                    {lesson.code}
                  </pre>
                </figure>
              )}

              {lesson.practice && (
                <div className="mt-7 rounded-xl border border-photon/30 bg-photon/[0.06] px-5 py-4">
                  <p className="font-mono text-[10px] tracking-[0.18em] text-photon uppercase">
                    Try it in the sandbox
                  </p>
                  <p className="mt-2 text-[15px] leading-relaxed text-paper">
                    {lesson.practice}
                  </p>
                </div>
              )}

              <LessonQuiz
                questions={quizFor(slug, index)}
                index={index}
                complete={complete}
                busy={busy}
                signedIn={signedIn}
                onPass={markDone}
                isLast={index === lessons.length - 1}
              />
            </article>
          );
        })}
      </div>

      {error && <p className="mt-4 text-[13px] text-collapse">{error}</p>}

      {lab && (
        /* The assessment, and it says so. Reading a module is self-reported;
           this is the one thing here that is measured, so it is set apart from
           the lessons rather than listed as another one of them. */
        <div
          id="module-lab"
          className="panel mt-12 scroll-mt-28 rounded-2xl p-6"
        >
          <p className="eyebrow flex items-center gap-2 text-photon">
            <FlaskConical className="size-3.5" aria-hidden />
            Lab {lab.level} of {lab.of} · the assessment
          </p>
          <h3 className="mt-2.5 text-[19px] font-medium text-paper">
            {lab.title}
          </h3>
          <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-paper">
            {lab.goal}
          </p>
          {/* Said before the first attempt, because the two modes accept
              different things: any route to a state, or only a circuit that
              does the whole job on every input. */}
          <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-frost">
            {lab.mode === "state"
              ? "It is marked on the state your circuit reaches, up to a global phase, so any route to that state passes."
              : "It is marked on every input, up to a global phase, so the circuit has to do what the algorithm does — landing on the right answer from |0…0⟩ alone does not pass."}{" "}
            Ticking a lesson is something you say; this is something it checks.
          </p>
          <Link
            href={lab.href}
            className="mt-5 inline-flex h-11 items-center gap-2 bg-photon px-5 text-[13px] font-medium text-void transition-colors hover:bg-photon-hi focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-photon"
          >
            Open the lab
          </Link>
        </div>
      )}
    </section>
  );
}
