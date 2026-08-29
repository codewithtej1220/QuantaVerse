"use client";

import { Radio, RadioTower, X } from "lucide-react";

import type { BlochVector } from "@/lib/quantum";
import {
  angleBetween,
  closeLink,
  getLinkStats,
  openLink,
  setGhostTarget,
  useGhostTarget,
  useLinkState,
  useStudentFrame,
  vectorOf,
} from "@/lib/telemetry";
import { cn } from "@/lib/utils";

/**
 * The instructor's side of the link.
 *
 * Read-only by construction. The only thing this panel can write is a ghost
 * target, and a ghost target is a drawing — it never touches the student's
 * circuit, their state, or their controls. That constraint is the reason the
 * feature is usable during a live class: a demonstration cannot pull the work
 * out from under someone mid-thought.
 */

const TARGETS: { label: string; ket: string; theta: number; phi: number }[] = [
  { label: "Ground", ket: "|0⟩", theta: 0, phi: 0 },
  { label: "Excited", ket: "|1⟩", theta: Math.PI, phi: 0 },
  { label: "Plus", ket: "|+⟩", theta: Math.PI / 2, phi: 0 },
  { label: "Minus", ket: "|−⟩", theta: Math.PI / 2, phi: Math.PI },
  { label: "Phase up", ket: "|i⟩", theta: Math.PI / 2, phi: Math.PI / 2 },
  { label: "Phase down", ket: "|−i⟩", theta: Math.PI / 2, phi: -Math.PI / 2 },
];

function Reading({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">{label}</p>
      <p className={cn("mt-1 font-mono text-[15px] tabular-nums", tone ?? "text-paper")}>{value}</p>
    </div>
  );
}

export function ProfessorConsole({ focus }: { focus: BlochVector }) {
  const link = useLinkState();
  const frame = useStudentFrame();
  const ghost = useGhostTarget();
  const stats = getLinkStats();

  const live = link === "live";
  const target = ghost ? vectorOf(ghost.theta, ghost.phi) : null;
  /* A maximally mixed qubit has no direction, so there is no angle to a target
     and reporting one is worse than reporting nothing — an entangled qubit
     would read "180° off" when it is not pointing anywhere at all. */
  const hasDirection = Math.hypot(focus.x, focus.y, focus.z) > 1e-3;
  const deviation =
    target && hasDirection ? (angleBetween(focus, target) * 180) / Math.PI : null;
  const onTarget = deviation !== null && deviation < 6;

  return (
    <section className="well flex flex-col p-4">
      <div className="flex items-center justify-between gap-3 border-b border-edge pb-3">
        <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-frost uppercase">
          {live ? (
            <RadioTower className="size-3.5 animate-breathe text-photon" />
          ) : (
            <Radio className="size-3.5 text-dim" />
          )}
          Instructor link
        </p>
        <button
          type="button"
          onClick={() => (live ? closeLink() : openLink())}
          className={cn(
            "border px-3 py-1 font-mono text-[10.5px] tracking-[0.14em] uppercase transition-colors",
            live
              ? "border-photon text-photon hover:bg-photon hover:text-void"
              : "border-edge text-frost hover:border-photon hover:text-photon",
          )}
        >
          {link === "connecting" ? "linking…" : live ? "connected" : "connect"}
        </button>
      </div>

      {!live ? (
        <p className="mt-4 text-[12.5px] leading-relaxed text-frost">
          Open the link and this panel receives the workspace&rsquo;s state as it changes. The
          transport is simulated in-tab for now; the frames are the real ones.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <Reading label="Latency" value={`${stats.latency} ms`} />
            <Reading label="Frames" value={String(stats.framesSent)} />
            <Reading
              label="Purity"
              value={frame.purity.toFixed(3)}
              tone={frame.purity > 0.99 ? "text-paper" : "text-photon"}
            />
            <Reading label="Depth" value={String(frame.depth)} />
            <Reading label="Gates" value={String(frame.gateCount)} />
            <Reading label="Qubits" value={String(frame.qubits)} />
          </div>

          <div className="mt-5 border-t border-edge pt-4">
            <p className="font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">
              Demonstrate a target
            </p>
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              {TARGETS.map((option) => {
                const chosen = ghost?.label === option.label;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() =>
                      setGhostTarget(
                        chosen
                          ? null
                          : { theta: option.theta, phi: option.phi, label: option.label },
                      )
                    }
                    title={option.label}
                    className={cn(
                      "border px-2 py-2 font-mono text-[13px] transition-colors",
                      chosen
                        ? "border-paper bg-paper/10 text-paper"
                        : "border-edge text-frost hover:border-paper hover:text-paper",
                    )}
                  >
                    {option.ket}
                  </button>
                );
              })}
            </div>

            {ghost ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="font-mono text-[11.5px] text-frost tabular-nums">
                  {deviation === null ? (
                    <span className="text-frost">
                      no direction to compare · qubit is mixed
                    </span>
                  ) : (
                    <>
                      deviation{" "}
                      <span className={onTarget ? "text-photon" : "text-paper"}>
                        {deviation.toFixed(1)}°
                      </span>
                      {onTarget && <span className="ml-2 text-photon">matched</span>}
                    </>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setGhostTarget(null)}
                  className="inline-flex items-center gap-1 font-mono text-[10.5px] tracking-[0.14em] text-dim uppercase hover:text-paper"
                >
                  <X className="size-3" />
                  clear
                </button>
              </div>
            ) : (
              <p className="mt-3 text-[12px] leading-relaxed text-dim">
                A target appears in the student&rsquo;s sphere as a frosted arrow beside their own.
                It cannot move their state.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
