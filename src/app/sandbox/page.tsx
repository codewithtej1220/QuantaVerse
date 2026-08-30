import type { Metadata } from "next";

import { CircuitStudio } from "@/components/sandbox/circuit-studio";
import { Stage, Zone } from "@/components/three/stage";

export const metadata: Metadata = {
  title: "Circuit sandbox",
  description:
    "Build a quantum circuit by dragging gates onto wires, read the generated Qiskit, and watch a real statevector simulation update the Bloch sphere and the measurement histogram.",
};

export default function SandboxPage() {
  return (
    <div className="min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
        {/* The shared canvas the header zone renders into. */}
        <Stage />

        <header className="grid gap-x-10 gap-y-8 border-b border-edge pb-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow">Sandbox · /sandbox</p>
            <h1 className="mt-3 display-2">
              Build the circuit. <span className="text-photon">Watch the state move.</span>
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-frost">
              Every number on this page comes from an actual statevector simulation running in your
              browser — no server, no account, nothing to install. Drag a gate onto a wire, or edit
              the Qiskit and the diagram follows.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {/* The machine the circuit on this page is written against: a
                packaged die with its fan-out routed out to the pins. Point at
                it and the die pushes a wavefront along every trace at once. */}
            <Zone
              id="sandbox-hero"
              focus="chip"
              scale={1.38}
              className="h-[260px] w-full cursor-crosshair sm:h-[310px]"
            />

            <dl className="grid grid-cols-3 gap-x-8 gap-y-2 sm:gap-x-10">
              {(
                [
                  ["Simulator", "statevector"],
                  ["Runs in", "the browser"],
                  ["Max register", "4 qubits"],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="font-mono text-[11px] tracking-[0.16em] text-frost uppercase">
                    {label}
                  </dt>
                  <dd className="mt-1 font-mono text-[12.5px] text-paper">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </header>

        <div className="mt-6">
          <CircuitStudio />
        </div>
      </div>
    </div>
  );
}
