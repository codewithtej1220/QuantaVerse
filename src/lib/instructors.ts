/**
 * Who each module is presented by.
 *
 * Five instructors, each paired with the modules closest to their field. They
 * are not real people: the names and the institutions are invented, and every
 * portrait is a generated face of nobody. The last part is not negotiable —
 * a real person's photograph over an invented name and invented credentials is
 * the one thing this site must never carry — so any instructor added later
 * takes a generated face too.
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

const SARIN: Instructor = {
  name: "Prof. Iqbal Sarin",
  position: "Professor of Quantum Information",
  institution: "Institute for Quantum Systems",
  photo: "/avatars/i-sarin.webp",
};

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
  "qubit-and-superposition": SARIN,
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
