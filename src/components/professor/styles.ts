import type { ProfessorDashboard } from "@/lib/professor";

/** The teaching page's small square control: a mono label in a hairline box. */
export const SMALL =
  "inline-flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[11.5px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon disabled:cursor-not-allowed disabled:opacity-50";

export const FIELD =
  "h-11 w-full border border-edge bg-strata px-3.5 text-[14px] text-paper placeholder:text-dim outline-none transition-colors focus:border-photon";

export const AREA =
  "w-full border border-edge bg-strata px-3.5 py-2.5 text-[14px] leading-relaxed text-paper placeholder:text-dim outline-none transition-colors focus:border-photon";

/** Every action on the teaching page: one at a time, answered with the whole dashboard. */
export type Act = (
  key: string,
  work: () => Promise<ProfessorDashboard>,
  said: string,
) => Promise<boolean>;
