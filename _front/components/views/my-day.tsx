"use client";
import Link from "next/link";
import { API_BASE, type Match } from "@/lib/api";
import { useFollows, useTeamLabel } from "@/lib/follows";
import { useEvent, useMyDay } from "@/lib/queries";
import { MatchCard } from "../match-card";
import { FreshnessNote } from "../freshness";
import {
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageTitle,
  SectionTitle,
} from "../ui";

export function MyDayView({ eventId }: { eventId: string }) {
  const { directTeamIds, divisionIds } = useFollows(eventId);
  const query = useMyDay(eventId, directTeamIds);
  const event = useEvent(eventId);
  if (!directTeamIds.length && !divisionIds.length)
    return (
      <>
        <PageTitle>My Day</PageTitle>
        <EmptyState title="Make the event yours">
          <p>Follow your teams or a division to see what happens next.</p>
          <Link
            href={`/events/${eventId}/teams`}
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand underline"
          >
            Find teams & divisions →
          </Link>
        </EmptyState>
      </>
    );
  const day = query.data?.data;
  const next = day?.next_match_id ? day.matches[day.next_match_id] : null;
  return (
    <div>
      <PageTitle subtitle="Your teams first. The wider competition just below.">
        My Day
      </PageTitle>
      <Link
        href={`/events/${eventId}/my-teams`}
        className="mb-4 inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-semibold text-brand"
      >
        Manage my teams & labels →
      </Link>
      {!!directTeamIds.length &&
        (query.isPending ? (
          <Loading label="Building your day" />
        ) : query.error ? (
          <ErrorState error={query.error} />
        ) : (
          day && (
            <>
              <section aria-labelledby="next-match">
                <h2
                  id="next-match"
                  className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted"
                >
                  Next match
                </h2>
                {next ? (
                  <LabelledMatch
                    match={next}
                    eventId={eventId}
                    followed={directTeamIds}
                  />
                ) : (
                  <EmptyState title="No upcoming matches with a confirmed time" />
                )}
              </section>
              {day.conflicts.map((c) => (
                <div
                  key={c.match_ids.join()}
                  role="note"
                  className="mt-4 rounded-xl border border-warn/40 bg-warn-soft p-4 text-sm text-warn"
                >
                  <p className="font-semibold">
                    {c.match_ids.length} matches may overlap
                    {c.different_venues ? " across different venues" : ""}
                  </p>
                  <p className="mt-1">
                    {c.match_ids
                      .map((id) => {
                        const m = day.matches[id];
                        return `${m.home.team_name ?? m.home.placeholder} vs ${m.away.team_name ?? m.away.placeholder}`;
                      })
                      .join("; ")}
                  </p>
                  <p className="mt-1 text-xs">
                    Assumes {day.assumed_match_minutes} minutes per match, using
                    estimated starts where available.
                  </p>
                </div>
              ))}
              <MatchSection
                title="Coming up"
                ids={day.upcoming_ids.filter((id) => id !== day.next_match_id)}
                matches={day.matches}
                eventId={eventId}
                followed={directTeamIds}
              />
              {!!day.work_duties?.length && (
                <section>
                  <SectionTitle>Work duties</SectionTitle>
                  <p className="mb-2 text-xs text-muted">
                    Your team is assigned to officiate these matches by the
                    competition source.
                  </p>
                  <ul className="space-y-2">
                    {day.work_duties.map((m) => (
                      <li key={m.id}>
                        <Card className="border-info/30">
                          <p className="mb-2 text-sm font-semibold text-info">
                            Work duty · referee / scorekeeping
                          </p>
                          <MatchCard match={m} eventId={eventId} showDay />
                        </Card>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <MatchSection
                title="Awaiting schedule"
                ids={day.awaiting_schedule_ids}
                matches={day.matches}
                eventId={eventId}
                followed={directTeamIds}
              />
              <MatchSection
                title="Results"
                ids={day.completed_ids}
                matches={day.matches}
                eventId={eventId}
                followed={directTeamIds}
              />
              <FreshnessNote sources={query.data?.sources} />
            </>
          )
        ))}
      {divisionIds.length > 0 && (
        <section>
          <SectionTitle>Divisions you follow</SectionTitle>
          <div className="space-y-3">
            {divisionIds.map((id) => (
              <DivisionDay
                key={id}
                eventId={eventId}
                id={id}
                name={
                  event.data?.data.divisions.find((d) => d.id === id)?.name ??
                  "Followed division"
                }
              />
            ))}
          </div>
        </section>
      )}
      <Card className="mt-6">
        <a
          href={`${API_BASE}/v1/events/${eventId}/calendar.ics?entry_ids=${directTeamIds.join(",")}&division_ids=${divisionIds.join(",")}`}
          className="inline-flex min-h-11 items-center font-semibold text-brand underline"
        >
          Download matches to calendar
        </a>
        <p className="text-xs text-muted">
          One-time snapshot. Times will not update automatically.
        </p>
      </Card>
      <p className="mt-4 text-xs text-muted">
        Your follows and labels stay on this device. Following grants no coach
        or guardian access.
      </p>
    </div>
  );
}
function LabelledMatch({
  match,
  eventId,
  followed,
}: {
  match: Match;
  eventId: string;
  followed: string[];
}) {
  const home = useTeamLabel(eventId, match.home.entry_id ?? "");
  const away = useTeamLabel(eventId, match.away.entry_id ?? "");
  const labels = [
    followed.includes(match.home.entry_id ?? "") ? home.label : "",
    followed.includes(match.away.entry_id ?? "") ? away.label : "",
  ].filter(Boolean);
  return (
    <div>
      {labels.length > 0 && (
        <p className="mb-1 px-1 text-sm font-semibold text-brand">
          {labels.join(" · ")}
        </p>
      )}
      <MatchCard match={match} eventId={eventId} followed={followed} showDay />
    </div>
  );
}
function MatchSection({
  title,
  ids,
  matches,
  eventId,
  followed,
}: {
  title: string;
  ids: string[];
  matches: Record<string, Match>;
  eventId: string;
  followed: string[];
}) {
  return ids.length ? (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <ul className="space-y-3">
        {ids.map((id) => (
          <li key={id}>
            <LabelledMatch
              match={matches[id]}
              eventId={eventId}
              followed={followed}
            />
          </li>
        ))}
      </ul>
    </section>
  ) : null;
}
function DivisionDay({
  eventId,
  id,
  name,
}: {
  eventId: string;
  id: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded-xl border border-border bg-surface"
    >
      <summary className="min-h-12 cursor-pointer p-4 text-sm font-semibold">
        {name}
      </summary>
      {open && <DivisionContents eventId={eventId} id={id} />}
    </details>
  );
}
import { useState } from "react";
function DivisionContents({ eventId, id }: { eventId: string; id: string }) {
  const query = useMyDay(eventId, [], [id]);
  const day = query.data?.data;
  return (
    <div className="px-4 pb-4">
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : day ? (
        <>
          <MatchSection
            title="Division schedule"
            ids={[...day.upcoming_ids, ...day.awaiting_schedule_ids]}
            matches={day.matches}
            eventId={eventId}
            followed={[]}
          />
          <MatchSection
            title="Division results"
            ids={day.completed_ids}
            matches={day.matches}
            eventId={eventId}
            followed={[]}
          />
          {!day.upcoming_ids.length &&
            !day.awaiting_schedule_ids.length &&
            !day.completed_ids.length && (
              <EmptyState title="No matches published yet" />
            )}
        </>
      ) : null}
      <Link
        href={`/events/${eventId}/pathway`}
        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline"
      >
        Open pool & playoff path →
      </Link>
    </div>
  );
}
