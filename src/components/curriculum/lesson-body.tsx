"use client";

import Link from "next/link";
import { FlaskConical } from "lucide-react";

import { LessonQuiz } from "@/components/curriculum/lesson-quiz";
import { LessonPlayer } from "@/components/curriculum/lesson-video";
import { useLessonToggle } from "@/components/curriculum/use-lesson-toggle";
import type { Lesson } from "@/lib/lessons";
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
          {lines.map((line) => (
            <p
              key={line}
              className="font-mono text-[15.5px] leading-snug whitespace-pre text-paper"
            >
              {line}
            </p>
          ))}
        </div>
      </div>
      {caption && (
        <figcaption className="mt-2.5 max-w-[34rem] text-[13px] leading-relaxed text-dim">
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
  lab: { href: string; title: string } | null;
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
              <h3 className="mt-2.5 max-w-[22ch] text-[26px] leading-[1.15] font-medium text-balance text-paper sm:text-[30px]">
                {lesson.title}
              </h3>
              {/* The standfirst, which is what it has always been — it was just
                  set in the tertiary tone at body size, so it read as a caption
                  that had drifted up the page rather than as the sentence
                  telling you what the next four paragraphs are for. */}
              <p className="mt-3 max-w-[34rem] text-[16.5px] leading-relaxed text-frost">
                {lesson.summary}
              </p>

              <LessonPlayer video={lesson.video} title={lesson.title} />

              {/* The theory.

                  Three things were making this hard to read and none of them
                  was the writing. It was set in `frost`, the *secondary* text
                  tone, when `paper` is the one the palette designates for body
                  copy — so the main material on the page was dimmer than the
                  furniture around it. It ran the full 800px of the column,
                  which at this size is about 104 characters a line, where a
                  reader's eye reliably finds the next line at around 65. And
                  every paragraph was identical, so nothing said where to start.

                  Now: the page's own body colour, a measure that fits, and a
                  first paragraph set a step larger to open the section.

                  The width is in rem rather than `ch` on purpose. `ch` is the
                  width of a zero, and IBM Plex Sans averages about 0.43em over
                  real prose — so `60ch` measured out at 79 characters, not 60,
                  and sizing by it quietly misses by a fifth. */}
              <div className="mt-7 flex max-w-[31rem] flex-col gap-5">
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
                <div className="mt-7 max-w-[31rem] rounded-xl border border-photon/30 bg-photon/[0.06] px-5 py-4">
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
            Lab · the assessment
          </p>
          <h3 className="mt-2.5 text-[19px] font-medium text-paper">
            {lab.title}
          </h3>
          <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-frost">
            Now build it. The simulator marks this by measuring the state your
            circuit actually produces and comparing it to the target — both the
            final state and the whole operation, up to global phase. Ticking a
            lesson is something you say; this is something it checks.
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
