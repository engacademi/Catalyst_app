"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CalendarCheck, Megaphone, RefreshCw } from "lucide-react";
import type { Change, Match } from "@/lib/api";
import { useFollows, useLastSeen } from "@/lib/follows";
import { formatRelative, formatTime } from "@/lib/format";
import { useChanges } from "@/lib/queries";
import { Badge, EmptyState, ErrorState, Loading, PageTitle } from "../ui";

const TITLES: Record<string, string> = {
  time_changed: "Time changed",
  court_changed: "Court changed",
  status_changed: "Status changed",
  result_posted: "Result posted",
  result_corrected: "Result corrected",
  participants_resolved: "Teams confirmed",
  next_match_set: "Next match set",
};

type Filled = { entry_id: string; team_name: string; placeholder: string | null; opponent: string | null };

// "Gold medal vs Venom Havoc, Court 12, 2:00 pm", told from the followed team's side.
function nextMatchLine(c: Change, followed: string[], tz: string): string {
  const d = c.diff as { filled?: Filled[]; round?: string | null; court?: string | null; scheduled_start?: string | null };
  const filled = d.filled?.find((f) => followed.includes(f.entry_id)) ?? d.filled?.[0];
  if (!filled) return "";
  return [`${d.round ?? filled.team_name} vs ${filled.opponent ?? "TBD"}`, d.court ?? "court to be confirmed", formatTime(d.scheduled_start ?? null, tz)].join(", ");
}

function matchLine(m: Match | undefined) {
  if (!m) return "";
  return `${m.home.team_name ?? m.home.placeholder} vs ${m.away.team_name ?? m.away.placeholder}`;
}

function detail(c: Change, m: Match | undefined): string {
  const d = c.diff as Record<string, [unknown, unknown]>;
  const tz = m?.timezone ?? "America/Toronto";
  if (c.event_type === "court_changed") return `Now on ${d.court?.[1] ?? "a court to be confirmed"} (was ${d.court?.[0] ?? "unassigned"}).`;
  if (c.event_type === "time_changed")
    return `Now ${formatTime(d.scheduled_start?.[1] as string | null, tz)} (was ${formatTime(d.scheduled_start?.[0] as string | null, tz)}).`;
  if (c.event_type === "status_changed") return `Status: ${String(d.status?.[1]).replace("_", " ")}.`;
  if (c.event_type.startsWith("result") && m?.sets_won) return `Sets ${m.sets_won.home}–${m.sets_won.away}.`;
  return "";
}

export function UpdatesView({ eventId }: { eventId: string }) {
  const query = useChanges(eventId);
  const { ids } = useFollows(eventId);
  const { lastSeen, markSeen } = useLastSeen(eventId);
  const latest = query.data?.latest_id ?? 0;

  // Mark everything as seen a moment after the page shows it.
  useEffect(() => {
    if (!latest || latest <= lastSeen) return;
    const t = setTimeout(() => markSeen(latest), 1500);
    return () => clearTimeout(t);
  }, [latest, lastSeen, markSeen]);

  if (query.isPending) return <Loading label="Loading updates" />;
  if (query.error) return <ErrorState error={query.error} />;

  // Filtering happens here on the device, so the server never learns who follows what.
  const relevant = query.data.data.filter((c) => c.entry_ids.length === 0 || c.entry_ids.some((e) => ids.includes(e)));

  return (
    <div>
      <PageTitle subtitle="Event-wide notices plus changes to the teams you follow.">Updates</PageTitle>
      <div aria-live="polite">
        {relevant.length === 0 ? (
          <EmptyState title="Nothing new">
            {ids.length ? "Changes to your teams' matches will appear here." : "Follow teams to see changes to their matches here."}
          </EmptyState>
        ) : (
          <ol className="space-y-2">
            {relevant.map((c) => {
              const isNew = c.id > lastSeen;
              if (c.entity_type === "announcement") {
                const a = query.data.announcements[c.entity_id];
                if (!a) return null;
                return (
                  <li key={c.id} className={`rounded-xl border bg-surface p-4 ${isNew ? "border-brand" : "border-border"}`}>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Megaphone aria-hidden className="h-4 w-4 text-brand" /> {a.title}
                      {isNew && <Badge tone="brand">New</Badge>}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm">{a.body}</p>
                    <p className="mt-2 text-xs text-muted">{formatRelative(c.occurred_at)}</p>
                  </li>
                );
              }
              const m = query.data.matches[c.entity_id];
              const nextMatch = c.event_type === "next_match_set";
              return (
                <li key={c.id}>
                  <Link
                    href={`/events/${eventId}/matches/${c.entity_id}`}
                    className={`block rounded-xl border bg-surface p-4 ${isNew ? "border-brand" : "border-border"}`}
                  >
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {nextMatch ? (
                        <CalendarCheck aria-hidden className="h-4 w-4 text-brand" />
                      ) : (
                        <RefreshCw aria-hidden className="h-4 w-4 text-warn" />
                      )}{" "}
                      {TITLES[c.event_type] ?? "Match updated"}
                      {isNew && <Badge tone="brand">New</Badge>}
                      {c.simulated && <Badge tone="warn">Simulated</Badge>}
                    </p>
                    {nextMatch ? (
                      <p className="mt-1 text-sm">{nextMatchLine(c, ids, m?.timezone ?? "America/Toronto")}</p>
                    ) : (
                      <>
                        <p className="mt-1 text-sm">{matchLine(m)}</p>
                        <p className="text-sm text-muted">{detail(c, m)}</p>
                      </>
                    )}
                    <p className="mt-2 text-xs text-muted">{formatRelative(c.occurred_at)}</p>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <p className="mt-4 text-xs text-muted">
        Updates refresh about every 30 seconds while this page is open. They aren&apos;t push notifications and shouldn&apos;t be relied
        on as the only emergency channel.
      </p>
    </div>
  );
}
