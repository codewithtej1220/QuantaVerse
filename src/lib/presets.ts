import { pack, type Placement } from "./quantum";

/**
 * Circuits worth opening cold.
 *
 * Each preset is a circuit a lesson actually asks for, so the sandbox is useful
 * before the learner knows what to build. Operations are listed in reading
 * order and packed into columns by `pack`.
 */

export interface Preset {
  id: string;
  name: string;
  qubits: number;
  /** What the learner should notice once they press run. */
  expect: string;
  ops: { gate: string; wires: number[] }[];
}

export const PRESETS: Preset[] = [
  {
    id: "bell",
    name: "Bell pair",
    qubits: 3,
    expect: "|000⟩ and |011⟩ only — q0 and q1 are correlated, q2 is untouched.",
    ops: [
      { gate: "h", wires: [0] },
      { gate: "cnot", wires: [0, 1] },
      { gate: "m", wires: [0] },
      { gate: "m", wires: [1] },
    ],
  },
  {
    id: "ghz",
    name: "GHZ state",
    qubits: 3,
    expect: "All three qubits agree: |000⟩ or |111⟩, nothing in between.",
    ops: [
      { gate: "h", wires: [0] },
      { gate: "cnot", wires: [0, 1] },
      { gate: "cnot", wires: [1, 2] },
      { gate: "m", wires: [0] },
      { gate: "m", wires: [1] },
      { gate: "m", wires: [2] },
    ],
  },
  {
    id: "uniform",
    name: "Uniform superposition",
    qubits: 3,
    expect: "All eight outcomes at 12.5%. Every Grover run starts here.",
    ops: [
      { gate: "h", wires: [0] },
      { gate: "h", wires: [1] },
      { gate: "h", wires: [2] },
    ],
  },
  {
    id: "phase-kickback",
    name: "Phase kickback",
    qubits: 3,
    expect: "q0 leaves the equator even though nothing was applied to it directly.",
    ops: [
      { gate: "h", wires: [0] },
      { gate: "x", wires: [1] },
      { gate: "h", wires: [1] },
      { gate: "cnot", wires: [0, 1] },
      { gate: "h", wires: [1] },
    ],
  },
  {
    id: "deutsch-jozsa",
    name: "Deutsch–Jozsa",
    qubits: 3,
    expect: "|11⟩ on the input register proves the oracle is balanced, in one query.",
    ops: [
      { gate: "h", wires: [0] },
      { gate: "h", wires: [1] },
      { gate: "x", wires: [2] },
      { gate: "h", wires: [2] },
      { gate: "cnot", wires: [0, 2] },
      { gate: "cnot", wires: [1, 2] },
      { gate: "h", wires: [0] },
      { gate: "h", wires: [1] },
      { gate: "m", wires: [0] },
      { gate: "m", wires: [1] },
    ],
  },
];

export function presetPlacements(preset: Preset): Placement[] {
  return pack(preset.ops, preset.qubits);
}
