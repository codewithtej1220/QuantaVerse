/**
 * Client for the QuantaVerse FastAPI service.
 *
 * The API is optional: the sandbox has its own simulator and runs with no server
 * at all. Everything here therefore fails soft — a caller gets an `ApiError` it
 * can show as a note, never an unhandled rejection that blanks the page.
 */

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export type BackendId = "qiskit" | "cirq" | "pennylane" | "qbraid";

export interface IRGate {
  gate: string;
  targets: number[];
  control?: number | null;
  params?: number[];
  step: number;
}

export interface IRMeasurement {
  targets: number[];
  clbits?: number[];
}

export interface CircuitIR {
  qubits: number;
  clbits?: number;
  timeline: IRGate[];
  measurements?: IRMeasurement[];
}

export interface Amplitude {
  re: number;
  im: number;
}

export interface SimulationResponse {
  backend: string;
  framework_version: string;
  qubits: number;
  clbits: number;
  shots: number;
  depth: number;
  gate_counts: Record<string, number>;
  labels: string[];
  statevector: Amplitude[] | null;
  probabilities: number[];
  histogram: Record<string, number>;
  measured_qubits: number[];
  duration_ms: number;
  truncated: boolean;
  status: "ok" | "stub";
  note: string | null;
}

export interface BackendInfo {
  framework: string;
  installed: boolean;
  version: string;
  real: boolean;
}

export interface HealthResponse {
  status: string;
  version: string;
  backends: Record<string, BackendInfo>;
  tutor: { live: boolean; model: string | null; fallback: string };
}

export interface SandboxResponse {
  ok: boolean;
  circuit: CircuitIR | null;
  variable: string | null;
  stdout: string;
  error: string | null;
  error_type: string | null;
  duration_ms: number;
  diagram: string | null;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** One AbortSignal that fires on either the caller's signal or a deadline. */
function deadline(ms: number, external?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new ApiError("the API did not answer in time")), ms);
  const forward = () => controller.abort(external?.reason);
  external?.addEventListener("abort", forward, { once: true });
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", forward);
    },
  };
}

/**
 * The reason an error carries, out of whatever shape the server wrote it in.
 *
 * FastAPI puts a plain string in `detail` for the errors the routes raise by
 * hand, and a list of per-field objects in it for the ones its own validation
 * raises. Reading only the string meant every validation failure arrived as
 * "422 Unprocessable Content" — which is exactly the class of error where the
 * server has already said which field is wrong and why, so it was the one
 * message worth reading that never got shown.
 */
function reasonFrom(payload: unknown, response: Response) {
  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const lines = detail
      .map((item: unknown) => {
        const entry = item as { msg?: unknown; loc?: unknown };
        if (typeof entry.msg !== "string") return null;
        // Pydantic prefixes its own validators; the learner wants the sentence.
        const message = entry.msg.replace(/^Value error,\s*/, "");
        const field = Array.isArray(entry.loc)
          ? entry.loc.filter((part) => part !== "body").join(".")
          : "";
        return field ? `${field}: ${message}` : message;
      })
      .filter((line): line is string => Boolean(line));
    if (lines.length) return lines.join("; ");
  }

  return `${response.status} ${response.statusText}`;
}

async function request<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  ms = 20_000,
  token?: string | null,
) {
  const gate = deadline(ms, signal);
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: gate.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new ApiError(reasonFrom(payload, response), response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("the request was cancelled");
    }
    throw new ApiError(
      `cannot reach the QuantaVerse API at ${API_BASE} — is uvicorn running?`,
    );
  } finally {
    gate.done();
  }
}

/**
 * What the API can run, with a cold start allowed for.
 *
 * This is probed once when a page mounts, and the answer decides whether the
 * server engines and "build from code" are offered at all. A container host
 * that sleeps its free tier — Render does — takes twenty to forty seconds to
 * answer its first request of the day, so a single short deadline does not
 * report "the API is slow", it reports "there is no API": every server engine
 * greys out and stays greyed out for the whole visit, on a service that was
 * only asleep.
 *
 * Three attempts on a widening deadline cover the wake-up. The first still
 * gives up in five seconds, which is what a local run with no uvicorn wants —
 * the picker should not sit there spinning when nothing is listening.
 */
