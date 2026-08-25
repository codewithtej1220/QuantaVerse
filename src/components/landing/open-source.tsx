import { GitFork, Scale, ShieldOff, Users } from "lucide-react";

import { ActionLink } from "@/components/site/action";
import { REPO_LABEL, REPO_URL } from "@/lib/site";

/**
 * The free-and-open-source statement.
 *
 * The claim is made in terms a judge or a teacher can verify — a licence, a
 * clone command, the absence of an account — rather than as a "100% FREE!"
 * banner. Verifiable beats emphatic.
 */

const TERMS = [
  {
    icon: Scale,
    term: "MIT licensed code",
    detail:
      "Clone it, run it on a college server, rename it for your own department. No attribution theatre required.",
  },
  {
    icon: Users,
    term: "CC BY-SA 4.0 content",
    detail:
      "All 53 lessons, diagrams and problem sets are reusable in your own course, so long as your version stays open too.",
  },
  {
    icon: ShieldOff,
    term: "No account, no telemetry",
    detail:
      "Simulation runs in your browser, and the optional Qiskit API runs on your own machine. There is nothing to sign up for and nothing to leak.",
  },
  {
    icon: GitFork,
    term: "Built in the open",
    detail:
      "Every commit, issue and lesson draft is public. The deliverable is the repository, not a licence key.",
  },
] as const;

export function OpenSource() {
  return (
    <section className="relative mx-auto max-w-[1400px] px-5 py-20 lg:px-10 lg:py-28">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-20">
        {/* min-w-0: the clone command below is one long line, and without this the
            grid track grows to fit it and drags the whole page sideways. */}
        <div className="min-w-0">
          <p className="eyebrow">The licence</p>
          <h2 className="mt-4 text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.04] font-semibold tracking-[-0.03em] text-balance">
            Free is not our pricing.
            <br />
            <span className="text-photon text-glow">It is the licence.</span>
          </h2>
          <p className="mt-6 max-w-lg text-[1.0625rem] leading-relaxed text-frost/80">
            Quantum computing courses cost more than most Indian undergraduates spend on a semester
            of everything else. QuantaVerse is the whole syllabus, the simulator and the tutor, under
            terms that let any college run its own copy tomorrow.
          </p>

          {/* The claim, made checkable. */}
          <div className="mt-9 overflow-hidden rounded-xl border border-white/8 bg-[#05080f]">
            <div className="flex items-center gap-2 border-b border-white/6 px-4 py-2.5">
              <span className="size-2 rounded-full bg-collapse/70" />
              <span className="size-2 rounded-full bg-[#f5c451]/70" />
              <span className="size-2 rounded-full bg-photon/70" />
              <span className="ml-2 font-mono text-[10.5px] tracking-[0.16em] text-frost/45 uppercase">
                run your own copy
              </span>
            </div>
            <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-relaxed">
              <code>
                <span className="text-frost/40">$ </span>
                <span className="text-paper">git clone </span>
                <span className="text-photon">{REPO_LABEL}</span>
                {"\n"}
                <span className="text-frost/40">$ </span>
                <span className="text-paper">npm install &amp;&amp; npm run dev</span>
                {"\n"}
                <span className="text-frost/45"># ready on localhost:3000 — no keys, no config</span>
                {"\n"}
                <span className="text-frost/40">$ </span>
                <span className="text-paper">uvicorn app.main:app --reload</span>
                <span className="text-frost/45">  # optional Qiskit API</span>
              </code>
            </pre>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <ActionLink href="/curriculum" size="lg">
              Start learning
            </ActionLink>
            <ActionLink href={REPO_URL} variant="outline" size="lg">
              <GitFork className="size-4 text-photon" />
              Read the source
            </ActionLink>
          </div>
        </div>

        <div className="glass self-start overflow-hidden rounded-2xl">
          <dl className="grid divide-y divide-white/6 sm:grid-cols-2 sm:[&>*:nth-child(-n+2)]:border-b sm:[&>*:nth-child(-n+2)]:border-white/6 sm:[&>*:nth-child(odd)]:border-r sm:[&>*:nth-child(odd)]:border-white/6 sm:divide-y-0">
            {TERMS.map(({ icon: Icon, term, detail }) => (
              <div key={term} className="flex flex-col gap-3 p-6 sm:p-7">
                <Icon className="size-4.5 text-photon" />
                <dt className="font-medium text-paper">{term}</dt>
                <dd className="text-[0.9rem] leading-relaxed text-frost/70">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
