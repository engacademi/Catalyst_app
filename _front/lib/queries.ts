"use client";

import { useQuery } from "@tanstack/react-query";
import {
  apiGet,
  type Announcement,
  type Change,
  type Entry,
  type EventDetail,
  type EventSummary,
  type GuideItem,
  type Match,
  type MyDay,
  type Partner,
  type RosterPlayer,
  type SourceInfo,
  type Venue,
} from "./api";

type WithSources<T> = { data: T; sources: SourceInfo[] };

export const keys = {
  events: ["events"] as const,
  event: (id: string) => ["event", id] as const,
  myDay: (id: string, entries: string[], divisions: string[] = []) =>
    ["my-day", id, [...entries].sort().join(","), [...divisions].sort().join(",")] as const,
  teams: (id: string, q: string, division: string) => ["teams", id, q, division] as const,
  matches: (id: string, params: string) => ["matches", id, params] as const,
  entry: (id: string) => ["entry", id] as const,
  match: (id: string) => ["match", id] as const,
  changes: (id: string) => ["changes", id] as const,
  announcements: (id: string) => ["announcements", id] as const,
  guide: (id: string) => ["guide", id] as const,
};

export function useEvents() {
  return useQuery({ queryKey: keys.events, queryFn: () => apiGet<{ data: (EventSummary & { venues: string[] })[] }>("/v1/events") });
}

export function useEvent(eventId: string) {
  return useQuery({ queryKey: keys.event(eventId), queryFn: () => apiGet<WithSources<EventDetail>>(`/v1/events/${eventId}`) });
}

export function useMyDay(eventId: string, entryIds: string[], divisionIds: string[] = []) {
  return useQuery({
    queryKey: keys.myDay(eventId, entryIds, divisionIds),
    queryFn: () =>
      apiGet<WithSources<MyDay>>(
        `/v1/events/${eventId}/my-day?entry_ids=${entryIds.join(",")}&division_ids=${divisionIds.join(",")}`,
      ),
    enabled: entryIds.length > 0 || divisionIds.length > 0,
  });
}

export function useTeams(eventId: string, q: string, division: string) {
  const params = new URLSearchParams({ limit: "100" });
  if (q) params.set("q", q);
  if (division) params.set("division_id", division);
  return useQuery({
    queryKey: keys.teams(eventId, q, division),
    queryFn: () => apiGet<{ data: Entry[]; total: number }>(`/v1/events/${eventId}/teams?${params}`),
    refetchInterval: false,
  });
}

export function useMatches(eventId: string, params: URLSearchParams) {
  const qs = params.toString();
  return useQuery({
    queryKey: keys.matches(eventId, qs),
    queryFn: () =>
      apiGet<{ data: Match[]; next_cursor: number | null; sources: SourceInfo[] }>(`/v1/events/${eventId}/matches?${qs}`),
  });
}

export type EntryDetail = Entry & {
  event: EventSummary;
  roster: { version: number; published_at: string | null; team_photo_url: string | null; players: RosterPlayer[] } | null;
  matches: Match[];
};

export function useEntry(entryId: string) {
  return useQuery({ queryKey: keys.entry(entryId), queryFn: () => apiGet<WithSources<EntryDetail>>(`/v1/entries/${entryId}`) });
}

export function useMatch(matchId: string) {
  return useQuery({
    queryKey: keys.match(matchId),
    queryFn: () => apiGet<WithSources<Match & { event: EventSummary; history: Change[] }>>(`/v1/matches/${matchId}`),
  });
}

export function useChanges(eventId: string) {
  return useQuery({
    queryKey: keys.changes(eventId),
    queryFn: () =>
      apiGet<{
        data: Change[];
        matches: Record<string, Match>;
        announcements: Record<string, Announcement>;
        latest_id: number;
        sources: SourceInfo[];
      }>(`/v1/events/${eventId}/changes`),
  });
}

export function useAnnouncements(eventId: string) {
  return useQuery({
    queryKey: keys.announcements(eventId),
    queryFn: () => apiGet<{ data: Announcement[] }>(`/v1/events/${eventId}/announcements`),
  });
}

export function useGuide(eventId: string) {
  return useQuery({
    queryKey: keys.guide(eventId),
    queryFn: () => apiGet<{ data: { venues: Venue[]; items: GuideItem[]; partners: Partner[] } }>(`/v1/events/${eventId}/guide`),
    refetchInterval: 120_000,
  });
}
