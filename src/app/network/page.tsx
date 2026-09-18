import type { Metadata } from "next";

import { ResearchHub } from "@/components/network/research-hub";
import { Stage, Zone } from "@/components/three/stage";

export const metadata: Metadata = {
  title: "Research hub",
  description:
    "Find a mentor working on what you are stuck on, send a connection request with a sentence about why, and keep the people who answered.",
};

export default function NetworkPage() {
  return (
    <div className="min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
        <Stage />

        <header className="grid gap-x-10 gap-y-8 border-b border-edge pb-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow">Research hub</p>
            <h1 data-tour="hub" className="mt-3 display-2">
              Find someone who has{" "}
              <span className="text-photon">already been stuck here.</span>
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-frost">
              A directory of the people on this instance and the connections
              between them. Search by what someone works on, ask with a sentence
              about where you are, and the request waits until they answer —
              nobody is added to your network without agreeing to it.
            </p>
          </div>

          {/* A graph with the visitor at the centre. This was an entangled
              pair, on the argument that two things which only mean something
              together describe a collaboration page well — true, and still a
              picture of physics on a page that is a directory of people. */}
          <Zone
            id="network-hero"
            focus="network"
            scale={1.15}
            className="h-[220px] w-full cursor-crosshair sm:h-[260px]"
          />
        </header>

        <div className="mt-6">
          <ResearchHub />
        </div>
      </div>
    </div>
  );
}
