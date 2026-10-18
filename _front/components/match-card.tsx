"use client";

import Link from "next/link";
import { ArrowRightLeft, Clock, MapPin, Whistle } from "lucide-react";
import type { Change, Match, Participant } from "@/lib/api";
import { formatDay, formatTime } from "@/lib/format";
import { useNow } from "@/lib/now";
import { TeamAvatar } from "./brand";
import { Badge } from "./ui";

const STATUS: Record<
  Match["status"],
  { label: string; tone: "neutral" | "brand" | "warn" | "danger" | "info" }
> = {
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
};

export function StatusBadge({
  status,
  unverified = false,
}: {
  status: Match["status"];
  unverified?: boolean;
}) {
  if (unverified && status === "in_progress")
    return <Badge tone="warn">*Unverified Match Result</Badge>;
  const s = STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function ChangeBadge({ change }: { change: Change | null }) {
  const now = useNow();
  if (!change) return null;
  // Badges fade after six hours so old changes don't look urgent.
  const recent =
    now - new Date(change.occurred_at).getTime() < 6 * 60 * 60 * 1000;
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

/** Name of the followed team the source assigns to work this match, if any. */
export function workDutyTeam(match: Match, followed: string[]) {
  if (!match.work_entry_id || !followed.includes(match.work_entry_id))
    return null;
  return match.work_team?.team_name ?? "Your team";
}

export function WorkDutyLabel({ team }: { team: string }) {
  return (
    <p className="match-duty">
      <Whistle aria-hidden className="h-4 w-4 shrink-0" />
      <span>
        <strong>Work duty: referee / scorekeeping</strong>
        <span className="match-duty-team">{team} officiates this match</span>
      </span>
    </p>
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
}: {
  p: Participant;
  won: number | undefined;
  highlight: boolean;
  sets: (number | null)[];
}) {
  return (
    <div className="match-team">
      <TeamAvatar name={name(p)} small />
      <span
        className={`match-team-name ${highlight ? "font-semibold" : ""} ${p.team_name ? "" : "italic text-muted"}`}
      >
        {name(p)}
        {!p.team_name && p.placeholder && (
          <span className="sr-only"> (placeholder until results decide)</span>
        )}
      </span>
      {won !== undefined && (
        <span className="match-score shrink-0">
          <span className="text-muted">
            {sets.map((s) => s ?? "–").join(" ")}
          </span>
          <span className="match-score-total">{won}</span>
        </span>
      )}
    </div>
  );
}

export function MatchCard({
  match,
  eventId,
  followed = [],
  showDay = false,
}: {
  match: Match;
  eventId: string;
  followed?: string[];
  showDay?: boolean;
  showSource?: boolean;
}) {
  const start = match.estimated_start ?? match.scheduled_start;
  const isFollowed = (p: Participant) =>
    !!p.entry_id && followed.includes(p.entry_id);
  const homeSets = match.sets.map((s) => s.home);
  const awaySets = match.sets.map((s) => s.away);
  const duty = workDutyTeam(match, followed);
  return (
    <article
      className={`match-card ${match.status === "cancelled" ? "match-card-cancelled" : ""} ${duty ? "match-card-duty" : ""}`}
    >
      {duty && <WorkDutyLabel team={duty} />}
      <div className="match-card-header">
        <span className="flex items-center gap-1 font-semibold">
          <Clock aria-hidden className="h-4 w-4 text-brand" />
          {showDay && start ? `${formatDay(start, match.timezone)}, ` : ""}
          {formatTime(match.scheduled_start, match.timezone)}
          {match.estimated_start && (
            <span className="font-normal text-muted">
              · Est. ~{formatTime(start, match.timezone)}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 text-muted">
          <MapPin aria-hidden className="h-4 w-4" />
          {match.court
            ? `${match.court.label}, ${match.court.venue_name}`
            : "Court to be confirmed"}
        </span>
      </div>
      {match.delay_notice && (
        <p className="mb-2 rounded-lg bg-warn-soft px-2 py-1 text-xs text-warn">
          Court running ~{match.delay_notice.minutes} minutes late ·{" "}
          <Link
            className="match-alert-link underline"
            href={`/events/${eventId}/updates?match=${match.id}#match-${match.id}`}
          >
            See alerts
          </Link>
        </p>
      )}
      {match.expected_start_soon && (
        <p className="mb-2 text-xs font-semibold text-warn">
          Expected to start soon · awaiting source confirmation
        </p>
      )}
      <div className="space-y-1">
        <TeamLine
          p={match.home}
          won={match.sets_won?.home}
          highlight={isFollowed(match.home)}
          sets={homeSets}
        />
        <TeamLine
          p={match.away}
          won={match.sets_won?.away}
          highlight={isFollowed(match.away)}
          sets={awaySets}
        />
      </div>
      <div className="match-card-meta">
        <StatusBadge status={match.status} unverified />
        <ChangeBadge change={match.latest_change} />
        {match.division && (
          <span>{match.division.code ?? match.division.name}</span>
        )}
        {match.round_label && <span>· {match.round_label}</span>}
      </div>
      <Link
        className="match-details-link"
        href={`/events/${eventId}/matches/${match.id}`}
      >
        <span className="sr-only">
          Match details: {name(match.home)} vs {name(match.away)}
        </span>
      </Link>
    </article>
  );
}
