"use client";

import Link from "next/link";
import { Check, FlaskConical, Loader2 } from "lucide-react";

import { LessonPlayer } from "@/components/curriculum/lesson-video";
import { useLessonToggle } from "@/components/curriculum/use-lesson-toggle";
import type { Lesson } from "@/lib/lessons";
import { cn } from "@/lib/utils";

/**
 * The lessons, in reading order: watch it, read it, say you are done.
 *
 * No accordions. A module is read top to bottom once and scrolled back through
 * afterwards, and collapsing five of six sections hides exactly the material
 * somebody arrived for. The outline in the rail is the navigator; this is the
 * thing being navigated.
 *
 * Marking complete sits at the foot of each lesson rather than in the outline,
 * because that is where somebody actually finishes one. A control in the rail
 * has to be aimed at from across the page, and invites ticking a lesson you
 * have not read — which costs the learner the only honest signal the
 * recommendation has to work with.
 */

function Notation({ lines, caption }: { lines: string[]; caption?: string }) {
  return (
    <figure className="mt-5">
      <pre className="overflow-x-auto rounded-xl border border-edge bg-void px-5 py-4 font-mono text-[13px] leading-relaxed text-paper">
        {lines.join("\n")}
      </pre>
      {caption && <figcaption className="mt-2 text-[12.5px] text-dim">{caption}</figcaption>}
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
  const { isDone, toggle, pending, signedIn, error } = useLessonToggle(slug);

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
                Lesson {String(index + 1).padStart(2, "0")} · {lesson.minutes} min
              </p>
              <h3 className="mt-2.5 text-[21px] leading-tight font-medium text-paper">
                {lesson.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-dim">{lesson.summary}</p>

              <LessonPlayer video={lesson.video} title={lesson.title} />

              <div className="mt-6 flex flex-col gap-4">
                {lesson.body.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 40)}
                    className="text-[15.5px] leading-relaxed text-frost"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              {lesson.notation && (
                <Notation lines={lesson.notation.lines} caption={lesson.notation.caption} />
              )}

              {lesson.code && (
                <pre className="mt-5 overflow-x-auto rounded-xl bg-sheet px-5 py-4 font-mono text-[13px] leading-relaxed text-void">
                  {lesson.code}
                </pre>
              )}

              {lesson.practice && (
                <p className="mt-5 border-l-2 border-photon pl-4 text-[14px] leading-relaxed text-paper">
                  <span className="font-mono text-[11px] tracking-[0.14em] text-photon uppercase">
                    Try it
                  </span>
                  <br />
                  {lesson.practice}
                </p>
              )}

              {signedIn && (
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  disabled={busy}
                  aria-pressed={complete}
                  className={cn(
                    "mt-6 inline-flex h-10 items-center gap-2 border px-4 text-[13px] font-medium transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-photon",
                    "disabled:opacity-60",
                    complete
                      ? "border-photon bg-photon/10 text-photon"
                      : "border-edge text-frost hover:border-edge-hi hover:text-paper",
                  )}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="size-4" aria-hidden />
                  )}
                  {complete ? "Completed" : "Mark complete"}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {error && <p className="mt-4 text-[13px] text-collapse">{error}</p>}

      {lab && (
        /* The assessment, and it says so. Reading a module is self-reported;
           this is the one thing here that is measured, so it is set apart from
           the lessons rather than listed as another one of them. */
        <div id="module-lab" className="panel mt-12 scroll-mt-28 rounded-2xl p-6">
          <p className="eyebrow flex items-center gap-2 text-photon">
            <FlaskConical className="size-3.5" aria-hidden />
            Lab · the assessment
          </p>
          <h3 className="mt-2.5 text-[19px] font-medium text-paper">{lab.title}</h3>
          <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-frost">
            Now build it. The simulator marks this by measuring the state your circuit actually
            produces and comparing it to the target — both the final state and the whole operation,
            up to global phase. Ticking a lesson is something you say; this is something it checks.
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