export async function fetchHealth(signal?: AbortSignal) {
  const deadlines = [5_000, 15_000, 30_000];
  let last: unknown = new ApiError("the API did not answer in time");

  for (const ms of deadlines) {
    if (signal?.aborted) throw new ApiError("the request was cancelled");
    try {
      return await request<HealthResponse>("/api/health", undefined, signal, ms);
    } catch (error) {
      last = error;
      /* A status means something answered — it is awake and it is broken, and
         asking again will not change its mind. Only silence is worth a retry. */
      if (error instanceof ApiError && error.status > 0) throw error;
    }
  }

  throw last;
}

export function runSimulation(
  body: { circuit: CircuitIR; backend: BackendId; shots: number },
  signal?: AbortSignal,
) {
  return request<SimulationResponse>("/api/simulate", body, signal, 45_000);
}

export function introspectCode(code: string, signal?: AbortSignal) {
  return request<SandboxResponse>("/api/introspect", { code }, signal, 45_000);
}

export interface GradeResponse {
  passed: boolean;
  checks: { check: string; passed: boolean; score: number; threshold: number; detail: string }[];
  hint: string | null;
  recorded: boolean;
  earned_badges: string[];
}

export function gradeCircuit(
  body: {
    target: CircuitIR;
    submission: CircuitIR;
    threshold?: number;
    challenge_slug?: string | null;
  },
  signal?: AbortSignal,
  token?: string | null,
) {
  return request<GradeResponse>("/api/grade", body, signal, 45_000, token);
}

/* ------------------------------------------------------------------ */
/* Tutor: server-sent events                                           */
/* ------------------------------------------------------------------ */

export interface TutorMeta {
  live: boolean;
  model: string | null;
  /** Null when the learner has no circuit open. */
  looking: {
    lesson_id: string | null;
    qubits: number;
    depth: number;
    gates: number;
    measured?: number[];
    reading: string;
  } | null;
}

export interface TutorHandlers {
  onMeta?: (meta: TutorMeta) => void;
  onDelta: (text: string) => void;
  onDone?: (info: { source: string; reason?: string }) => void;
}

export interface TutorAsk {
  prompt: string;
  circuit?: CircuitIR | null;
  lesson_id?: string | null;
  history?: { role: "user" | "assistant"; content: string }[];
}

/**
 * Read `/api/tutor/ask` as a stream.
 *
 * The wire format is SSE, but EventSource cannot POST, so the frames are parsed
 * off a plain fetch body: split on the blank line, take the `data:` payload.
 */
export async function streamTutor(
  ask: TutorAsk,
  handlers: TutorHandlers,
  signal?: AbortSignal,
) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/tutor/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(ask),
      signal,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(`cannot reach the tutor at ${API_BASE} — is uvicorn running?`);
  }

  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      payload && typeof payload.detail === "string"
        ? payload.detail
        : `the tutor answered ${response.status}`,
      response.status,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleFrame = (frame: string) => {
    const data = frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    if (!data) return;

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(data);
    } catch {
      return;
    }

    if (event.type === "meta") handlers.onMeta?.(event as unknown as TutorMeta);
    else if (event.type === "delta" && typeof event.text === "string") handlers.onDelta(event.text);
    else if (event.type === "done") {
      handlers.onDone?.({
        source: String(event.source ?? "unknown"),
        reason: typeof event.reason === "string" ? event.reason : undefined,
      });
    } else if (event.type === "error" && typeof event.message === "string") {
      throw new ApiError(event.message);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let split = buffer.indexOf("\n\n");
    while (split !== -1) {
      handleFrame(buffer.slice(0, split));
      buffer = buffer.slice(split + 2);
      split = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim()) handleFrame(buffer);
}
