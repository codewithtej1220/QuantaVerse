import { API_BASE, ApiError } from "@/lib/api";

const STORAGE_KEY = "quantaverse.session";
const CHANGED = "quantaverse:session-changed";

export interface TokenPair {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
}

export interface StudentProfile {
  id: number;
  email: string;
  handle: string;
  display_name: string;
  institution: string | null;
  cohort: string;
  created_at: string;
  last_login_at: string | null;
  /* Null until the two sign-up questions are answered. Null and zero are not
     the same thing here: null means nobody has asked, zero means they were
     asked and said they are starting from nothing. */
  math_level: number | null;
  code_level: number | null;
  /* Which home to show. The server decides what each role may do; this only
     decides where the account menu points. */
  role: "student" | "mentor" | "professor";
  /** The modules a professor teaches, in curriculum order. Empty otherwise. */
  teaches: string[];
}

export interface AuthResponse {
  user: StudentProfile;
  tokens: TokenPair;
}

export interface ChallengeProgress {
  slug: string;
  title: string;
  qubits: number;
  attempts: number;
  passed: boolean;
  best_score: number;
  success_rate: number;
  first_passed_at: string | null;
  last_attempt_at: string | null;
}

export interface ModuleProgress {
  slug: string;
  ket: string;
  title: string;
  track: string;
  track_label: string;
  lessons: number;
  minutes: number;
  lessons_completed: number;
  completed_lessons: number[];
  percent: number;
  state: string;
  badge_id: string;
  badge: string;
  badge_earned: boolean;
  challenge: ChallengeProgress | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface SkillPoint {
  key: string;
  label: string;
  short: string;
  value: number;
  cohort: number;
}

export interface BadgeState {
  id: string;
  name: string;
  detail: string;
  ket: string;
  module_slug: string;
  earned: boolean;
  earned_at: string | null;
}

export interface Mastery {
  level: number;
  title: string;
  next_title: string | null;
  percent: number;
  points: number;
  points_max: number;
}

export interface ProgressStats {
  lessons_completed: number;
  lessons_total: number;
  modules_completed: number;
  modules_total: number;
  challenges_passed: number;
  challenges_total: number;
  attempts: number;
  attempts_passed: number;
  success_rate: number;
  percent_complete: number;
  minutes_logged: number;
  badges_earned: number;
  streak_days: number;
  active_days: number;
  first_activity_at: string | null;
  last_activity_at: string | null;
}

export interface UpNext {
  module_slug: string;
  ket: string;
  title: string;
  percent: number;
  reason: string;
  lesson_index: number | null;
  challenge_slug: string | null;
  weakest_skill: string | null;
}

export interface AttemptRecord {
  id: number;
  challenge_slug: string;
  challenge_title: string;
  passed: boolean;
  score: number;
  state_fidelity: number | null;
  unitary_fidelity: number | null;
  created_at: string;
}

export interface DashboardResponse {
  profile: StudentProfile;
  stats: ProgressStats;
  mastery: Mastery;
  modules: ModuleProgress[];
  skills: SkillPoint[];
  badges: BadgeState[];
  activity: number[];
  activity_weeks: number;
  recent_attempts: AttemptRecord[];
  up_next: UpNext | null;
}

export interface ProgressResponse {
  stats: ProgressStats;
  mastery: Mastery;
  modules: ModuleProgress[];
  skills: SkillPoint[];
  badges: BadgeState[];
  up_next: UpNext | null;
}

export interface LessonMarkResponse {
  module: ModuleProgress;
  stats: ProgressStats;
  mastery: Mastery;
  earned_badges: BadgeState[];
  already_recorded: boolean;
}

export function readSession(): TokenPair | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TokenPair;
    return parsed && parsed.access_token && parsed.refresh_token ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSession(tokens: TokenPair | null) {
  if (typeof window === "undefined") return;
  if (tokens) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function onSessionChange(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGED, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGED, listener);
    window.removeEventListener("storage", listener);
  };
}

