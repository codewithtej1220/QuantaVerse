import type { ProfessorDashboard } from "@/lib/professor";

/** The teaching page's small control: a word in a rounded key. */
export const SMALL =
  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon disabled:cursor-not-allowed disabled:opacity-50";

/**
 * What a small control says with its colour. `go` is solid because it is the
 * one to press; `stop` is coloured words on a faint ground, because declining
 * should be possible without being the loudest thing on the card.
 */
export const TINT = {
  quiet: "border-edge bg-strata text-paper hover:border-edge-hi hover:bg-[#1a2640]",
  go: "border-emerald-400 bg-emerald-400 font-semibold text-emerald-950 hover:border-emerald-300 hover:bg-emerald-300",
  stop: "border-transparent bg-rose-400/10 text-rose-300 hover:bg-rose-400/20",
  own: "border-violet-400/40 bg-violet-400/15 text-violet-200 hover:bg-violet-400/25",
} as const;

export const FIELD =
  "h-11 w-full rounded-lg border border-edge bg-strata px-3.5 text-[14px] text-paper placeholder:text-dim outline-none transition-colors focus:border-photon";

export const AREA =
  "w-full rounded-lg border border-edge bg-strata px-3.5 py-2.5 text-[14px] leading-relaxed text-paper placeholder:text-dim outline-none transition-colors focus:border-photon";

/** Every action on the teaching page: one at a time, answered with the whole dashboard. */
export type Act = (
  key: string,
  work: () => Promise<ProfessorDashboard>,
  said: string,
) => Promise<boolean>;
