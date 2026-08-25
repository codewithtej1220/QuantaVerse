import Link from "next/link";
import { GitFork, Scale } from "lucide-react";

import { QuantaMark } from "@/components/site/quantum-wire";
import { REPO_ISSUES, REPO_URL } from "@/lib/site";

const COLUMNS = [
  {
    title: "Learn",
    links: [
      { label: "Curriculum", href: "/curriculum" },
      { label: "Circuit sandbox", href: "/sandbox" },
      { label: "Your dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Open resource",
    links: [
      { label: "Source repository", href: REPO_URL },
      { label: "Contribute a lesson", href: `${REPO_URL}/pulls` },
      { label: "Report an error", href: REPO_ISSUES },
    ],
  },
  {
    title: "Built on",
    links: [
      { label: "Qiskit + Aer", href: "https://www.ibm.com/quantum/qiskit" },
      { label: "Cirq", href: "https://quantumai.google/cirq" },
      { label: "PennyLane", href: "https://pennylane.ai" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-28 border-t border-white/8">
      <div className="mx-auto max-w-[1400px] px-5 py-14 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <QuantaMark />
              <span className="text-[15px] font-semibold">
                Quanta<span className="text-photon">Verse</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-frost/70">
              An open educational resource for quantum algorithms. No account required to read a
              lesson, no paywall on any module, and the whole platform is yours to fork.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="glass-quiet inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] text-frost/85 uppercase">
                <Scale className="size-3 text-photon" />
                MIT licence
              </span>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="glass-quiet inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] text-frost/85 uppercase transition-colors hover:text-paper"
              >
                <GitFork className="size-3 text-photon" />
                Fork on GitHub
              </a>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="eyebrow">{column.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") ? (
                      <Link
                        href={link.href}
                        className="text-sm text-frost/75 transition-colors hover:text-photon"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-frost/75 transition-colors hover:text-photon"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/8 pt-6 font-mono text-[11px] text-frost/50 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 QuantaVerse contributors · Content under CC BY-SA 4.0</span>
          <span className="tracking-[0.16em] uppercase">
            Simulated locally · no telemetry · no ads
          </span>
        </div>
      </div>
    </footer>
  );
}
