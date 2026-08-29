import { Lock } from "lucide-react";

import { ActionLink } from "@/components/site/action";
import { Zone } from "@/components/three/stage";
import { MODULES, TRACK_LABEL, type ModuleState } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * The curriculum, enumerated as a three-qubit register.
 *
 * Eight modules and eight basis states is not a coincidence we invented after
 * the fact — the ket is the module's index, written the way the subject writes
 * indices, and the row order is the prerequisite chain. A real table is used
 * because this genuinely is tabular data.
 *
 * The pair of bodies on one shaft beside the heading is the module the register
 * is named for: turn either one and the other turns with it.
 */

const STATE_STYLE: Record<ModuleState, { ket: string; label: string; chip: string }> = {
  mastered: { ket: "text-photon", label: "Mastered", chip: "border-photon text-photon" },
  active: { ket: "text-paper", label: "In progress", chip: "border-paper text-paper" },
  available: { ket: "text-frost", label: "Open", chip: "border-edge-hi text-frost" },
  locked: { ket: "text-dim", label: "Locked", chip: "border-edge text-dim" },
};

export function RegisterPreview() {
  return (
    <section className="relative mx-auto max-w-[1440px] px-5 py-24 lg:px-10 lg:py-32">
      <div className="grid items-center gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <header>
          <p className="eyebrow">The register</p>
          <h2 className="display-2 mt-5 max-w-2xl text-paper">
            Eight modules, indexed like the states they teach.
          </h2>
          <p className="body-text mt-6 max-w-lg">
            Three qubits have eight basis states. The curriculum has eight modules, and they are
            numbered <span className="math text-paper">|000⟩</span> through{" "}
            <span className="math text-paper">|111⟩</span> in prerequisite order.
          </p>
        </header>
        <Zone
          id="register-pair"
          focus="pair"
          scale={1.15}
          className="h-[14rem] w-full lg:h-[18rem]"
        />
      </div>

      <div className="panel mt-14">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <caption className="sr-only">
              QuantaVerse curriculum: eight modules with track, length and completion.
            </caption>
            <thead>
              <tr className="border-b border-edge">
                {["State", "Module", "Track", "Length", "Completion"].map((head, i) => (
                  <th
                    key={head}
                    scope="col"
                    className={cn(
                      "eyebrow px-5 py-4 font-normal whitespace-nowrap",
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
                      "border-b border-edge transition-colors duration-150 last:border-b-0",
                      !locked && "hover:bg-strata",
                    )}
                  >
                    <th scope="row" className="px-5 py-5 align-middle font-normal">
                      <span className={cn("ket text-[1.05rem] whitespace-nowrap", style.ket)}>
                        {module.ket}
                      </span>
                    </th>
                    <td className="px-5 py-5 align-middle">
                      <span className="flex items-center gap-2 text-[15px] font-medium text-paper">
                        {module.title}
                        {locked && <Lock className="size-3.5 shrink-0 text-dim" />}
                      </span>
                      <span className="mt-1 block max-w-md text-[13px] text-frost lg:hidden">
                        {TRACK_LABEL[module.track]}
                      </span>
                    </td>
                    <td className="hidden px-5 py-5 align-middle lg:table-cell">
                      <span className="font-mono text-[12px] tracking-[0.12em] text-frost uppercase">
                        {TRACK_LABEL[module.track]}
                      </span>
                    </td>
                    <td className="px-5 py-5 align-middle font-mono text-[13px] whitespace-nowrap text-frost tabular-nums">
                      {module.lessons} lessons · {module.minutes}m
                    </td>
                    <td className="px-5 py-5 align-middle">
                      <div className="ml-auto flex w-[184px] items-center gap-3">
                        <div
                          className="relative h-2 flex-1 bg-strata"
                          role="progressbar"
                          aria-valuenow={module.progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${module.title} completion`}
                        >
                          <span
                            className={cn(
                              "absolute inset-y-0 left-0",
                              module.progress > 0 && "bg-photon",
                            )}
                            style={{ width: `${module.progress}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            "w-[92px] shrink-0 border px-2 py-1 text-center font-mono text-[11px] tracking-[0.08em] uppercase",
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

        <div className="flex flex-wrap items-center justify-between gap-5 border-t border-edge px-5 py-6 sm:px-6">
          <p className="body-text max-w-xl">
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
