import type { Metadata } from "next";
import { Crimson_Pro, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { TutorSidebar } from "@/components/ai/tutor-sidebar";
import { AuthProvider } from "@/components/auth/auth-provider";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import "./globals.css";

/**
 * Three type roles, each with a job:
 *   Plex Sans — interface and headings. IBM Quantum's own face, and Qiskit is
 *               IBM's framework, so it is the vernacular of the subject.
 *   Plex Mono — gates, kets, telemetry, code. Anything a machine produced.
 *   Crimson   — mathematics. Set in serif italic the way a physics paper sets it.
 */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const crimson = Crimson_Pro({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "QuantaVerse — Learn quantum algorithms for free",
    template: "%s · QuantaVerse",
  },
  description:
    "A free and open educational resource for quantum computing: an interactive Bloch sphere, a drag-and-drop circuit sandbox with Qiskit code, an AI tutor, and eight modules from the qubit to Shor's algorithm. MIT licensed, CC BY-SA content.",
  keywords: [
    "quantum computing",
    "quantum algorithms",
    "Qiskit",
    "open educational resource",
    "quantum circuit simulator",
    "Grover's algorithm",
    "Bloch sphere",
  ],
  openGraph: {
    title: "QuantaVerse — Learn quantum algorithms for free",
    description:
      "Eight modules, a live circuit sandbox, and an AI tutor. Free, open source, no account required.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${plexSans.variable} ${plexMono.variable} ${crimson.variable} h-full`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-full focus:bg-photon focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[#03121b]"
        >
          Skip to content
        </a>
        <AuthProvider>
          <SiteNav />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <TutorSidebar />
        </AuthProvider>
      </body>
    </html>
  );
}
