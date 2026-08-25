import { COHERENCE_LOG, LEARNER } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * The coherence log: 84 days of practice, one cell per day.
 *
 * A real qubit holds its state for microseconds; a habit is the same problem on
 * a human timescale, which is the joke the name is making. Weeks run left to
 * right, days top to bottom, and every number on the card is counted from the
 * array rather than asserted next to it.
 */

const WEEKS = 12;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Monday 1 June 2026 — the first cell. Fixed, so server and client agree. */
const START = Date.UTC(2026, 5, 1);
const DAY_MS = 86_400_000;

/** Month bands above the grid: {label, weeks} in order. */
const MONTH_BANDS = [
  { label: "June", weeks: 5 },
  { label: "July", weeks: 4 },
  { label: "August", weeks: 3 },
];

const LEVEL = [
  "bg-white/[0.055]",
  "bg-photon/25",
  "bg-photon/45",
  "bg-photon/70",
  "bg-photon shadow-[0_0_10px_-2px_rgba(56,232,255,0.95)]",
];

const ACTIVE_DAYS = COHERENCE_LOG.filter((value) => value > 0).length;
const SESSIONS = COHERENCE_LOG.reduce((sum, value) => sum + value, 0);
const LONGEST_RUN = COHERENCE_LOG.reduce(
  (state, value) => {
    const run = value > 0 ? state.run + 1 : 0;
    return { run, best: Math.max(state.best, run) };
  },
  { run: 0, best: 0 },
).best;

function cellDate(index: number) {
  const date = new Date(START + index * DAY_MS);
  return `${DAY_LABELS[index % 7]} ${date.getUTCDate()} ${MONTH_LABELS[date.getUTCMonth()]}`;
}

export function CoherenceLog() {
  return (
    <section className="glass rounded-2xl p-5 lg:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <p className="eyebrow">Coherence log</p>
          <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em]">
            {LEARNER.streakDays} days without a gap
          </h2>
        </div>
        <p className="font-mono text-[11px] text-frost/55 tabular-nums">
          12 weeks to Sun 23 Aug
        </p>
      </div>

      <div className="mt-5 flex gap-8 overflow-x-auto pb-1">
        <div className="min-w-[300px] flex-1">
          {/* Month bands, sized by how many weeks each one owns. */}
          <div className="flex pl-8">
            {MONTH_BANDS.map((band) => (
              <span
                key={band.label}
                className="font-mono text-[9.5px] tracking-[0.14em] text-frost/40 uppercase"
                style={{ flex: `${band.weeks} 0 0%` }}
              >
                {band.label}
              </span>
            ))}
          </div>

          <div className="mt-1.5 flex gap-1.5">
            {/* Weekday rail — every other row, so the labels never crowd. */}
            <div className="grid w-6 shrink-0 grid-rows-7 gap-[3px]">
              {DAY_LABELS.map((day, row) => (
                <span
                  key={day}
                  className="flex items-center font-mono text-[8.5px] text-frost/35"
                >
                  {row % 2 === 0 ? day[0] : ""}
                </span>
              ))}
            </div>

            {/* 12 columns × 7 rows, filled column-first so a column is a week. */}
            <div
              className="grid flex-1 grid-flow-col grid-rows-7 gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}
              role="img"
              aria-label={`Practice heatmap: ${ACTIVE_DAYS} active days out of ${COHERENCE_LOG.length}, ${SESSIONS} sessions in total, current run ${LEARNER.streakDays} days.`}
            >
              {COHERENCE_LOG.map((value, index) => (
                <span
                  key={index}
                  title={`${cellDate(index)} · ${value === 0 ? "no practice" : `${value} session${value === 1 ? "" : "s"}`}`}
                  className={cn(
                    "aspect-square w-full rounded-[3px] transition-transform hover:scale-125",
                    LEVEL[value],
                  )}
                />
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 pl-8">
            <span className="mr-1 font-mono text-[9px] tracking-[0.14em] text-frost/35 uppercase">
              quiet
            </span>
            {LEVEL.map((level, i) => (
              <span key={i} className={cn("size-2.5 rounded-[2px]", level)} />
            ))}
            <span className="ml-1 font-mono text-[9px] tracking-[0.14em] text-frost/35 uppercase">
              4 sessions
            </span>
          </div>
        </div>

        {/* Counted, not claimed. */}
        <dl className="grid shrink-0 grid-cols-3 gap-6 sm:w-[210px] sm:grid-cols-1 sm:gap-4">
          {(
            [
              ["Active days", `${ACTIVE_DAYS}/${COHERENCE_LOG.length}`],
              ["Sessions", SESSIONS.toLocaleString("en-IN")],
              ["Longest run", `${LONGEST_RUN}d`],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="font-mono text-[9.5px] tracking-[0.16em] text-frost/40 uppercase">
                {label}
              </dt>
              <dd className="mt-1 font-mono text-[17px] text-paper tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mt-4 border-t border-white/8 pt-4 text-[12px] leading-relaxed text-frost/55">
        A day counts when a circuit runs, not when a page loads. Hover a cell for the date.
      </p>
    </section>
  );
}
