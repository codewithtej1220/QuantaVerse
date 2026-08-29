"use client";

import { ArrowRight } from "lucide-react";

import { ActionLink } from "@/components/site/action";
import { Zone } from "@/components/three/stage";
import { StateReadout } from "@/components/three/state-readout";
import { PLATFORM_STATS } from "@/lib/data";

/**
 * The hero.
 *
 * Three words, stacked, at the largest size the viewport will carry. The third
 * is the only copper on the screen above the fold, which is what makes it land.
 *
 * The object to the right is not an illustration of a qubit — it is one. The
 * cursor's vertical position is θ and its horizontal position is φ, so a
 * visitor who has never seen a Bloch sphere before has already prepared a state
 * on it by the time they finish reading the headline, and the read-out
 * underneath writes down what they just did in the notation module one teaches.
 */
export function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-[1440px] px-5 pt-32 pb-16 lg:px-10 lg:pt-40 lg:pb-20">
        <div className="grid items-center gap-x-16 gap-y-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <div className="@container animate-rise">
            <p className="eyebrow">Open educational resource</p>

            <h1 className="display-1 mt-6 text-paper">
              Master
              <br />
              Quantum
              <br />
              <span className="text-photon">Algorithms</span>
            </h1>

            {/* The claim, in the smallest type on the page, because it does not
                need to shout to be the reason someone stays. */}
            <p className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[12px] tracking-[0.16em] text-frost uppercase">
              <span>Free forever</span>
              <span className="h-3 w-px bg-edge-hi" />
              <span>MIT licensed</span>
              <span className="h-3 w-px bg-edge-hi" />
              <span>No account required</span>
            </p>

            <p className="lede mt-8 max-w-xl">
              Eight modules take you from a single qubit to Shor&apos;s factoring algorithm. Build
              circuits by dragging gates, watch the state vector move in real time, and read the
              Qiskit your circuit compiles to. Every simulation runs in your browser — nothing is
              uploaded, and there is nothing to sign up for.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <ActionLink href="/curriculum" size="lg">
                Start learning
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </ActionLink>
              <ActionLink href="/sandbox" variant="outline" size="lg">
                Open circuit sandbox
              </ActionLink>
            </div>
          </div>

          {/* The qubit, and the instrument that reads it. */}
          <div className="flex flex-col gap-6">
            <Zone
              id="hero-qubit"
              focus="qubit"
              scale={1.05}
              className="h-[20rem] w-full sm:h-[24rem] lg:h-[27rem]"
            />
            <StateReadout />
          </div>
        </div>
      </div>

      {/* The free-and-open claim, stated as four numbers on one rule. */}
      <div className="border-y border-edge">
        <dl className="mx-auto grid max-w-[1440px] grid-cols-2 lg:grid-cols-4">
          {PLATFORM_STATS.map((stat) => (
            <div
              key={stat.label}
              className="border-edge px-5 py-8 not-first:border-l lg:px-10 [&:nth-child(3)]:border-l-0 [&:nth-child(n+3)]:border-t lg:[&:nth-child(3)]:border-l lg:[&:nth-child(n+3)]:border-t-0"
            >
              <dt className="eyebrow">{stat.label}</dt>
              <dd className="font-display mt-3 text-5xl font-extrabold tracking-[-0.04em] text-paper tabular-nums lg:text-6xl">
                {stat.value}
              </dd>
              <dd className="mt-2 font-mono text-[12px] text-dim">{stat.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
