/**
 * Who each module is presented by.
 *
 * These are the research hub's four example instructors, each paired with the
 * two modules closest to their field. They are not real people: the names are
 * invented, the institutions are invented, and the portraits are generated
 * faces of nobody. That is said wherever a byline appears, in the same words
 * the hub uses, because a real-looking academic on an invented name is the one
 * thing this site must not pass off as real.
 *
 * A professor who teaches a module on the site appears on its page in the
 * classes panel, separately from this byline.
 */

export interface Instructor {
  name: string;
  position: string;
  institution: string;
  /** A generated portrait, under /public/avatars. */
  photo: string;
}

const MARSH: Instructor = {
  name: "Prof. Helena Marsh",
  position: "Professor of Physics",
  institution: "Institute for Quantum Systems",
  photo: "/avatars/h-marsh.webp",
};

const NDUKWE: Instructor = {
  name: "Dr. Adaora Ndukwe",
  position: "Senior Lecturer, Algorithms and Complexity",
  institution: "Centre for Quantum Algorithms",
  photo: "/avatars/a-ndukwe.webp",
};

const DUARTE: Instructor = {
  name: "Prof. Rafael Duarte",
  position: "Professor, Experimental Quantum Hardware",
  institution: "Laboratory for Superconducting Devices",
  photo: "/avatars/r-duarte.webp",
};

const BAKKER: Instructor = {
  name: "Dr. Sanne Bakker",
  position: "Research Fellow, Simulation and Benchmarking",
  institution: "Institute for Quantum Systems",
  photo: "/avatars/s-bakker.webp",
};

const BY_MODULE: Record<string, Instructor> = {
  "qubit-and-superposition": MARSH,
  "measurement-and-probability": BAKKER,
  "single-qubit-gates": DUARTE,
  "quantum-entanglement": MARSH,
  "circuits-with-qiskit": DUARTE,
  "deutsch-jozsa": NDUKWE,
  "grovers-search": NDUKWE,
  "shors-factoring": BAKKER,
};

export function instructorFor(slug: string): Instructor | null {
  return BY_MODULE[slug] ?? null;
}

/** Said on every byline: the instructor is an example, not a person. */
export const EXAMPLE_NOTE = "Example instructor — a generated portrait, not a real person";
