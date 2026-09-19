import { authed } from "@/lib/auth";

/**
 * Professors and their classes.
 *
 * A class is one professor and one module. A student asks to join it; the
 * professor accepts or declines. Accepting is what lets the professor see that
 * student's progress on the module, so every ranking on the professor's page
 * is of students who chose to be in it.
 *
 * The professor role is picked at registration, on the Professor tab, the way
 * a student picks theirs. The server checks every action; the role on the
 * client only decides which pages are offered.
 */

export interface Person {
  id: number;
  handle: string;
  display_name: string;
  institution: string | null;
  position: string | null;
  avatar_url: string | null;
}

export interface LabStanding {
  title: string;
  passed: boolean;
  best_score: number;
  attempts: number;
  first_passed_at: string | null;
}

export interface ClassStudent {
  membership_id: number;
  rank: number;
  student: Person;
  percent: number;
  lessons_completed: number;
  lessons_total: number;
  lab: LabStanding | null;
  last_active: string | null;
  joined_at: string | null;
}

export interface ClassRequest {
  id: number;
  module_slug: string;
  module_title: string;
  student: Person;
  note: string | null;
  created_at: string;
}

export interface TaughtModule {
  slug: string;
  title: string;
  ket: string;
  lessons: number;
  lab_title: string | null;
  students: ClassStudent[];
  pending: number;
  notes: number;
}

export interface ModuleChoice {
  slug: string;
  title: string;
  ket: string;
}

export interface ProfessorDashboard {
  professor: Person;
  modules: TaughtModule[];
  requests: ClassRequest[];
  catalogue: ModuleChoice[];
  totals: { students: number; requests: number; notes: number };
}

export type MembershipStatus = "pending" | "accepted" | "declined";

export interface Membership {
  id: number;
  status: MembershipStatus;
  note: string | null;
  created_at: string;
  responded_at: string | null;
}

export interface ModuleProfessor {
  professor: Person;
  students: number;
  membership: Membership | null;
}

export interface ModuleClasses {
  module_slug: string;
  professors: ModuleProfessor[];
  you_teach: boolean;
}

/* ------------------------------------------------------------------ */
/* The professor's side                                                */

export function fetchProfessorDashboard() {
  return authed<ProfessorDashboard>("/api/professor");
}

export function setTaughtModules(modules: string[]) {
  return authed<ProfessorDashboard>("/api/professor/modules", "PUT", { modules });
}

export function answerRequest(id: number, accept: boolean) {
  return authed<ProfessorDashboard>(
    `/api/professor/requests/${id}/${accept ? "accept" : "decline"}`,
    "POST",
  );
}

export function removeStudent(membershipId: number) {
  return authed<ProfessorDashboard>(`/api/professor/students/${membershipId}`, "DELETE");
}

/* ------------------------------------------------------------------ */
/* The student's side                                                  */

export function fetchModuleClasses(slug: string) {
  return authed<ModuleClasses>(`/api/classes/${encodeURIComponent(slug)}`);
}

export function askToJoin(slug: string, professorId: number, note?: string) {
  return authed<ModuleClasses>(`/api/classes/${encodeURIComponent(slug)}`, "POST", {
    professor_id: professorId,
    note: note?.trim() || null,
  });
}

export function leaveClass(membershipId: number) {
  return authed<ModuleClasses>(`/api/classes/membership/${membershipId}`, "DELETE");
}

/* ------------------------------------------------------------------ */

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** "3 days ago", "today", or a date for anything older than a month. */
export function sinceWhen(value: string | null) {
  if (!value) return "—";
  const then = new Date(value.endsWith("Z") || value.includes("+") ? value : `${value}Z`);
  if (Number.isNaN(then.getTime())) return "—";
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
