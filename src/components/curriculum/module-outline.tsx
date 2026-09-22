"use client";

import Link from "next/link";
import { Check, Circle, FlaskConical } from "lucide-react";

import { useLessonToggle } from "@/components/curriculum/use-lesson-toggle";
import type { Lesson } from "@/lib/lessons";
import { TONE, moduleTone } from "@/lib/tone";
import { cn } from "@/lib/utils";

/**
 * The outline, in the rail, as a navigator.
 *
 * It used to sit in the main column and be the only thing that could mark a
 * lesson complete. Both of those moved: marking belongs at the end of the
 * lesson you have just read, and the outline belongs where you can still see it
 * while reading — which is the rail, pinned, the way any course with more than
 * three sections in it is laid out.
 *
 * So these rows navigate and report, and they do not write. A row that both
 * jumped to a lesson and ticked it would have to guess which of the two a click
 * meant, and would get it wrong about half the time.
 */
export function ModuleOutline({
  slug,
  lessons,
  fallbackTitles,
  hasLab,
}: {
  slug: string;
  lessons: Lesson[];
  fallbackTitles: string[];
  hasLab: boolean;
}) {
  const { isDone, signedIn } = useLessonToggle(slug);
  const tone = TONE[moduleTone(slug)];

  const rows = lessons.length
    ? lessons.map((lesson, index) => ({
        index,
        title: lesson.title,
        minutes: lesson.minutes,
      }))
    : fallbackTitles.map((title, index) => ({ index, title, minutes: null }));

  const done = rows.filter((row) => isDone(row.index)).length;

  return (
    <nav className="panel rounded-2xl p-5" aria-label="Module outline">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Outline</p>
        <p className="font-mono text-[11px] text-frost tabular-nums">
          {signedIn ? `${done}/${rows.length}` : `${rows.length} lessons`}
        </p>
      </div>

      <ol className="mt-3 flex flex-col">
        {rows.map((row) => {
          const complete = signedIn && isDone(row.index);
          return (
            <li key={row.index}>
              <a
                href={`#lesson-${row.index + 1}`}
                className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-strata focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-photon"
              >
                {complete ? (
                  <Check
                    className="mt-0.5 size-3.5 shrink-0 text-ok"
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
                  {row.title}
                </span>
                {row.minutes !== null && (
                  <span className="mt-0.5 shrink-0 font-mono text-[10.5px] text-dim tabular-nums">
                    {row.minutes}m
                  </span>
                )}
              </a>
            </li>
          );
        })}

        {hasLab && (
          <li className="mt-1 border-t border-edge pt-1">
            <Link
              href={`/sandbox/${slug}`}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-strata focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-photon"
            >
              <FlaskConical
                className={cn("size-3.5 shrink-0", tone.text)}
                aria-hidden
              />
              <span className={cn("flex-1 text-[13px] font-medium", tone.text)}>
                Lab — build it
              </span>
            </Link>
          </li>
        )}
      </ol>
    </nav>
  );
}
