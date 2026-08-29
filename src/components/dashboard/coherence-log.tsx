import { COHERENCE_LOG, LEARNER } from "@/lib/data";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DEMO_START = Date.UTC(2026, 5, 1);
const DAY_MS = 86_400_000;

/* A heatmap needs its steps to be tellable apart, so this is the one place
   on the site with a ramp. It is still one colour — cyan at four strengths
   over black — rather than a hue shift. */
const LEVEL = [
  "bg-strata",
  "bg-photon/25",
  "bg-photon/50",
  "bg-photon/75",
  "bg-photon",
];

function monthBands(start: number, weeks: number) {
  const bands: { label: string; weeks: number }[] = [];
  for (let week = 0; week < weeks; week += 1) {
    const monday = new Date(start + week * 7 * DAY_MS);
    const label = MONTH_FULL[monday.getUTCMonth()];
    const last = bands[bands.length - 1];
    if (last && last.label === label) last.weeks += 1;
    else bands.push({ label, weeks: 1 });
  }
  return bands;
}

interface CoherenceLogProps {
  log?: number[];
  streakDays?: number;
  start?: number;
}

export function CoherenceLog({
  log = COHERENCE_LOG,
  streakDays = LEARNER.streakDays,
  start = DEMO_START,
}: CoherenceLogProps) {
  const weeks = Math.max(1, Math.round(log.length / 7));
  const activeDays = log.filter((value) => value > 0).length;
  const sessions = log.reduce((sum, value) => sum + value, 0);
  const longestRun = log.reduce(
    (state, value) => {
      const run = value > 0 ? state.run + 1 : 0;
      return { run, best: Math.max(state.best, run) };
    },
    { run: 0, best: 0 },
  ).best;

  const bands = monthBands(start, weeks);
  const endDate = new Date(start + (log.length - 1) * DAY_MS);
  const endLabel = `${DAY_LABELS[6]} ${endDate.getUTCDate()} ${MONTH_LABELS[endDate.getUTCMonth()]}`;

  const cellDate = (index: number) => {
    const date = new Date(start + index * DAY_MS);
    return `${DAY_LABELS[index % 7]} ${date.getUTCDate()} ${MONTH_LABELS[date.getUTCMonth()]}`;
  };

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-edge pb-4">
        <div>
          <p className="eyebrow">Coherence log</p>
          <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em]">
            {streakDays === 0
              ? "No run yet"
              : `${streakDays} day${streakDays === 1 ? "" : "s"} without a gap`}
          </h2>
        </div>
        <p className="font-mono text-[11px] text-frost tabular-nums">
          {weeks} weeks to {endLabel}
        </p>
      </div>

      <div className="mt-5 flex gap-8 overflow-x-auto pb-1">
        <div className="min-w-[300px] flex-1">
          <div className="flex pl-8">
            {bands.map((band) => (
              <span
                key={band.label}
                className="font-mono text-[11px] tracking-[0.14em] text-frost uppercase"
                style={{ flex: `${band.weeks} 0 0%` }}
              >
                {band.label}
              </span>
            ))}
          </div>

          <div className="mt-1.5 flex gap-1.5">
            <div className="grid w-6 shrink-0 grid-rows-7 gap-[3px]">
              {DAY_LABELS.map((day, row) => (
                <span
                  key={day}
                  className="flex items-center font-mono text-[8.5px] text-frost"
                >
                  {row % 2 === 0 ? day[0] : ""}
                </span>
              ))}
            </div>

            <div
              className="grid flex-1 grid-flow-col grid-rows-7 gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
              role="img"
              aria-label={`Practice heatmap: ${activeDays} active days out of ${log.length}, ${sessions} sessions in total, current run ${streakDays} days.`}
            >
              {log.map((value, index) => (
                <span
                  key={index}
                  title={`${cellDate(index)} · ${value === 0 ? "no practice" : `${value} session${value === 1 ? "" : "s"}`}`}
                  className={cn(
                    "aspect-square w-full rounded-[3px] transition-transform hover:scale-125",
                    LEVEL[Math.min(value, LEVEL.length - 1)],
                  )}
                />
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 pl-8">
            <span className="mr-1 font-mono text-[11px] tracking-[0.14em] text-frost uppercase">
              quiet
            </span>
            {LEVEL.map((level, i) => (
              <span key={i} className={cn("size-2.5 rounded-[2px]", level)} />
            ))}
            <span className="ml-1 font-mono text-[11px] tracking-[0.14em] text-frost uppercase">
              4 sessions
            </span>
          </div>
        </div>

        <dl className="grid shrink-0 grid-cols-3 gap-6 sm:w-[210px] sm:grid-cols-1 sm:gap-4">
          {(
            [
              ["Active days", `${activeDays}/${log.length}`],
              ["Sessions", sessions.toLocaleString("en-IN")],
              ["Longest run", `${longestRun}d`],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="font-mono text-[11px] tracking-[0.16em] text-frost uppercase">
                {label}
              </dt>
              <dd className="mt-1 font-mono text-[17px] text-paper tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mt-4 border-t border-edge pt-4 text-[12px] leading-relaxed text-frost">
        A day counts when a circuit runs, not when a page loads. Hover a cell for the date.
      </p>
    </section>
  );
}
