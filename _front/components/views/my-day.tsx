"use client";

import Link from "next/link";
import { AlertTriangle, CalendarPlus, HelpCircle } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { useFollows } from "@/lib/follows";
import { useLabels } from "@/lib/labels";
import { dayKey, formatDay } from "@/lib/format";
import { useMyDay } from "@/lib/queries";
import { FreshnessNote } from "../freshness";
import { MatchCard } from "../match-card";
import { WorkDuties } from "../work-duties";
import { Card, EmptyState, ErrorState, Loading, PageTitle, SectionTitle } from "../ui";

export function MyDayView({ eventId }: { eventId: string }) {
  const { ids } = useFollows(eventId);
  const { labels, labelFor } = useLabels(eventId);
  const query = useMyDay(eventId, ids);

  if (ids.length === 0) {
    return (
      <div>
        <PageTitle>My Day</PageTitle>
        <EmptyState title="You aren't following any teams yet">
          <p>Follow one or more teams and their matches show up here in one schedule.</p>
          <Link href={`/events/${eventId}/teams`} className="mt-3 inline-block font-semibold text-brand underline">
            Find teams
          </Link>
        </EmptyState>
        <DeviceNote />
      </div>
    );
  }
  if (query.isPending) return <Loading label="Building your day" />;
  if (query.error) return <ErrorState error={query.error} />;

  const day = query.data.data;
  const m = (id: string) => day.matches[id];
  const next = day.next_match_id ? m(day.next_match_id) : null;
  const conflictIds = new Set(day.conflicts.flatMap((c) => c.match_ids));
  const upcoming = day.upcoming_ids.filter((id) => id !== day.next_match_id);
  const byDay = new Map<string, string[]>();
  for (const id of upcoming) {
    const match = m(id);
    const key = dayKey(match.estimated_start ?? match.scheduled_start, match.timezone);
    byDay.set(key, [...(byDay.get(key) ?? []), id]);
  }

  return (
    <div>
      <PageTitle
        subtitle={
          <>
            Following {day.entries.map((e) => (labelFor(e.id) ? `${labelFor(e.id)} (${e.team_name})` : e.team_name)).join(", ")}
            {" · "}
            <Link href={`/events/${eventId}/my-teams`} className="font-semibold text-brand underline">
              My teams
            </Link>
          </>
        }
      >
        My Day
      </PageTitle>

      <section aria-labelledby="next-match">
        <h2 id="next-match" className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Next match
        </h2>
        {next ? (
          <MatchCard match={next} eventId={eventId} followed={ids} labels={labels} showDay />
        ) : (
          <EmptyState title="No upcoming matches with a confirmed time" />
        )}
      </section>

      {day.conflicts.length > 0 && (
        <section aria-labelledby="overlaps" className="mt-6">
          <h2 id="overlaps" className="sr-only">
            Overlapping matches
          </h2>
          {day.conflicts.map((c) => (
            <div key={c.match_ids.join()} role="note" className="mb-2 flex gap-2 rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm text-warn">
              <AlertTriangle aria-hidden className="h-5 w-5 shrink-0" />
              <p>
                {c.match_ids.length} of your matches may overlap
                {c.different_venues ? " and are in different venues" : ""}:{" "}
                {c.match_ids
                  .map((id) => {
                    const x = m(id);
                    const side = (p: typeof x.home) => labelFor(p.entry_id) ?? p.team_name ?? p.placeholder;
                    return `${side(x.home)} vs ${side(x.away)}`;
                  })
                  .join("; ")}
                . This assumes each match takes about {day.assumed_match_minutes} minutes.
              </p>
            </div>
          ))}
        </section>
      )}

      <WorkDuties duties={day.work_duties} matches={day.matches} showTeam={day.entries.length > 1} />

      {[...byDay.entries()].map(([key, matchIds]) => (
        <section key={key}>
          <SectionTitle>{formatDay(m(matchIds[0]).scheduled_start ?? m(matchIds[0]).estimated_start, m(matchIds[0]).timezone)}</SectionTitle>
          <ul className="space-y-2">
            {matchIds.map((id) => (
              <li key={id} className={conflictIds.has(id) ? "rounded-xl ring-2 ring-warn/50" : ""}>
                <MatchCard match={m(id)} eventId={eventId} followed={ids} labels={labels} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {day.awaiting_schedule_ids.length > 0 && (
        <section>
          <SectionTitle>
            <span className="flex items-center gap-2">
              <HelpCircle aria-hidden className="h-4 w-4 text-muted" /> Awaiting schedule
            </span>
          </SectionTitle>
          <ul className="space-y-2">
            {day.awaiting_schedule_ids.map((id) => (
              <li key={id}>
                <MatchCard match={m(id)} eventId={eventId} followed={ids} labels={labels} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {day.completed_ids.length > 0 && (
        <section>
          <SectionTitle>Results</SectionTitle>
          <ul className="space-y-2">
            {day.completed_ids.map((id) => (
              <li key={id}>
                <MatchCard match={m(id)} eventId={eventId} followed={ids} labels={labels} showDay />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card className="mt-6">
        <a
          href={`${API_BASE}/v1/events/${eventId}/calendar.ics?entry_ids=${ids.slice(0, 20).join(",")}`}
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand underline"
        >
          <CalendarPlus aria-hidden className="h-4 w-4" /> Add these matches to your calendar
        </a>
        <p className="mt-1 text-xs text-muted">
          This is a one-time snapshot. If times change, the calendar won&apos;t update, so check here on the day.
        </p>
      </Card>

      <DeviceNote />
      <FreshnessNote sources={query.data.sources} />
    </div>
  );
}

function DeviceNote() {
  return (
    <p className="mt-4 text-xs text-muted">
      Your followed teams and labels are saved on this device only. Following a team doesn&apos;t make you a verified coach or guardian.
    </p>
  );
}
