"use client";

import { ArrowRight } from "lucide-react";

import { ActionLink } from "@/components/site/action";
import { Zone } from "@/components/three/stage";
import { StateReadout } from "@/components/three/state-readout";
import { PLATFORM_STATS } from "@/lib/data";

/**
 * The hero.
 *
 * The name, at the largest size the viewport will carry, and two ways in.
 * Nothing else.
 *
 * It used to carry a headline, a row of claims and a paragraph explaining the
 * site. All of that said true things, and all of it was read by nobody: a
 * visitor who has already clicked through to a quantum-computing site does not
 * need to be sold on one, and a wall of prose above the fold is the thing that
 * makes a page look generated rather than made. What is left is the mark,
 * broken across two lines at the same point the wordmark breaks its colour, so
 * the headline is the logo at size rather than a slogan wearing its font.
 *
 * The work of holding the fold now belongs to the two live objects either side
 * of it — the lattice rippling under the cursor behind, and the qubit to the
 * right. That one is not an illustration of a qubit, it is one: the cursor's
 * vertical position is θ and its horizontal position is φ, so a visitor who has
 * never seen a Bloch sphere has already prepared a state on it before they
 * reach the buttons, and the read-out underneath writes down what they just did
 * in the notation module one teaches.
 */
export function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-[1440px] px-5 pt-32 pb-16 lg:px-10 lg:pt-40 lg:pb-20">
        <div className="grid items-center gap-x-16 gap-y-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <div className="@container animate-rise">
            <p className="eyebrow">Open educational resource</p>

            {/* The wordmark, enlarged. The break between the two halves is
                where the mark already changes colour, so setting them on
                separate lines reads as the logo rather than as two words. */}
            <h1 className="display-1 mt-6 text-paper">
              Quanta
              <br />
              <span className="text-photon">Verse</span>
            </h1>

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
