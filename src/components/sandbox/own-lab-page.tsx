"use client";

import { BackLink, OwnModuleStatus } from "@/components/curriculum/own-module-page";
import { useOwnModule } from "@/components/curriculum/use-own-module";
import { CircuitStudio } from "@/components/sandbox/circuit-studio";
import { ActionLink } from "@/components/site/action";
import { asChallenge } from "@/lib/own-modules";

/**
 * The lab a professor set, in the same studio as the curriculum's.
 *
 * The grader marks it against the professor's answer circuit, which the
 * server holds; the page only names the lab. Every attempt is filed on the
 * student's record like any other, which is what puts it in the professor's
 * table.
 */
export function OwnLabPage({ slug }: { slug: string }) {
  const state = useOwnModule(slug);
  const back = { href: `/curriculum/own/${slug}`, label: "Back to the module" };
  if (state.kind !== "ready") return <OwnModuleStatus state={state} back={back} />;

  const { view } = state;
  const challenge = asChallenge(view);

  return (
    <div className="min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
        <BackLink href={back.href}>Back to {view.title}</BackLink>

        {!challenge ? (
          <div className="mt-6">
            <p className="eyebrow">Circuit lab</p>
            <h1 className="mt-3 display-2">This module has no lab</h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-frost">
              {view.professor.display_name} has not set a graded circuit for {view.title}. Its
              lessons and notes are on the module page.
            </p>
            <div className="mt-7">
              <ActionLink href={back.href}>Open the module</ActionLink>
            </div>
          </div>
        ) : (
          <>
            <header className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-edge pb-7">
              <div className="max-w-2xl">
                <p className="eyebrow">Circuit lab · set by {view.professor.display_name}</p>
                <h1 className="mt-3 display-2">
                  Build it, then <span className="text-photon">have it marked.</span>
                </h1>
                <p className="mt-4 text-[15px] leading-relaxed text-frost">
                  Place the gates on the grid or write the Qiskit — either pane will do. The check
                  sends your circuit to the API, which rebuilds it with Qiskit and compares it with
                  your professor&rsquo;s answer: on the state it reaches, for a lab that asks for a
                  state, and on every input, for a lab that asks for an algorithm.
                </p>
              </div>

              <dl className="grid grid-cols-3 gap-x-8 gap-y-2 sm:gap-x-10">
                {(
                  [
                    [
                      "Register",
                      `${challenge.qubits} ${challenge.qubits === 1 ? "qubit" : "qubits"}`,
                    ],
                    ["Marked by", "qiskit"],
                    ["Attempts", "unlimited"],
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
            </header>

            <div className="mt-6">
              <CircuitStudio key={challenge.slug} challenge={challenge} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
