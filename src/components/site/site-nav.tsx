"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitFork, Menu, X } from "lucide-react";

import { ActionLink } from "@/components/site/action";
import { QuantaMark } from "@/components/site/quantum-wire";
import { REPO_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/curriculum", label: "Curriculum" },
  { href: "/sandbox", label: "Sandbox" },
  { href: "/dashboard", label: "Dashboard" },
];

export function SiteNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [route, setRoute] = useState(pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Navigating closes the mobile menu. Adjusted during render, not in an
     effect: the panel must not paint over the new page for a frame first. */
  if (route !== pathname) {
    setRoute(pathname);
    setOpen(false);
  }

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-white/8 bg-void/72 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-5 lg:px-10">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-full outline-offset-4 focus-visible:outline-2 focus-visible:outline-photon"
        >
          <QuantaMark />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">
            Quanta<span className="text-photon">Verse</span>
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative rounded-full px-3.5 py-2 text-sm transition-colors",
                  active ? "text-paper" : "text-frost/75 hover:text-paper",
                )}
              >
                {link.label}
                {active && (
                  <span className="absolute inset-x-3.5 -bottom-0.5 h-px bg-photon shadow-[0_0_10px_1px_rgba(56,232,255,0.9)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <span className="hidden items-center gap-2 rounded-full border border-photon/25 bg-photon/8 px-3 py-1.5 lg:inline-flex">
            <span className="size-1.5 animate-breathe rounded-full bg-photon" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-photon/90 uppercase">
              Free · MIT · Open source
            </span>
          </span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Source on GitHub"
            className="hidden size-9 items-center justify-center rounded-full text-frost/80 transition-colors hover:bg-white/6 hover:text-paper sm:flex"
          >
            <GitFork className="size-4" />
          </a>
          <ActionLink href="/sandbox" size="md" className="hidden sm:inline-flex">
            Open sandbox
          </ActionLink>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex size-9 items-center justify-center rounded-full text-frost transition-colors hover:bg-white/6 hover:text-paper md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/8 bg-void/95 px-5 pb-5 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col py-2">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="border-b border-white/6 py-3.5 text-sm text-frost last:border-0 hover:text-paper"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <ActionLink href="/sandbox" className="w-full">
            Open sandbox
          </ActionLink>
        </div>
      )}
    </header>
  );
}
