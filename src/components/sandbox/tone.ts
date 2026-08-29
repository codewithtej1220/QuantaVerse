import type { GateTone } from "@/lib/data";

/**
 * Gate colouring, kept in one place because the same three tones appear in the
 * palette, the circuit grid, the histogram and the tutor's diffs.
 *
 * The site has one accent, so the three classes of gate are told apart by
 * material rather than by hue:
 *   photon   (copper) — basis-changing. The gates that move amplitude.
 *   phase    (white)  — phase-only. Invisible until you interfere.
 *   collapse (steel)  — irreversible. Measurement makes a classical bit, and
 *                       classical things are drawn in steel everywhere here.
 *
 * `glow` is now the armed state: a solid fill, not a halo. The name is kept so
 * the three call sites keep working.
 */
export const TONE: Record<
  GateTone,
  { text: string; border: string; bg: string; ring: string; glow: string }
> = {
  photon: {
    text: "text-photon",
    border: "border-photon",
    bg: "bg-photon/12",
    ring: "outline-photon",
    glow: "bg-photon text-void",
  },
  phase: {
    text: "text-paper",
    border: "border-paper",
    bg: "bg-strata",
    ring: "outline-paper",
    glow: "bg-paper text-void",
  },
  collapse: {
    text: "text-collapse",
    border: "border-edge-hi",
    bg: "bg-strata",
    ring: "outline-collapse",
    glow: "bg-collapse text-void",
  },
};

/** MIME-ish key used by the HTML drag-and-drop payload. */
export const GATE_MIME = "application/x-quantaverse-gate";
