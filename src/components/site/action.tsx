import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The site's two buttons.
 *
 * Rectangular, because every other surface here is machined and a pill would be
 * the only soft thing on the page. Labels are set in the mono face, uppercase
 * and tracked out: it is the same treatment the gate labels and the telemetry
 * get, so a button reads as a control rather than as a piece of marketing.
 *
 * There is no glow and no shadow. The primary sits in solid copper with black
 * type on it — 6.5:1, and the loudest thing on any screen it appears on, which
 * is the whole job of a primary button.
 */

type Variant = "primary" | "outline" | "quiet";

const base =
  "group relative inline-flex shrink-0 items-center justify-center gap-2.5 " +
  "font-mono uppercase tracking-[0.16em] " +
  "transition-colors duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon " +
  "disabled:pointer-events-none disabled:opacity-40";

const sizes = {
  md: "h-11 px-5 text-[12px]",
  lg: "h-14 px-7 text-[13px]",
} as const;

const variants: Record<Variant, string> = {
  primary: "bg-photon text-void font-semibold hover:bg-photon-hi",
  // Hover inverts to solid white rather than adding a halo: the state change
  // is a change of material, not a change of lighting.
  outline:
    "border border-edge-hi text-paper hover:border-paper hover:bg-paper hover:text-void font-medium",
  quiet: "text-frost hover:text-paper font-medium",
};

export function ActionLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: keyof typeof sizes;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    >
      {children}
    </Link>
  );
}

export function ActionButton({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes }) {
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  );
}
