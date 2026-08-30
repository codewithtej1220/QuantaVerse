import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { TutorSidebar } from "@/components/ai/tutor-sidebar";
import { AuthProvider } from "@/components/auth/auth-provider";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { RouteField } from "@/components/three/route-field";
import "./globals.css";

/**
 * Three type roles, each with a job:
 *
 *   Archivo   — headlines. A grotesque that holds its shape at 800 and
 *               at 6rem, which is what a full-bleed line needs. Nothing
 *               below a section heading is ever set in it.
 *   Plex Sans — everything a person reads for longer than a second.
 *               Drawn for screen text, and it is IBM Quantum's own face,
 *               which is the vernacular of the subject being taught.
 *   Plex Mono — gates, kets, telemetry, code, and the mathematics. Any
 *               value a machine produced is set in the machine's face.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      className={`dark ${archivo.variable} ${plexSans.variable} ${plexMono.variable} h-full`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-void">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:bg-photon focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-void"
        >
          Skip to content
        </a>
        <AuthProvider>
          {/* The field behind every route but the landing page, which brings
              its own along with the stage its zones render into. */}
          <RouteField />
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
