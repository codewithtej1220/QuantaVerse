"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, GraduationCap, Loader2, Send, X } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import {
  askToJoin,
  fetchModuleClasses,
  initialsOf,
  leaveClass,
  sinceWhen,
  type ModuleClasses,
  type ModuleProfessor,
} from "@/lib/professor";
import { cn } from "@/lib/utils";

/**
 * The professors who teach a module, and joining one of their classes.
 *
 * Joining is asked, not taken: the professor accepts or declines, and only
 * once they accept can they see this student's progress on the module. That
 * is said on the panel, because it is the one thing a student should know
 * before pressing the button.
 *
 * Nothing is shown to a visitor who is signed out, or on a module nobody
 * teaches here yet — an empty "professors" box on every page would be noise.
 */

const SMALL =
  "inline-flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[11.5px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon disabled:cursor-not-allowed disabled:opacity-50";

const reason = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

export function ModuleClassesPanel({ slug, title }: { slug: string; title: string }) {
  const { user, ready } = useAuth();
  const userId = user?.id ?? null;

  const [result, setResult] = useState<{
    owner: string;
    data?: ModuleClasses;
    error?: string;
  } | null>(null);
  const owner = userId === null ? null : `${slug}:${userId}`;

  useEffect(() => {
    if (!ready || owner === null) return;
    let live = true;
    fetchModuleClasses(slug).then(
      (data) => live && setResult({ owner, data }),
      (error) => live && setResult({ owner, error: reason(error, "classes could not be loaded") }),
    );
    return () => {
      live = false;
    };
  }, [ready, owner, slug]);

  const [override, setOverride] = useState<{ owner: string; data: ModuleClasses } | null>(null);
  const current = owner !== null && override?.owner === owner ? override.data : null;
  const data = current ?? (result?.owner === owner ? (result?.data ?? null) : null);

  if (owner === null || !data) return null;

  if (data.you_teach && data.professors.length === 0) {
    return <TeachingNote title={title} />;
  }
  if (data.professors.length === 0) return null;

  const update = (next: ModuleClasses) => setOverride({ owner, data: next });

  return (
    <section className="panel mt-6 rounded-2xl p-5 sm:p-6" aria-labelledby={`classes-${slug}`}>
      <p className="eyebrow flex items-center gap-2 text-photon">
        <GraduationCap className="size-3.5" aria-hidden />
        Classes on this module
      </p>
      <h2 id={`classes-${slug}`} className="mt-2 text-[19px] font-medium text-paper">
        Join your professor&rsquo;s class
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-frost">
        Ask to join and your professor decides. Once they accept, they can see your progress on{" "}
        {title} — nothing else — and where you rank in their class.
      </p>

      <ul className="mt-4 flex flex-col gap-2.5">
        {data.professors.map((entry) => (
          <ProfessorRow key={entry.professor.id} slug={slug} entry={entry} onChange={update} />
        ))}
      </ul>

      {data.you_teach && (
        <p className="mt-4 text-[13px] text-frost">
          You teach this module too.{" "}
          <Link href="/professor" className="text-photon underline-offset-4 hover:underline">
            Your teaching page
          </Link>
        </p>
      )}
    </section>
  );
}

function TeachingNote({ title }: { title: string }) {
  return (
    <section className="panel mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
      <p className="flex items-center gap-2.5 text-[14px] text-paper">
        <GraduationCap className="size-4 text-photon" aria-hidden />
        You teach {title}. Requests to join and your students&rsquo; standings are on your teaching
        page.
      </p>
      <Link
        href="/professor"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] text-photon uppercase hover:text-paper"
      >
        teaching page
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </section>
  );
}

function ProfessorRow({
  slug,
  entry,
  onChange,
}: {
  slug: string;
  entry: ModuleProfessor;
  onChange: (next: ModuleClasses) => void;
}) {
  const { professor, membership } = entry;
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (work: () => Promise<ModuleClasses>) => {
    setBusy(true);
    setProblem(null);
    try {
      onChange(await work());
      setAsking(false);
      setNote("");
    } catch (error) {
      setProblem(reason(error, "that did not go through"));
    } finally {
      setBusy(false);
    }
  };

  const status = membership?.status ?? null;

  return (
    <li
      className={cn(
        "rounded-xl border px-4 py-3",
        status === "accepted" ? "border-photon/60 bg-photon/[0.06]" : "border-edge",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-full bg-photon/10 font-mono text-[12.5px] text-photon ring-1 ring-photon/45"
          >
            {initialsOf(professor.display_name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-medium text-paper">
              {professor.display_name}
            </span>
            <span className="block truncate font-mono text-[11.5px] text-dim">
              {[professor.position, professor.institution].filter(Boolean).join(" · ") ||
                `@${professor.handle}`}
              {" · "}
              {entry.students} {entry.students === 1 ? "student" : "students"}
            </span>
          </span>
        </div>

        <div className={cn("flex shrink-0 flex-wrap items-center gap-2", busy && "opacity-60")}>
          {status === null && !asking && (
            <button
              type="button"
              onClick={() => setAsking(true)}
              className={cn(SMALL, "border-photon bg-photon/10 text-photon hover:bg-photon/20")}
            >
              <Send className="size-3.5" aria-hidden />
              ask to join
            </button>
          )}
          {status === "pending" && membership && (
            <>
              <span className="font-mono text-[11px] text-frost">
                asked {sinceWhen(membership.created_at)} · waiting
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => leaveClass(membership.id))}
                className={cn(SMALL, "border-edge text-frost hover:border-paper hover:text-paper")}
              >
                <X className="size-3.5" aria-hidden />
                withdraw
              </button>
            </>
          )}
          {status === "accepted" && membership && (
            <>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-photon uppercase">
                <Check className="size-3.5" aria-hidden />
                in this class
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Leave ${professor.display_name}'s class? They will no longer see your progress on this module.`,
                    )
                  )
                    return;
                  void run(() => leaveClass(membership.id));
                }}
                className={cn(SMALL, "border-edge text-frost hover:border-paper hover:text-paper")}
              >
                leave
              </button>
            </>
          )}
          {status === "declined" && !asking && (
            <>
              <span className="font-mono text-[11px] text-frost">not accepted</span>
              <button
                type="button"
                onClick={() => setAsking(true)}
                className={cn(SMALL, "border-edge-hi text-paper hover:border-photon")}
              >
                ask again
              </button>
            </>
          )}
        </div>
      </div>

      {asking && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => askToJoin(slug, professor.id, note));
          }}
          className="mt-3 flex flex-col gap-2"
        >
          <label className="text-[12.5px] text-frost" htmlFor={`note-${slug}-${professor.id}`}>
            A note for {professor.display_name} <span className="text-dim">(optional)</span>
          </label>
          <textarea
            id={`note-${slug}-${professor.id}`}
            value={note}
            maxLength={300}
            rows={2}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Which section you are in, or why you want to join"
            className="w-full resize-y border border-edge bg-strata px-3 py-2 text-[14px] text-paper placeholder:text-dim outline-none focus:border-photon"
          />
          <span className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className={cn(SMALL, "border-photon bg-photon text-void hover:bg-photon-hi")}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Send className="size-3.5" aria-hidden />
              )}
              send request
            </button>
            <button
              type="button"
              onClick={() => {
                setAsking(false);
                setProblem(null);
              }}
              className={cn(SMALL, "border-edge text-frost hover:border-paper hover:text-paper")}
            >
              cancel
            </button>
          </span>
        </form>
      )}

      {problem && (
        <p role="alert" className="mt-2 text-[12.5px] text-collapse">
          {problem}
        </p>
      )}
    </li>
  );
}
