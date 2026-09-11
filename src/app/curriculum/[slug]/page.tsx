import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, GitFork } from "lucide-react";

import { ActionLink } from "@/components/site/action";
import { CHALLENGE_BY_SLUG } from "@/lib/challenges";
import { GATE_BY_ID, MODULES, TRACK_LABEL } from "@/lib/data";
import { lessonsFor } from "@/lib/lessons";
import { REPO_URL } from "@/lib/site";
import { LessonBodies } from "@/components/curriculum/lesson-body";
import { LessonChecklist } from "@/components/curriculum/lesson-checklist";
import { ModuleRail } from "@/components/curriculum/module-rail";

/**
 * A module.
 *
 * The outline at the top is the tracker — where a lesson gets ticked — and the
 * bodies follow it in reading order, with the graded lab at the end framed as
 * the assessment it is. A module that sent the learner from a list of concept
 * names straight to a circuit they had been told nothing about was not a course
 * with a test at the end; it was only the test.
 *
 * Modules whose bodies are not written yet fall back to the outline and say so,
 * which stays the honest thing to publish. `lessonsFor` coming back empty is
 * what switches the page between the two.
 */

export function generateStaticParams() {
  return MODULES.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/curriculum/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const entry = MODULES.find((m) => m.slug === slug);
  if (!entry) return { title: "Module not found" };
  return { title: entry.title, description: entry.summary };
}

/** Gate labels the palette does not carry. */
const EXTRA_GATE_NAMES: Record<string, string> = {
  rz: "Z rotation",
  i: "Identity",
};

/**
 * Why two modules have no graded lab.
 *
 * The grader compares unitaries, so a read-out has nothing for it to check, and
 * period-finding does not fit in the sandbox's four wires. Saying which is more
 * useful than an "open" link that leads to a task nobody can pass.
 */
const LAB_PENDING: Record<string, string> = {
  "measurement-and-probability":
    "a read-out is not a unitary, so this module is marked by the histogram in the sandbox",
  "shors-factoring": "period-finding needs more than the sandbox's four wires",
};

export default async function ModulePage({
  params,
}: PageProps<"/curriculum/[slug]">) {
  const { slug } = await params;
  const index = MODULES.findIndex((m) => m.slug === slug);
  if (index === -1) notFound();

  const entry = MODULES[index];
  const previous = MODULES[index - 1];
  const next = MODULES[index + 1];

  // Sections completed so far, so the outline agrees with the progress bar.
  const done = Math.round((entry.concepts.length * entry.progress) / 100);

  const written = lessonsFor(slug);
  const lab = CHALLENGE_BY_SLUG[slug]
    ? { href: `/sandbox/${slug}`, title: CHALLENGE_BY_SLUG[slug].title }
    : null;

  return (
    <div className="min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
        <Link
          href="/curriculum"
          className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-frost uppercase transition-colors hover:text-photon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
        >
          <ArrowLeft className="size-3.5" />
          All modules
        </Link>

        <div className="mt-6 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div>
            <header className="border-b border-edge pb-7">
              <div className="flex flex-wrap items-center gap-3">
                <span className="ket rounded-lg border border-photon bg-photon/10 px-2.5 py-1 text-[14px] text-photon">
                  {entry.ket}
                </span>
                <span className="font-mono text-[11px] tracking-[0.16em] text-frost uppercase">
                  {TRACK_LABEL[entry.track]} · {entry.lessons} lessons ·{" "}
                  {entry.minutes} min
                </span>
              </div>
              <h1 className="mt-4 display-2">{entry.title}</h1>
              <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-frost">
                {entry.summary}
              </p>
            </header>

            <LessonChecklist
              slug={entry.slug}
              lessons={entry.lessons}
              concepts={
                written.length
                  ? written.map((lesson) => lesson.title)
                  : entry.concepts
              }
              fallbackDone={done}
              lab={lab}
              labPending={LAB_PENDING[slug] ?? "coming with the lesson bodies"}
            />

            <LessonBodies lessons={written} lab={lab} />

            {/* The honest bit, while a module still has no bodies to show. */}
            {written.length === 0 && (
              <section className="panel mt-8 rounded-2xl p-5">
                <p className="eyebrow">Status</p>
                <p className="mt-2.5 text-[14px] leading-relaxed text-frost">
                  The lesson bodies for this module are being written in the
                  open. The outline, the gate set and — where the module has one
                  — the graded circuit lab are final; the prose is not, so this
                  page shows the shape of the module rather than filled-in
                  placeholder text. Pull requests are the fastest way to change
                  that.
                </p>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 border border-edge px-3.5 py-2 text-[13px] text-frost transition-colors hover:border-photon hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
                >
                  <GitFork className="size-3.5" />
                  Write a lesson with us
                </a>
              </section>
            )}
          </div>

          {/* Side rail. */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <ModuleRail
              slug={entry.slug}
              fallbackProgress={entry.progress}
              fallbackBadge={entry.badge}
            />

            <div className="panel rounded-2xl p-5">
              <p className="eyebrow">Gates in this module</p>
              <ul className="mt-3 space-y-2">
                {entry.gates.map((gate) => {
                  const key = gate.toLowerCase();
                  const known = GATE_BY_ID[key];
                  return (
                    <li key={gate} className="flex items-center gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md border border-photon bg-photon/10 font-mono text-[11px] font-semibold text-photon">
                        {gate === "CNOT" ? "CX" : gate}
                      </span>
                      <span className="text-[13px] text-frost">
                        {known?.name ?? EXTRA_GATE_NAMES[key] ?? gate}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <ActionLink
                href={CHALLENGE_BY_SLUG[slug] ? `/sandbox/${slug}` : "/sandbox"}
                variant="outline"
                className="mt-4 w-full"
              >
                {CHALLENGE_BY_SLUG[slug]
                  ? "Open the circuit lab"
                  : "Try them in the sandbox"}
              </ActionLink>
            </div>

            {/* Prerequisite chain. */}
            <nav className="panel rounded-2xl p-5" aria-label="Module order">
              <p className="eyebrow">Order</p>
              <div className="mt-3 space-y-2.5">
                {previous ? (
                  <Link
                    href={`/curriculum/${previous.slug}`}
                    className="group flex items-center gap-3 rounded-xl border border-edge px-3 py-2.5 transition-colors hover:border-photon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
                  >
                    <ArrowLeft className="size-3.5 shrink-0 text-frost transition-transform group-hover:-translate-x-0.5" />
                    <span className="min-w-0">
                      <span className="block font-mono text-[11px] tracking-[0.14em] text-frost uppercase">
                        Comes before
                      </span>
                      <span className="block truncate text-[13px] text-frost">
                        {previous.title}
                      </span>
                    </span>
                    <span className="ket ml-auto shrink-0 text-[11px] text-photon">
                      {previous.ket}
                    </span>
                  </Link>
                ) : (
                  <p className="rounded-xl border border-edge px-3 py-2.5 text-[12.5px] text-frost">
                    This is the first module — no prerequisites at all.
                  </p>
                )}

                {next && (
                  <Link
                    href={`/curriculum/${next.slug}`}
                    className="group flex items-center gap-3 rounded-xl border border-edge px-3 py-2.5 transition-colors hover:border-photon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-[11px] tracking-[0.14em] text-frost uppercase">
                        Comes after
                      </span>
                      <span className="block truncate text-[13px] text-frost">
                        {next.title}
                      </span>
                    </span>
                    <span className="ket ml-auto shrink-0 text-[11px] text-photon">
                      {next.ket}
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-frost transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </div>
            </nav>
          </aside>
        </div>
      </div>
    </div>
  );
}
