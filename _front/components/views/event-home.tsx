"use client";

import { useHydrated } from "@/lib/hydration";

import Link from "next/link";
import { Info, Megaphone, Tags, Check, Shirt } from "lucide-react";
import { useAnnouncements, useEvent, useMatches } from "@/lib/queries";
import { useFollows } from "@/lib/follows";
import { formatDateRange, formatRelative } from "@/lib/format";
import { FreshnessNote } from "../freshness";
import { SaveEventButton } from "../event-tile";
import { MatchCard } from "../match-card";
import { usePreference } from "@/lib/preferences";
import { isRelevantAnnouncement } from "@/lib/relevance";
import { CourtOverview } from "../court-overview";
import { EventLogo } from "../ova-venue";
import { MyDayPanel } from "../my-day-links";
import { Card, ErrorState, Loading, SectionTitle } from "../ui";

export function EventHomeView({ eventId }: { eventId: string }) {
  const hydrated = useHydrated();
  const live = useMatches(
    eventId,
    new URLSearchParams({ status: "in_progress" }),
  );
  const upcoming = useMatches(
    eventId,
    new URLSearchParams({ status: "upcoming" }),
  );
  const [attended, setAttended] = usePreference<string[]>("attended", []);
  const [saved] = usePreference<string[]>("saved-events", []);
  const event = useEvent(eventId);
  const announcements = useAnnouncements(eventId);
  const { ids, divisionIds } = useFollows(eventId);

  if (!hydrated || event.isPending) return <Loading label="Loading event" />;
  if (event.error && !event.data) return <ErrorState error={event.error} />;
  const e = event.data.data;
  const audience = {
    savedEvent: saved.includes(eventId),
    entryIds: ids,
    divisionIds,
  };
  const notices =
    announcements.data?.data.filter((a) =>
      isRelevantAnnouncement(a, audience),
    ) ?? [];
  const comingUp =
    upcoming.data?.data.filter((m) => {
      const start = m.estimated_start ?? m.scheduled_start;
      return !start || Date.parse(start) > new Date().getTime();
    }) ?? [];

  return (
    <div>
      <div className="page-heading event-heading">
        <EventLogo
          event={{ title: e.title, venues: e.venues.map((v) => v.name) }}
          size={88}
        />
        <h1>{e.title}</h1>
      </div>
      <p className="mt-1 text-sm text-muted">
        {formatDateRange(e.start_date, e.end_date)} ·{" "}
        {e.kind === "beach" ? "Beach" : "Indoor"} · {e.counts.entries} teams in{" "}
        {e.divisions.length} divisions
      </p>

      <div className="tournament-actions">
        <div className="tournament-save">
          <SaveEventButton slug={e.slug} />
          <Link
            className="icon-link team-label-link"
            href={`/events/${eventId}/my-teams`}
            aria-label="My teams and kids’ names"
            title="My teams and kids’ names"
          >
            <Tags size={19} aria-hidden />
          </Link>
          <Link
            className="icon-link"
            href={`/events/${eventId}/guide#merchandise`}
            aria-label="Event merchandise"
            title="Merchandise"
          >
            <Shirt size={19} aria-hidden />
          </Link>
        </div>
        <button
          className="secondary-link attendance-toggle"
          aria-label="Attended"
          aria-pressed={attended.includes(e.slug)}
          onClick={() =>
            setAttended(
              attended.includes(e.slug)
                ? attended.filter((id) => id !== e.slug)
                : [...attended, e.slug],
            )
          }
        >
          <Check size={15} aria-hidden /> Attended
        </button>
      </div>
      <MyDayPanel eventId={eventId} />
      {e.counts.matches > 0 && (
        <>
          <SectionTitle
            action={
              <Link
                href={`/events/${eventId}/matches`}
                className="text-sm text-brand underline"
              >
                All matches →
              </Link>
            }
          >
            Live on court
          </SectionTitle>
          {live.isPending ? (
            <Loading label="Loading live matches" />
          ) : live.error && !live.data ? (
            <ErrorState error={live.error} />
          ) : live.data?.data.length ? (
            <>
              <ul className="event-carousel live-carousel">
                {live.data.data.map((m) => (
                  <li key={m.id}>
                    <MatchCard match={m} eventId={eventId} showSource={false} />
                  </li>
                ))}
              </ul>
              {live.hasNextPage && (
                <button
                  className="secondary-link"
                  disabled={live.isFetchingNextPage}
                  onClick={() => live.fetchNextPage()}
                >
                  More live matches
                </button>
              )}
            </>
          ) : (
            <p className="empty-inline">
              No matches currently marked in progress by the source.
            </p>
          )}
        </>
      )}
      <SectionTitle>Coming up</SectionTitle>
      {upcoming.isPending ? (
        <Loading label="Loading upcoming matches" />
      ) : upcoming.error && !upcoming.data ? (
        <ErrorState error={upcoming.error} />
      ) : comingUp.length ? (
        <ul className="event-carousel live-carousel">
          {comingUp.slice(0, 8).map((m) => (
            <li key={m.id}>
              <MatchCard
                match={m}
                eventId={eventId}
                showDay
                showSource={false}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-inline">No upcoming matches published yet.</p>
      )}
      <SectionTitle>
        <span className="flex items-center gap-2">
          <Megaphone aria-hidden className="h-4 w-4 text-brand" /> Announcements
        </span>
      </SectionTitle>
      {notices.length ? (
        <ul
          className="event-carousel announcements-carousel"
          aria-label="Event announcements"
        >
          {notices.map((a) => (
            <li key={a.id}>
              <Card
                className={a.category === "safety" ? "border-danger/40" : ""}
              >
                <p className="font-semibold">{a.title}</p>
                <p className="mt-1 whitespace-pre-line text-sm">{a.body}</p>
                <p className="mt-2 text-xs text-muted">
                  Posted {formatRelative(a.publish_at)}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No announcements right now.</p>
      )}

      <SectionTitle>At the venue</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        {e.venues.map((v) => (
          <Card key={v.id}>
            <p className="font-semibold">{v.name}</p>
            {v.address && <p className="text-sm text-muted">{v.address}</p>}
            {v.courts.length > 0 && (
              <CourtOverview venue={v} eventId={eventId} />
            )}
          </Card>
        ))}
      </div>
      <Link
        href={`/events/${eventId}/guide`}
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand underline"
      >
        <Info aria-hidden className="h-4 w-4" /> Parking, food, accessibility
        and help
      </Link>

      <FreshnessNote sources={event.data.sources} />
    </div>
  );
}
