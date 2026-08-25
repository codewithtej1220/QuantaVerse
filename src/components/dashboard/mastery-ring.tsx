import { LEARNER } from "@/lib/data";

/**
 * The mastery ring.
 *
 * Five titles, one arc. The pips on the track are the level boundaries, so the
 * gap between the arc's head and the next pip is literally how far there is to
 * go — the number in the middle and the geometry say the same thing.
 */

const LEVELS = 5;
const R = 52;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function MasteryRing() {
  const { masteryLevel, masteryProgress, masteryTitle, nextTitle } = LEARNER;

  /* Position on the whole ladder: levels already cleared, plus this one's part. */
  const overall = ((masteryLevel - 1 + masteryProgress / 100) / LEVELS) * 100;
  const dash = (overall / 100) * CIRCUMFERENCE;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg viewBox="-64 -64 128 128" className="size-[128px] -rotate-90">
          <circle r={R} fill="none" stroke="#101835" strokeWidth="7" />
          <circle
            r={R}
            fill="none"
            stroke="url(#mastery-arc)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${dash.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`}
            style={{ filter: "drop-shadow(0 0 10px rgba(56,232,255,0.5))" }}
          />
          {/* Level boundaries. */}
          {Array.from({ length: LEVELS }, (_, i) => {
            const angle = (2 * Math.PI * i) / LEVELS;
            return (
              <circle
                key={i}
                cx={Math.cos(angle) * R}
                cy={Math.sin(angle) * R}
                r="2"
                fill={i <= masteryLevel - 1 ? "#38e8ff" : "#33427a"}
              />
            );
          })}
          <defs>
            <linearGradient id="mastery-arc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38e8ff" />
              <stop offset="100%" stopColor="#b14eff" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-mono text-[9px] tracking-[0.18em] text-frost/45 uppercase">
            level
          </span>
          <span className="font-mono text-[30px] leading-none text-paper tabular-nums">
            {masteryLevel}
          </span>
        </div>
      </div>

      <div className="min-w-0">
        <p className="eyebrow">Mastery</p>
        <p className="mt-1.5 text-[19px] leading-tight font-semibold tracking-[-0.015em] text-paper">
          {masteryTitle}
        </p>
        <p className="mt-2 font-mono text-[11.5px] leading-relaxed text-frost/65">
          <span className="text-photon">{masteryProgress}%</span> of the way to {nextTitle}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-frost/50">
          Levels come from circuits that pass their check, not from lessons opened.
        </p>
      </div>
    </div>
  );
}
