"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FlaskConical } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Byline } from "@/components/curriculum/own-module-page";
import { fetchOwnModules, type OwnModuleCard } from "@/lib/own-modules";

/**
 * The modules a student's professors wrote for them.
 *
 * Above the site's eight, because a student in a class is usually on the
 * curriculum page to do what their professor set this week. Drawn only for
 * someone who has such modules: a shelf that is empty for most visitors would
 * be a heading promising something that is not there.
 */
export function ProfessorModules({ className }: { className?: string }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [result, setResult] = useState<{
    userId: number;
    cards: OwnModuleCard[];
  } | null>(null);

  useEffect(() => {
    if (userId === null) return;
    let live = true;
    fetchOwnModules().then(
      (cards) => live && setResult({ userId, cards }),
      /* Nothing to show is the right answer to a failed fetch here: the
         shelf is extra, and the curriculum below it still works. */
      () => live && setResult({ userId, cards: [] }),
    );
    return () => {
      live = false;
    };
  }, [userId]);

  const cards = result && result.userId === userId ? result.cards : [];
  if (!cards.length) return null;

  return (
    <section aria-labelledby="professor-modules-title" className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-edge pb-4">
        <h2
          id="professor-modules-title"
          className="flex items-center gap-2.5 text-[18px] font-semibold tracking-[-0.01em] text-paper"
        >
          From your professors
          <span className="pill text-grape">{cards.length}</span>
        </h2>
        <p className="text-[13px] text-frost">
          Written for the classes you are in.
        </p>
      </div>

      <ul className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <li key={card.slug}>
            <Link
              href={`/curriculum/own/${card.slug}`}
              className="group panel relative flex h-full flex-col overflow-hidden rounded-2xl p-5 transition-colors hover:border-violet-400/50! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-1 bg-violet-400"
              />
              <span className="pill self-start text-grape">
                From your professor
              </span>
              <span className="mt-3 text-[17px] leading-snug font-semibold text-paper">
                {card.title}
              </span>
              {card.summary && (
                <span className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-frost">
                  {card.summary}
                </span>
              )}
              <Byline person={card.professor} className="mt-4" />

              <span className="mt-auto flex items-center gap-3 pt-5">
                <span className="pill text-frost">
                  {card.lessons} {card.lessons === 1 ? "lesson" : "lessons"}
                </span>
                {card.has_lab && (
                  <span className="pill text-ok">
                    <FlaskConical className="size-3" aria-hidden />
                    Lab
                  </span>
                )}
                <span className="ml-auto flex items-center gap-2 text-[14px] font-semibold text-violet-200 tabular-nums">
                  {card.percent}%
                  <ArrowRight
                    className="size-3.5 text-photon transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </span>
              <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-strata">
                <span
                  className="block h-full rounded-full bg-violet-400"
                  style={{ width: `${card.percent}%` }}
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
