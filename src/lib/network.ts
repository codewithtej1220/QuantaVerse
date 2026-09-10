import { authed } from "@/lib/auth";

/**
 * Client for the research hub.
 *
 * Every call goes through `authed`, which carries the access token and renews
 * it once on a 401 — the directory and the connection graph are members-only,
 * so there is no anonymous path here to fall back to.
 */

export type Role = "student" | "mentor";
export type ConnectionStatus = "pending" | "accepted" | "declined";

/**
 * Where the viewer stands with a person.
 *
 * Computed on the server and returned on the card, so a list of sixty people
 * renders sixty correct buttons without the client joining two arrays.
 */
export type Standing =
  | "none"
  | "self"
  | "connected"
  | "awaiting_them"
  | "awaiting_you"
  | "declined";

export interface PersonCard {
  id: number;
  handle: string;
  display_name: string;
  role: Role;
  institution: string | null;
  headline: string | null;
  interests: string[];
  open_to_mentoring: boolean;
  is_demo: boolean;
  joined_at: string;
  standing: Standing;
  connection_id: number | null;
  /** Only filled for people you are connected to. */
  modules_completed: number | null;
  badges_earned: number | null;
}

export interface DirectoryResponse {
  people: PersonCard[];
  total: number;
  query: string | null;
  role: Role | null;
}

export interface ConnectionRecord {
  id: number;
  status: ConnectionStatus;
  note: string | null;
  created_at: string;
  responded_at: string | null;
  /** True when you are the one who asked. */
  outgoing: boolean;
  person: PersonCard;
}

export interface NetworkResponse {
  connections: ConnectionRecord[];
  incoming: ConnectionRecord[];
  outgoing: ConnectionRecord[];
  pending_incoming: number;
}

export function fetchDirectory(options: {
  q?: string;
  role?: Role | null;
  mentorsOnly?: boolean;
} = {}) {
  const params = new URLSearchParams();
  if (options.q?.trim()) params.set("q", options.q.trim());
  if (options.role) params.set("role", options.role);
  if (options.mentorsOnly) params.set("mentors_only", "true");
  const query = params.toString();
  return authed<DirectoryResponse>(`/api/network/directory${query ? `?${query}` : ""}`);
}

export function fetchNetwork() {
  return authed<NetworkResponse>("/api/network");
}

export function sendRequest(handle: string, note?: string) {
  return authed<ConnectionRecord>("/api/network/requests", "POST", {
    handle,
    note: note?.trim() || null,
  });
}

export function acceptRequest(id: number) {
  return authed<ConnectionRecord>(`/api/network/requests/${id}/accept`, "POST", {});
}

export function declineRequest(id: number) {
  return authed<ConnectionRecord>(`/api/network/requests/${id}/decline`, "POST", {});
}

export function withdrawRequest(id: number) {
  return authed<void>(`/api/network/requests/${id}`, "DELETE");
}

export function removeConnection(id: number) {
  return authed<void>(`/api/network/connections/${id}`, "DELETE");
}

export function fetchMyCard() {
  return authed<PersonCard>("/api/network/me");
}

export function updateMyCard(body: {
  role?: Role;
  headline?: string | null;
  interests?: string | null;
  open_to_mentoring?: boolean;
}) {
  return authed<PersonCard>("/api/network/me", "PATCH", body);
}
