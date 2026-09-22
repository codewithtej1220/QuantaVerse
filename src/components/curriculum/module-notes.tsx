"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Film,
  LoaderCircle,
  NotebookText,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { LessonPlayer } from "@/components/curriculum/lesson-video";
import type { LessonVideo } from "@/lib/lessons";
import {
  deleteModuleNote,
  describeSize,
  exampleNotesFor,
  fetchModuleNotes,
  mediumSnapshot,
  noteError,
  subscribeMedium,
  uploadedNoteUrl,
  uploadModuleNote,
  writeMedium,
  type ExampleNotes,
  type LessonMedium,
  type ModuleNotesResponse,
  type UploadedNote,
} from "@/lib/notes";
import { cn } from "@/lib/utils";

/**
 * Theory notes, as an alternative to the lesson videos.
 *
 * A module can have two kinds of notes: the example PDF that ships with the
 * site, and any a professor has uploaded. The shelf at the top of the lessons
 * lists them and picks one; each lesson then shows either its video or that
 * PDF, opened at the lesson's own page where the page is known.
 *
 * Watching or reading is one setting for the whole curriculum, not a toggle per
 * lesson. Someone who would rather read than watch would otherwise switch six
 * lessons, one at a time, on every module.
 */

type Choice = { kind: "example" } | { kind: "uploaded"; id: number };

interface NotesContext {
  slug: string;
  example: ExampleNotes | null;
  uploaded: UploadedNote[];
  signedIn: boolean;
  loading: boolean;
  error: string | null;
  canUpload: boolean;
  uploadHint: string | null;
  maxBytes: number;
  choice: Choice | null;
  choose: (choice: Choice) => void;
  refresh: () => void;
  medium: LessonMedium;
  setMedium: (medium: LessonMedium) => void;
}

const Context = createContext<NotesContext | null>(null);

function useNotes() {
  const context = useContext(Context);
  if (!context) throw new Error("module notes used outside ModuleNotesProvider");
  return context;
}

/* ------------------------------------------------------------------ */
/* The chosen notes, remembered per module                            */

const CHOICE_EVENT = "quantaverse:notes-choice";
const choiceKey = (slug: string) => `quantaverse.notes-choice.${slug}`;

function readChoice(slug: string): string | null {
  try {
    return window.localStorage.getItem(choiceKey(slug));
  } catch {
    return null;
  }
}

