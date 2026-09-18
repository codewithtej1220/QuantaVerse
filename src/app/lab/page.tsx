import type { Metadata } from "next";

import { QuantumLab } from "@/components/lab/quantum-lab";

export const metadata: Metadata = {
  title: "Lab",
  description:
    "A collaborative quantum workspace: build a circuit, watch two entangled gyroscopes answer to it, collapse the measurement cloud, and have the result graded against real amplitudes while an instructor watches the state live.",
};

export default function LabPage() {
  return (
    <div className="min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
        <header className="grid gap-x-16 gap-y-6 border-b border-edge pb-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <p className="eyebrow">Lab</p>
            <h1 data-tour="lab" className="display-1 mt-5 max-w-[9ch]">
              The lab
            </h1>
          </div>
          <p className="lede max-w-lg lg:pb-2">
            One circuit drives everything here — the gyroscopes, the measurement
            cloud, the graded checks and the telemetry an instructor sees are
            all reading the same statevector, so nothing on the page can
            disagree with anything else on it.
          </p>
        </header>

        <div className="mt-10">
          <QuantumLab />
        </div>
      </div>
    </div>
  );
}
