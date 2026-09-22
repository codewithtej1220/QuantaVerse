"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  GraduationCap,
  Loader2,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import {
  acceptRequest,
  declineRequest,
  fetchDirectory,
  fetchMyCard,
  fetchNetwork,
  removeConnection,
  sendRequest,
  updateMyCard,
  withdrawRequest,
  type ConnectionRecord,
  type NetworkResponse,
  type PersonCard,
  type Role,
} from "@/lib/network";
import { TONE, personTone } from "@/lib/tone";
import { cn } from "@/lib/utils";

/**
 * The research hub.
 *
 * A directory of the people on this instance and the connection graph between
 * them. The shape is the one everybody already knows from professional
 * networks — ask, wait, accept — because the point is for a student to reach a
 * mentor without first learning a new set of rules.
 *
 * One thing is deliberately different: a person's progress is not on their card
 * until you are connected to them. A directory that shows strangers how many
 * badges you have is a leaderboard, and a leaderboard is the fastest way to
 * make a beginner close the tab.
 */

type Tab = "directory" | "requests" | "connections";
type Filter = "all" | "mentor" | "professor" | "student" | "open";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "open", label: "Open to mentoring" },
  { id: "mentor", label: "Mentors" },
  { id: "professor", label: "Professors" },
  { id: "student", label: "Students" },
];

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function reasonOf(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

const SMALL =
  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon disabled:cursor-not-allowed disabled:opacity-50";
/* The one to press. */
const PRIMARY =
  "border-photon bg-photon font-semibold text-void hover:bg-photon-hi";
/* Yes, to a person. */
const GO =
  "border-emerald-400 bg-emerald-400 font-semibold text-emerald-950 hover:bg-emerald-300";
/* No, or undo. */
const STOP =
  "border-transparent bg-rose-400/10 text-rose-300 hover:bg-rose-400/20";
const QUIET =
  "border-edge bg-strata text-paper hover:border-edge-hi hover:bg-[#1a2640]";

/* An interest is coloured by its own name, so "grover" is the same colour on
   every card it appears on and two people who share one can be seen to. */
function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "professor" | "mentor" | "example";
}) {
  const hue =
    !tone && typeof children === "string"
      ? TONE[personTone(children)].text
      : null;
  return (
    <span
      className={cn(
        "pill",
        tone === "professor" && "text-grape",
        tone === "mentor" && "text-teal-300",
        tone === "example" && "text-dim",
        hue,
      )}
    >
      {children}
    </span>
  );
}

function Avatar({ person }: { person: PersonCard }) {
  const tone = TONE[personTone(person.handle)];
  const ring = person.role === "student" ? "ring-white/15" : tone.ring;

  /* A picture where there is one. The example mentors carry portraits of people
     who do not exist — generated faces, not photographs of anybody — because a
     real person's face on an invented name and invented credentials is the one
     thing a directory like this must never do. The "example profile" chip beside
     the name still says so. */
  if (person.avatar_url) {
    return (
      <Image
        src={person.avatar_url}
        alt=""
        width={44}
        height={44}
        className={cn(
          "size-11 shrink-0 rounded-full object-cover ring-1 ring-offset-2 ring-offset-nebula",
          ring,
        )}
      />
    );
  }

  /* Initials for everybody else. Nobody has uploaded a picture, and a grid of
     identical placeholder silhouettes reads worse than a grid of letters. */
  const initials = person.display_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full text-[13.5px] font-semibold ring-1",
        tone.soft,
        tone.text,
        tone.ring,
      )}
    >
      {initials || "?"}
    </span>
  );
}

