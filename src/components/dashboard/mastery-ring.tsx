import { LEARNER } from "@/lib/data";

const DEFAULT_LEVELS = 5;
const R = 52;
const CIRCUMFERENCE = 2 * Math.PI * R;

interface MasteryRingProps {
  level?: number;
  title?: string;
  progress?: number;
  nextTitle?: string | null;
  levels?: number;
  note?: string;
}

export function MasteryRing({
  level = LEARNER.masteryLevel,
  title = LEARNER.masteryTitle,
  progress = LEARNER.masteryProgress,
  nextTitle = LEARNER.nextTitle,
  levels = DEFAULT_LEVELS,
  note = "Levels come from circuits that pass their check, not from lessons opened.",
}: MasteryRingProps) {
  const overall = Math.min(100, ((level - 1 + progress / 100) / levels) * 100);
  const dash = (overall / 100) * CIRCUMFERENCE;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg viewBox="-64 -64 128 128" className="size-[128px] -rotate-90">
          <circle r={R} fill="none" stroke="#151515" strokeWidth="7" />
          <circle
            r={R}
            fill="none"
            stroke="#2fe4ff"
            strokeWidth="7"
            strokeDasharray={`${dash.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`}
          />
          {Array.from({ length: levels }, (_, i) => {
            const angle = (2 * Math.PI * i) / levels;
            return (
              <circle
                key={i}
                cx={Math.cos(angle) * R}
                cy={Math.sin(angle) * R}
                r="2"
                fill={i <= level - 1 ? "#2fe4ff" : "#3d3d3d"}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-mono text-[11px] tracking-[0.18em] text-frost uppercase">
            Level
          </span>
          <span className="font-mono text-[30px] leading-none text-paper tabular-nums">
            {level}
          </span>
        </div>
      </div>

      <div className="min-w-0">
        <p className="eyebrow">Mastery</p>
        <p className="mt-1.5 text-[19px] leading-tight font-semibold tracking-[-0.015em] text-paper">
          {title}
        </p>
        <p className="mt-2 font-mono text-[11.5px] leading-relaxed text-frost">
          {nextTitle ? (
            <>
              <span className="text-photon">{progress}%</span> of the way to {nextTitle}
            </>
          ) : (
            <span className="text-photon">top of the ladder</span>
          )}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-frost">{note}</p>
      </div>
    </div>
  );
}
