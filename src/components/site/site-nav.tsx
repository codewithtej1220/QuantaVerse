"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { AccountMenu } from "@/components/site/account-menu";
import { ActionLink } from "@/components/site/action";
import { QuantaMark, Wordmark } from "@/components/site/mark";
import { cn } from "@/lib/utils";

/**
 * The header.
 *
 * Four things: where you are, where you can go, who you are, and the one action
 * worth putting in a header. The status pill, the pulsing "live" dot and the
 * repository shortcut that used to sit here have gone to the footer or gone
 * entirely — a header is navigation, and everything else in it is weight.
 *
 * The active route is marked with a solid copper rule under the label. It is
 * the only copper in the bar, so it is unmissable without being loud.
 */

const LINKS = [
  { href: "/curriculum", label: "Curriculum" },
  { href: "/sandbox", label: "Sandbox" },
  { href: "/lab", label: "Lab" },
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
        "fixed inset-x-0 top-0 z-50 transition-colors duration-200",
        scrolled || open ? "border-b border-edge bg-void" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center gap-8 px-5 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5" aria-label="QuantaVerse home">
          <QuantaMark />
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative px-3.5 py-2 font-mono text-[12px] tracking-[0.14em] uppercase transition-colors",
                  active ? "text-paper" : "text-frost hover:text-paper",
                )}
              >
                {link.label}
                {active && <span className="absolute inset-x-3.5 -bottom-px h-0.5 bg-photon" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <AccountMenu className="hidden sm:inline-flex" />
          <ActionLink href="/sandbox" className="hidden lg:inline-flex">
            Open sandbox
          </ActionLink>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex size-10 items-center justify-center text-paper md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-edge bg-void px-5 pb-6 md:hidden">
          <nav className="flex flex-col">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="border-b border-edge py-4 font-mono text-[13px] tracking-[0.14em] text-paper uppercase"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 flex flex-col gap-3">
            <AccountMenu className="sm:hidden" />
            <ActionLink href="/sandbox" className="w-full">
              Open sandbox
            </ActionLink>
          </div>
        </div>
      )}
    </header>
  );
}
