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
          className="font-mono text-[12px] tracking-[0.14em] text-photon uppercase"
        >
          From your professors{" "}
          <span className="text-[11px] tabular-nums opacity-70">
            {cards.length}
          </span>
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
              className="group panel flex h-full flex-col rounded-2xl p-5 transition-colors hover:border-photon! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
            >
              <span className="text-[17px] leading-snug font-medium text-paper">
                {card.title}
              </span>
              {card.summary && (
                <span className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-frost">
                  {card.summary}
                </span>
              )}
              <Byline person={card.professor} className="mt-4" />

              <span className="mt-auto flex items-center gap-3 pt-5">
                <span className="font-mono text-[11px] tracking-[0.14em] text-dim uppercase">
                  {card.lessons} {card.lessons === 1 ? "lesson" : "lessons"}
                </span>
                {card.has_lab && (
                  <span className="flex items-center gap-1 font-mono text-[11px] tracking-[0.14em] text-dim uppercase">
                    <FlaskConical className="size-3" aria-hidden />
                    lab
                  </span>
                )}
                <span className="ml-auto flex items-center gap-2 font-mono text-[12px] text-paper tabular-nums">
                  {card.percent}%
                  <ArrowRight
                    className="size-3.5 text-photon transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </span>
              <span className="mt-2.5 block h-1 overflow-hidden rounded-full bg-strata">
                <span
                  className="block h-full rounded-full bg-photon"
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