function Identity({ person }: { person: PersonCard }) {
  return (
    <div className="flex min-w-0 flex-1 gap-3">
      <Avatar person={person} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[15.5px] font-semibold text-paper">
            {person.display_name}
          </span>
          {person.role === "mentor" && <Chip tone="mentor">Mentor</Chip>}
          {person.role === "professor" && (
            <Chip tone="professor">Professor</Chip>
          )}
          {/* Said plainly on the card. A seeded fixture that looks like a real
              academic is the one thing this directory must not do. */}
          {person.is_demo && <Chip tone="example">Example profile</Chip>}
        </p>
        <p className="mt-0.5 truncate text-[12.5px] text-dim">
          @{person.handle}
          {person.institution && (
            <span className="text-frost"> · {person.institution}</span>
          )}
        </p>
      </div>
    </div>
  );
}

function Interests({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <p className="mt-3 flex flex-wrap gap-1.5">
      {tags.slice(0, 5).map((tag) => (
        <Chip key={tag}>{tag}</Chip>
      ))}
    </p>
  );
}

/**
 * What a directory row opens into.
 *
 * A card has room for a name, an institution and one line; everything that
 * would actually help somebody decide whether to write — what this person
 * works on, who they have supervised, whether they have any time — does not
 * fit and used to simply not exist. It lives here instead, behind a
 * disclosure, so the list stays scannable and the detail is one press away.
 *
 * Sections render only when they have something in them. A member who has
 * filled in nothing gets a shorter panel rather than a grid of empty labels,
 * which is the difference between a profile that is sparse and one that looks
 * broken.
 */
function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[12.5px] font-semibold text-frost">{label}</p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-frost">
        {children}
      </p>
    </div>
  );
}

function ProfilePanel({ person }: { person: PersonCard }) {
  const anything =
    person.position ||
    person.education ||
    person.focus ||
    person.mentoring ||
    person.availability;

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-edge pt-4">
      {person.position && <Detail label="Position">{person.position}</Detail>}
      {person.education && (
        <Detail label="Academic background">{person.education}</Detail>
      )}
      {person.focus && <Detail label="Research focus">{person.focus}</Detail>}
      {person.mentoring && (
        <Detail label="Mentoring">{person.mentoring}</Detail>
      )}
      {person.availability && (
        <Detail label="Availability">{person.availability}</Detail>
      )}

      {!anything && (
        <p className="text-[13px] leading-relaxed text-dim">
          This member has not filled in a full profile yet.
        </p>
      )}

      {/* Said again, in a sentence, because the chip on the card can be cropped
          out of a screenshot and this is the claim that must not travel. */}
      {person.is_demo && (
        <p className="border-l-2 border-edge-hi pl-3 text-[12.5px] leading-relaxed text-dim">
          This is an example profile shipped with the instance so the directory
          has something to show. The person is invented and the account cannot
          be signed into.
        </p>
      )}
    </div>
  );
}

/** The button whose label is entirely decided by where you stand. */
function StandingAction({
  person,
  busy,
  onConnect,
  onAccept,
  onWithdraw,
}: {
  person: PersonCard;
  busy: boolean;
  onConnect: () => void;
  onAccept: () => void;
  onWithdraw: () => void;
}) {
  const base = SMALL;

  if (person.standing === "self") {
    return <span className="pill shrink-0 text-dim">This is you</span>;
  }

  if (person.standing === "connected") {
    return (
      <span className="pill shrink-0 text-ok">
        <Check className="size-3" />
        Connected
      </span>
    );
  }

  if (person.standing === "awaiting_you") {
    return (
      <button
        type="button"
        onClick={onAccept}
        disabled={busy}
        className={cn(base, GO)}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5" />
        )}
        Accept
      </button>
    );
  }

  if (person.standing === "awaiting_them" || person.standing === "declined") {
    /* A declined request is shown to the person who asked as "waiting", not as
       a rebuff. They can withdraw it; they are not handed a rejection notice
       to reread. */
    return (
      <button
        type="button"
        onClick={onWithdraw}
        disabled={busy}
        className={cn(
          base,
          "border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20",
        )}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Clock className="size-3.5" />
        )}
        Waiting
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onConnect}
      disabled={busy}
      className={cn(base, PRIMARY)}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <UserPlus className="size-3.5" />
      )}
      Connect
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

