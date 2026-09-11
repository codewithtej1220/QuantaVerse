"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, UserPlus } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { ActionButton } from "@/components/site/action";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

/* A field is a well with a hairline. Focus moves the hairline to copper —
   no ring, no halo, because the border already says which one is live. */
const FIELD =
  "h-12 w-full border border-edge bg-strata px-4 text-[15px] " +
  "text-paper placeholder:text-dim outline-none transition-colors " +
  "focus:border-photon";

const LABEL = "font-mono text-[12px] tracking-[0.16em] text-frost uppercase";

export function AuthPanel({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [institution, setInstitution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const registering = mode === "register";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (registering) {
        await signUp({
          email,
          password,
          display_name: displayName,
          institution: institution.trim() || null,
        });
      } else {
        await signIn(email, password);
      }
      /* A new account goes to the two questions first; they are what decide
         how much of the track is open on the first day, and asking after the
         learner has already landed on a dashboard is asking too late. */
      router.push(registering ? "/welcome" : "/dashboard");
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "something went wrong — try again",
      );
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen pt-32 pb-24">
      <div className="mx-auto max-w-[520px] px-5">
        <p className="eyebrow">{registering ? "Register · /register" : "Sign in · /login"}</p>
        <h1 className="mt-3 display-2">
          {registering ? "Start a student record" : "Welcome back"}
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-frost">
          {registering
            ? "An account stores the lessons you finish and every graded circuit you submit, so the dashboard counts your work instead of a demo learner's."
            : "Sign in to pick up your streak, your badges and the module you left open."}
        </p>

        <form onSubmit={submit} className="panel mt-8 space-y-4 rounded-2xl p-5 lg:p-6">
          {registering && (
            <div className="space-y-1.5">
              <label htmlFor="display_name" className={LABEL}>
                Display name
              </label>
              <input
                id="display_name"
                className={FIELD}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Ada Lovelace"
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className={LABEL}>
              Email
            </label>
            <input
              id="email"
              type="email"
              className={FIELD}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@university.edu"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className={LABEL}>
              Password
            </label>
            <input
              id="password"
              type="password"
              className={FIELD}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={registering ? "at least 10 characters" : "your password"}
              autoComplete={registering ? "new-password" : "current-password"}
              minLength={registering ? 10 : 1}
              required
            />
            {registering && (
              <p className="font-mono text-[11px] leading-relaxed text-frost">
                Ten characters or more, mixing at least two of: lower case, upper case, digits,
                punctuation.
              </p>
            )}
          </div>

          {registering && (
            <div className="space-y-1.5">
              <label htmlFor="institution" className={LABEL}>
                Institution <span className="text-frost">optional</span>
              </label>
              <input
                id="institution"
                className={FIELD}
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
                placeholder="PSG College of Technology"
                maxLength={160}
              />
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-edge-hi bg-strata px-3.5 py-2.5 text-[12.5px] leading-relaxed text-collapse"
            >
              {error}
            </p>
          )}

          <ActionButton type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : registering ? (
              <UserPlus className="size-4" />
            ) : (
              <KeyRound className="size-4" />
            )}
            {busy
              ? registering
                ? "Creating account…"
                : "Signing in…"
              : registering
                ? "Create account"
                : "Sign in"}
          </ActionButton>

          <p className={cn("pt-1 text-center text-[12.5px] text-frost")}>
            {registering ? "Already have an account? " : "No account yet? "}
            <Link
              href={registering ? "/login" : "/register"}
              className="text-photon underline-offset-4 hover:underline"
            >
              {registering ? "Sign in" : "Create one"}
            </Link>
          </p>
        </form>

        <p className="mt-6 text-[12px] leading-relaxed text-frost">
          Your password is hashed with bcrypt and never leaves the server. The curriculum, the
          sandbox and the tutor all work without an account — signing in only adds the record.
        </p>
      </div>
    </div>
  );
}
