"use client";

import Link from "next/link";
import { ArrowLeft, Clock, Hourglass, MapPin } from "lucide-react";
import type { Change, Participant } from "@/lib/api";
import { courtPlace, estimateLine, formatDay, formatRelative, formatTime } from "@/lib/format";
import { useMatch } from "@/lib/queries";
import { FreshnessNote } from "../freshness";
import { StatusBadge } from "../match-card";
import { Card, ErrorState, Loading, SectionTitle } from "../ui";

const LABELS: Record<string, string> = {
  time_changed: "Time changed",
  court_changed: "Court changed",
  status_changed: "Status changed",
  result_posted: "Result posted",
  result_corrected: "Result corrected",
  participants_resolved: "Teams confirmed",
  next_match_set: "Next match set",
};

function describe(change: Change, timeZone: string): string {
  const d = change.diff as Record<string, [unknown, unknown]>;
  switch (change.event_type) {
    case "court_changed":
      return `${d.court?.[0] ?? "No court"} → ${d.court?.[1] ?? "No court"}`;
    case "time_changed":
      return `${formatTime(d.scheduled_start?.[0] as string | null, timeZone)} → ${formatTime(d.scheduled_start?.[1] as string | null, timeZone)}`;
    case "status_changed":
      return `${d.status?.[0]} → ${d.status?.[1]}`;
    case "next_match_set": {
      const filled = (change.diff.filled ?? []) as { placeholder: string | null; team_name: string }[];
      return filled.map((f) => `${f.placeholder ?? "To be decided"} → ${f.team_name}`).join(", ");
    }
    default:
      return "";
  }
}

function Team({ p, eventId }: { p: Participant; eventId: string }) {
  if (!p.entry_id) return <span className="italic text-muted">{p.placeholder ?? "To be decided"}</span>;
  return (
    <Link href={`/events/${eventId}/teams/${p.entry_id}`} className="font-semibold underline decoration-border underline-offset-4">
      {p.team_name}
    </Link>
  );
}

export function MatchView({ eventId, matchId }: { eventId: string; matchId: string }) {
  const query = useMatch(matchId);
  if (query.isPending) return <Loading label="Loading match" />;
  if (query.error) return <ErrorState error={query.error} />;
  const m = query.data.data;
  const start = m.scheduled_start;
  const estimate = estimateLine(m);
  const notice = m.delay_notice;

  return (
    <div>
      <Link href={`/events/${eventId}/matches`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeft aria-hidden className="h-4 w-4" /> All matches
      </Link>
      <p className="text-sm text-muted">{[m.division?.name, m.round_label].filter(Boolean).join(" · ")}</p>
      <h1 className="mt-1 text-xl font-bold leading-snug">
        <Team p={m.home} eventId={eventId} /> <span className="font-normal text-muted">vs</span> <Team p={m.away} eventId={eventId} />
      </h1>
      <div className="mt-2 flex flex-wrap gap-2">
        <StatusBadge status={m.status} expectedSoon={m.expected_to_start_soon} />
      </div>

      <Card className="mt-4 space-y-2">
        <p className="flex items-center gap-2">
          <Clock aria-hidden className="h-4 w-4 text-brand" />
          {start ? `${formatDay(start, m.timezone)}, ${estimate ? "Official " : ""}${formatTime(start, m.timezone)}` : "Time to be confirmed"}
          {estimate && <span className="text-warn">· {estimate}</span>}
        </p>
        {notice && (
          <p className="flex items-start gap-2 text-sm">
            <Hourglass aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
            <span>
              {m.court?.label ?? "This court"} is running about {notice.minutes} minutes late. Posted by {notice.posted_by} at{" "}
              {formatTime(notice.posted_at, m.timezone)}, until {formatTime(notice.expires_at, m.timezone)}.
            </span>
          </p>
        )}
        <p className="flex items-center gap-2">
          <MapPin aria-hidden className="h-4 w-4 text-brand" />
          {m.court ? (
            <Link href={`/events/${eventId}/guide#venue-${m.court.venue_id}`} className="underline">
              {courtPlace(m.court)}, {m.court.venue_name}
            </Link>
          ) : (
            "Court to be confirmed"
          )}
        </p>
      </Card>

      <SectionTitle>Score</SectionTitle>
      {m.sets.length ? (
        <Card className="p-0">
          <table className="w-full text-center text-sm tabular-nums">
            <caption className="sr-only">Set scores</caption>
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">Team</th>
                {m.sets.map((s) => (
                  <th key={s.set_number} scope="col" className="px-2 py-2">Set {s.set_number}</th>
                ))}
                <th scope="col" className="px-3 py-2">Sets</th>
              </tr>
            </thead>
            <tbody>
              {(["home", "away"] as const).map((side) => (
                <tr key={side} className="border-b border-border last:border-0">
                  <th scope="row" className="px-3 py-2 text-left font-medium">{m[side].team_name ?? m[side].placeholder}</th>
                  {m.sets.map((s) => (
                    <td key={s.set_number} className="px-2 py-2">{s[side] ?? "–"}</td>
                  ))}
                  <td className="px-3 py-2 font-bold">{m.sets_won?.[side] ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <p className="text-sm text-muted">No score published yet.</p>
      )}
      {m.result_state === "provisional" && <p className="mt-1 text-xs text-warn">Provisional until the source marks the match final.</p>}

      {m.history.length > 0 && (
        <>
          <SectionTitle>Changes</SectionTitle>
          <ol className="space-y-2">
            {m.history.map((h) => (
              <li key={h.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <span className="font-semibold">{LABELS[h.event_type] ?? h.event_type}</span>
                {h.simulated && <span className="text-muted"> (simulated)</span>} {describe(h, m.timezone)}
                <span className="block text-xs text-muted">{formatRelative(h.occurred_at)}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      <p className="mt-6 text-xs text-muted">
        From {m.source.name}. Seen by Courtside {formatRelative(m.source.observed_at)}
        {m.source.source_updated_at ? `; source updated ${formatRelative(m.source.source_updated_at)}` : "; source update time unknown"}.
      </p>
      <FreshnessNote sources={query.data.sources.filter((s) => s.id === m.source.id)} />
    </div>
  );
}
