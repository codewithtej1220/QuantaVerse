import { cn } from "@/lib/utils";

/**
 * Progress drawn as a measurement probability.
 *
 * A learner's completion is |amplitude|² on this platform, so the bar carries a
 * probability read-out and quarter-tick gridlines like a histogram axis rather
 * than a generic percentage. The ticks stay because they are an axis; the
 * gradient and the glow that used to fill the bar have gone, because a
 * probability is one number and one number is one colour.
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
    <div className={cn("space-y-2", className)}>
      {(label || showValue) && (
        <div className="flex items-baseline justify-between gap-3">
          <span className="eyebrow">{label}</span>
          {showValue && (
            <span className="font-mono text-[13px] text-paper tabular-nums">
              {clamped.toFixed(0)}
              <span className="text-dim">%</span>
            </span>
          )}
        </div>
      )}
      <div
        className="relative h-2 overflow-hidden bg-strata"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        {/* Quarter ticks: the same gridlines a probability histogram carries. */}
        <span className="absolute inset-y-0 left-1/4 w-px bg-edge-hi" />
        <span className="absolute inset-y-0 left-1/2 w-px bg-edge-hi" />
        <span className="absolute inset-y-0 left-3/4 w-px bg-edge-hi" />
        <span
          className={cn(
            "absolute inset-y-0 left-0 transition-[width] duration-500 ease-out",
            dim ? "bg-collapse" : "bg-photon",
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
