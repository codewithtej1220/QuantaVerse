import { ApiError } from "@/lib/api";
import { authed, authedResponse } from "@/lib/auth";

import manifest from "./example-notes.json";

/**
 * Module notes: PDFs to learn from instead of a video.
 *
 * Two kinds. The example notes ship with the site, one per module, built by
 * `npm run notes` from `scripts/notes/`: theory and every formula, a page per
 * lesson, a formula sheet at the end. The page each lesson starts on is
 * measured when the PDF is printed and recorded in `example-notes.json`, so a
 * lesson can open the notes at its own page.
 *
 * The other kind is uploaded by professors through the API. Those need an
 * account to list and to read, so they are fetched with the session's token
 * and shown from a blob URL — an iframe cannot send a bearer token itself.
 */

export interface ExampleNotes {
  slug: string;
  title: string;
  /** A public path, under /notes. */
  href: string;
  pages: number;
  bytes: number;
  /** The page each lesson starts on, by lesson index. */
  lessonPages: number[];
  sheetPage: number;
  /** Key formulas on the formula sheet. */
  formulas: number;
}

const EXAMPLES = manifest as Record<string, ExampleNotes>;

export function exampleNotesFor(slug: string): ExampleNotes | null {
  return EXAMPLES[slug] ?? null;
}

/* ------------------------------------------------------------------ */

export interface NoteUploader {
  display_name: string;
  handle: string;
  institution: string | null;
  position: string | null;
}

export interface UploadedNote {
  id: number;
  module_slug: string;
  title: string;
  description: string | null;
  original_name: string | null;
  size_bytes: number;
  pages: number | null;
  uploaded_at: string;
  uploader: NoteUploader;
  mine: boolean;
}

export interface ModuleNotesResponse {
  module_slug: string;
  notes: UploadedNote[];
  can_upload: boolean;
  upload_hint: string | null;
  max_bytes: number;
}

export function fetchModuleNotes(slug: string) {
  return authed<ModuleNotesResponse>(`/api/notes/${encodeURIComponent(slug)}`);
}

export async function uploadModuleNote(
  slug: string,
  file: File,
  details: { title: string; description?: string },
) {
  const query = new URLSearchParams({ title: details.title, filename: file.name });
  if (details.description) query.set("description", details.description);
  const response = await authedResponse(
    `/api/notes/${encodeURIComponent(slug)}?${query.toString()}`,
    { method: "POST", body: file, headers: { "Content-Type": "application/pdf" } },
  );
  return (await response.json()) as UploadedNote;
}

export async function deleteModuleNote(id: number) {
  await authedResponse(`/api/notes/file/${id}`, { method: "DELETE" });
  const cached = blobs.get(id);
  blobs.delete(id);
  if (cached) void cached.then((url) => URL.revokeObjectURL(url)).catch(() => {});
}

/* ------------------------------------------------------------------ */

const blobs = new Map<number, Promise<string>>();

/**
 * An uploaded PDF as a URL the page can put in an iframe or a link.
 *
 * Fetched once per note per visit and kept: every lesson on the page shows the
 * same file, and six requests for one PDF would be five too many. The bytes are
 * wrapped as application/pdf whatever the server said, so the browser only ever
 * treats them as a PDF.
 */
export function uploadedNoteUrl(id: number): Promise<string> {
  let pending = blobs.get(id);
  if (!pending) {
    pending = authedResponse(`/api/notes/file/${id}`)
      .then((response) => response.arrayBuffer())
      .then((bytes) => URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })));
    /* A failure is not cached: the next attempt should try again. */
    pending.catch(() => blobs.delete(id));
    blobs.set(id, pending);
  }
  return pending;
}

export function describeSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function noteError(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/* ------------------------------------------------------------------ */

export type LessonMedium = "video" | "notes";

const MEDIUM_KEY = "quantaverse.lesson-medium";
const MEDIUM_EVENT = "quantaverse:lesson-medium";

/**
 * Whether lessons show their video or the notes.
 *
 * One setting for the whole curriculum, remembered in this browser: somebody
 * who prefers reading to watching prefers it on the next module too. It is a
 * convenience, so if storage is unavailable it simply resets to video.
 */
export function readMedium(): LessonMedium {
  if (typeof window === "undefined") return "video";
  try {
    return window.localStorage.getItem(MEDIUM_KEY) === "notes" ? "notes" : "video";
  } catch {
    return "video";
  }
}

export function writeMedium(medium: LessonMedium) {
  try {
    window.localStorage.setItem(MEDIUM_KEY, medium);
  } catch {
    /* Remembered for this page only, then. */
  }
  mediumOverride = medium;
  window.dispatchEvent(new Event(MEDIUM_EVENT));
}

/* Holds the choice when storage refuses it, so the page still switches. */
let mediumOverride: LessonMedium | null = null;

export function mediumSnapshot(): LessonMedium {
  return mediumOverride ?? readMedium();
}

export function subscribeMedium(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === MEDIUM_KEY) {
      mediumOverride = null;
      listener();
    }
  };
  window.addEventListener(MEDIUM_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MEDIUM_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
