"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, KeyRound, Loader2, UserPlus } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { ActionButton } from "@/components/site/action";
import { ApiError } from "@/lib/api";
import { MODULES } from "@/lib/data";
import { professorSignupOpen } from "@/lib/professor";
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
      eyebrow: "Sign in · /login",
      title: "Welcome back",
      lede: "Sign in to pick up your streak, your badges and the module you left open.",
    },
    register: {
      eyebrow: "Register · /register",
      title: "Start a student record",
      lede: "An account stores the lessons you finish and every graded circuit you submit, so the dashboard counts your work instead of a demo learner's.",
    },
  },
  professor: {
    login: {
      eyebrow: "Professor sign in · /professor/login",
      title: "Your classes are waiting",
      lede: "Sign in to answer students asking to join your classes, see who is furthest ahead on each of your modules, and upload notes.",
    },
    register: {
      eyebrow: "Professor · /professor/register",
      title: "Set up a teaching account",
      lede: "Register with the invite code your site's administrator gave you and pick the modules you teach. Students then ask to join your class on each one, and you decide who is in.",
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
  const [code, setCode] = useState("");
  const [teaches, setTeaches] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const registering = mode === "register";
  const professor = audience === "professor";
  const copy = COPY[audience][mode];

  /* Professor sign-up only exists where the site has set an invite code. Asked
     up front, so nobody fills in the whole form to be told at the end. */
  const [signupOpen, setSignupOpen] = useState<boolean | null>(null);
  useEffect(() => {
    if (!professor || !registering) return;
    let live = true;
    professorSignupOpen().then(
      (open) => live && setSignupOpen(open),
      () => live && setSignupOpen(null),
    );
    return () => {
      live = false;
    };
  }, [professor, registering]);
  const closed = professor && registering && signupOpen === false;

  const toggleModule = (slug: string) =>
    setTeaches((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug],
    );

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
          ...(professor ? { professor_code: code.trim(), teaches } : {}),
        });
      } else {
        await signIn(email, password);
      }
      /* A new student lands on the track, where the two starting-point
         questions are waiting in a box over it. Asking there rather than on a
         route of their own means the thing the answers are about is on screen
         while they are being given — and means an account that predates the
         questions gets asked too, which a post-registration redirect cannot.
         A professor lands on their classes, and an account that turns out not
         to be a professor's is offered the invite code there. */
      router.push(professor ? "/professor" : registering ? "/curriculum" : "/dashboard");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "something went wrong — try again");
      setBusy(false);
    }
  };

  const otherLogin = professor ? "/login" : "/professor/login";

  return (
    <div className="min-h-screen pt-32 pb-24">
      <div
        className={cn("mx-auto px-5", professor && registering ? "max-w-[640px]" : "max-w-[520px]")}
      >
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 className="mt-3 display-2">{copy.title}</h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-frost">{copy.lede}</p>

        <form onSubmit={submit} className="panel mt-8 space-y-4 rounded-2xl p-5 lg:p-6">
          {closed && (
            <p
              role="status"
              className="rounded-xl border border-edge-hi bg-strata px-3.5 py-2.5 text-[12.5px] leading-relaxed text-frost"
            >
              Professor sign-up isn&rsquo;t switched on for this site. It opens when the
              administrator sets an invite code (
              <code className="font-mono">QUANTAVERSE_PROFESSOR_CODE</code>) on the API.
            </p>
          )}

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

          {registering && professor && (
            <>
              <div className="space-y-1.5">
                <label htmlFor="professor_code" className={LABEL}>
                  Invite code
                </label>
                <input
                  id="professor_code"
                  className={cn(FIELD, "font-mono")}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="from your site's administrator"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={120}
                  required
                  disabled={closed}
                />
                <p className="text-[12px] leading-relaxed text-frost">
                  A professor sees the progress of every student they accept, so the role needs the
                  code rather than a tick-box.
                </p>
              </div>

              <fieldset className="space-y-2">
                <legend className={LABEL}>Modules you teach</legend>
                <p className="text-[12px] leading-relaxed text-frost">
                  Students can ask to join your class on these. You can change them later.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {MODULES.map((module) => {
                    const on = teaches.includes(module.slug);
                    return (
                      <label
                        key={module.slug}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 border px-3 py-2.5 transition-colors",
                          on
                            ? "border-photon bg-photon/[0.07]"
                            : "border-edge hover:border-edge-hi",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleModule(module.slug)}
                          disabled={closed}
                          className="size-3.5 shrink-0 accent-photon"
                        />
                        <span className="ket shrink-0 text-[12px] text-photon">{module.ket}</span>
                        <span className="min-w-0 text-[13px] leading-snug text-paper">
                          {module.title}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-edge-hi bg-strata px-3.5 py-2.5 text-[12.5px] leading-relaxed text-collapse"
            >
              {error}
            </p>
          )}

          <ActionButton type="submit" size="lg" className="w-full" disabled={busy || closed}>
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
              {registering ? "Sign in" : professor ? "Register with an invite code" : "Create one"}
            </Link>
          </p>
        </form>

        <p className="mt-5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-frost">
          <GraduationCap className="size-3.5 text-photon" aria-hidden />
          {professor ? "Not a professor?" : "Teaching a module?"}
          <Link href={otherLogin} className="text-photon underline-offset-4 hover:underline">
            {professor ? "Student sign in" : "Professor sign in"}
          </Link>
        </p>

        <p className="mt-4 text-[12px] leading-relaxed text-frost">
          Your password is hashed with bcrypt and never leaves the server. The curriculum, the
          sandbox and the tutor all work without an account — signing in only adds the record.
        </p>
      </div>
    </div>
  );
}
