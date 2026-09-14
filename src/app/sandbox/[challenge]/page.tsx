import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CircuitStudio } from "@/components/sandbox/circuit-studio";
import { CHALLENGES, CHALLENGE_BY_SLUG } from "@/lib/challenges";
import { MODULES } from "@/lib/data";

/**
 * A module's circuit lab.
 *
 * The same studio as /sandbox, opened empty with one graded build to make. The
 * slug is a module slug, so the page can name where the task came from and send
 * the learner back to it; only the six modules with a challenge exist here.
 */

export function generateStaticParams() {
  return CHALLENGES.map((challenge) => ({ challenge: challenge.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/sandbox/[challenge]">): Promise<Metadata> {
  const { challenge: slug } = await params;
  const challenge = CHALLENGE_BY_SLUG[slug];
  if (!challenge) return { title: "Circuit lab not found" };
  return {
    title: `Circuit lab — ${challenge.title}`,
    description: challenge.goal,
  };
}

export default async function ChallengePage({ params }: PageProps<"/sandbox/[challenge]">) {
  const { challenge: slug } = await params;
  const challenge = CHALLENGE_BY_SLUG[slug];
  if (!challenge) notFound();

  const index = MODULES.findIndex((m) => m.slug === slug);
  const entry = MODULES[index];

  return (
    <div className="min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
        {entry && (
          <Link
            href={`/curriculum/${entry.slug}`}
            className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-frost uppercase transition-colors hover:text-photon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
          >
            <ArrowLeft className="size-3.5" />
            Back to {entry.title}
          </Link>
        )}

        <header className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-edge pb-7">
          <div className="max-w-2xl">
            <p className="eyebrow">
              Circuit lab{entry ? ` · module ${String(index + 1).padStart(2, "0")}` : ""}
            </p>
            <h1 className="mt-3 display-2">
              Build it, then{" "}
              <span className="text-photon">have it marked.</span>
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-frost">
              Place the gates on the grid or write the Qiskit — either pane will do. The check
              sends your circuit to the API, which rebuilds it with Qiskit and compares it with
              the lab&rsquo;s own reference: on the state it reaches, for a lab that asks for a
              state, and on every input, for a lab that asks for an algorithm.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-x-8 gap-y-2 sm:gap-x-10">
            {(
              [
                ["Register", `${challenge.qubits} qubits`],
                ["Marked by", "qiskit"],
                ["Attempts", "unlimited"],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[11px] tracking-[0.16em] text-frost uppercase">
                  {label}
                </dt>
                <dd className="mt-1 font-mono text-[12.5px] text-paper">{value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="mt-6">
          <CircuitStudio challenge={challenge} />
        </div>
      </div>
    </div>
  );
}
