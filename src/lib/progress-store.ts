import { fetchProgress, type ProgressResponse } from "@/lib/auth";

interface Snapshot {
  userId: number;
  data: ProgressResponse | null;
  error: string | null;
}

let snapshot: Snapshot | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeProgress(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function progressSnapshot(userId: number | null) {
  if (userId === null || snapshot?.userId !== userId) return null;
  return snapshot;
}

export function loadProgress(userId: number, force = false) {
  if (!force && snapshot?.userId === userId && (snapshot.data || snapshot.error)) {
    return Promise.resolve();
  }
  if (inflight && !force) return inflight;

  inflight = fetchProgress()
    .then((data) => {
      snapshot = { userId, data, error: null };
    })
    .catch((error: unknown) => {
      snapshot = {
        userId,
        data: null,
        error: error instanceof Error ? error.message : "progress could not load",
      };
    })
    .finally(() => {
      inflight = null;
      emit();
    });

  return inflight;
}

export function applyProgress(userId: number, data: ProgressResponse) {
  snapshot = { userId, data, error: null };
  emit();
}

export function clearProgress() {
  snapshot = null;
  inflight = null;
  emit();
}
