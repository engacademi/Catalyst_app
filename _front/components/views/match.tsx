"use client";
import { useHydrated } from "@/lib/hydration";

import Link from "next/link";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import type { Change, Participant } from "@/lib/api";
import { changeTitle, delayText, timeChangeText } from "@/lib/change-text";
import { formatDay, formatRelative, formatTime } from "@/lib/format";
import { useMatch } from "@/lib/queries";
import { ScoreDispute } from "../score-dispute";
import { checkedLabel, FreshnessNote } from "../freshness";
import { StatusBadge } from "../match-card";
import { Card, ErrorState, Loading, SectionTitle } from "../ui";

const LABELS: Record<string, string> = {
  time_changed: "Time changed",
  court_changed: "Court changed",
  status_changed: "Status changed",
  result_posted: "Result posted",
  result_corrected: "Result corrected",
  participants_resolved: "Teams confirmed",
  delay_notice: "Court delay notice",
  delay_cleared: "Court delay cleared",
};

function describe(change: Change, timeZone: string): string {
  const d = change.diff as Record<string, [unknown, unknown]>;
  switch (change.event_type) {
    case "court_changed":
      return `${d.court?.[0] ?? "No court"} → ${d.court?.[1] ?? "No court"}`;
    case "time_changed":
      return timeChangeText(change, timeZone);
    case "delay_notice":
    case "delay_cleared":
      return delayText(change, timeZone);
    case "status_changed":
      return `${d.status?.[0]} → ${d.status?.[1]}`;
    default:
      return "";
  }
}

function Team({ p, eventId }: { p: Participant; eventId: string }) {
  if (!p.entry_id)
    return (
      <span className="italic text-muted">
        {p.placeholder ?? "To be decided"}
      </span>
    );
  return (
    <Link
      href={`/events/${eventId}/teams/${p.entry_id}`}
      className="font-semibold underline decoration-border underline-offset-4"
    >
      {p.team_name}
    </Link>
  );
}

export function MatchView({
  eventId,
  matchId,
}: {
  eventId: string;
  matchId: string;
}) {
  const hydrated = useHydrated();
  const query = useMatch(matchId);
  if (!hydrated || query.isPending) return <Loading label="Loading match" />;
  if (query.error) return <ErrorState error={query.error} />;
  const m = query.data.data;

  return (
    <div>
      <Link
        href={`/events/${eventId}/matches`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> All matches
      </Link>
      <p className="text-sm text-muted">
        {[m.division?.name, m.round_label].filter(Boolean).join(" · ")}
      </p>
      <h1 className="mt-3 font-display text-2xl font-bold leading-snug sm:text-3xl">
        <Team p={m.home} eventId={eventId} />{" "}
        <span className="font-normal text-muted">vs</span>{" "}
        <Team p={m.away} eventId={eventId} />
      </h1>
      <div className="mt-2 flex flex-wrap gap-2">
        <StatusBadge status={m.status} />
        {["in_progress", "completed"].includes(m.status) && (
          <ScoreDispute matchId={m.id} />
        )}
      </div>

      <Card className="mt-4 space-y-2">
        <p className="flex items-center gap-2">
          <Clock aria-hidden className="h-4 w-4 text-brand" />
          {m.scheduled_start
            ? `Official ${formatDay(m.scheduled_start, m.timezone)}, ${formatTime(m.scheduled_start, m.timezone)}`
            : "Official time to be confirmed"}
          {m.estimated_start && (
            <span className="text-sm text-muted">
              Est. ~{formatTime(m.estimated_start, m.timezone)}
            </span>
          )}
        </p>
        <p className="flex items-center gap-2">
          <MapPin aria-hidden className="h-4 w-4 text-brand" />
          {m.court ? (
            <Link
              href={`/events/${eventId}/guide#venue-${m.court.venue_id}`}
              className="underline"
            >
              {m.court.label}, {m.court.venue_name}
            </Link>
          ) : (
            "Court to be confirmed"
          )}
        </p>
      </Card>

      {m.delay_notice && (
        <p className="mt-3 rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm text-warn">
          Court running ~{m.delay_notice.minutes} minutes late ·{" "}
          <Link
            className="underline"
            href={`/events/${eventId}/updates?match=${m.id}#match-${m.id}`}
          >
            See alerts
          </Link>
        </p>
      )}
      {m.expected_start_soon && (
        <p className="mt-2 text-sm font-semibold text-warn">
          Expected to start soon · awaiting source confirmation
        </p>
      )}
      <SectionTitle>Score</SectionTitle>
      {m.sets.length ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-center text-sm tabular-nums">
            <caption className="sr-only">Set scores</caption>
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">
                  Team
                </th>
                {m.sets.map((s) => (
                  <th key={s.set_number} scope="col" className="px-2 py-2">
                    Set {s.set_number}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2">
                  Sets
                </th>
              </tr>
            </thead>
            <tbody>
              {(["home", "away"] as const).map((side) => (
                <tr key={side} className="border-b border-border last:border-0">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {m[side].team_name ?? m[side].placeholder}
                  </th>
                  {m.sets.map((s) => (
                    <td key={s.set_number} className="px-2 py-2">
                      {s[side] ?? "–"}
                    </td>
                  ))}
                  <td className="px-3 py-2 font-bold">
                    {m.sets_won?.[side] ?? "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <p className="text-sm text-muted">No score published yet.</p>
      )}
      {m.result_state === "provisional" && (
        <p className="mt-1 text-xs text-warn">
          Provisional until the source marks the match final.
        </p>
      )}

      {m.history.length > 0 && (
        <>
          <SectionTitle>Changes</SectionTitle>
          <ol className="space-y-2">
            {m.history.map((h) => (
              <li
                key={h.id}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <span className="font-semibold">
                  {changeTitle(h) ?? LABELS[h.event_type] ?? h.event_type}
                </span>
                {h.simulated && (
                  <span className="text-muted"> (simulated)</span>
                )}{" "}
                {describe(h, m.timezone)}
                <span className="block text-xs text-muted">
                  {formatRelative(h.occurred_at)}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      <p className="mt-6 text-xs text-muted">
        From {m.source.name}.{" "}
        {checkedLabel(
          m.source.freshness,
          m.source.last_checked_at ?? m.source.observed_at,
        )}
        {m.source.source_updated_at
          ? `; source updated ${formatRelative(m.source.source_updated_at)}`
          : "; source update time unknown"}
        .
      </p>
      <FreshnessNote
        sources={query.data.sources.filter((s) => s.id === m.source.id)}
      />
    </div>
  );
}
