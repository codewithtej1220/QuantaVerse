import Link from "next/link";
import { FlaskConical } from "lucide-react";

import type { Lesson } from "@/lib/lessons";

/**
 * The lessons themselves, laid out in order under the outline.
 *
 * The outline above stays the tracker — it is where a lesson gets ticked, and
 * duplicating that control next to every body would mean two widgets writing
 * the same row. These are the bodies, anchored so the outline can jump to one.
 *
 * Reading order is the whole layout. No accordions: a module is a thing you
 * read top to bottom once and scroll back through afterwards, and collapsing
 * five of six sections hides exactly the material somebody came for. The lab is
 * at the end, framed as what it is — the assessment, after the teaching, not
 * instead of it.
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
  lessons,
  lab,
}: {
  lessons: Lesson[];
  lab: { href: string; title: string } | null;
}) {
  if (!lessons.length) return null;

  return (
    <section className="mt-12">
      <h2 className="eyebrow">Learn</h2>

      <div className="mt-5 flex flex-col gap-10">
        {lessons.map((lesson, index) => (
          <article
            key={lesson.title}
            id={`lesson-${index + 1}`}
            className="scroll-mt-28 border-t border-edge pt-7 first:border-0 first:pt-0"
          >
            <p className="font-mono text-[11px] tracking-[0.16em] text-dim uppercase">
              Lesson {String(index + 1).padStart(2, "0")} · {lesson.minutes} min
            </p>
            <h3 className="mt-2.5 text-[21px] leading-tight font-medium text-paper">
              {lesson.title}
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-dim">{lesson.summary}</p>

            <div className="mt-5 flex flex-col gap-4">
              {lesson.body.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="text-[15.5px] leading-relaxed text-frost">
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
          </article>
        ))}
      </div>

      {lab && (
        /* The assessment, and it says so. Reading the module is self-reported;
           this is the one thing on the page that is measured, so it is set
           apart from the lessons rather than listed as another one of them. */
        <div className="panel mt-12 rounded-2xl p-6">
          <p className="eyebrow flex items-center gap-2 text-photon">
            <FlaskConical className="size-3.5" aria-hidden />
            Assessment
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