async function readError(response: Response) {
  const payload = await response.json().catch(() => null);
  const detail = payload && (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string };
    if (typeof first?.msg === "string") return first.msg;
  }
  return `${response.status} ${response.statusText}`;
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, cache: "no-store" });
  } catch {
    throw new ApiError(
      `cannot reach the QuantaVerse API at ${API_BASE} — is uvicorn running?`,
    );
  }
  if (!response.ok) throw new ApiError(await readError(response), response.status);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function jsonInit(method: string, body?: unknown, token?: string): RequestInit {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

let refreshing: Promise<TokenPair> | null = null;

async function refreshSession(): Promise<TokenPair> {
  const current = readSession();
  if (!current) throw new ApiError("no session to refresh", 401);

  if (!refreshing) {
    refreshing = send<AuthResponse>(
      "/api/auth/refresh",
      jsonInit("POST", { refresh_token: current.refresh_token }),
    )
      .then((payload) => {
        writeSession(payload.tokens);
        return payload.tokens;
      })
      .catch((error) => {
        writeSession(null);
        throw error;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/**
 * Answer the two sign-up questions.
 *
 * The server treats these as a starting point rather than a score — how many
 * modules stand open, and which axis the first suggestion aims at — so they
 * can be sent again later without anything having to be undone.
 */
export async function saveStartingPoint(mathLevel: number, codeLevel: number) {
  return authed<StudentProfile>("/api/auth/onboarding", "POST", {
    math_level: mathLevel,
    code_level: codeLevel,
  });
}

export async function authed<T>(
  path: string,
  method: string = "GET",
  body?: unknown,
): Promise<T> {
  const session = readSession();
  if (!session) throw new ApiError("sign in to use this endpoint", 401);

  try {
    return await send<T>(path, jsonInit(method, body, session.access_token));
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const renewed = await refreshSession();
    return send<T>(path, jsonInit(method, body, renewed.access_token));
  }
}

/**
 * A signed-in request whose body or answer is not JSON: a file going up, or a
 * file coming back.
 *
 * Same token handling as `authed` — one refresh on a 401, then give up — but it
 * hands back the raw response, and it leaves the body alone so a File can be
 * sent as itself. A Blob can be read twice, so the retry after a refresh sends
 * the same bytes again.
 */
export async function authedResponse(
  path: string,
  init: { method?: string; body?: BodyInit; headers?: Record<string, string> } = {},
): Promise<Response> {
  const session = readSession();
  if (!session) throw new ApiError("sign in to use this endpoint", 401);

  const attempt = async (token: string) => {
    try {
      return await fetch(`${API_BASE}${path}`, {
        method: init.method ?? "GET",
        body: init.body,
        headers: { ...init.headers, Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    } catch {
      throw new ApiError(
        `cannot reach the QuantaVerse API at ${API_BASE} — is uvicorn running?`,
      );
    }
  };

  let response = await attempt(session.access_token);
  if (response.status === 401) {
    const renewed = await refreshSession();
    response = await attempt(renewed.access_token);
  }
  if (!response.ok) throw new ApiError(await readError(response), response.status);
  return response;
}

export function register(body: {
  email: string;
  password: string;
  display_name: string;
  institution?: string | null;
  /* A professor registers with the site's invite code and what they teach. */
  professor_code?: string | null;
  teaches?: string[];
}) {
  return send<AuthResponse>("/api/auth/register", jsonInit("POST", body));
}

export function login(body: { email: string; password: string }) {
  return send<AuthResponse>("/api/auth/login", jsonInit("POST", body));
}

export async function logout() {
  const session = readSession();
  if (!session) return;
  try {
    await authed("/api/auth/logout", "POST", { refresh_token: session.refresh_token });
  } catch {
  } finally {
    writeSession(null);
  }
}

export function fetchMe() {
  return authed<StudentProfile>("/api/auth/me");
}

export function fetchDashboard() {
  return authed<DashboardResponse>("/api/dashboard");
}

export function fetchProgress() {
  return authed<ProgressResponse>("/api/progress");
}

export function markLesson(moduleSlug: string, lessonIndex: number, seconds = 0) {
  return authed<LessonMarkResponse>("/api/progress/lessons", "POST", {
    module_slug: moduleSlug,
    lesson_index: lessonIndex,
    seconds_spent: seconds,
  });
}

export function unmarkLesson(moduleSlug: string, lessonIndex: number) {
  return authed<{ removed: boolean }>(
    `/api/progress/lessons/${moduleSlug}/${lessonIndex}`,
    "DELETE",
  );
}
