import { cn } from "@/lib/utils";

/**
 * The mark: a Bloch sphere reduced to a ring, an equator and a state vector.
 *
 * Two flat colours and no gradient. The tip is the only copper on it, which is
 * the same rule the rest of the site follows — copper marks the state, and
 * everything else is drawn in steel.
 */
export function QuantaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6", className)} aria-hidden>
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="#f2f2ef" strokeWidth="1.6" />
      <ellipse
        cx="16"
        cy="16"
        rx="12.5"
        ry="4.4"
        fill="none"
        stroke="#8e8e89"
        strokeWidth="1.2"
      />
      <line x1="16" y1="16" x2="23.4" y2="8.2" stroke="#f2f2ef" strokeWidth="1.8" />
      <circle cx="23.8" cy="7.8" r="3" fill="#2fe4ff" />
    </svg>
  );
}

/** The wordmark, so the nav and the footer cannot drift apart. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-[15px] font-extrabold tracking-[-0.02em] uppercase",
        className,
      )}
    >
      Quanta<span className="text-photon">Verse</span>
    </span>
  );
}