function subscribeChoice(listener: () => void) {
  window.addEventListener(CHOICE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHOICE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/* ------------------------------------------------------------------ */

export function ModuleNotesProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const { user, ready } = useAuth();
  const userId = user?.id ?? null;
  const example = exampleNotesFor(slug);

  const medium = useSyncExternalStore(subscribeMedium, mediumSnapshot, () => "video" as const);
  const stored = useSyncExternalStore(
    subscribeChoice,
    () => readChoice(slug),
    () => null,
  );
  /* Kept in memory as well, for browsers that refuse storage. */
  const [picked, setPicked] = useState<string | null>(null);

  /* Uploaded notes need an account. An answer is kept with the module and
     account it was fetched for, so a stale one is never shown against another
     module or another person; within those, the previous list stays on screen
     while a refresh after an upload is on its way. */
  const [generation, setGeneration] = useState(0);
  const owner = userId === null ? null : `${slug}:${userId}`;
  const [result, setResult] = useState<{
    owner: string;
    generation: number;
    data?: ModuleNotesResponse;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!ready || owner === null) return;
    let live = true;
    fetchModuleNotes(slug).then(
      (data) => live && setResult({ owner, generation, data }),
      (error) =>
        live &&
        setResult((previous) => ({
          owner,
          generation,
          /* A failed refresh keeps the list it already had. */
          data: previous?.owner === owner ? previous.data : undefined,
          error: noteError(error, "uploaded notes could not be loaded"),
        })),
    );
    return () => {
      live = false;
    };
  }, [ready, owner, generation, slug]);

  const current = owner !== null && result?.owner === owner ? result : null;
  const data = current?.data ?? null;
  const uploaded = useMemo(() => data?.notes ?? [], [data]);
  const loading = owner !== null && current?.generation !== generation;

  const preference = picked ?? stored;
  const choice = useMemo<Choice | null>(() => {
    if (preference?.startsWith("uploaded:")) {
      const id = Number(preference.slice("uploaded:".length));
      if (uploaded.some((note) => note.id === id)) return { kind: "uploaded", id };
      /* Still loading: wait rather than flash the example and switch back. */
      if (loading) return null;
    }
    if (preference === "example" && example) return { kind: "example" };
    /* No preference: a professor's own notes, newest first, over the example. */
    if (uploaded.length) return { kind: "uploaded", id: uploaded[0].id };
    if (loading) return null;
    return example ? { kind: "example" } : null;
  }, [preference, uploaded, loading, example]);

  const choose = useCallback(
    (next: Choice) => {
      const value = next.kind === "example" ? "example" : `uploaded:${next.id}`;
      setPicked(value);
      try {
        window.localStorage.setItem(choiceKey(slug), value);
        window.dispatchEvent(new Event(CHOICE_EVENT));
      } catch {
        /* Remembered for this visit only. */
      }
    },
    [slug],
  );

  const value: NotesContext = {
    slug,
    example,
    uploaded,
    signedIn: userId !== null,
    loading,
    error: current?.error ?? null,
    canUpload: Boolean(data?.can_upload),
    uploadHint: data?.upload_hint ?? null,
    maxBytes: data?.max_bytes ?? 20 * 1024 * 1024,
    choice,
    choose,
    refresh: () => setGeneration((count) => count + 1),
    medium,
    setMedium: writeMedium,
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/* ------------------------------------------------------------------ */
/* Watch or read                                                       */

function MediumSwitch({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  const { medium, setMedium } = useNotes();
  const options: { value: LessonMedium; label: string; icon: typeof Film }[] = [
    { value: "video", label: "Video", icon: Film },
    { value: "notes", label: "Notes", icon: NotebookText },
  ];
  return (
    <div
      role="group"
      aria-label="Learn from"
      className={cn("inline-flex rounded-lg border border-edge bg-void/60 p-0.5", className)}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const on = medium === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            onClick={() => setMedium(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-mono tracking-[0.1em] uppercase transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
              size === "sm" ? "px-2.5 py-1 text-[10.5px]" : "px-3 py-1.5 text-[11px]",
              on ? "bg-photon text-void" : "text-frost hover:text-paper",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The shelf                                                           */

function formatDate(value: string) {
  const date = new Date(value.endsWith("Z") || value.includes("+") ? value : `${value}Z`);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function openUploaded(id: number, onError: (message: string) => void) {
  /* Opened before the fetch, while the click still counts as the user's, or a
     popup blocker would stop the tab once the file arrives. */
  const tab = window.open("about:blank", "_blank");
  try {
    const url = await uploadedNoteUrl(id);
    if (tab) tab.location.href = url;
    else window.location.assign(url);
  } catch (error) {
    tab?.close();
    onError(noteError(error, "those notes could not be opened"));
  }
}

async function downloadUploaded(note: UploadedNote, onError: (message: string) => void) {
  try {
    const url = await uploadedNoteUrl(note.id);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${note.title}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
  } catch (error) {
    onError(noteError(error, "those notes could not be downloaded"));
  }
}

const actionClass =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10.5px] tracking-[0.1em] text-frost uppercase transition-colors hover:bg-strata hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon";

export function NotesShelf() {
  const notes = useNotes();
  const { example, uploaded, choice, choose, signedIn, loading, error } = notes;
  const [problem, setProblem] = useState<string | null>(null);
  const group = useId();

  if (!example && !uploaded.length && !notes.canUpload) return null;

  const remove = async (note: UploadedNote) => {
    if (!window.confirm(`Delete “${note.title}”? Students will no longer see it.`)) return;
    setProblem(null);
    try {
      await deleteModuleNote(note.id);
      notes.refresh();
    } catch (caught) {
      setProblem(noteError(caught, "those notes could not be deleted"));
    }
  };

  return (
    <section
      aria-labelledby={`${group}-title`}
      data-tour="module-notes"
      className="panel mt-8 rounded-2xl p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="eyebrow flex items-center gap-2 text-photon">
            <FileText className="size-3.5" aria-hidden />
            Theory notes · PDF
          </p>
          <h2 id={`${group}-title`} className="mt-2 text-[19px] font-medium text-paper">
            Read the notes instead of watching
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-frost">
            Switch every lesson below from its video to the notes: the theory and every formula,
            opened at the page for that lesson.
          </p>
        </div>
        <MediumSwitch />
      </div>

      <div
        role="radiogroup"
        aria-label="Which notes the lessons show"
        className="mt-5 flex flex-col gap-2"
      >
        {uploaded.map((note) => {
          const on = choice?.kind === "uploaded" && choice.id === note.id;
          const by = [note.uploader.display_name, note.uploader.institution]
            .filter(Boolean)
            .join(", ");
          return (
            <div
              key={note.id}
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-3.5 py-3 transition-colors",
                on ? "border-photon/70 bg-photon/[0.07]" : "border-edge",
              )}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name={`${group}-choice`}
                  checked={on}
                  onChange={() => choose({ kind: "uploaded", id: note.id })}
                  className="mt-1 size-3.5 shrink-0 accent-photon"
                />
                <span className="min-w-0">
                  <span className="block text-[14.5px] leading-snug text-paper">{note.title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-frost">
                    Uploaded by {by} · {formatDate(note.uploaded_at)}
                    {note.pages ? ` · ${note.pages} pages` : ""} · {describeSize(note.size_bytes)}
                  </span>
                  {note.description && (
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-dim">
                      {note.description}
                    </span>
                  )}
                </span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={actionClass}
                  onClick={() => void openUploaded(note.id, setProblem)}
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Open
                </button>
                <button
                  type="button"
                  className={actionClass}
                  onClick={() => void downloadUploaded(note, setProblem)}
                >
                  <Download className="size-3.5" aria-hidden />
                  Save
                </button>
                {note.mine && (
                  <button
                    type="button"
                    className={cn(actionClass, "hover:text-collapse")}
                    onClick={() => void remove(note)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {example && (
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-3.5 py-3 transition-colors",
              choice?.kind === "example" ? "border-photon/70 bg-photon/[0.07]" : "border-edge",
            )}
          >
            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
              <input
                type="radio"
                name={`${group}-choice`}
                checked={choice?.kind === "example"}
                onChange={() => choose({ kind: "example" })}
                className="mt-1 size-3.5 shrink-0 accent-photon"
              />
              <span className="min-w-0">
                <span className="block text-[14.5px] leading-snug text-paper">
                  Example notes
                  <span className="ml-2 rounded border border-edge-hi px-1.5 py-px align-[1px] font-mono text-[9.5px] tracking-[0.12em] text-dim uppercase">
                    QuantaVerse
                  </span>
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-frost">
                  Theory and formulas for every lesson · {example.pages} pages · {example.formulas}{" "}
                  key formulas, with a formula sheet on page {example.sheetPage} ·{" "}
                  {describeSize(example.bytes)}
                </span>
              </span>
            </label>
            <div className="flex items-center gap-1">
              <a className={actionClass} href={example.href} target="_blank" rel="noopener">
                <ExternalLink className="size-3.5" aria-hidden />
                Open
              </a>
              <a className={actionClass} href={example.href} download>
                <Download className="size-3.5" aria-hidden />
                Save
              </a>
            </div>
          </div>
        )}
      </div>

      {!signedIn && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
          <Link
            href="/login"
            className="text-frost underline decoration-edge-hi underline-offset-2 hover:text-paper"
          >
            Sign in
          </Link>{" "}
          to see notes your professors have uploaded for this module.
        </p>
      )}
      {signedIn && loading && !uploaded.length && (
        <p className="mt-3 flex items-center gap-2 text-[12.5px] text-dim">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          Looking for notes from your professors…
        </p>
      )}
      {/* Why there are none, for a reader who expected their professor's. */}
      {signedIn && !loading && !uploaded.length && !notes.canUpload && notes.uploadHint && (
        <p className="mt-3 text-[12.5px] text-dim">
          Nothing uploaded for this module yet. {notes.uploadHint}
        </p>
      )}
      {error && <p className="mt-3 text-[12.5px] text-collapse">{error}</p>}
      {problem && <p className="mt-3 text-[12.5px] text-collapse">{problem}</p>}

      {notes.canUpload && <UploadForm />}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Uploading, for professors                                           */

function titleFromFile(name: string) {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function UploadForm() {
  const { slug, maxBytes, refresh, choose } = useNotes();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "done"; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  const pick = (next: File | null) => {
    setMessage(null);
    if (!next) {
      setFile(null);
      return;
    }
    const looksPdf = next.type === "application/pdf" || /\.pdf$/i.test(next.name);
    if (!looksPdf) {
      setFile(null);
      setMessage({ tone: "error", text: "Choose a PDF. Export or print the notes to PDF first." });
      return;
    }
    if (next.size > maxBytes) {
      setFile(null);
      setMessage({
        tone: "error",
        text: `That file is ${describeSize(next.size)}; the limit is ${describeSize(maxBytes)}.`,
      });
      return;
    }
    setFile(next);
    if (!title.trim()) setTitle(titleFromFile(next.name));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !title.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const note = await uploadModuleNote(slug, file, {
        title: title.trim(),
        description: description.trim() || undefined,
      });
      choose({ kind: "uploaded", id: note.id });
      refresh();
      setMessage({
        tone: "done",
        text: `Uploaded “${note.title}”. Students on this module can read it now.`,
      });
      setFile(null);
      setTitle("");
      setDescription("");
      if (input.current) input.current.value = "";
      setOpen(false);
    } catch (error) {
      setMessage({ tone: "error", text: noteError(error, "the upload did not go through") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 border-t border-edge pt-4">
      {!open ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setMessage(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-edge-hi px-3.5 py-2 text-[13px] text-paper transition-colors hover:border-photon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
          >
            <Upload className="size-3.5" aria-hidden />
            Upload notes for this module
          </button>
          <span className="text-[12px] text-dim">
            PDF, up to {describeSize(maxBytes)}. Everyone signed in sees it on this module&rsquo;s
            page.
          </span>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] tracking-[0.14em] text-frost uppercase">
              Upload notes · PDF up to {describeSize(maxBytes)}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the upload form"
              className="rounded-md p-1 text-dim transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-photon"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <label className="flex flex-col gap-1.5" htmlFor={`${id}-file`}>
            <span className="text-[12.5px] text-frost">File</span>
            <input
              ref={input}
              id={`${id}-file`}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => pick(event.target.files?.[0] ?? null)}
              className="block w-full text-[13px] text-frost file:mr-3 file:rounded-md file:border file:border-edge-hi file:bg-strata file:px-3 file:py-1.5 file:text-[12.5px] file:text-paper hover:file:border-photon"
            />
          </label>
          {file && (
            <p className="text-[12px] text-dim">
              {file.name} · {describeSize(file.size)}
            </p>
          )}

          <label className="flex flex-col gap-1.5" htmlFor={`${id}-title`}>
            <span className="text-[12.5px] text-frost">Title</span>
            <input
              id={`${id}-title`}
              value={title}
              maxLength={140}
              required
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Week 3 lecture notes: the Bloch sphere"
              className="rounded-lg border border-edge bg-void/60 px-3 py-2 text-[14px] text-paper placeholder:text-dim focus-visible:border-photon focus-visible:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5" htmlFor={`${id}-description`}>
            <span className="text-[12.5px] text-frost">
              Description <span className="text-dim">(optional)</span>
            </span>
            <input
              id={`${id}-description`}
              value={description}
              maxLength={300}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Covers lessons 1 to 3, with worked examples"
              className="rounded-lg border border-edge bg-void/60 px-3 py-2 text-[14px] text-paper placeholder:text-dim focus-visible:border-photon focus-visible:outline-none"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!file || !title.trim() || busy}
              className="inline-flex h-10 items-center gap-2 bg-photon px-4 text-[13px] font-medium text-void transition-colors hover:bg-photon-hi disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-photon"
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )}
              {busy ? `Uploading ${file ? describeSize(file.size) : ""}…` : "Upload"}
            </button>
          </div>
        </form>
      )}
      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={cn(
            "mt-3 text-[12.5px]",
            message.tone === "error" ? "text-collapse" : "text-photon",
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* In each lesson                                                      */

/* The page thumbnails take half of a lesson-width viewer, so they start closed,
   and the page fits the width so a line of maths is readable without zooming.
   Viewers that do not know these options ignore them. */
const VIEWER_OPTIONS = "navpanes=0&view=FitH";

/* Whether this browser shows PDFs inline at all. Phones mostly do not. */
const noSubscription = () => () => {};
function usePdfViewer() {
  return useSyncExternalStore(
    noSubscription,
    () =>
      typeof navigator !== "undefined" && "pdfViewerEnabled" in navigator
        ? navigator.pdfViewerEnabled
        : true,
    () => true,
  );
}

function useUploadedUrl(id: number | null) {
  const [state, setState] = useState<{ id: number; url?: string; error?: string } | null>(null);
  useEffect(() => {
    if (id === null) return;
    let live = true;
    uploadedNoteUrl(id).then(
      (url) => live && setState({ id, url }),
      (error) => live && setState({ id, error: noteError(error, "those notes did not load") }),
    );
    return () => {
      live = false;
    };
  }, [id]);
  return id !== null && state?.id === id ? state : null;
}

export function LessonMedia({
  video,
  title,
  index,
  optional = false,
}: {
  video?: LessonVideo;
  title: string;
  index: number;
  /** A lesson that may simply have no video: say nothing about one, and show
      the notes in its place only for a reader who chose to read. */
  optional?: boolean;
}) {
  const { medium, setMedium, example, uploaded, choice } = useNotes();
  const hasNotes = Boolean(example || uploaded.length);

  if (optional && !video) {
    if (!hasNotes || medium !== "notes") return null;
    return (
      <div className="mt-5">
        <div className="flex justify-end">
          <MediumSwitch size="sm" />
        </div>
        <NotesViewer choice={choice} index={index} lessonTitle={title} />
      </div>
    );
  }

  if (!hasNotes) return <LessonPlayer video={video} title={title} />;

  return (
    <div className="mt-5">
      <div className="flex justify-end">
        <MediumSwitch size="sm" />
      </div>
      {medium === "video" ? (
        <LessonPlayer
          video={video}
          title={title}
          emptyAction={
            <button
              type="button"
              onClick={() => setMedium("notes")}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-edge-hi px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] text-paper uppercase transition-colors hover:border-photon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
            >
              <NotebookText className="size-3.5" aria-hidden />
              Read the notes instead
            </button>
          }
        />
      ) : (
        <NotesViewer choice={choice} index={index} lessonTitle={title} />
      )}
    </div>
  );
}

function NotesViewer({
  choice,
  index,
  lessonTitle,
}: {
  choice: Choice | null;
  index: number;
  lessonTitle: string;
}) {
  const { example, uploaded } = useNotes();
  const inline = usePdfViewer();
  const note =
    choice?.kind === "uploaded" ? (uploaded.find((entry) => entry.id === choice.id) ?? null) : null;
  const blob = useUploadedUrl(note ? note.id : null);
  const [problem, setProblem] = useState<string | null>(null);

  const frame = "mt-3 w-full overflow-hidden rounded-xl border border-edge bg-void";

  if (!choice) {
    return (
      <div
        className={cn(frame, "flex h-48 items-center justify-center gap-2 text-[13px] text-dim")}
      >
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading the notes…
      </div>
    );
  }

  let src: string | null = null;
  let page: number | null = null;
  let name: string;
  let caption: ReactNode;
  let actions: ReactNode;

  if (choice.kind === "example" && example) {
    page = example.lessonPages[index] ?? 1;
    src = `${example.href}#${VIEWER_OPTIONS}&page=${page}`;
    name = `${lessonTitle} — example notes, page ${page}`;
    caption = (
      <>
        Example notes · lesson {index + 1} starts on page {page} of {example.pages} · formula sheet
        on page {example.sheetPage}
      </>
    );
    actions = (
      <>
        <a
          className={actionClass}
          href={`${example.href}#page=${page}`}
          target="_blank"
          rel="noopener"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Open
        </a>
        <a className={actionClass} href={example.href} download>
          <Download className="size-3.5" aria-hidden />
          Save
        </a>
      </>
    );
  } else if (note) {
    src = blob?.url ? `${blob.url}#${VIEWER_OPTIONS}` : null;
    name = `${note.title}, uploaded by ${note.uploader.display_name}`;
    caption = (
      <>
        {note.title} · uploaded by {note.uploader.display_name}
        {note.pages ? ` · ${note.pages} pages` : ""}
      </>
    );
    actions = (
      <>
        <button
          type="button"
          className={actionClass}
          onClick={() => void openUploaded(note.id, setProblem)}
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Open
        </button>
        <button
          type="button"
          className={actionClass}
          onClick={() => void downloadUploaded(note, setProblem)}
        >
          <Download className="size-3.5" aria-hidden />
          Save
        </button>
      </>
    );
    if (blob?.error) {
      return (
        <div
          className={cn(
            frame,
            "flex h-48 flex-col items-center justify-center gap-2 px-6 text-center",
          )}
        >
          <p className="text-[13px] text-collapse">{blob.error}</p>
          <p className="text-[12.5px] text-dim">
            Pick other notes above, or switch back to the video.
          </p>
        </div>
      );
    }
  } else {
    return null;
  }

  return (
    <figure className="m-0">
      {inline ? (
        src ? (
          <iframe
            key={src}
            src={src}
            title={name}
            loading="lazy"
            className={cn(frame, "block h-[min(78vh,56rem)] min-h-[26rem]")}
          />
        ) : (
          <div
            className={cn(
              frame,
              "flex h-48 items-center justify-center gap-2 text-[13px] text-dim",
            )}
          >
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Loading the notes…
          </div>
        )
      ) : (
        /* No inline PDF viewer here, which is most phones: offer the file. */
        <div
          className={cn(
            frame,
            "flex flex-col items-center justify-center gap-3 px-6 py-8 text-center",
          )}
        >
          <NotebookText className="size-6 text-photon" aria-hidden />
          <p className="max-w-sm text-[13.5px] leading-relaxed text-frost">
            This browser opens PDFs in their own viewer rather than inside the page.
            {page ? ` This lesson starts on page ${page}.` : ""}
          </p>
          <div className="flex items-center gap-1">{actions}</div>
        </div>
      )}
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-[12.5px] text-dim">{caption}</span>
        {inline && <span className="flex items-center gap-1">{actions}</span>}
      </figcaption>
      {problem && <p className="mt-1 text-[12.5px] text-collapse">{problem}</p>}
    </figure>
  );
}
