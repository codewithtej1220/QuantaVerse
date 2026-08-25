import { cn } from "@/lib/utils";

/**
 * Progress drawn as a measurement probability.
 *
 * A learner's completion is |amplitude|² on this platform, so the bar carries a
 * probability read-out and quarter-tick gridlines like a histogram axis rather
 * than a generic percentage.
 */
export function AmplitudeBar({
  value,
  label = "Completion",
  className,
  showValue = true,
  dim = false,
}: {
  value: number;
  label?: string;
  className?: string;
  showValue?: boolean;
  dim?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || showValue) && (
        <div className="flex items-baseline justify-between gap-3">
          <span className="eyebrow">{label}</span>
          {showValue && (
            <span className="font-mono text-[11px] tabular-nums text-frost/85">
              {clamped.toFixed(0)}
              <span className="text-frost/45">%</span>
            </span>
          )}
        </div>
      )}
      <div
        className="relative h-1.5 overflow-hidden rounded-full bg-[#101835]"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        {/* Quarter ticks: the same gridlines a probability histogram carries. */}
        <span className="absolute inset-y-0 left-1/4 w-px bg-white/8" />
        <span className="absolute inset-y-0 left-1/2 w-px bg-white/8" />
        <span className="absolute inset-y-0 left-3/4 w-px bg-white/8" />
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out",
            dim ? "bg-[#33427a]" : "amplitude-fill",
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
