import { Hero } from "@/components/landing/hero";
import { OpenSource } from "@/components/landing/open-source";
import { RegisterPreview } from "@/components/landing/register-preview";
import { Surfaces } from "@/components/landing/surfaces";
import { Workflow } from "@/components/landing/workflow";
import { QuantumWire } from "@/components/site/quantum-wire";

export default function Home() {
  return (
    <>
      <Hero />

      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <QuantumWire label="prepare · evolve · measure" />
      </div>
      <Workflow />

      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <QuantumWire label="the platform" tone="phase" />
      </div>
      <Surfaces />

      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <QuantumWire label="|000⟩ → |111⟩" />
      </div>
      <RegisterPreview />

      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <QuantumWire label="mit · cc by-sa 4.0" tone="phase" />
      </div>
      <OpenSource />
    </>
  );
}
