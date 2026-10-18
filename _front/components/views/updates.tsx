"use client";
import { usePreference } from "@/lib/preferences";
import { useHydrated } from "@/lib/hydration";

import Link from "next/link";
import { useEffect } from "react";
import { Megaphone, RefreshCw } from "lucide-react";
import type { Change, Match } from "@/lib/api";
import { changeTitle, delayText, timeChangeText } from "@/lib/change-text";
import { useEventKey, useFollows, useLastSeen } from "@/lib/follows";
import { formatRelative, formatTime } from "@/lib/format";
import { useSearchParams } from "next/navigation";
import { useMatch, useChanges } from "@/lib/queries";
import { isRelevantChange } from "@/lib/relevance";
import { LoadMore } from "../load-more";
import { Badge, EmptyState, ErrorState, Loading, PageTitle } from "../ui";

const TITLES: Record<string, string> = {
  time_changed: "Time changed",
  court_changed: "Court changed",
  status_changed: "Status changed",
  result_posted: "Result posted",
  result_corrected: "Result corrected",
  participants_resolved: "Next match set",
  details_changed: "Bracket details updated",
  work_assigned: "Work duty assigned",
};

function matchLine(m: Match | undefined) {
  if (!m) return "";
  return `${m.home.team_name ?? m.home.placeholder} vs ${m.away.team_name ?? m.away.placeholder}`;
}

function detail(c: Change, m: Match | undefined): string {
  const d = c.diff as Record<string, [unknown, unknown]>;
  const tz = m?.timezone ?? "America/Toronto";
  if (c.event_type === "delay_notice" || c.event_type === "delay_cleared")
    return delayText(c, tz);
  if (c.event_type === "participants_resolved")
    return `Next match set: ${m?.round_label ?? "Upcoming match"}, ${m?.court?.label ?? "court pending"}, ${formatTime(m?.scheduled_start ?? null, tz)}.`;
  if (c.event_type === "court_changed")
    return `Now on ${d.court?.[1] ?? "a court to be confirmed"} (was ${d.court?.[0] ?? "unassigned"}).`;
  if (c.event_type === "time_changed") return timeChangeText(c, tz);
  if (c.event_type === "status_changed")
    return `Status: ${String(d.status?.[1]).replace("_", " ")}.`;
  if (c.event_type.startsWith("result") && m?.sets_won)
    return `Sets ${m.sets_won.home}–${m.sets_won.away}.`;
  return "";
}

export function UpdatesView({ eventId }: { eventId: string }) {
  const hydrated = useHydrated();
  const matchId = useSearchParams().get("match");
  const [saved] = usePreference<string[]>("saved-events", []);
  const query = useChanges(eventId);
  const { ids, divisionIds } = useFollows(eventId);
  const { lastSeen, markSeen } = useLastSeen(eventId);
  const eventKey = useEventKey(eventId);
  const audience = {
    savedEvent: saved.includes(eventKey),
    entryIds: ids,
    divisionIds,
  };
  const latest = query.data?.latest_id ?? 0;

  // Mark everything as seen a moment after the page shows it.
  useEffect(() => {
    if (!latest || latest <= lastSeen) return;
    const t = setTimeout(() => markSeen(latest), 1500);
    return () => clearTimeout(t);
  }, [latest, lastSeen, markSeen]);

  if (!hydrated || query.isPending) return <Loading label="Loading updates" />;
  if (query.error && !query.data) return <ErrorState error={query.error} />;

  // Filtering happens here on the device, so the server never learns who follows what.
  const relevant = query.data!.data.filter((c) =>
    isRelevantChange(c, audience, query.data!.divisions),
  );

  return (
    <div>
      <PageTitle subtitle="Event-wide notices plus changes to the teams you follow.">
        Updates
      </PageTitle>
      {matchId && <DelayAlert matchId={matchId} />}
      <div aria-live="polite">
        {relevant.length === 0 ? (
          <EmptyState title="Nothing new">
            {ids.length
              ? "Changes to your teams' matches will appear here."
              : "Follow teams to see changes to their matches here."}
          </EmptyState>
        ) : (
          <ol className="updates-list">
            {relevant.map((c) => {
              const isNew = c.id > lastSeen;
              if (c.entity_type === "announcement") {
                const a = query.data!.announcements[c.entity_id];
                if (!a) return null;
                return (
                  <li
                    key={c.id}
                    className={`update-card ${isNew ? "update-card-new" : ""}`}
                  >
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Megaphone aria-hidden className="h-4 w-4 text-brand" />{" "}
                      {a.title}
                      {isNew && <Badge tone="brand">New</Badge>}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm">{a.body}</p>
                    <p className="mt-2 text-xs text-muted">
                      {formatRelative(c.occurred_at)}
                    </p>
                  </li>
                );
              }
              const m = query.data!.matches[c.entity_id];
              return (
                <li key={c.id}>
                  <Link
                    href={`/events/${eventId}/matches/${c.entity_id}`}
                    className={`update-card ${isNew ? "update-card-new" : ""}`}
                  >
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <RefreshCw aria-hidden className="h-4 w-4 text-warn" />{" "}
                      {changeTitle(c) ??
                        TITLES[c.event_type] ??
                        "Match updated"}
                      {isNew && <Badge tone="brand">New</Badge>}
                      {c.simulated && <Badge tone="warn">Simulated</Badge>}
                    </p>
                    <p className="mt-1 text-sm">{matchLine(m)}</p>
                    <p className="text-sm text-muted">{detail(c, m)}</p>
                    <p className="mt-2 text-xs text-muted">
                      {formatRelative(c.occurred_at)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <LoadMore query={query} label="older updates" />
      <p className="mt-4 text-xs text-muted">
        Updates refresh about every 30 seconds while this page is open. They
        aren&apos;t push notifications and shouldn&apos;t be relied on as the
        only emergency channel.
      </p>
    </div>
  );
}

function DelayAlert({ matchId }: { matchId: string }) {
  const query = useMatch(matchId);
  if (query.isPending) return <Loading label="Loading alert" />;
  if (query.error && !query.data) return <ErrorState error={query.error} />;
  const match = query.data.data;
  const delay = match.delay_notice;
  return (
    <section
      id={`match-${matchId}`}
      className="update-card mb-4"
      aria-label="Court delay alert"
    >
      <h2 className="font-semibold">
        {delay
          ? `Court running ~${delay.minutes} minutes late`
          : "No active court delay"}
      </h2>
      <p>
        {match.court?.label} · {match.court?.venue_name}
      </p>
      {delay && (
        <>
          <p>
            {delay.posted_by} posted this notice at{" "}
            {formatTime(delay.posted_at, match.timezone)}. Valid until{" "}
            {formatTime(delay.expires_at, match.timezone)}.
          </p>
          <p>
            Official start remains unchanged. Check the match for the latest
            estimated start.
          </p>
        </>
      )}
    </section>
  );
}
