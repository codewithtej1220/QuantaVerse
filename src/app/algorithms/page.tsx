import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ALGORITHMS } from "@/lib/algorithms";
import { TONE, algorithmTone } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { Stage, Zone } from "@/components/three/stage";

export const metadata: Metadata = {
  title: "Algorithms",
  description:
    "Walk through quantum algorithms — Grover, Deutsch–Jozsa, Bernstein–Vazirani, superdense coding and teleportation — stage by stage and gate by gate, on a real statevector simulation running in your browser.",
};

/**
 * The algorithms, as a shelf.
 *
 * The curriculum teaches gates and the sandbox lets you place them, and until
 * now nothing on the site closed the gap between "H makes a superposition" and
 * "this is why anybody cares". That gap is what this page is for.
 *
 * Every entry runs. The note at the bottom about what is missing is not an
 * apology, it is the same promise as the sandbox's: the numbers are real, and a
 * gallery that quietly mixed in three hand-drawn cartoons would cost more
 * credibility than the cartoons could ever buy.
 */
export default function AlgorithmsPage() {
  return (
    <div className="min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
        <Stage />

        <header className="grid gap-x-10 gap-y-8 border-b border-edge pb-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow">Algorithms</p>
            <h1 data-tour="algorithms" className="mt-3 display-2">
              Watch each algorithm{" "}
              <span className="text-photon">run, stage by stage.</span>
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-frost">
              Each one is taken a stage at a time — superposition, oracle,
              interference, measurement — with a picture of what every stage
              does to the amplitudes, and the gates, the Qiskit and the
              statevector underneath. Nothing here is an animation of a circuit:
              every picture is read off the circuit itself, running on the same
              simulator the sandbox uses, in your browser.
            </p>
          </div>

          <Zone
            id="algorithms-hero"
            focus="network"
            scale={1.3}
            className="h-[240px] w-full cursor-crosshair sm:h-[290px]"
          />
        </header>

        <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ALGORITHMS.map((algorithm) => {
            const tone = TONE[algorithmTone(algorithm.slug)];
            return (
              <li key={algorithm.slug}>
                <Link
                  href={`/algorithms/${algorithm.slug}`}
                  className="panel group relative flex h-full flex-col overflow-hidden rounded-2xl p-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
                >
                  <span
                    aria-hidden
                    className={cn("absolute inset-x-0 top-0 h-1", tone.solid)}
                  />
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-[17px] font-semibold text-paper">
                      {algorithm.name}
                    </h2>
                    <span className={cn("pill", tone.text)}>
                      {algorithm.qubits} qubits
                    </span>
                  </div>

                  <p className="mt-2 text-[13.5px] leading-relaxed text-frost">
                    {algorithm.tagline}
                  </p>

                  {/* The stages, in order: the shape of the idea before the gates. */}
                  <ol
                    aria-label="Stages"
                    className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[12.5px] text-dim"
                  >
                    {algorithm.stages.map((stage, i) => (
                      <li
                        key={stage.title}
                        className="flex items-center gap-1.5"
                      >
                        {i > 0 && (
                          <span aria-hidden className="text-edge-hi">
                            →
                          </span>
                        )}
                        <span className="text-frost">{stage.title}</span>
                      </li>
                    ))}
                  </ol>

                  {/* The comparison is the reason the algorithm exists, so it is
                    on the card rather than buried on the page behind it. */}
                  <dl className="mt-4 grid gap-2 border-t border-edge pt-4 text-[12px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="font-mono text-[10.5px] tracking-[0.14em] text-dim uppercase">
                        Classical
                      </dt>
                      <dd className="text-right text-frost">
                        {algorithm.classical}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="font-mono text-[10.5px] tracking-[0.14em] text-dim uppercase">
                        This circuit
                      </dt>
                      <dd className={cn("text-right font-semibold", tone.text)}>
                        {algorithm.quantum}
                      </dd>
                    </div>
                  </dl>

                  <span
                    className={cn(
                      "mt-auto inline-flex items-center gap-1.5 pt-4 text-[13px] font-semibold",
                      tone.text,
                    )}
                  >
                    Walk the {algorithm.stages.length} stages
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-8 max-w-3xl border-t border-edge pt-6 text-[13px] leading-relaxed text-dim">
          <span className="font-mono text-[10.5px] tracking-[0.14em] text-frost uppercase">
            What is not here
          </span>
          <br />
          Shor&rsquo;s algorithm needs controlled modular exponentiation across
          eight or more qubits, and this simulator holds four. The quantum
          Fourier transform and anything built on a Toffoli need controlled
          phase rotations and a T&#8224; gate, which the palette does not carry.
          They are missing rather than faked — every circuit on this page is one
          you could rebuild yourself in the sandbox.
        </p>
      </div>
    </div>
  );
}
