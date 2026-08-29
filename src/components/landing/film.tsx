"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { fireBurst } from "@/lib/burst";
import { useReducedMotion } from "@/lib/pointer";
import {
  clearTrack,
  FILM_PLATEAU,
  FILM_STOPS,
  FILM_TRACK,
  setTrack,
} from "@/lib/scroll";

/**
 * Each beat sits on the formation it describes.
 *
 * `stop` is the index of the shape in the field's sequence, so a caption is
 * held at full opacity for exactly as long as that shape is held still, and
 * fades only while the field is moving to the next one. Beat three runs to the
 * end because the circuit resolving into the histogram is the sentence it is
 * in the middle of saying.
 */
const SECTIONS = [
  {
    index: "01",
    stop: 1,
    label: "The Qubit",
    title: "One state, and a direction",
    body: "A bit is 0 or 1. A qubit is a direction, and every direction it can point is a point on this sphere — the poles are |0⟩ and |1⟩, and everything else is a mixture carrying a phase.",
  },
  {
    index: "02",
    stop: 2,
    label: "Superposition",
    title: "Both answers, held at once",
    body: "Nothing was added to get here. The same points stopped agreeing, and the register is now sitting in |0⟩ and |1⟩ simultaneously — which is the resource every algorithm in the curriculum spends.",
  },
  {
    index: "03",
    stop: 3,
    holdToEnd: true,
    label: "Quantum Gates",
    title: "Gates turn it, measurement ends it",
    body: "A gate is a rotation. Lay them across a register in sequence and the sequence is an algorithm — this one entangles two qubits, and the bars are its real outcome: half |00⟩, half |11⟩, never anything between.",
  },
] as const;

const SEGMENT = 1 / (FILM_STOPS - 1);

/** How much track a caption spends fading in or out at either end of its hold. */
const FADE = 0.045;

const smooth = (t: number) => t * t * (3 - 2 * t);

function visibility(progress: number, from: number, to: number) {
  if (progress < from - FADE || progress > to + FADE) return 0;
  if (progress < from) return smooth((progress - from + FADE) / FADE);
  if (progress > to) return smooth(1 - (progress - to) / FADE);
  return 1;
}

export function Film() {
  const track = useRef<HTMLElement>(null);
  const cards = useRef<Array<HTMLDivElement | null>>([]);
  const ticks = useRef<Array<HTMLSpanElement | null>>([]);
  const collapsed = useRef(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = track.current;
    if (!node) return;

    gsap.registerPlugin(ScrollTrigger);

    const paint = (progress: number) => {
      /* Measurement is a collapse, so it gets one.
         The circuit starts resolving into the histogram once the last beat's
         hold ends, and the burst lands on that. Armed with hysteresis so
         scrolling back and forth over the threshold re-triggers it once each
         way instead of machine-gunning at the boundary. */
      if (!collapsed.current && progress > 0.92) {
        collapsed.current = true;
        fireBurst({ y: 0.22, size: 1.15 });
      } else if (collapsed.current && progress < 0.86) {
        collapsed.current = false;
      }

      SECTIONS.forEach((section, i) => {
        const card = cards.current[i];
        if (!card) return;

        const from = section.stop * SEGMENT;
        const to = "holdToEnd" in section && section.holdToEnd ? 1 : from + FILM_PLATEAU;
        const shown = visibility(progress, from, to);

        // Dead still through the hold, so the only thing moving while you are
        // reading is the shape above the words.
        const drift = progress < from ? progress - from : progress > to ? progress - to : 0;

        card.style.opacity = String(shown);
        card.style.transform = `translate3d(0, ${(drift * -160).toFixed(2)}px, 0)`;
        card.style.visibility = shown < 0.01 ? "hidden" : "visible";

        const tick = ticks.current[i];
        if (tick) tick.style.transform = `scaleX(${Math.max(0.1, shown).toFixed(3)})`;
      });
    };

    const trigger = ScrollTrigger.create({
      trigger: node,
      start: "top top",
      end: "bottom bottom",
      // A number lags the scrub behind the wheel, which is the whole difference
      // between scrubbing a film and dragging a slider. Someone who asked for
      // less motion gets it locked to the scrollbar instead.
      scrub: reduced ? true : 0.55,
      onUpdate: (self) => {
        setTrack(FILM_TRACK, self.progress, true);
        paint(self.progress);
      },
      onToggle: (self) => setTrack(FILM_TRACK, self.progress, self.isActive),
    });

    paint(0);

    return () => {
      trigger.kill();
      clearTrack(FILM_TRACK);
    };
  }, [reduced]);

  return (
    <section ref={track} className="relative h-[700vh]" aria-label="How a quantum computation runs">
      <div className="sticky top-0 flex h-screen items-end overflow-hidden pb-16 lg:pb-24">
        <div className="mx-auto flex w-full max-w-[1440px] items-end gap-10 px-5 lg:px-10">
          <div className="relative h-[17rem] flex-1 sm:h-[15rem]">
            {SECTIONS.map((section, i) => (
              <div
                key={section.label}
                ref={(el) => {
                  cards.current[i] = el;
                }}
                className="absolute inset-0 flex flex-col justify-end will-change-[opacity,transform]"
                style={{ opacity: 0 }}
              >
                <p className="flex items-baseline gap-3">
                  <span className="font-mono text-sm text-photon tabular-nums">{section.index}</span>
                  <span className="eyebrow text-photon">{section.label}</span>
                </p>
                <h2 className="display-2 mt-5 max-w-3xl text-paper">{section.title}</h2>
                <p className="lede mt-6 max-w-xl">{section.body}</p>
              </div>
            ))}
          </div>

          <div className="hidden shrink-0 flex-col gap-3 pb-2 lg:flex" aria-hidden>
            {SECTIONS.map((section, i) => (
              <span key={section.label} className="block h-px w-16 bg-edge">
                <span
                  ref={(el) => {
                    ticks.current[i] = el;
                  }}
                  className="block h-px w-full origin-left bg-photon"
                  style={{ transform: "scaleX(0.1)" }}
                />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