export function ResearchHub() {
  const { user, ready } = useAuth();

  const [tab, setTab] = useState<Tab>("directory");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const [people, setPeople] = useState<PersonCard[]>([]);
  const [total, setTotal] = useState(0);
  const [network, setNetwork] = useState<NetworkResponse | null>(null);
  const [card, setCard] = useState<PersonCard | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** The person a note is being written to, if any. */
  /* Any number of rows open at once. It used to be one: opening a second
     profile quietly closed the first, so there was no way to read two
     professors side by side — which is exactly what somebody choosing between
     them wants to do. The list still starts closed, so it stays scannable. */
  const [opened, setOpened] = useState<ReadonlySet<number>>(() => new Set());
  const toggleOpened = useCallback((id: number) => {
    setOpened((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const [composing, setComposing] = useState<PersonCard | null>(null);
  const [note, setNote] = useState("");
  const noteBox = useRef<HTMLTextAreaElement>(null);

  const [editing, setEditing] = useState(false);

  const refreshNetwork = useCallback(async () => {
    const next = await fetchNetwork();
    setNetwork(next);
    return next;
  }, []);

  const refreshDirectory = useCallback(async () => {
    const next = await fetchDirectory({
      q: query,
      role:
        filter === "mentor" || filter === "student" || filter === "professor"
          ? (filter as Role)
          : null,
      mentorsOnly: filter === "open",
    });
    setPeople(next.people);
    setTotal(next.total);
  }, [query, filter]);

  /* Switching account puts the page back into its loading state, adjusted
     during render rather than from inside the effect below — React's own
     guidance, and the same shape the site nav uses to close its menu when the
     route changes. Without it, signing in as someone else shows the previous
     account's directory for a frame. */
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  if (user && loadedFor !== user.id) {
    setLoadedFor(user.id);
    setLoading(true);
  }

  /* First load. The three calls are independent, so they go together rather
     than in a chain that makes the page appear a third at a time. */
  useEffect(() => {
    if (!ready || !user) return;
    let live = true;

    Promise.all([fetchDirectory(), fetchNetwork(), fetchMyCard()])
      .then(([directory, net, mine]) => {
        if (!live) return;
        setPeople(directory.people);
        setTotal(directory.total);
        setNetwork(net);
        setCard(mine);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (live) setError(reasonOf(cause, "the hub could not load"));
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [ready, user]);

  /* Search and filters, debounced. Typing a name should not be forty requests. */
  const firstRun = useRef(true);
  useEffect(() => {
    if (!ready || !user) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      refreshDirectory().catch((cause: unknown) =>
        setError(reasonOf(cause, "the directory could not load")),
      );
    }, 260);
    return () => window.clearTimeout(timer);
  }, [ready, user, refreshDirectory]);

  useEffect(() => {
    if (composing) noteBox.current?.focus();
  }, [composing]);

  /** Re-read both lists, because one action changes what the other shows. */
  const settle = useCallback(async () => {
    await Promise.all([refreshDirectory(), refreshNetwork()]);
  }, [refreshDirectory, refreshNetwork]);

  const act = useCallback(
    async (id: number, work: () => Promise<unknown>, said: string) => {
      setBusy(id);
      setError(null);
      try {
        await work();
        await settle();
        setNotice(said);
        window.setTimeout(() => setNotice(null), 4000);
      } catch (cause: unknown) {
        setError(reasonOf(cause, "that did not go through"));
      } finally {
        setBusy(null);
      }
    },
    [settle],
  );

  const submitNote = async () => {
    if (!composing) return;
    const target = composing;
    setComposing(null);
    await act(
      target.id,
      () => sendRequest(target.handle, note),
      `Request sent to ${target.display_name}.`,
    );
    setNote("");
  };

  const counts = useMemo(
    () => ({
      requests:
        (network?.incoming.length ?? 0) + (network?.outgoing.length ?? 0),
      connections: network?.connections.length ?? 0,
      incoming: network?.pending_incoming ?? 0,
    }),
    [network],
  );

  /* ---------------------------------------------------------------- */

  if (!ready) {
    return (
      <p className="flex items-center gap-2 text-[14px] text-frost">
        <Loader2 className="size-4 animate-spin" />
        Checking your session…
      </p>
    );
  }

  if (!user) {
    return (
      <div className="panel max-w-xl rounded-2xl p-6">
        <p className="eyebrow">Members only</p>
        <h2 className="display-2 mt-3 text-paper">Sign in to reach a mentor</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-frost">
          The directory lists real people and their institutions, so it is not
          readable without an account — and a connection request has to come
          from someone.
        </p>
        <p className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-photon px-5 py-2.5 text-[13.5px] font-semibold text-void hover:bg-photon-hi"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-edge bg-strata px-5 py-2.5 text-[13.5px] font-medium text-paper hover:border-edge-hi"
          >
            Create an account
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Your own card. It is what everyone else searches on, so it sits at the
          top rather than behind a settings page nobody opens. */}
      {card && (
        <MyCard
          card={card}
          editing={editing}
          onEdit={setEditing}
          onSaved={(next) => {
            setCard(next);
            setEditing(false);
            void refreshDirectory();
          }}
        />
      )}

      {/* Tabs. */}
      <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-edge bg-nebula p-1">
        {(
          [
            ["directory", "Directory", total],
            ["requests", "Requests", counts.requests],
            ["connections", "Connections", counts.connections],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
              tab === id
                ? "bg-strata text-paper ring-1 ring-edge-hi"
                : "text-frost hover:text-paper",
            )}
          >
            {label}
            <span
              className={cn(
                "pill tabular-nums",
                tab === id ? "text-cyan-300" : "text-dim",
              )}
            >
              {count}
            </span>
            {id === "requests" && counts.incoming > 0 && (
              <span
                className="size-2 rounded-full bg-amber-400"
                aria-label="new requests"
              />
            )}
          </button>
        ))}
      </div>

      {notice && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-[13.5px] text-emerald-200">
          <Check className="size-3.5 shrink-0" />
          {notice}
        </p>
      )}
      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-[13.5px] text-rose-200">
          <AlertTriangle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {loading ? (
        <p className="flex items-center gap-2 py-8 text-[14px] text-frost">
          <Loader2 className="size-4 animate-spin" />
          Reading the directory…
        </p>
      ) : tab === "directory" ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative flex min-w-[16rem] flex-1 items-center">
              <Search
                className="pointer-events-none absolute left-3 size-3.5 text-dim"
                aria-hidden
              />
              <span className="sr-only">Search the directory</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, institution or interest — try “grover”"
                className="w-full rounded-xl border border-edge bg-nebula py-2.5 pr-3 pl-9 text-[14px] text-paper placeholder:text-dim focus:border-edge-hi focus:outline-none"
              />
            </label>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Filter the directory"
            >
              {FILTERS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setFilter(entry.id)}
                  aria-pressed={filter === entry.id}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                    filter === entry.id
                      ? "border-photon/50 bg-photon/15 text-photon"
                      : "border-edge bg-nebula text-frost hover:border-edge-hi hover:text-paper",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>

          {people.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-frost">
              Nobody matches that. Try a broader search — the directory holds{" "}
              {total} member
              {total === 1 ? "" : "s"}.
            </p>
          ) : (
            <ul className="grid items-start gap-3 lg:grid-cols-2">
              {/* `items-start`: an open profile makes its card tall, and a grid
                  row stretches every card in it to match, which left the closed
                  neighbour hanging over a block of empty panel. */}
              {people.map((person) => (
                <li
                  key={person.id}
                  className="panel flex flex-col rounded-2xl p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleOpened(person.id)}
                      aria-expanded={opened.has(person.id)}
                      aria-label={
                        opened.has(person.id)
                          ? `Hide ${person.display_name}'s profile`
                          : `Show ${person.display_name}'s profile`
                      }
                      className="mt-1 grid size-6 shrink-0 place-items-center rounded-md text-frost transition-colors hover:bg-strata hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform duration-200",
                          opened.has(person.id) && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </button>
                    <Identity person={person} />
                    <StandingAction
                      person={person}
                      busy={busy === person.id}
                      onConnect={() => {
                        setNote("");
                        setComposing(person);
                      }}
                      onAccept={() =>
                        person.connection_id &&
                        act(
                          person.id,
                          () => acceptRequest(person.connection_id!),
                          `Connected with ${person.display_name}.`,
                        )
                      }
                      onWithdraw={() =>
                        person.connection_id &&
                        act(
                          person.id,
                          () => withdrawRequest(person.connection_id!),
                          "Request withdrawn.",
                        )
                      }
                    />
                  </div>

                  {person.headline && (
                    <p className="mt-3 text-[13.5px] leading-relaxed text-frost">
                      {person.headline}
                    </p>
                  )}
                  <Interests tags={person.interests} />

                  {opened.has(person.id) && <ProfilePanel person={person} />}

                  {person.standing === "connected" &&
                    person.modules_completed !== null && (
                      <p className="mt-3 border-t border-edge pt-2.5 text-[12.5px] text-dim tabular-nums">
                        {person.modules_completed} lessons finished
                        <span className="mx-2">·</span>
                        {person.badges_earned} badges
                      </p>
                    )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : tab === "requests" ? (
        <RequestLists network={network} busy={busy} act={act} />
      ) : (
        <ConnectionList network={network} busy={busy} act={act} />
      )}

      {/* The note composer. A request with a sentence on it gets answered; a
          bare one from a stranger does not. */}
      {composing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Connect with ${composing.display_name}`}
          className="fixed inset-0 z-50 grid place-items-center bg-void/80 p-5"
          onClick={(event) => {
            if (event.target === event.currentTarget) setComposing(null);
          }}
        >
          <div className="panel w-full max-w-md rounded-2xl p-5">
            <p className="eyebrow">Connection request</p>
            <h2 className="mt-2 text-[18px] font-semibold text-paper">
              To {composing.display_name}
            </h2>
            {composing.headline && (
              <p className="mt-2 text-[13px] leading-relaxed text-frost">
                {composing.headline}
              </p>
            )}

            <label className="mt-4 block">
              <span className="text-[13px] font-medium text-frost">
                Say why <span className="text-dim">(optional)</span>
              </span>
              <textarea
                ref={noteBox}
                value={note}
                maxLength={500}
                rows={4}
                onChange={(event) => setNote(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setComposing(null);
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey))
                    void submitNote();
                }}
                placeholder="I'm on the entanglement module and stuck on why the Bloch vector vanishes…"
                className="mt-2 w-full resize-none rounded-lg border border-edge bg-strata p-3 text-[13.5px] leading-relaxed text-paper placeholder:text-dim focus:border-edge-hi focus:outline-none"
              />
              <span className="mt-1 block text-right text-[12px] text-dim tabular-nums">
                {note.length}/500
              </span>
            </label>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setComposing(null)}
                className={cn(SMALL, QUIET)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitNote}
                className={cn(SMALL, PRIMARY)}
              >
                Send request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RequestRow({
  record,
  busy,
  children,
}: {
  record: ConnectionRecord;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="panel rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Identity person={record.person} />
        <div className={cn("flex shrink-0 gap-2", busy && "opacity-50")}>
          {children}
        </div>
      </div>
      {record.note && (
        <p className="mt-3 rounded-xl bg-strata px-3.5 py-2.5 text-[13.5px] leading-relaxed text-paper">
          &ldquo;{record.note}&rdquo;
        </p>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-dim">
        <Clock className="size-3.5" aria-hidden />
        {record.outgoing ? "You asked" : "They asked"} ·{" "}
        {when(record.created_at)}
      </p>
    </li>
  );
}

function RequestLists({
  network,
  busy,
  act,
}: {
  network: NetworkResponse | null;
  busy: number | null;
  act: (
    id: number,
    work: () => Promise<unknown>,
    said: string,
  ) => Promise<void>;
}) {
  const incoming = network?.incoming ?? [];
  const outgoing = network?.outgoing ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <p className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-paper">
          Waiting on you
          <span
            className={cn("pill", incoming.length ? "text-warn" : "text-dim")}
          >
            {incoming.length}
          </span>
        </p>
        {incoming.length === 0 ? (
          <p className="text-[14px] text-frost">
            Nobody has asked to connect yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {incoming.map((record) => (
              <RequestRow
                key={record.id}
                record={record}
                busy={busy === record.person.id}
              >
                <button
                  type="button"
                  onClick={() =>
                    act(
                      record.person.id,
                      () => acceptRequest(record.id),
                      `Connected with ${record.person.display_name}.`,
                    )
                  }
                  className={cn(SMALL, GO)}
                >
                  <Check className="size-3.5" />
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() =>
                    act(
                      record.person.id,
                      () => declineRequest(record.id),
                      "Request declined.",
                    )
                  }
                  className={cn(SMALL, STOP)}
                >
                  <X className="size-3.5" />
                  Decline
                </button>
              </RequestRow>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-paper">
          Waiting on them
          <span className="pill text-info">{outgoing.length}</span>
        </p>
        {outgoing.length === 0 ? (
          <p className="text-[14px] text-frost">
            You have not asked anyone yet. The directory is the place to start.
          </p>
        ) : (
          <ul className="space-y-3">
            {outgoing.map((record) => (
              <RequestRow
                key={record.id}
                record={record}
                busy={busy === record.person.id}
              >
                <button
                  type="button"
                  onClick={() =>
                    act(
                      record.person.id,
                      () => withdrawRequest(record.id),
                      "Request withdrawn.",
                    )
                  }
                  className={cn(SMALL, QUIET)}
                >
                  <X className="size-3.5" />
                  Withdraw
                </button>
              </RequestRow>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ConnectionList({
  network,
  busy,
  act,
}: {
  network: NetworkResponse | null;
  busy: number | null;
  act: (
    id: number,
    work: () => Promise<unknown>,
    said: string,
  ) => Promise<void>;
}) {
  const rows = network?.connections ?? [];

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-[14px] text-frost">
        No connections yet. Open the directory and ask someone whose work you
        want to understand — a sentence about where you are stuck goes further
        than a bare request.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {rows.map((record) => (
        <li key={record.id} className="panel rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <Identity person={record.person} />
            <button
              type="button"
              disabled={busy === record.person.id}
              onClick={() =>
                act(
                  record.person.id,
                  () => removeConnection(record.id),
                  "Connection removed.",
                )
              }
              className={cn(SMALL, STOP)}
            >
              Remove
            </button>
          </div>
          {record.person.headline && (
            <p className="mt-3 text-[13.5px] leading-relaxed text-frost">
              {record.person.headline}
            </p>
          )}
          <Interests tags={record.person.interests} />
          <p className="mt-3 border-t border-edge pt-2.5 text-[12.5px] text-dim tabular-nums">
            {record.person.modules_completed ?? 0} lessons finished
            <span className="mx-2">·</span>
            {record.person.badges_earned ?? 0} badges
            <span className="mx-2">·</span>
            Connected {when(record.responded_at ?? record.created_at)}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */

function MyCard({
  card,
  editing,
  onEdit,
  onSaved,
}: {
  card: PersonCard;
  editing: boolean;
  onEdit: (open: boolean) => void;
  onSaved: (next: PersonCard) => void;
}) {
  const [role, setRole] = useState<Role>(card.role);
  const [headline, setHeadline] = useState(card.headline ?? "");
  const [interests, setInterests] = useState(card.interests.join(", "));
  const [mentoring, setMentoring] = useState(card.open_to_mentoring);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setFailed(null);
    try {
      onSaved(
        await updateMyCard({
          /* A professor's role is not the card's to change, so it is not sent. */
          ...(role === "professor" ? {} : { role }),
          headline: headline.trim() || null,
          interests: interests.trim() || null,
          open_to_mentoring: mentoring,
        }),
      );
    } catch (cause: unknown) {
      setFailed(reasonOf(cause, "that could not be saved"));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="panel flex flex-wrap items-start justify-between gap-4 rounded-2xl p-4">
        <div className="min-w-0">
          <p className="eyebrow">Your card</p>
          <div className="mt-2.5">
            <Identity person={card} />
          </div>
          {card.headline ? (
            <p className="mt-3 text-[13.5px] leading-relaxed text-frost">
              {card.headline}
            </p>
          ) : (
            <p className="mt-3 text-[13.5px] leading-relaxed text-dim italic">
              No headline yet — this is the line people read before deciding
              whether to answer.
            </p>
          )}
          <Interests tags={card.interests} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {card.open_to_mentoring && (
            <span className="pill text-teal-300">
              <GraduationCap className="size-3" />
              Open to mentoring
            </span>
          )}
          <button
            type="button"
            onClick={() => onEdit(true)}
            className={cn(SMALL, QUIET)}
          >
            Edit card
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel rounded-2xl p-5">
      <p className="eyebrow">Your card</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-frost">
        This is what the directory searches and what a mentor reads before
        answering.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[13px] font-medium text-frost">Headline</span>
          <input
            value={headline}
            maxLength={140}
            onChange={(event) => setHeadline(event.target.value)}
            placeholder="Second year, working through Grover"
            className="mt-1.5 w-full rounded-lg border border-edge bg-strata px-3 py-2 text-[13.5px] text-paper placeholder:text-dim focus:border-edge-hi focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-[13px] font-medium text-frost">
            Interests <span className="text-dim">· comma separated</span>
          </span>
          <input
            value={interests}
            maxLength={240}
            onChange={(event) => setInterests(event.target.value)}
            placeholder="grover, error correction, qiskit"
            className="mt-1.5 w-full rounded-lg border border-edge bg-strata px-3 py-2 text-[13.5px] text-paper placeholder:text-dim focus:border-edge-hi focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        {role === "professor" ? (
          <p className="flex items-center gap-2 text-[12.5px] text-frost">
            <Chip tone="professor">Professor</Chip>
            set by your teaching account
          </p>
        ) : (
          <div
            className="flex items-center gap-1.5"
            role="group"
            aria-label="Your role"
          >
            {(["student", "mentor"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRole(option)}
                aria-pressed={role === option}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[13px] font-medium capitalize transition-colors",
                  role === option
                    ? "border-photon/50 bg-photon/15 text-photon"
                    : "border-edge bg-strata text-frost hover:border-edge-hi hover:text-paper",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-frost">
          <input
            type="checkbox"
            checked={mentoring}
            onChange={(event) => setMentoring(event.target.checked)}
            className="size-3.5 accent-[var(--color-photon)]"
          />
          Open to mentoring — listed first in the directory
        </label>
      </div>

      {failed && <p className="mt-3 text-[13px] text-bad">{failed}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onEdit(false)}
          className={cn(SMALL, QUIET)}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={cn(SMALL, PRIMARY)}
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Users className="size-3.5" />
          )}
          Save card
        </button>
      </div>
    </div>
  );
}
