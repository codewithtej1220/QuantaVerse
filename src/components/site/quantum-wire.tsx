import { cn } from "@/lib/utils";

/**
 * The site's structural divider: a quantum wire.
 *
 * Sections are separated the way qubits are drawn in a circuit diagram — a
 * horizontal wire carrying a gate box. The label in the box says what the next
 * section operates on, so the device encodes content rather than decorating it.
 */
export function QuantumWire({
  label,
  className,
  tone = "photon",
}: {
  label?: string;
  className?: string;
  tone?: "photon" | "phase";
}) {
  const accent = tone === "photon" ? "text-photon/80" : "text-phase/80";

  return (
    <div className={cn("relative flex items-center gap-4", className)} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#4a63b8]/45 to-[#4a63b8]/55" />
      {label ? (
        <span
          className={cn(
            "glass-quiet flex h-7 items-center rounded-[5px] px-3 font-mono text-[10px] tracking-[0.28em] uppercase",
            accent,
          )}
        >
          {label}
        </span>
      ) : (
        <span className="size-1.5 rounded-full bg-photon/70 shadow-[0_0_12px_2px_rgba(56,232,255,0.55)]" />
      )}
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[#4a63b8]/45 to-[#4a63b8]/55" />
    </div>
  );
}

/** The mark: a Bloch sphere reduced to a ring and a state vector. */
export function QuantaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <defs>
        <linearGradient id="qv-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38e8ff" />
          <stop offset="100%" stopColor="#b14eff" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="url(#qv-mark)" strokeWidth="1.3" />
      <ellipse
        cx="16"
        cy="16"
        rx="12.5"
        ry="4.4"
        fill="none"
        stroke="#38e8ff"
        strokeOpacity="0.5"
        strokeWidth="1"
      />
      <line x1="16" y1="16" x2="24" y2="7.6" stroke="#eaf1ff" strokeWidth="1.5" />
      <circle cx="24" cy="7.6" r="2.5" fill="#38e8ff" />
    </svg>
  );
}
