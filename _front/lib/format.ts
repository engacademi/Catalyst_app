import type { Match, Venue } from "./api";

export function formatTime(iso: string | null, timeZone: string): string {
  if (!iso) return "Time to be confirmed";
  return new Intl.DateTimeFormat("en-CA", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function formatDay(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(
    new Date(iso),
  );
}

export function formatDateRange(start: string, end: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return start === end ? fmt.format(new Date(start)) : `${fmt.format(new Date(start))} to ${fmt.format(new Date(end))}`;
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "unknown";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export function dayKey(iso: string | null, timeZone: string): string {
  if (!iso) return "tbd";
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

/** The start a match is grouped and ordered by: its estimated start, else its official start. */
export function effectiveStart(match: Pick<Match, "estimated_start" | "scheduled_start">): string | null {
  return match.estimated_start ?? match.scheduled_start;
}

type Court = { label: string; area: string | null };

/** "Court 53 · Hall C" when the court has an area, otherwise just "Court 53". */
export function courtPlace(court: Court): string {
  return court.area ? `${court.label} · ${court.area}` : court.label;
}

/** Courts grouped by area in first-seen order; courts without an area come last under `null`. */
export function courtsByArea(courts: Venue["courts"]): [string | null, Venue["courts"]][] {
  const groups = new Map<string | null, Venue["courts"]>();
  for (const c of [...courts].sort((a, b) => Number(!a.area) - Number(!b.area))) {
    groups.set(c.area, [...(groups.get(c.area) ?? []), c]);
  }
  return [...groups];
}

const ESTIMATE_BY: Record<NonNullable<Match["estimated_start_by"]>, string> = { source: "source", ova_staff: "OVA staff" };

/** "Est. ~10:20, OVA staff", or null when the match has no estimated start. */
export function estimateLine(match: Match): string | null {
  if (!match.estimated_start || !match.estimated_start_by) return null;
  return `Est. ~${formatTime(match.estimated_start, match.timezone)}, ${ESTIMATE_BY[match.estimated_start_by]}`;
}
