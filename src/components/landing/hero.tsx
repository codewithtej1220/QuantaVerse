"use client";

import dynamic from "next/dynamic";
import { ArrowRight, Boxes, Sparkles } from "lucide-react";

import { ActionLink } from "@/components/site/action";
import { StateReadout } from "@/components/three/state-readout";
import { SPHERE_ANCHOR_ID } from "@/components/three/anchor";
import { PLATFORM_STATS } from "@/lib/data";

// The 3D field is browser-only and roughly 400 kB of WebGL; it must not block
// the headline from painting.
const QuantumField = dynamic(() => import("@/components/three/quantum-field"), {
  ssr: false,
  loading: () => null,
});

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Layer 1: the reference lattice. */}
      <div className="lattice pointer-events-none absolute inset-0 opacity-45 [mask-image:radial-gradient(ellipse_75%_60%_at_50%_35%,#000_35%,transparent_100%)]" />

      {/* Layer 2: the interactive field. */}
      <div className="absolute inset-0" aria-hidden>
        <QuantumField />
      </div>

      {/* Layer 3: content. */}
      <div className="relative mx-auto grid max-w-[1400px] gap-14 px-5 pt-32 pb-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:px-10 lg:pt-40 lg:pb-28">
        <div className="animate-rise">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="ket text-lg text-photon">|ψ⟩</span>
            <span className="eyebrow">Open educational resource</span>
            <span className="h-3 w-px bg-white/15" />
            <span className="eyebrow text-phase/85">MIT + CC BY-SA</span>
          </p>

          <h1 className="mt-6 text-[clamp(2.7rem,6.4vw,5rem)] leading-[0.94] font-semibold tracking-[-0.038em] text-balance">
            Master quantum
            <br />
            algorithms{" "}
            <span className="relative whitespace-nowrap text-photon text-glow">
              for free
              <svg
                className="absolute -bottom-2 left-0 h-2.5 w-full text-photon/45"
                viewBox="0 0 200 10"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M0 7 Q 50 1, 100 6 T 200 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>
            </span>
            .
          </h1>

          <p className="mt-8 max-w-xl text-[1.0625rem] leading-relaxed text-frost/85">
            Eight modules take you from a single qubit to Shor&apos;s factoring algorithm. Build
            circuits by dragging gates, watch the state vector move in real time, and read the Qiskit
            your circuit compiles to. No account, no paywall, no trial period.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <ActionLink href="/curriculum" size="lg">
              Start learning
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </ActionLink>
            <ActionLink href="/sandbox" variant="outline" size="lg">
              <Boxes className="size-4 text-photon" />
              Open circuit sandbox
            </ActionLink>
          </div>

          <p className="mt-5 inline-flex items-center gap-2 text-[13px] text-frost/60">
            <Sparkles className="size-3.5 text-phase" />
            Everything runs in your browser. Nothing is uploaded.
          </p>
        </div>

        {/* The sphere is anchored to this reserved box; the read-out sits under it. */}
        <div className="flex flex-col items-center gap-6 lg:items-end lg:pt-4">
          <div
            id={SPHERE_ANCHOR_ID}
            aria-hidden
            className="h-[286px] w-full max-w-[26rem] sm:h-[340px] lg:h-[400px]"
          />
          <StateReadout className="animate-rise" />
        </div>
      </div>

      {/* Free-and-open claim, stated as numbers rather than a banner. */}
      <div className="relative mx-auto max-w-[1400px] px-5 pb-20 lg:px-10">
        <dl className="glass grid grid-cols-2 gap-px overflow-hidden rounded-xl lg:grid-cols-4">
          {PLATFORM_STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-1 border-t border-l border-white/6 px-5 py-5 first:border-l-0 lg:border-t-0"
            >
              <dt className="eyebrow">{stat.label}</dt>
              <dd className="text-2xl font-semibold tracking-tight text-paper tabular-nums">
                {stat.value}
              </dd>
              <dd className="font-mono text-[11px] text-frost/55">{stat.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
