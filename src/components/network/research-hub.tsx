"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
type Filter = "all" | "mentor" | "student" | "open";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "open", label: "Open to mentoring" },
  { id: "mentor", label: "Mentors" },
  { id: "student", label: "Students" },
];

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function reasonOf(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Chip({ children, tone }: { children: React.ReactNode; tone?: "photon" | "warn" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10.5px] tracking-[0.1em] uppercase",
        tone === "photon" && "border-photon/50 text-photon",
        tone === "warn" && "border-edge-hi text-dim",
        !tone && "border-edge text-frost",
      )}
    >
      {children}
    </span>
  );
}

function Avatar({ person }: { person: PersonCard }) {
  /* Initials rather than a photograph. Nobody has uploaded one, and a grid of
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
        "grid size-10 shrink-0 place-items-center border font-mono text-[13px]",
        person.role === "mentor"
          ? "border-photon/40 bg-photon/10 text-photon"
          : "border-edge bg-strata text-frost",
      )}
    >
      {initials || "?"}
    </span>
  );
}

function Identity({ person }: { person: PersonCard }) {
  return (
    <div className="flex min-w-0 gap-3">
      <Avatar person={person} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[15px] font-medium text-paper">
            {person.display_name}
          </span>
          {person.role === "mentor" && <Chip tone="photon">mentor</Chip>}
          {/* Said plainly on the card. A seeded fixture that looks like a real
              academic is the one thing this directory must not do. */}
          {person.is_demo && <Chip tone="warn">example profile</Chip>}
        </p>
        <p className="mt-0.5 truncate font-mono text-[11.5px] text-dim">
          @{person.handle}
          {person.institution && <span className="text-frost"> · {person.institution}</span>}
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
function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">{label}</p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-frost">{children}</p>
    </div>
  );
}

