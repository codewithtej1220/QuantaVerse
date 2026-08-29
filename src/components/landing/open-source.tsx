import { ActionLink } from "@/components/site/action";
import { REPO_LABEL, REPO_URL } from "@/lib/site";

/**
 * The free-and-open-source statement.
 *
 * The claim is made in terms a judge or a teacher can verify — a licence, a
 * clone command, the absence of an account — rather than as a "100% FREE!"
 * banner. Verifiable beats emphatic.
 *
 * The icons that used to head each term have gone. Four terms with four
 * different pictograms above them is four pictures doing nothing the four
 * headings were not already doing.
 */

const TERMS = [
  {
    term: "MIT licensed code",
    detail:
      "Clone it, run it on a college server, rename it for your own department. No attribution theatre required.",
  },
  {
    term: "CC BY-SA 4.0 content",
    detail:
      "All 53 lessons, diagrams and problem sets are reusable in your own course, so long as your version stays open too.",
  },
  {
    term: "No account, no telemetry",
    detail:
      "Simulation runs in your browser, and the optional Qiskit API runs on your own machine. There is nothing to sign up for and nothing to leak.",
  },
  {
    term: "Built in the open",
    detail:
      "Every commit, issue and lesson draft is public. The deliverable is the repository, not a licence key.",
  },
] as const;

export function OpenSource() {
  return (
    <section className="relative mx-auto max-w-[1440px] px-5 py-24 lg:px-10 lg:py-32">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-20">
        {/* min-w-0: the clone command below is one long line, and without this the
            grid track grows to fit it and drags the whole page sideways. */}
        <div className="min-w-0">
          <p className="eyebrow">The licence</p>
          <h2 className="display-2 mt-5 text-paper">
            Free is not our pricing.
            <br />
            <span className="text-photon">It is the licence.</span>
          </h2>
          <p className="lede mt-7 max-w-lg">
            Quantum computing courses cost more than most Indian undergraduates spend on a semester
            of everything else. QuantaVerse is the whole syllabus, the simulator and the tutor,
            under terms that let any college run its own copy tomorrow.
          </p>

          {/* The claim, made checkable. */}
          <div className="well mt-10">
            <div className="border-b border-edge px-5 py-3">
              <span className="font-mono text-[12px] tracking-[0.16em] text-dim uppercase">
                run your own copy
              </span>
            </div>
            <pre className="overflow-x-auto px-5 py-5 font-mono text-[13px] leading-relaxed">
              <code>
                <span className="text-dim">$ </span>
                <span className="text-paper">git clone </span>
                <span className="text-photon">{REPO_LABEL}</span>
                {"\n"}
                <span className="text-dim">$ </span>
                <span className="text-paper">npm install &amp;&amp; npm run dev</span>
                {"\n"}
                <span className="text-dim"># ready on localhost:3000 — no keys, no config</span>
                {"\n"}
                <span className="text-dim">$ </span>
                <span className="text-paper">uvicorn app.main:app --reload</span>
                <span className="text-dim">  # optional Qiskit API</span>
              </code>
            </pre>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <ActionLink href="/curriculum" size="lg">
              Start learning
            </ActionLink>
            <ActionLink href={REPO_URL} variant="outline" size="lg" target="_blank" rel="noreferrer">
              Fork on GitHub
            </ActionLink>
          </div>
        </div>

        <div className="panel self-start">
          <dl className="grid divide-y divide-edge sm:grid-cols-2 sm:divide-y-0 sm:[&>*:nth-child(-n+2)]:border-b sm:[&>*:nth-child(-n+2)]:border-edge sm:[&>*:nth-child(odd)]:border-r sm:[&>*:nth-child(odd)]:border-edge">
            {TERMS.map(({ term, detail }) => (
              <div key={term} className="flex flex-col gap-3 p-7 sm:p-8">
                <dt className="text-[1.0625rem] font-semibold text-paper">{term}</dt>
                <dd className="body-text">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
