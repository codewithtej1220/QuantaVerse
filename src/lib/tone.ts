/**
 * Colour with a job, for the working pages.
 *
 * Two kinds. A module has its own hue, used wherever the module is named — its
 * ket, its progress bar, the chip on a request to join it — so that a teacher
 * scanning three classes, or a student scanning eight modules, can tell them
 * apart before reading a word. A person has a hue too, picked from their name
 * and the same on every page, which is what lets a face in a list of initials
 * be found again.
 *
 * State is not here. Passed, waiting and declined are the `ok`, `warn` and
 * `bad` tokens in globals.css, set as pills, and they mean the same thing
 * whatever module or person they sit beside.
 *
 * Every class is written out in full so that Tailwind finds it in the source.
 */

export type Tone =
  | "cyan"
  | "sky"
  | "indigo"
  | "violet"
  | "fuchsia"
  | "pink"
  | "rose"
  | "orange"
  | "amber"
  | "lime"
  | "emerald"
  | "teal";

export interface ToneClasses {
  /** Text and icons in the hue. */
  text: string;
  /** A tinted ground behind a chip or an avatar. */
  soft: string;
  /** A hairline in the hue. */
  ring: string;
  border: string;
  /** A solid fill: a progress bar, a dot. */
  solid: string;
}

export const TONE: Record<Tone, ToneClasses> = {
  cyan: {
    text: "text-cyan-300",
    soft: "bg-cyan-400/15",
    ring: "ring-cyan-400/40",
    border: "border-cyan-400/40",
    solid: "bg-cyan-400",
  },
  sky: {
    text: "text-sky-300",
    soft: "bg-sky-400/15",
    ring: "ring-sky-400/40",
    border: "border-sky-400/40",
    solid: "bg-sky-400",
  },
  indigo: {
    text: "text-indigo-300",
    soft: "bg-indigo-400/15",
    ring: "ring-indigo-400/40",
    border: "border-indigo-400/40",
    solid: "bg-indigo-400",
  },
  violet: {
    text: "text-violet-300",
    soft: "bg-violet-400/15",
    ring: "ring-violet-400/40",
    border: "border-violet-400/40",
    solid: "bg-violet-400",
  },
  fuchsia: {
    text: "text-fuchsia-300",
    soft: "bg-fuchsia-400/15",
    ring: "ring-fuchsia-400/40",
    border: "border-fuchsia-400/40",
    solid: "bg-fuchsia-400",
  },
  pink: {
    text: "text-pink-300",
    soft: "bg-pink-400/15",
    ring: "ring-pink-400/40",
    border: "border-pink-400/40",
    solid: "bg-pink-400",
  },
  rose: {
    text: "text-rose-300",
    soft: "bg-rose-400/15",
    ring: "ring-rose-400/40",
    border: "border-rose-400/40",
    solid: "bg-rose-400",
  },
  orange: {
    text: "text-orange-300",
    soft: "bg-orange-400/15",
    ring: "ring-orange-400/40",
    border: "border-orange-400/40",
    solid: "bg-orange-400",
  },
  amber: {
    text: "text-amber-300",
    soft: "bg-amber-400/15",
    ring: "ring-amber-400/40",
    border: "border-amber-400/40",
    solid: "bg-amber-400",
  },
  lime: {
    text: "text-lime-300",
    soft: "bg-lime-400/15",
    ring: "ring-lime-400/40",
    border: "border-lime-400/40",
    solid: "bg-lime-400",
  },
  emerald: {
    text: "text-emerald-300",
    soft: "bg-emerald-400/15",
    ring: "ring-emerald-400/40",
    border: "border-emerald-400/40",
    solid: "bg-emerald-400",
  },
  teal: {
    text: "text-teal-300",
    soft: "bg-teal-400/15",
    ring: "ring-teal-400/40",
    border: "border-teal-400/40",
    solid: "bg-teal-400",
  },
};

/**
 * One hue per curriculum module, in course order, walking round the wheel so
 * that neighbours never share a family. A professor's own module is violet,
 * the colour the teaching pages use for the professor.
 */
const MODULE_TONE: Record<string, Tone> = {
  "qubit-and-superposition": "cyan",
  "measurement-and-probability": "sky",
  "single-qubit-gates": "indigo",
  "quantum-entanglement": "fuchsia",
  "circuits-with-qiskit": "teal",
  "deutsch-jozsa": "amber",
  "grovers-search": "emerald",
  "shors-factoring": "rose",
};

export function moduleTone(slug: string): Tone {
  return MODULE_TONE[slug] ?? (slug.startsWith("own-") ? "violet" : "cyan");
}

/* The algorithms that have a module share its colour, so the two pages about
   Grover's search are visibly about the same thing. */
const ALGORITHM_TONE: Record<string, Tone> = {
  "bernstein-vazirani": "sky",
  "deutsch-jozsa": "amber",
  grover: "emerald",
  "superdense-coding": "fuchsia",
  teleportation: "violet",
};

export function algorithmTone(slug: string): Tone {
  return ALGORITHM_TONE[slug] ?? "cyan";
}

/* People draw from the warmer and brighter end, so an avatar never reads as a
   module chip beside it. */
const PERSON_TONES: Tone[] = [
  "sky",
  "violet",
  "emerald",
  "amber",
  "pink",
  "teal",
  "orange",
  "indigo",
  "lime",
  "rose",
];

/** The same hue for the same name, on every page and every visit. */
export function personTone(key: string): Tone {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return PERSON_TONES[hash % PERSON_TONES.length];
}
