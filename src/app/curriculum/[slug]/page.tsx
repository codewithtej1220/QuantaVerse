import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Award, Check, Circle, GitFork, Play } from "lucide-react";

import { ActionLink } from "@/components/site/action";
import { AmplitudeBar } from "@/components/site/amplitude-bar";
import { CHALLENGE_BY_SLUG } from "@/lib/challenges";
import { GATE_BY_ID, MODULES, TRACK_LABEL } from "@/lib/data";
import { REPO_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * A module shell.
 *
 * The outline is generated from the module's concept list, which is the honest
 * thing to publish while the lesson bodies are still being written — the page
 * says so plainly rather than filling the space with placeholder prose.
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

export default async function ModulePage({ params }: PageProps<"/curriculum/[slug]">) {
  const { slug } = await params;
  const index = MODULES.findIndex((m) => m.slug === slug);
  if (index === -1) notFound();

  const entry = MODULES[index];
  const previous = MODULES[index - 1];
  const next = MODULES[index + 1];

  // Sections completed so far, so the outline agrees with the progress bar.
  const done = Math.round((entry.concepts.length * entry.progress) / 100);

  return (
    <div className="lattice min-h-screen overflow-x-clip pt-24 pb-20">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <Link
          href="/curriculum"
          className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-frost/60 uppercase transition-colors hover:text-photon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
        >
          <ArrowLeft className="size-3.5" />
          All modules
        </Link>

        <div className="mt-6 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div>
            <header className="border-b border-white/8 pb-7">
              <div className="flex flex-wrap items-center gap-3">
                <span className="ket rounded-lg border border-photon/35 bg-photon/8 px-2.5 py-1 text-[14px] text-photon">
                  {entry.ket}
                </span>
                <span className="font-mono text-[10px] tracking-[0.16em] text-frost/50 uppercase">
                  {TRACK_LABEL[entry.track]} · {entry.lessons} lessons · {entry.minutes} min
                </span>
              </div>
              <h1 className="mt-4 text-[clamp(1.9rem,3.6vw,2.6rem)] leading-[1.06] font-semibold tracking-[-0.025em]">
                {entry.title}
              </h1>
              <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-frost/80">
                {entry.summary}
              </p>
            </header>

            {/* Outline. */}
            <section className="mt-8">
              <h2 className="eyebrow">Outline</h2>
              <ol className="mt-4 overflow-hidden rounded-2xl border border-white/8">
                {entry.concepts.map((concept, i) => {
                  const complete = i < done;
                  const current = i === done && entry.progress > 0 && entry.progress < 100;
                  return (
                    <li
                      key={concept}
                      className={cn(
                        "flex items-center gap-4 border-b border-white/6 px-4 py-3.5 last:border-0",
                        current ? "bg-phase/8" : "bg-white/2",
                      )}
                    >
                      <span className="w-6 shrink-0 font-mono text-[11px] text-frost/40 tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {complete ? (
                        <Check className="size-4 shrink-0 text-photon" />
                      ) : (
                        <Circle
                          className={cn(
                            "size-3.5 shrink-0",
                            current ? "text-phase" : "text-frost/30",
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "flex-1 text-[14px]",
                          complete ? "text-frost/70" : current ? "text-paper" : "text-frost/75",
                        )}
                      >
                        {concept}
                      </span>
                      <span className="shrink-0 font-mono text-[9.5px] tracking-[0.14em] text-frost/40 uppercase">
                        {complete ? "done" : current ? "in progress" : "queued"}
                      </span>
                    </li>
                  );
                })}
                {/* The lab is a real graded task for six of the eight modules. */}
                {CHALLENGE_BY_SLUG[slug] ? (
                  <li className="bg-photon/6">
                    <Link
                      href={`/sandbox/${slug}`}
                      className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-photon/12 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-photon"
                    >
                      <span className="w-6 shrink-0 font-mono text-[11px] text-frost/40 tabular-nums">
                        {String(entry.concepts.length + 1).padStart(2, "0")}
                      </span>
                      <Play className="size-3.5 shrink-0 text-photon" />
                      <span className="min-w-0 flex-1 text-[14px] text-paper">
                        Circuit lab — {CHALLENGE_BY_SLUG[slug].title}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 font-mono text-[9.5px] tracking-[0.14em] text-photon/70 uppercase">
                        open
                        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </li>
                ) : (
                  <li className="flex items-center gap-4 bg-white/2 px-4 py-3.5">
                    <span className="w-6 shrink-0 font-mono text-[11px] text-frost/40 tabular-nums">
                      {String(entry.concepts.length + 1).padStart(2, "0")}
                    </span>
                    <Play className="size-3.5 shrink-0 text-frost/35" />
                    <span className="min-w-0 flex-1 text-[14px] text-frost/70">
                      Circuit lab — {LAB_PENDING[slug] ?? "coming with the lesson bodies"}
                    </span>
                    <span className="shrink-0 font-mono text-[9.5px] tracking-[0.14em] text-frost/40 uppercase">
                      not yet
                    </span>
                  </li>
                )}
              </ol>
            </section>

            {/* The honest bit. */}
            <section className="glass mt-8 rounded-2xl p-5">
              <p className="eyebrow">Status</p>
              <p className="mt-2.5 text-[14px] leading-relaxed text-frost/75">
                The lesson bodies for this module are being written in the open. The outline, the
                gate set and — where the module has one — the graded circuit lab are final; the
                prose is not, so this page shows the shape of the module rather than filled-in
                placeholder text. Pull requests are the fastest way to change that.
              </p>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/12 px-3.5 py-2 text-[13px] text-frost/85 transition-colors hover:border-photon/40 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
              >
                <GitFork className="size-3.5" />
                Write a lesson with us
              </a>
            </section>
          </div>

          {/* Side rail. */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="glass rounded-2xl p-5">
              <AmplitudeBar value={entry.progress} />
              <p className="mt-4 flex items-center gap-2 border-t border-white/8 pt-4 text-[12.5px]">
                <Award
                  className={cn(
                    "size-4 shrink-0",
                    entry.progress === 100 ? "text-photon" : "text-frost/40",
                  )}
                />
                <span className={entry.progress === 100 ? "text-paper" : "text-frost/65"}>
                  {entry.badge}
                </span>
                <span className="ml-auto font-mono text-[9.5px] tracking-[0.14em] text-frost/40 uppercase">
                  {entry.progress === 100 ? "earned" : "on completion"}
                </span>
              </p>
            </div>

            <div className="glass rounded-2xl p-5">
              <p className="eyebrow">Gates in this module</p>
              <ul className="mt-3 space-y-2">
                {entry.gates.map((gate) => {
                  const key = gate.toLowerCase();
                  const known = GATE_BY_ID[key];
                  return (
                    <li key={gate} className="flex items-center gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md border border-photon/25 bg-photon/8 font-mono text-[11px] font-semibold text-photon">
                        {gate === "CNOT" ? "CX" : gate}
                      </span>
                      <span className="text-[13px] text-frost/75">
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
                {CHALLENGE_BY_SLUG[slug] ? "Open the circuit lab" : "Try them in the sandbox"}
              </ActionLink>
            </div>

            {/* Prerequisite chain. */}
            <nav className="glass rounded-2xl p-5" aria-label="Module order">
              <p className="eyebrow">Order</p>
              <div className="mt-3 space-y-2.5">
                {previous ? (
                  <Link
                    href={`/curriculum/${previous.slug}`}
                    className="group flex items-center gap-3 rounded-xl border border-white/8 px-3 py-2.5 transition-colors hover:border-photon/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
                  >
                    <ArrowLeft className="size-3.5 shrink-0 text-frost/50 transition-transform group-hover:-translate-x-0.5" />
                    <span className="min-w-0">
                      <span className="block font-mono text-[9.5px] tracking-[0.14em] text-frost/40 uppercase">
                        Comes before
                      </span>
                      <span className="block truncate text-[13px] text-frost/85">
                        {previous.title}
                      </span>
                    </span>
                    <span className="ket ml-auto shrink-0 text-[11px] text-photon/60">
                      {previous.ket}
                    </span>
                  </Link>
                ) : (
                  <p className="rounded-xl border border-white/8 px-3 py-2.5 text-[12.5px] text-frost/55">
                    This is the first module — no prerequisites at all.
                  </p>
                )}

                {next && (
                  <Link
                    href={`/curriculum/${next.slug}`}
                    className="group flex items-center gap-3 rounded-xl border border-white/8 px-3 py-2.5 transition-colors hover:border-photon/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-[9.5px] tracking-[0.14em] text-frost/40 uppercase">
                        Comes after
                      </span>
                      <span className="block truncate text-[13px] text-frost/85">
                        {next.title}
                      </span>
                    </span>
                    <span className="ket ml-auto shrink-0 text-[11px] text-photon/60">
                      {next.ket}
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-frost/50 transition-transform group-hover:translate-x-0.5" />
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