function ProfilePanel({ person }: { person: PersonCard }) {
  const anything =
    person.position || person.education || person.focus || person.mentoring || person.availability;

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-edge pt-4">
      {person.position && <Detail label="Position">{person.position}</Detail>}
      {person.education && <Detail label="Academic background">{person.education}</Detail>}
      {person.focus && <Detail label="Research focus">{person.focus}</Detail>}
      {person.mentoring && <Detail label="Mentoring">{person.mentoring}</Detail>}
      {person.availability && <Detail label="Availability">{person.availability}</Detail>}

      {!anything && (
        <p className="text-[13px] leading-relaxed text-dim">
          This member has not filled in a full profile yet.
        </p>
      )}

      {/* Said again, in a sentence, because the chip on the card can be cropped
          out of a screenshot and this is the claim that must not travel. */}
      {person.is_demo && (
        <p className="border-l-2 border-collapse pl-3 text-[12.5px] leading-relaxed text-dim">
          This is an example profile shipped with the instance so the directory has something to
          show. The person is invented and the account cannot be signed into.
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
  const base =
    "flex shrink-0 items-center gap-1.5 border px-3 py-1.5 font-mono text-[11.5px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon disabled:cursor-not-allowed disabled:opacity-50";

  if (person.standing === "self") {
    return <span className="shrink-0 font-mono text-[11.5px] text-dim">this is you</span>;
  }

  if (person.standing === "connected") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11.5px] tracking-[0.1em] text-photon uppercase">
        <Check className="size-3.5" />
        connected
      </span>
    );
  }

  if (person.standing === "awaiting_you") {
    return (
      <button type="button" onClick={onAccept} disabled={busy} className={cn(base, "border-photon bg-photon/10 text-photon hover:bg-photon/20")}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        accept
      </button>
    );
  }

  if (person.standing === "awaiting_them" || person.standing === "declined") {
    /* A declined request is shown to the person who asked as "waiting", not as
       a rebuff. They can withdraw it; they are not handed a rejection notice
       to reread. */
    return (
      <button type="button" onClick={onWithdraw} disabled={busy} className={cn(base, "border-edge text-frost hover:border-edge-hi hover:text-paper")}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Clock className="size-3.5" />}
        waiting
      </button>
    );
  }

  return (
    <button type="button" onClick={onConnect} disabled={busy} className={cn(base, "border-photon text-photon hover:bg-photon/10")}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
      connect
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
  /* One row open at a time. Several open at once turns a scannable list into a
     wall of prose, which is the thing the disclosure exists to prevent. */
  const [opened, setOpened] = useState<number | null>(null);
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
      role: filter === "mentor" || filter === "student" ? (filter as Role) : null,
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
    await act(target.id, () => sendRequest(target.handle, note), `Request sent to ${target.display_name}.`);
    setNote("");
  };

  const counts = useMemo(
    () => ({
      requests: (network?.incoming.length ?? 0) + (network?.outgoing.length ?? 0),
      connections: network?.connections.length ?? 0,
      incoming: network?.pending_incoming ?? 0,
    }),
    [network],
  );

  /* ---------------------------------------------------------------- */

  if (!ready) {
    return (
      <p className="flex items-center gap-2 font-mono text-[13px] text-frost">
        <Loader2 className="size-4 animate-spin" />
        checking your session
      </p>
    );
  }

  if (!user) {
    return (
      <div className="panel max-w-xl rounded-2xl p-6">
        <p className="eyebrow">Members only</p>
        <h2 className="display-2 mt-3 text-paper">Sign in to reach a mentor</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-frost">
          The directory lists real people and their institutions, so it is not readable
          without an account — and a connection request has to come from someone.
        </p>
        <p className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="bg-photon px-5 py-2.5 font-mono text-[12px] tracking-[0.12em] text-void uppercase hover:bg-photon-hi"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="border border-edge px-5 py-2.5 font-mono text-[12px] tracking-[0.12em] text-frost uppercase hover:border-paper hover:text-paper"
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
      {card && <MyCard card={card} editing={editing} onEdit={setEditing} onSaved={(next) => { setCard(next); setEditing(false); void refreshDirectory(); }} />}

      {/* Tabs. */}
      <div className="flex flex-wrap items-center gap-1 border-b border-edge">
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
              "-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 font-mono text-[12px] tracking-[0.12em] uppercase transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
              tab === id
                ? "border-photon text-photon"
                : "border-transparent text-frost hover:text-paper",
            )}
          >
            {label}
            <span className="font-mono text-[11px] text-dim tabular-nums">{count}</span>
            {id === "requests" && counts.incoming > 0 && (
              <span className="size-1.5 rounded-full bg-photon" aria-label="new requests" />
            )}
          </button>
        ))}
      </div>

      {notice && (
        <p className="flex items-center gap-2 border border-photon/40 bg-photon/5 px-3.5 py-2.5 font-mono text-[12px] text-photon">
          <Check className="size-3.5 shrink-0" />
          {notice}
        </p>
      )}
      {error && (
        <p className="flex items-center gap-2 border border-collapse/50 px-3.5 py-2.5 font-mono text-[12px] text-collapse">
          <AlertTriangle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {loading ? (
        <p className="flex items-center gap-2 py-8 font-mono text-[13px] text-frost">
          <Loader2 className="size-4 animate-spin" />
          reading the directory
        </p>
      ) : tab === "directory" ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative flex min-w-[16rem] flex-1 items-center">
              <Search className="pointer-events-none absolute left-3 size-3.5 text-dim" aria-hidden />
              <span className="sr-only">Search the directory</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="name, institution, or an interest — try “grover”"
                className="w-full border border-edge bg-strata py-2.5 pr-3 pl-9 font-mono text-[13px] text-paper placeholder:text-dim focus:border-edge-hi focus:outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter the directory">
              {FILTERS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setFilter(entry.id)}
                  aria-pressed={filter === entry.id}
                  className={cn(
                    "border px-2.5 py-1.5 font-mono text-[11.5px] tracking-[0.1em] uppercase transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                    filter === entry.id
                      ? "border-photon bg-photon/10 text-photon"
                      : "border-edge text-frost hover:border-edge-hi hover:text-paper",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>

          {people.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-frost">
              Nobody matches that. Try a broader search — the directory holds {total} member
              {total === 1 ? "" : "s"}.
            </p>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {people.map((person) => (
                <li key={person.id} className="panel flex flex-col rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setOpened((prev) => (prev === person.id ? null : person.id))}
                      aria-expanded={opened === person.id}
                      aria-label={
                        opened === person.id
                          ? `Hide ${person.display_name}'s profile`
                          : `Show ${person.display_name}'s profile`
                      }
                      className="mt-1 grid size-6 shrink-0 place-items-center rounded-md text-frost transition-colors hover:bg-strata hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform duration-200",
                          opened === person.id && "rotate-180",
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
                        act(person.id, () => acceptRequest(person.connection_id!), `Connected with ${person.display_name}.`)
                      }
                      onWithdraw={() =>
                        person.connection_id &&
                        act(person.id, () => withdrawRequest(person.connection_id!), "Request withdrawn.")
                      }
                    />
                  </div>

                  {person.headline && (
                    <p className="mt-3 text-[13.5px] leading-relaxed text-frost">{person.headline}</p>
                  )}
                  <Interests tags={person.interests} />

                  {opened === person.id && <ProfilePanel person={person} />}

                  {person.standing === "connected" && person.modules_completed !== null && (
                    <p className="mt-3 border-t border-edge pt-2.5 font-mono text-[11.5px] text-dim tabular-nums">
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
            <h2 className="mt-2 text-[18px] font-medium text-paper">
              to {composing.display_name}
            </h2>
            {composing.headline && (
              <p className="mt-2 text-[13px] leading-relaxed text-frost">{composing.headline}</p>
            )}

            <label className="mt-4 block">
              <span className="font-mono text-[11.5px] tracking-[0.12em] text-frost uppercase">
                Say why (optional)
              </span>
              <textarea
                ref={noteBox}
                value={note}
                maxLength={500}
                rows={4}
                onChange={(event) => setNote(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setComposing(null);
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submitNote();
                }}
                placeholder="I'm on the entanglement module and stuck on why the Bloch vector vanishes…"
                className="mt-2 w-full resize-none border border-edge bg-strata p-3 text-[13.5px] leading-relaxed text-paper placeholder:text-dim focus:border-edge-hi focus:outline-none"
              />
              <span className="mt-1 block text-right font-mono text-[11px] text-dim tabular-nums">
                {note.length}/500
              </span>
            </label>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setComposing(null)}
                className="border border-edge px-4 py-2 font-mono text-[12px] tracking-[0.1em] text-frost uppercase hover:border-paper hover:text-paper"
              >
                cancel
              </button>
              <button
                type="button"
                onClick={submitNote}
                className="bg-photon px-4 py-2 font-mono text-[12px] font-semibold tracking-[0.1em] text-void uppercase hover:bg-photon-hi"
              >
                send request
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
    <li className="panel rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Identity person={record.person} />
        <div className={cn("flex shrink-0 gap-2", busy && "opacity-50")}>{children}</div>
      </div>
      {record.note && (
        <p className="mt-3 border-l-2 border-edge-hi pl-3 text-[13.5px] leading-relaxed text-frost italic">
          {record.note}
        </p>
      )}
      <p className="mt-3 font-mono text-[11px] text-dim">
        {record.outgoing ? "you asked" : "they asked"} · {when(record.created_at)}
      </p>
    </li>
  );
}

const SMALL =
  "flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[11.5px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon disabled:cursor-not-allowed disabled:opacity-50";

function RequestLists({
  network,
  busy,
  act,
}: {
  network: NetworkResponse | null;
  busy: number | null;
  act: (id: number, work: () => Promise<unknown>, said: string) => Promise<void>;
}) {
  const incoming = network?.incoming ?? [];
  const outgoing = network?.outgoing ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <p className="eyebrow mb-3">Waiting on you · {incoming.length}</p>
        {incoming.length === 0 ? (
          <p className="text-[14px] text-frost">Nobody has asked to connect yet.</p>
        ) : (
          <ul className="space-y-3">
            {incoming.map((record) => (
              <RequestRow key={record.id} record={record} busy={busy === record.person.id}>
                <button
                  type="button"
                  onClick={() =>
                    act(record.person.id, () => acceptRequest(record.id), `Connected with ${record.person.display_name}.`)
                  }
                  className={cn(SMALL, "border-photon bg-photon/10 text-photon hover:bg-photon/20")}
                >
                  <Check className="size-3.5" />
                  accept
                </button>
                <button
                  type="button"
                  onClick={() => act(record.person.id, () => declineRequest(record.id), "Request declined.")}
                  className={cn(SMALL, "border-edge text-frost hover:border-paper hover:text-paper")}
                >
                  <X className="size-3.5" />
                  decline
                </button>
              </RequestRow>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="eyebrow mb-3">Waiting on them · {outgoing.length}</p>
        {outgoing.length === 0 ? (
          <p className="text-[14px] text-frost">
            You have not asked anyone yet. The directory is the place to start.
          </p>
        ) : (
          <ul className="space-y-3">
            {outgoing.map((record) => (
              <RequestRow key={record.id} record={record} busy={busy === record.person.id}>
                <button
                  type="button"
                  onClick={() => act(record.person.id, () => withdrawRequest(record.id), "Request withdrawn.")}
                  className={cn(SMALL, "border-edge text-frost hover:border-paper hover:text-paper")}
                >
                  <X className="size-3.5" />
                  withdraw
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
  act: (id: number, work: () => Promise<unknown>, said: string) => Promise<void>;
}) {
  const rows = network?.connections ?? [];

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-[14px] text-frost">
        No connections yet. Open the directory and ask someone whose work you want to
        understand — a sentence about where you are stuck goes further than a bare request.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {rows.map((record) => (
        <li key={record.id} className="panel rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <Identity person={record.person} />
            <button
              type="button"
              disabled={busy === record.person.id}
              onClick={() =>
                act(record.person.id, () => removeConnection(record.id), "Connection removed.")
              }
              className={cn(SMALL, "border-edge text-dim hover:border-collapse hover:text-collapse")}
            >
              remove
            </button>
          </div>
          {record.person.headline && (
            <p className="mt-3 text-[13.5px] leading-relaxed text-frost">
              {record.person.headline}
            </p>
          )}
          <Interests tags={record.person.interests} />
          <p className="mt-3 border-t border-edge pt-2.5 font-mono text-[11.5px] text-dim tabular-nums">
            {record.person.modules_completed ?? 0} lessons finished
            <span className="mx-2">·</span>
            {record.person.badges_earned ?? 0} badges
            <span className="mx-2">·</span>
            connected {when(record.responded_at ?? record.created_at)}
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
          role,
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
            <p className="mt-3 text-[13.5px] leading-relaxed text-frost">{card.headline}</p>
          ) : (
            <p className="mt-3 text-[13.5px] leading-relaxed text-dim italic">
              No headline yet — this is the line people read before deciding whether to answer.
            </p>
          )}
          <Interests tags={card.interests} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {card.open_to_mentoring && (
            <span className="flex items-center gap-1.5 font-mono text-[11.5px] tracking-[0.1em] text-photon uppercase">
              <GraduationCap className="size-3.5" />
              open to mentoring
            </span>
          )}
          <button
            type="button"
            onClick={() => onEdit(true)}
            className={cn(SMALL, "border-edge text-frost hover:border-paper hover:text-paper")}
          >
            edit card
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel rounded-2xl p-5">
      <p className="eyebrow">Your card</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-frost">
        This is what the directory searches and what a mentor reads before answering.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[11.5px] tracking-[0.12em] text-frost uppercase">
            Headline
          </span>
          <input
            value={headline}
            maxLength={140}
            onChange={(event) => setHeadline(event.target.value)}
            placeholder="Second year, working through Grover"
            className="mt-1.5 w-full border border-edge bg-strata px-3 py-2 text-[13.5px] text-paper placeholder:text-dim focus:border-edge-hi focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="font-mono text-[11.5px] tracking-[0.12em] text-frost uppercase">
            Interests · comma separated
          </span>
          <input
            value={interests}
            maxLength={240}
            onChange={(event) => setInterests(event.target.value)}
            placeholder="grover, error correction, qiskit"
            className="mt-1.5 w-full border border-edge bg-strata px-3 py-2 text-[13.5px] text-paper placeholder:text-dim focus:border-edge-hi focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-1.5" role="group" aria-label="Your role">
          {(["student", "mentor"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRole(option)}
              aria-pressed={role === option}
              className={cn(
                "border px-3 py-1.5 font-mono text-[11.5px] tracking-[0.1em] uppercase transition-colors",
                role === option
                  ? "border-photon bg-photon/10 text-photon"
                  : "border-edge text-frost hover:border-edge-hi hover:text-paper",
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <label className="flex cursor-pointer items-center gap-2 font-mono text-[12px] text-frost">
          <input
            type="checkbox"
            checked={mentoring}
            onChange={(event) => setMentoring(event.target.checked)}
            className="size-3.5 accent-[var(--color-photon)]"
          />
          open to mentoring — listed first in the directory
        </label>
      </div>

      {failed && (
        <p className="mt-3 font-mono text-[12px] text-collapse">{failed}</p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onEdit(false)}
          className={cn(SMALL, "border-edge text-frost hover:border-paper hover:text-paper")}
        >
          cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-photon px-4 py-2 font-mono text-[12px] font-semibold tracking-[0.1em] text-void uppercase hover:bg-photon-hi disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Users className="size-3.5" />}
          save card
        </button>
      </div>
    </div>
  );
}
