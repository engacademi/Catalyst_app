"use client";

import { useHydrated } from "@/lib/hydration";

import Link from "next/link";
import {
  ArrowRight,
  Info,
  ListOrdered,
  Megaphone,
  Users,
  Tags,
  Check,
} from "lucide-react";
import { useAnnouncements, useEvent, useMatches } from "@/lib/queries";
import { useFollows } from "@/lib/follows";
import { formatDateRange, formatRelative } from "@/lib/format";
import { FreshnessNote } from "../freshness";
import { SaveEventButton } from "../event-tile";
import { MatchCard } from "../match-card";
import { usePreference } from "@/lib/preferences";
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
  const event = useEvent(eventId);
  const announcements = useAnnouncements(eventId);
  const { ids, divisionIds } = useFollows(eventId);

  if (!hydrated || event.isPending) return <Loading label="Loading event" />;
  if (event.error) return <ErrorState error={event.error} />;
  const e = event.data.data;
  const notices =
    announcements.data?.data.filter(
      (a) =>
        (!a.entry_id && !a.division_id) ||
        (!!a.entry_id && ids.includes(a.entry_id)) ||
        (!!a.division_id && divisionIds.includes(a.division_id)),
    ) ?? [];
  const comingUp =
    upcoming.data?.data.filter((m) => {
      const start = m.estimated_start ?? m.scheduled_start;
      return !start || Date.parse(start) > new Date().getTime();
    }) ?? [];

  return (
    <div>
      <div className="page-heading">
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
            aria-label="Manage team labels"
            title="Team labels"
          >
            <Tags size={19} aria-hidden />
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
      ) : live.error ? (
        <ErrorState error={live.error} />
      ) : live.data?.data.length ? (
        <>
          <ul className="event-carousel live-carousel">
            {live.data.data.map((m) => (
              <li key={m.id}>
                <MatchCard match={m} eventId={eventId} />
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
      <SectionTitle>Coming up</SectionTitle>
      {upcoming.isPending ? (
        <Loading label="Loading upcoming matches" />
      ) : upcoming.error ? (
        <ErrorState error={upcoming.error} />
      ) : comingUp.length ? (
        <ul className="event-carousel live-carousel">
          {comingUp.slice(0, 8).map((m) => (
            <li key={m.id}>
              <MatchCard match={m} eventId={eventId} showDay />
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-inline">No upcoming matches published yet.</p>
      )}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          {
            href: "teams",
            icon: Users,
            title: "Find your team",
            text: `${e.counts.entries} teams · ${e.divisions.length} divisions`,
          },
          {
            href: "matches",
            icon: ListOrdered,
            title: "Match centre",
            text: `${e.counts.matches} published matches`,
          },
          {
            href: "guide",
            icon: Info,
            title: "Make yourself at home",
            text: "Parking, food & venue help",
          },
        ].map(({ href, icon: Icon, title, text }) => (
          <Link
            key={href}
            href={`/events/${eventId}/${href}`}
            className="ui-card border border-border bg-surface p-5 hover:border-brand"
          >
            <Icon size={21} aria-hidden className="mb-4 text-brand" />
            <p className="font-display text-sm font-bold">{title}</p>
            <p className="mt-1 text-xs text-muted">{text}</p>
            <ArrowRight size={16} aria-hidden className="mt-4 text-brand" />
          </Link>
        ))}
      </div>

      <SectionTitle>
        <span className="flex items-center gap-2">
          <Megaphone aria-hidden className="h-4 w-4 text-brand" /> Announcements
        </span>
      </SectionTitle>
      {notices.length ? (
        <ul className="space-y-2">
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
            <p className="mt-1 text-sm">
              {v.courts.map((c) => c.label).join(", ")}
            </p>
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
