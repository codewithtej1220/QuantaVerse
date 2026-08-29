"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

export function AccountMenu({ className }: { className?: string }) {
  const { user, ready, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!ready) {
    return <span className={cn("h-10 w-24 bg-strata", className)} />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className={cn(
          "inline-flex h-10 items-center px-3 font-mono text-[12px] tracking-[0.14em] text-frost uppercase transition-colors hover:text-paper",
          className,
        )}
      >
        Sign in
      </Link>
    );
  }

  const leave = async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
    router.push("/");
  };

  return (
    <span className={cn("inline-flex items-center", className)}>
      <Link
        href="/dashboard"
        className="inline-flex h-10 items-center gap-2.5 border border-edge px-3 transition-colors hover:border-photon"
        title={user.email}
      >
        <span className="grid size-6 place-items-center bg-photon font-mono text-[12px] font-semibold text-void uppercase">
          {user.display_name.slice(0, 1)}
        </span>
        <span className="max-w-[12ch] truncate font-mono text-[12px] text-paper">
          {user.handle}
        </span>
      </Link>
      <button
        type="button"
        onClick={leave}
        disabled={busy}
        aria-label="Sign out"
        title="Sign out"
        className="flex size-10 items-center justify-center text-frost transition-colors hover:text-paper disabled:opacity-40"
      >
        <LogOut className="size-4" />
      </button>
    </span>
  );
}
