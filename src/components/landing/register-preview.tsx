import { Lock } from "lucide-react";

import { ActionLink } from "@/components/site/action";
import { MODULES, TRACK_LABEL, type ModuleState } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * The curriculum, enumerated as a three-qubit register.
 *
 * Eight modules and eight basis states is not a coincidence we invented after
 * the fact — the ket is the module's index, written the way the subject writes
 * indices, and the row order is the prerequisite chain. A real table is used
 * because this genuinely is tabular data.
 */

const STATE_STYLE: Record<ModuleState, { ket: string; label: string; chip: string }> = {
  mastered: {
    ket: "text-photon",
    label: "Mastered",
    chip: "border-photon/40 bg-photon/10 text-photon",
  },
  active: {
    ket: "text-phase",
    label: "In progress",
    chip: "border-phase/40 bg-phase/10 text-phase",
  },
  available: {
    ket: "text-frost/80",
    label: "Open",
    chip: "border-white/12 bg-white/4 text-frost/80",
  },
  locked: {
    ket: "text-frost/35",
    label: "Locked",
    chip: "border-white/8 bg-white/2 text-frost/45",
  },
};

export function RegisterPreview() {
  return (
    <section className="relative mx-auto max-w-[1400px] px-5 py-20 lg:px-10 lg:py-28">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="eyebrow">The register</p>
          <h2 className="mt-4 text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
            Eight modules, indexed like the states they teach.
          </h2>
        </div>
        <p className="max-w-sm text-[0.9375rem] leading-relaxed text-frost/70">
          Three qubits have eight basis states. The curriculum has eight modules, and they are
          numbered <span className="math text-paper">|000⟩</span> through{" "}
          <span className="math text-paper">|111⟩</span> in prerequisite order.
        </p>
      </header>

      <div className="glass mt-12 overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">
              QuantaVerse curriculum: eight modules with track, length and completion.
            </caption>
            <thead>
              <tr className="border-b border-white/8">
                {["State", "Module", "Track", "Length", "Completion"].map((head, i) => (
                  <th
                    key={head}
                    scope="col"
                    className={cn(
                      "eyebrow px-4 py-3.5 font-normal whitespace-nowrap",
                      i === 4 && "text-right",
                      i === 2 && "hidden lg:table-cell",
                    )}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((module) => {
                const style = STATE_STYLE[module.state];
                const locked = module.state === "locked";
                return (
                  <tr
                    key={module.slug}
                    className={cn(
                      "border-b border-white/5 transition-colors duration-200 last:border-b-0",
                      locked ? "opacity-60" : "hover:bg-white/[0.035]",
                    )}
                  >
                    <th scope="row" className="px-4 py-4 align-middle font-normal">
                      <span className={cn("ket text-[1.05rem] whitespace-nowrap", style.ket)}>
                        {module.ket}
                      </span>
                    </th>
                    <td className="px-4 py-4 align-middle">
                      <span className="flex items-center gap-2 font-medium text-paper">
                        {module.title}
                        {locked && <Lock className="size-3 shrink-0 text-frost/40" />}
                      </span>
                      <span className="mt-1 block max-w-md text-[13px] leading-snug text-frost/55 lg:hidden">
                        {TRACK_LABEL[module.track]}
                      </span>
                    </td>
                    <td className="hidden px-4 py-4 align-middle lg:table-cell">
                      <span className="font-mono text-[11px] tracking-[0.12em] text-frost/60 uppercase">
                        {TRACK_LABEL[module.track]}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-middle font-mono text-[12px] whitespace-nowrap text-frost/65 tabular-nums">
                      {module.lessons} lessons · {module.minutes}m
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="ml-auto flex w-[168px] items-center gap-3">
                        <div
                          className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#101835]"
                          role="progressbar"
                          aria-valuenow={module.progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${module.title} completion`}
                        >
                          <span
                            className={cn(
                              "absolute inset-y-0 left-0 rounded-full",
                              module.progress > 0 && "amplitude-fill",
                            )}
                            style={{ width: `${module.progress}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            "w-[86px] shrink-0 rounded-full border px-2 py-0.5 text-center font-mono text-[10px] tracking-[0.1em] uppercase",
                            style.chip,
                          )}
                        >
                          {style.label}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/8 px-4 py-5 sm:px-6">
          <p className="text-[13px] text-frost/60">
            A lock is a suggested order, never a paywall. Open any module early from the curriculum
            page.
          </p>
          <ActionLink href="/curriculum" variant="outline">
            Open the curriculum
          </ActionLink>
        </div>
      </div>
    </section>
  );
}
