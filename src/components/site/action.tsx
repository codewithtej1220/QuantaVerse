import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "quiet";

const base =
  "group relative inline-flex items-center justify-center gap-2.5 rounded-full font-medium " +
  "transition-[transform,box-shadow,background-color,border-color] duration-200 " +
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-photon " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-50";

const sizes = {
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-[0.95rem]",
} as const;

const variants: Record<Variant, string> = {
  primary:
    "bg-photon text-[#03121b] shadow-[0_0_0_1px_rgba(56,232,255,0.6),0_10px_40px_-12px_rgba(56,232,255,0.75)] " +
    "hover:bg-[#6ff0ff] hover:shadow-[0_0_0_1px_rgba(56,232,255,0.9),0_14px_52px_-10px_rgba(56,232,255,0.95)]",
  outline:
    "glass-quiet text-paper hover:border-phase/55 hover:text-white " +
    "hover:shadow-[0_0_34px_-10px_rgba(177,78,255,0.8)]",
  quiet: "text-frost hover:text-paper hover:bg-white/5",
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
