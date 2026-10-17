export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type Freshness = "current" | "stale" | "unavailable" | "imported_snapshot" | "no_data" | "unknown";

export type SourceInfo = {
  id: string;
  name: string;
  mode: string;
  status: string;
  official_url: string | null;
  last_checked_at: string | null;
  last_import_at: string | null;
  upstream_updated_at: string | null;
  unavailable_since: string | null;
  freshness: Freshness;
};

export type Division = { id: string; name: string; code: string | null };

export type Venue = {
  id: string;
  name: string;
  address: string | null;
  accessible_entrance: string | null;
  directions: string | null;
  map_url: string | null;
  courts: { id: string; label: string }[];
};

export type EventSummary = {
  id: string;
  slug: string;
  title: string;
  kind: "indoor" | "beach";
  timezone: string;
  start_date: string;
  end_date: string;
  status: string;
  is_demo: boolean;
  revision: number;
};

export type EventDetail = EventSummary & {
  venues: Venue[];
  divisions: Division[];
  counts: { entries: number; matches: number };
};

export type Entry = { id: string; team_name: string; club_name: string | null; division: Division | null };

export type Participant = {
  entry_id: string | null;
  team_name: string | null;
  club_name: string | null;
  placeholder: string | null;
};

export type Change = {
  id: number;
  entity_type: "match" | "announcement";
  entity_id: string;
  entity_revision: number;
  event_type: string;
  diff: Record<string, unknown>;
  entry_ids: string[];
  simulated: boolean;
  occurred_at: string;
};

export type Match = {
  id: string;
  revision: number;
  status: "scheduled" | "in_progress" | "completed" | "cancelled" | "postponed";
  result_state: string;
  round_label: string | null;
  division: Division | null;
  scheduled_start: string | null;
  estimated_start: string | null;
  timezone: string;
  court: { id: string; label: string; venue_id: string; venue_name: string } | null;
  home: Participant;
  away: Participant;
  sets: { set_number: number; home: number | null; away: number | null }[];
  sets_won: { home: number; away: number } | null;
  source: { id: string; name: string; mode: string; observed_at: string; source_updated_at: string | null; freshness: Freshness };
  latest_change: Change | null;
};

export type Announcement = {
  id: string;
  category: string;
  title: string;
  body: string;
  entry_id: string | null;
  division_id: string | null;
  publish_at: string | null;
  expire_at: string | null;
  revision: number;
};

export type GuideItem = {
  id: string;
  venue_id: string | null;
  kind: string;
  title: string;
  body: string;
  link_url: string | null;
  sort: number;
  revision: number;
};

export type Partner = {
  id: string;
  kind: "sponsor" | "merchandise" | "tickets" | "fundraiser" | "activity";
  name: string;
  body: string;
  link_url: string | null;
  logo_url: string | null;
  booth_location: string | null;
  seller_note: string | null;
  sort: number;
  active: boolean;
  revision: number;
};

export type RosterPlayer = { jersey: number | null; display_name: string; position: string | null; photo_url: string | null };

export type MyDay = {
  next_match_id: string | null;
  next_by_entry: Record<string, string>;
  upcoming_ids: string[];
  awaiting_schedule_ids: string[];
  completed_ids: string[];
  conflicts: { match_ids: string[]; different_venues: boolean }[];
  assumed_match_minutes: number;
  entries: Entry[];
  matches: Record<string, Match>;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      message = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {}
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return parse<T>(await fetch(`${API_BASE}${path}`, init));
}

export type AuthHeaders = () => Promise<Record<string, string>>;

export async function apiSend<T>(
  auth: AuthHeaders,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const headers = await auth();
  const isForm = body instanceof FormData;
  return parse<T>(
    await fetch(`${API_BASE}${path}`, {
      method,
      headers: isForm ? headers : { ...headers, "Content-Type": "application/json" },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    }),
  );
}

export async function apiAuthGet<T>(auth: AuthHeaders, path: string): Promise<T> {
  return parse<T>(await fetch(`${API_BASE}${path}`, { headers: await auth(), cache: "no-store" }));
}
