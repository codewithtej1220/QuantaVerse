import type { GateTone } from "@/lib/data";

/**
 * Gate colouring, kept in one place because the same three tones appear in the
 * palette, the circuit grid, the histogram and the tutor's diffs.
 *   photon (cyan) — basis-changing, phase (violet) — phase-only,
 *   collapse (magenta) — irreversible.
 */
export const TONE: Record<
  GateTone,
  { text: string; border: string; bg: string; ring: string; glow: string }
> = {
  photon: {
    text: "text-photon",
    border: "border-photon/55",
    bg: "bg-photon/8",
    ring: "outline-photon",
    glow: "shadow-[0_0_20px_-6px_rgba(56,232,255,0.85)]",
  },
  phase: {
    text: "text-phase",
    border: "border-phase/55",
    bg: "bg-phase/10",
    ring: "outline-phase",
    glow: "shadow-[0_0_20px_-6px_rgba(177,78,255,0.85)]",
  },
  collapse: {
    text: "text-collapse",
    border: "border-collapse/55",
    bg: "bg-collapse/10",
    ring: "outline-collapse",
    glow: "shadow-[0_0_20px_-6px_rgba(255,77,157,0.85)]",
  },
};

/** MIME-ish key used by the HTML drag-and-drop payload. */
export const GATE_MIME = "application/x-quantaverse-gate";
