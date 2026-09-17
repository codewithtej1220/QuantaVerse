import circuitsWithQiskit from "./circuits-with-qiskit.mjs";
import deutschJozsa from "./deutsch-jozsa.mjs";
import groversSearch from "./grovers-search.mjs";
import measurementAndProbability from "./measurement-and-probability.mjs";
import quantumEntanglement from "./quantum-entanglement.mjs";
import qubitAndSuperposition from "./qubit-and-superposition.mjs";
import shorsFactoring from "./shors-factoring.mjs";
import singleQubitGates from "./single-qubit-gates.mjs";

/**
 * The modules, in curriculum order.
 *
 * Each file's lessons must match the module's lessons on the site one for one,
 * in the same order: the module page opens the notes at a lesson by its
 * position.
 */
export const MODULES = [
  qubitAndSuperposition,
  measurementAndProbability,
  singleQubitGates,
  quantumEntanglement,
  circuitsWithQiskit,
  deutschJozsa,
  groversSearch,
  shorsFactoring,
].map((module, index) => ({ ...module, number: index + 1 }));
