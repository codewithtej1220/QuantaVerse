import Link from "next/link";

import { QuantaMark, Wordmark } from "@/components/site/mark";
import { REPO_ISSUES, REPO_URL } from "@/lib/site";

/**
 * The footer.
 *
 * Three columns of links, one licence statement, and nothing else. The badge
 * chips that used to sit here said the same thing the sentence above them says,
 * so they are gone; the licence line at the bottom carries it once.
 */

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
    <footer className="relative mt-32 border-t border-edge">
      <div className="mx-auto max-w-[1440px] px-5 py-16 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <QuantaMark />
              <Wordmark />
            </div>
            <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-frost">
              An open educational resource for quantum algorithms. No account required to read a
              lesson, no paywall on any module, and the whole platform is yours to fork.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="eyebrow">{column.title}</h3>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") ? (
                      <Link
                        href={link.href}
                        className="text-[15px] text-frost transition-colors hover:text-photon"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[15px] text-frost transition-colors hover:text-photon"
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

        <div className="mt-16 flex flex-col gap-3 border-t border-edge pt-7 font-mono text-[12px] text-dim lg:flex-row lg:items-center lg:justify-between">
          <span>© 2026 QuantaVerse contributors · MIT code · CC BY-SA 4.0 content</span>
          <span className="tracking-[0.16em] uppercase">
            Simulated locally · no telemetry · no ads
          </span>
        </div>
      </div>
    </footer>
  );
}
