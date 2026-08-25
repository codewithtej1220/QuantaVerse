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
 * The route path sits in the eyebrow because that is the honest label.
 */

/* ---------------- miniatures ---------------- */

function SandboxMini() {
  const wires = [0, 1, 2];
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-[#070c1a] p-4">
      <div className="lattice absolute inset-0 opacity-40" />
      <div className="relative space-y-4">
        {wires.map((q) => (
          <div key={q} className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-frost/45">q{q}</span>
            <div className="relative flex h-7 flex-1 items-center">
              <span className="absolute inset-x-0 h-px bg-[#6f8bd8]/35" />
              {q === 0 && (
                <span className="relative ml-3 grid size-7 place-items-center rounded-[6px] border border-photon/60 bg-[#0a1020] font-mono text-[11px] font-semibold text-photon shadow-[0_0_16px_-4px_rgba(56,232,255,0.7)]">
                  H
                </span>
              )}
              {q === 1 && (
                <span className="relative ml-14 size-3 rounded-full bg-photon shadow-[0_0_12px_2px_rgba(56,232,255,0.55)]" />
              )}
              {q === 2 && (
                <span className="relative ml-14 grid size-7 place-items-center rounded-full border border-photon/60 bg-[#0a1020] font-mono text-[12px] text-photon">
                  +
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* A gate mid-drag over an empty slot — the interaction the page promises. */}
      <span className="absolute top-[3.4rem] right-8 grid size-8 rotate-6 place-items-center rounded-[7px] border border-phase/70 bg-[#140a26]/95 font-mono text-xs font-semibold text-phase shadow-[0_10px_28px_-8px_rgba(177,78,255,0.9)]">
        Z
      </span>
      <span className="absolute top-[3.6rem] right-[5.4rem] size-8 rounded-[7px] border border-dashed border-photon/45" />
    </div>
  );
}

function TutorMini() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-[#070c1a] p-4">
      <div className="absolute inset-x-0 top-0 h-px animate-scan bg-gradient-to-r from-transparent via-photon/70 to-transparent" />
      <p className="eyebrow flex items-center gap-1.5 text-[9px] text-photon/70">
        <span className="size-1.5 animate-breathe rounded-full bg-collapse" />
        Reading your circuit
      </p>
      <div className="mt-3 space-y-2">
        <div className="max-w-[88%] rounded-lg rounded-tl-sm border border-white/8 bg-white/4 px-2.5 py-2 text-[11px] leading-snug text-paper/85">
          Your Hadamard is on q1, so the control wire never fires.
        </div>
        <div className="rounded-md border border-white/8 bg-[#05080f] px-2.5 py-1.5 font-mono text-[10px] leading-relaxed">
          <span className="text-collapse/90 line-through">- qc.h(1)</span>
          <br />
          <span className="text-photon">+ qc.h(0)</span>
        </div>
        <div className="ml-auto max-w-[62%] rounded-lg rounded-br-sm border border-photon/25 bg-photon/10 px-2.5 py-2 text-[11px] text-paper/90">
          Apply the fix
        </div>
      </div>
    </div>
  );
}

function CurriculumMini() {
  return (
    <div className="relative grid h-full w-full grid-cols-4 grid-rows-2 gap-1.5 overflow-hidden rounded-lg bg-[#070c1a] p-3">
      {MODULES.map((m) => {
        const done = m.state === "mastered";
        const going = m.state === "active";
        return (
          <div
            key={m.slug}
            className={cn(
              "flex flex-col justify-between rounded-md border px-2 py-1.5",
              done && "border-photon/45 bg-photon/10",
              going && "border-phase/45 bg-phase/10",
              !done && !going && "border-white/8 bg-white/3",
            )}
          >
            <span
              className={cn(
                "ket text-[11px] leading-none",
                done ? "text-photon" : going ? "text-phase" : "text-frost/45",
              )}
            >
              {m.ket}
            </span>
            <span className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-[#101835]">
              <span
                className={cn("block h-full rounded-full", m.progress > 0 && "amplitude-fill")}
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
    <div className="relative grid h-full w-full place-items-center overflow-hidden rounded-lg bg-[#070c1a] p-3">
      <svg viewBox="-60 -60 120 120" className="h-full max-h-[132px] w-auto" aria-hidden>
        {[0.35, 0.7, 1].map((ring) => (
          <polygon
            key={ring}
            points={radarPoints(Array(axes).fill(100), R * ring)}
            fill="none"
            stroke="#6f8bd8"
            strokeOpacity={0.22}
            strokeWidth={0.6}
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
              stroke="#6f8bd8"
              strokeOpacity={0.16}
              strokeWidth={0.6}
            />
          );
        })}
        <polygon
          points={radarPoints(
            SKILLS.map((s) => s.cohort),
            R,
          )}
          fill="none"
          stroke="#8fa2cf"
          strokeOpacity={0.5}
          strokeWidth={0.9}
          strokeDasharray="2 2"
        />
        <polygon
          points={radarPoints(
            SKILLS.map((s) => s.value),
            R,
          )}
          fill="#38e8ff"
          fillOpacity={0.16}
          stroke="#38e8ff"
          strokeWidth={1.3}
        />
      </svg>
    </div>
  );
}

/* ---------------- cards ---------------- */

const SURFACES = [
  {
    href: "/sandbox",
    route: "/sandbox",
    title: "Circuit sandbox",
    body: "Drag gates onto a three-qubit register and watch the Qiskit pane rewrite itself as you go. Edit either side — the diagram and the code stay the same circuit.",
    footnote: "8 gates · statevector + histogram · runs in your browser",
    span: "lg:col-span-7",
    visual: <SandboxMini />,
    glow: "hover:shadow-[0_0_60px_-18px_rgba(56,232,255,0.5)] hover:border-photon/40",
  },
  {
    href: "/sandbox",
    route: "AI tutor · ⌘I anywhere",
    title: "A tutor that reads the screen",
    body: "It sees the circuit you built, the histogram you got, and the lesson you are on — then explains the gap and offers the diff.",
    footnote: "Explains, suggests, and cites the state it is looking at",
    span: "lg:col-span-5",
    visual: <TutorMini />,
    glow: "hover:shadow-[0_0_60px_-18px_rgba(255,77,157,0.45)] hover:border-collapse/35",
  },
  {
    href: "/curriculum",
    route: "/curriculum",
    title: "Eight modules, |000⟩ → |111⟩",
    body: "A prerequisite chain from one qubit to Shor. Modules unlock as you master the one before, and nothing is ever behind a payment.",
    footnote: "53 lessons · 9.6 hours · 8 badges",
    span: "lg:col-span-5",
    visual: <CurriculumMini />,
    glow: "hover:shadow-[0_0_60px_-18px_rgba(177,78,255,0.5)] hover:border-phase/40",
  },
  {
    href: "/dashboard",
    route: "/dashboard",
    title: "Proficiency you can argue with",
    body: "A skill graph across eight quantum topics with the cohort median drawn behind your shape, so progress is a comparison and not a compliment.",
    footnote: "Mastery level · badge shelf · twelve-week practice log",
    span: "lg:col-span-7",
    visual: <DashboardMini />,
    glow: "hover:shadow-[0_0_60px_-18px_rgba(56,232,255,0.45)] hover:border-photon/35",
  },
] as const;

export function Surfaces() {
  return (
    <section className="relative mx-auto max-w-[1400px] px-5 py-20 lg:px-10 lg:py-28">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="eyebrow">Four surfaces</p>
          <h2 className="mt-4 text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
            Learn it, build it, ask about it, then prove it.
          </h2>
        </div>
        <p className="max-w-sm text-[0.9375rem] leading-relaxed text-frost/70">
          The four screens are one loop. Whatever you are looking at, the tutor is looking at the
          same thing.
        </p>
      </header>

      <div className="mt-12 grid gap-4 lg:grid-cols-12">
        {SURFACES.map((surface) => (
          <Link
            key={surface.title}
            href={surface.href}
            className={cn(
              "glass group relative flex flex-col gap-5 overflow-hidden rounded-2xl p-6 sm:p-7",
              "transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5",
              "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-photon",
              surface.span,
              surface.glow,
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{surface.route}</p>
                <h3 className="mt-3 text-[1.35rem] leading-tight font-semibold tracking-[-0.02em] text-paper">
                  {surface.title}
                </h3>
              </div>
              <ArrowUpRight className="size-5 shrink-0 text-frost/45 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-photon" />
            </div>

            <p className="max-w-xl text-[0.9375rem] leading-relaxed text-frost/78">
              {surface.body}
            </p>

            <div className="h-[152px] shrink-0">{surface.visual}</div>

            <p className="font-mono text-[10.5px] tracking-[0.14em] text-frost/50 uppercase">
              {surface.footnote}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
