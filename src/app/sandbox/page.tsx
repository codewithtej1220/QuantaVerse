import type { Metadata } from "next";

import { CircuitStudio } from "@/components/sandbox/circuit-studio";

export const metadata: Metadata = {
  title: "Circuit sandbox",
  description:
    "Build a quantum circuit by dragging gates onto wires, read the generated Qiskit, and watch a real statevector simulation update the Bloch sphere and the measurement histogram.",
};

export default function SandboxPage() {
  return (
    <div className="lattice min-h-screen overflow-x-clip pt-24 pb-20">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-white/8 pb-7">
          <div className="max-w-2xl">
            <p className="eyebrow">Sandbox · /sandbox</p>
            <h1 className="mt-3 text-[clamp(2rem,4vw,2.9rem)] leading-[1.05] font-semibold tracking-[-0.025em]">
              Build the circuit.{" "}
              <span className="text-photon text-glow">Watch the state move.</span>
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-frost/80">
              Every number on this page comes from an actual statevector simulation running in
              your browser — no server, no account, nothing to install. Drag a gate onto a wire,
              or edit the Qiskit and the diagram follows.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-x-8 gap-y-2 sm:gap-x-10">
            {(
              [
                ["Simulator", "statevector"],
                ["Runs in", "the browser"],
                ["Max register", "4 qubits"],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[9.5px] tracking-[0.16em] text-frost/40 uppercase">
                  {label}
                </dt>
                <dd className="mt-1 font-mono text-[12.5px] text-paper">{value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="mt-6">
          <CircuitStudio />
        </div>
      </div>
    </div>
  );
}
