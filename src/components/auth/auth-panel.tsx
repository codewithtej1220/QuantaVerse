"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, KeyRound, Loader2, UserPlus } from "lucide-react";

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

type Audience = "student" | "professor";

const COPY = {
  student: {
    login: {
      eyebrow: "Sign in",
      title: "Welcome back",
      lede: "Sign in to pick up your streak, your badges and the module you left open.",
    },
    register: {
      eyebrow: "Register",
      title: "Start a student record",
      lede: "An account stores the lessons you finish and every graded circuit you submit, so the dashboard counts your work instead of a demo learner's.",
    },
  },
  professor: {
    login: {
      eyebrow: "Professor sign in",
      title: "Your classes are waiting",
      lede: "Sign in to answer students asking to join your classes, see who is furthest ahead on each of your modules, and upload notes.",
    },
    register: {
      eyebrow: "Professor registration",
      title: "Set up a teaching account",
      lede: "Sign up the same way a student does. Once you are in, pick the modules you teach from your dashboard — students then ask to join your class on each one, and you decide who is in.",
    },
  },
} as const;

export function AuthPanel({
  mode,
  audience = "student",
}: {
  mode: "login" | "register";
  audience?: Audience;
}) {
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [institution, setInstitution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const registering = mode === "register";
  const professor = audience === "professor";
  const copy = COPY[audience][mode];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const profile = registering
        ? await signUp({
            email,
            password,
            display_name: displayName,
            institution: institution.trim() || null,
            role: professor ? "professor" : "student",
          })
        : await signIn(email, password);
      /* Where to land goes by what the account is, not by which tab was used:
         a professor who signs in on the student tab still lands on their
         classes, and a student on the professor tab on their own dashboard.
         A new student lands on the track, where the two starting-point
         questions are waiting in a box over it. */
      router.push(
        profile.role === "professor" ? "/professor" : registering ? "/curriculum" : "/dashboard",
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "something went wrong — try again");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen pt-32 pb-24">
      <div className="mx-auto max-w-[520px] px-5">
        {/* Student or professor, said before anything else on the page: the
            header's one "Sign in" link lands here for both. */}
        <nav
          aria-label="Account type"
          className="mb-7 inline-flex rounded-lg border border-edge bg-void/60 p-0.5"
        >
          {(
            [
              ["student", registering ? "/register" : "/login", "Student"],
              ["professor", registering ? "/professor/register" : "/professor/login", "Professor"],
            ] as const
          ).map(([id, href, label]) => {
            const on = audience === id;
            return (
              <Link
                key={id}
                href={href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-4 py-2 font-mono text-[12px] tracking-[0.12em] uppercase transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                  on ? "bg-photon text-void" : "text-frost hover:text-paper",
                )}
              >
                {id === "professor" && <GraduationCap className="size-3.5" aria-hidden />}
                {label}
              </Link>
            );
          })}
        </nav>

        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 className="mt-3 display-2">{copy.title}</h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-frost">{copy.lede}</p>

        <form onSubmit={submit} className="panel mt-8 space-y-4 rounded-2xl p-5 lg:p-6">
          {registering && (
            <div className="space-y-1.5">
              <label htmlFor="display_name" className={LABEL}>
                {professor ? "Name, as students should see it" : "Display name"}
              </label>
              <input
                id="display_name"
                className={FIELD}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={professor ? "Dr Ada Lovelace" : "Ada Lovelace"}
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
                Institution{" "}
                <span className="text-frost">{professor ? "shown to students" : "optional"}</span>
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
              professor ? (
                <GraduationCap className="size-4" />
              ) : (
                <UserPlus className="size-4" />
              )
            ) : (
              <KeyRound className="size-4" />
            )}
            {busy
              ? registering
                ? "Creating account…"
                : "Signing in…"
              : registering
                ? professor
                  ? "Create teaching account"
                  : "Create account"
                : "Sign in"}
          </ActionButton>

          <p className={cn("pt-1 text-center text-[12.5px] text-frost")}>
            {registering ? "Already have an account? " : "No account yet? "}
            <Link
              href={
                registering
                  ? professor
                    ? "/professor/login"
                    : "/login"
                  : professor
                    ? "/professor/register"
                    : "/register"
              }
              className="text-photon underline-offset-4 hover:underline"
            >
              {registering ? "Sign in" : professor ? "Create a teaching account" : "Create one"}
            </Link>
          </p>
        </form>

        <p className="mt-5 text-[12px] leading-relaxed text-frost">
          Your password is hashed with bcrypt and never leaves the server. The curriculum, the
          sandbox and the tutor all work without an account — signing in only adds the record.
        </p>
      </div>
    </div>
  );
}
