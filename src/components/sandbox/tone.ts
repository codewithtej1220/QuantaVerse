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
 *
 * The block materials below were lifted when the chassis was: against a panel
 * at L* 8 the old near-black walls read as holes cut in the board rather than
 * as parts standing on it, and the phase and collapse gates in particular were
 * indistinguishable black rectangles.
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

/**
 * The same three tones as solid material, for the raised deck.
 *
 * A gate on the board is a machined block standing proud of the wire plane, so
 * each tone needs three more values: the anodised walls, the lid that catches
 * the overhead light, and the underside sitting in its own shadow. They are hex
 * rather than utility classes because the faces are positioned with inline
 * transforms and painted in the same style object.
 */
export const MATERIAL: Record<GateTone, { wall: string; crown: string; base: string }> = {
  photon: { wall: "#0d3540", crown: "#237a8c", base: "#061e26" },
  phase: { wall: "#2b2c2a", crown: "#5c5c52", base: "#131413" },
  collapse: { wall: "#232725", crown: "#4a4f4a", base: "#101211" },
};
