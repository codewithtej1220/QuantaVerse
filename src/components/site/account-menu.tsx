"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

export function AccountMenu({ className }: { className?: string }) {
  const { user, ready, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!ready) {
    return <span className={cn("h-9 w-24 animate-pulse rounded-full bg-white/5", className)} />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm text-frost/80 transition-colors hover:bg-white/6 hover:text-paper",
          className,
        )}
      >
        <User className="size-4" />
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
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Link
        href="/dashboard"
        className="inline-flex h-9 items-center gap-2 rounded-full border border-photon/25 bg-photon/8 px-3 transition-colors hover:border-photon/45 hover:bg-photon/12"
        title={user.email}
      >
        <span className="grid size-5 place-items-center rounded-full bg-photon/20 font-mono text-[10px] text-photon uppercase">
          {user.display_name.slice(0, 1)}
        </span>
        <span className="max-w-[10ch] truncate font-mono text-[11px] text-photon/90">
          @{user.handle}
        </span>
      </Link>
      <button
        type="button"
        onClick={leave}
        disabled={busy}
        aria-label="Sign out"
        title="Sign out"
        className="flex size-9 items-center justify-center rounded-full text-frost/70 transition-colors hover:bg-white/6 hover:text-paper disabled:opacity-50"
      >
        <LogOut className="size-4" />
      </button>
    </span>
  );
}
