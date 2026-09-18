import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { ALGORITHMS } from "@/lib/algorithms";
import { AlgorithmTheatre } from "@/components/algorithms/algorithm-theatre";
import { ActionLink } from "@/components/site/action";

export function generateStaticParams() {
  return ALGORITHMS.map((algorithm) => ({ slug: algorithm.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/algorithms/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const algorithm = ALGORITHMS.find((a) => a.slug === slug);
  if (!algorithm) return { title: "Algorithm not found" };
  return { title: algorithm.name, description: algorithm.tagline };
}

export default async function AlgorithmPage({ params }: PageProps<"/algorithms/[slug]">) {
  const { slug } = await params;
  const index = ALGORITHMS.findIndex((a) => a.slug === slug);
  if (index < 0) notFound();

  const algorithm = ALGORITHMS[index];
  const next = ALGORITHMS[(index + 1) % ALGORITHMS.length];

  return (
    <div className="min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
        <Link
          href="/algorithms"
          className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-frost uppercase transition-colors hover:text-photon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          All algorithms
        </Link>

        <header className="mt-5 grid gap-x-10 gap-y-7 border-b border-edge pb-7 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-end">
          <div className="max-w-3xl">
            <p className="eyebrow">Algorithms</p>
            <h1 className="mt-3 display-2">{algorithm.name}</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-frost">{algorithm.premise}</p>
          </div>

          <dl className="grid gap-3">
            <div className="panel-quiet rounded-lg px-4 py-3">
              <dt className="font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">
                classically
              </dt>
              <dd className="mt-1 text-[14px] text-frost">{algorithm.classical}</dd>
            </div>
            <div className="panel rounded-lg border-photon/40 px-4 py-3">
              <dt className="font-mono text-[10.5px] tracking-[0.16em] text-frost uppercase">
                this circuit
              </dt>
              <dd className="mt-1 text-[14px] font-medium text-photon">{algorithm.quantum}</dd>
            </div>
          </dl>
        </header>

        <div className="mt-7">
          <AlgorithmTheatre algorithm={algorithm} />
        </div>

        <nav className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-7">
          <div>
            <p className="font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">next</p>
            <Link
              href={`/algorithms/${next.slug}`}
              className="mt-1 inline-flex items-center gap-2 text-[15px] text-paper transition-colors hover:text-photon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
            >
              {next.name}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          <ActionLink href="/sandbox">Build your own</ActionLink>
        </nav>
      </div>
    </div>
  );
}
