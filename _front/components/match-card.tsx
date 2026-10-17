"use client";

import Link from "next/link";
import { ArrowRightLeft, Clock, MapPin } from "lucide-react";
import type { Change, Match, Participant } from "@/lib/api";
import { courtPlace, formatDay, formatTime } from "@/lib/format";
import type { Labels } from "@/lib/labels";
import { useNow } from "@/lib/now";
import { Badge } from "./ui";

const STATUS: Record<Match["status"], { label: string; tone: "neutral" | "brand" | "warn" | "danger" | "info" }> = {
  scheduled: { label: "Scheduled", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  completed: { label: "Final", tone: "brand" },
  cancelled: { label: "Cancelled", tone: "danger" },
  postponed: { label: "Postponed", tone: "warn" },
};

const CHANGE_LABELS: Record<string, string> = {
  time_changed: "Time changed",
  court_changed: "Court changed",
  status_changed: "Status changed",
  result_posted: "Result posted",
  result_corrected: "Result corrected",
  participants_resolved: "Teams confirmed",
  next_match_set: "Next match set",
};

export function StatusBadge({ status }: { status: Match["status"] }) {
  const s = STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function ChangeBadge({ change }: { change: Change | null }) {
  const now = useNow();
  if (!change) return null;
  // Badges fade after six hours so old changes don't look urgent.
  const recent = now - new Date(change.occurred_at).getTime() < 6 * 60 * 60 * 1000;
  if (!recent) return null;
  const label = CHANGE_LABELS[change.event_type] ?? "Updated";
  return (
    <Badge tone={change.event_type.startsWith("result") ? "brand" : "warn"}>
      <ArrowRightLeft aria-hidden className="h-3 w-3" />
      {label}
      {change.simulated && " (simulated)"}
    </Badge>
  );
}

function name(p: Participant) {
  return p.team_name ?? p.placeholder ?? "To be decided";
}

function TeamLine({
  p,
  won,
  highlight,
  sets,
  label,
}: {
  p: Participant;
  won: number | undefined;
  highlight: boolean;
  sets: (number | null)[];
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`truncate ${highlight ? "font-semibold" : ""} ${p.team_name ? "" : "italic text-muted"}`}>
        {label && (
          <>
            <span className="mr-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">{label}</span>
            <span className="sr-only">, </span>
          </>
        )}
        {name(p)}
        {!p.team_name && p.placeholder && <span className="sr-only"> (placeholder until results decide)</span>}
      </span>
      {won !== undefined && (
        <span className="flex shrink-0 items-center gap-2 font-mono text-sm tabular-nums">
          <span className="text-muted">{sets.map((s) => s ?? "–").join(" ")}</span>
          <span className="w-4 text-right font-bold">{won}</span>
        </span>
      )}
    </div>
  );
}

export function MatchCard({
  match,
  eventId,
  followed = [],
  labels = {},
  showDay = false,
}: {
  match: Match;
  eventId: string;
  followed?: string[];
  labels?: Labels;
  showDay?: boolean;
}) {
  const labelOf = (p: Participant) => (p.entry_id && followed.includes(p.entry_id) ? labels[p.entry_id] : undefined);
  const start = match.estimated_start ?? match.scheduled_start;
  const isFollowed = (p: Participant) => !!p.entry_id && followed.includes(p.entry_id);
  const homeSets = match.sets.map((s) => s.home);
  const awaySets = match.sets.map((s) => s.away);
  return (
    <Link
      href={`/events/${eventId}/matches/${match.id}`}
      className={`block rounded-xl border bg-surface p-4 transition hover:border-brand ${
        match.status === "cancelled" ? "border-danger/30 opacity-80" : "border-border"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="flex items-center gap-1 font-semibold">
          <Clock aria-hidden className="h-4 w-4 text-brand" />
          {showDay && start ? `${formatDay(start, match.timezone)}, ` : ""}
          {formatTime(start, match.timezone)}
          {match.estimated_start && <span className="font-normal text-muted">(estimated)</span>}
        </span>
        <span className="flex items-center gap-1 text-muted">
          <MapPin aria-hidden className="h-4 w-4" />
          {match.court ? `${courtPlace(match.court)}, ${match.court.venue_name}` : "Court to be confirmed"}
        </span>
      </div>
      <div className="space-y-1">
        <TeamLine p={match.home} won={match.sets_won?.home} highlight={isFollowed(match.home)} sets={homeSets} label={labelOf(match.home)} />
        <TeamLine p={match.away} won={match.sets_won?.away} highlight={isFollowed(match.away)} sets={awaySets} label={labelOf(match.away)} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <StatusBadge status={match.status} />
        <ChangeBadge change={match.latest_change} />
        {match.division && <span>{match.division.code ?? match.division.name}</span>}
        {match.round_label && <span>· {match.round_label}</span>}
      </div>
    </Link>
  );
}
