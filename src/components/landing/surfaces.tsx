import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { MODULES, SKILLS } from "@/lib/data";
import { radarPoints, axisPoint } from "@/lib/geometry";
import { cn } from "@/lib/utils";

/**
 * The four surfaces of the platform.
 *
 * Each card carries a working miniature of the thing it links to rather than an
 * icon, so the grid doubles as a table of contents you can read at a glance.
 * The eyebrow names the part of the site the card opens.
 *
 * Hover changes the border and the arrow and nothing else. A card that lifts,
 * glows and casts a coloured shadow is four announcements for one event.
 */

/* ---------------- miniatures ---------------- */

function SandboxMini() {
  const wires = [0, 1, 2];
  return (
    <div className="relative h-full w-full overflow-hidden bg-void p-5">
      <div className="relative space-y-4">
        {wires.map((q) => (
          <div key={q} className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-dim">q{q}</span>
            <div className="relative flex h-7 flex-1 items-center">
              <span className="absolute inset-x-0 h-px bg-edge-hi" />
              {q === 0 && (
                <span className="relative ml-3 grid size-7 place-items-center border border-photon bg-void font-mono text-[12px] font-semibold text-photon">
                  H
                </span>
              )}
              {q === 1 && <span className="relative ml-14 size-3 rounded-full bg-photon" />}
              {q === 2 && (
                <span className="relative ml-14 grid size-7 place-items-center rounded-full border border-photon bg-void font-mono text-[13px] text-photon">
                  +
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* A gate mid-drag over an empty slot — the interaction the page promises. */}
      <span className="absolute top-[3.6rem] right-8 grid size-8 rotate-6 place-items-center border border-paper bg-strata font-mono text-[13px] font-semibold text-paper">
        Z
      </span>
      <span className="absolute top-[3.7rem] right-[5.6rem] size-8 border border-dashed border-edge-hi" />
    </div>
  );
}

function TutorMini() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-void p-4">
      <p className="eyebrow text-[11px] text-photon">Reading your circuit</p>
      <div className="mt-3 space-y-2">
        <div className="max-w-[92%] border border-edge bg-nebula px-3 py-1.5 text-[12.5px] leading-snug text-paper">
          Your Hadamard is on q1, so the control wire never fires.
        </div>
        <div className="border border-edge bg-strata px-3 py-1.5 font-mono text-[12px] leading-snug">
          <span className="text-collapse line-through">- qc.h(1)</span>
          <br />
          <span className="text-photon">+ qc.h(0)</span>
        </div>
        <div className="ml-auto max-w-[66%] border border-photon px-3 py-1.5 text-[12.5px] text-photon">
          Apply the fix
        </div>
      </div>
    </div>
  );
}

function CurriculumMini() {
  return (
    <div className="relative grid h-full w-full grid-cols-4 grid-rows-2 gap-2 overflow-hidden bg-void p-4">
      {MODULES.map((m) => {
        const done = m.state === "mastered";
        const going = m.state === "active";
        return (
          <div
            key={m.slug}
            className={cn(
              "flex flex-col justify-between border px-2 py-2",
              done && "border-photon",
              going && "border-paper",
              !done && !going && "border-edge",
            )}
          >
            <span
              className={cn(
                "ket text-[12px] leading-none",
                done ? "text-photon" : going ? "text-paper" : "text-dim",
              )}
            >
              {m.ket}
            </span>
            <span className="mt-2 block h-[3px] w-full bg-strata">
              <span
                className={cn("block h-full", m.progress > 0 && "bg-photon")}
                style={{ width: `${m.progress}%` }}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DashboardMini() {
  const R = 46;
  const axes = SKILLS.length;
  return (
    <div className="relative grid h-full w-full place-items-center overflow-hidden bg-void p-3">
      <svg viewBox="-60 -60 120 120" className="h-full max-h-[136px] w-auto" aria-hidden>
        {[0.35, 0.7, 1].map((ring) => (
          <polygon
            key={ring}
            points={radarPoints(Array(axes).fill(100), R * ring)}
            fill="none"
            stroke="#262626"
            strokeWidth={0.7}
          />
        ))}
        {SKILLS.map((skill, i) => {
          const { x, y } = axisPoint(i, axes, R);
          return (
            <line
              key={skill.short}
              x1={0}
              y1={0}
              x2={x}
              y2={y}
              stroke="#262626"
              strokeWidth={0.7}
            />
          );
        })}
        <polygon
          points={radarPoints(
            SKILLS.map((s) => s.cohort),
            R,
          )}
          fill="none"
          stroke="#8e8e89"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <polygon
          points={radarPoints(
            SKILLS.map((s) => s.value),
            R,
          )}
          fill="#2fe4ff"
          fillOpacity={0.2}
          stroke="#2fe4ff"
          strokeWidth={1.6}
        />
      </svg>
    </div>
  );
}

/* ---------------- cards ---------------- */

const SURFACES = [
  {
    href: "/sandbox",
    route: "Sandbox",
    title: "Circuit sandbox",
    body: "Drag gates onto a three-qubit register and watch the Qiskit pane rewrite itself as you go. Edit either side — the diagram and the code stay the same circuit.",
    footnote: "8 gates · statevector + histogram · runs in your browser",
    span: "lg:col-span-7",
    visual: <SandboxMini />,
  },
  {
    href: "/sandbox",
    route: "AI tutor",
    title: "A tutor that reads the screen",
    body: "It sees the circuit you built, the histogram you got, and the lesson you are on — then explains the gap and offers the diff.",
    footnote: "Explains, suggests, and cites the state it is looking at",
    span: "lg:col-span-5",
    visual: <TutorMini />,
  },
  {
    href: "/curriculum",
    route: "Curriculum",
    title: "Eight modules, |000⟩ → |111⟩",
    body: "A prerequisite chain from one qubit to Shor. Modules unlock as you master the one before, and nothing is ever behind a payment.",
    footnote: "53 lessons · 9.6 hours · 8 badges",
    span: "lg:col-span-5",
    visual: <CurriculumMini />,
  },
  {
    href: "/dashboard",
    route: "Dashboard",
    title: "Proficiency you can argue with",
    body: "A skill graph across eight quantum topics with the cohort median drawn behind your shape, so progress is a comparison and not a compliment.",
    footnote: "Mastery level · badge shelf · twelve-week practice log",
    span: "lg:col-span-7",
    visual: <DashboardMini />,
  },
] as const;

export function Surfaces() {
  return (
    <section className="relative mx-auto max-w-[1440px] px-5 py-24 lg:px-10 lg:py-32">
      <header className="flex flex-wrap items-end justify-between gap-x-16 gap-y-6">
        <div className="max-w-3xl">
          <p className="eyebrow">Four surfaces</p>
          <h2 className="display-2 mt-5 text-paper">
            Learn it, build it, ask about it, then prove it.
          </h2>
        </div>
        <p className="body-text max-w-sm">
          The four screens are one loop. Whatever you are looking at, the tutor is looking at the
          same thing.
        </p>
      </header>

      <div className="mt-14 grid gap-4 lg:grid-cols-12">
        {SURFACES.map((surface) => (
          <Link
            key={surface.title}
            href={surface.href}
            className={cn(
              "panel group relative flex flex-col gap-6 p-6 sm:p-8",
              "transition-colors duration-200 hover:border-photon",
              surface.span,
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{surface.route}</p>
                <h3 className="mt-3.5 text-[1.5rem] text-paper">{surface.title}</h3>
              </div>
              <ArrowUpRight className="size-5 shrink-0 text-dim transition-colors duration-200 group-hover:text-photon" />
            </div>

            <p className="body-text max-w-xl">{surface.body}</p>

            <div className="h-[156px] shrink-0 border border-edge">{surface.visual}</div>

            <p className="font-mono text-[12px] tracking-[0.12em] text-dim uppercase">
              {surface.footnote}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
