"use client";

import { useHydrated } from "@/lib/hydration";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Info,
  ListOrdered,
  Megaphone,
  Users,
} from "lucide-react";
import { useAnnouncements, useEvent } from "@/lib/queries";
import { useFollows } from "@/lib/follows";
import { formatDateRange, formatRelative } from "@/lib/format";
import { FreshnessNote } from "../freshness";
import { WelcomeBanner } from "../brand";
import { Card, ErrorState, Loading, SectionTitle } from "../ui";

export function EventHomeView({ eventId }: { eventId: string }) {
  const hydrated = useHydrated();
  const event = useEvent(eventId);
  const announcements = useAnnouncements(eventId);
  const { ids } = useFollows(eventId);

  if (!hydrated || event.isPending) return <Loading label="Loading event" />;
  if (event.error) return <ErrorState error={event.error} />;
  const e = event.data.data;

  return (
    <div>
      <div className="page-heading">
        <p className="eyebrow mb-2 text-muted">WELCOME TO YOUR EVENT</p>
        <h1>{e.title}</h1>
      </div>
      <p className="mt-1 text-sm text-muted">
        {formatDateRange(e.start_date, e.end_date)} ·{" "}
        {e.kind === "beach" ? "Beach" : "Indoor"} · {e.counts.entries} teams in{" "}
        {e.divisions.length} divisions
      </p>

      <div className="mt-6">
        <WelcomeBanner
          title={
            ids.length
              ? "Your teams. Your kind of day."
              : "Come for the volleyball. Stay for the moments."
          }
        >
          {ids.length ? (
            <>
              <p>
                You&apos;re following {ids.length} team
                {ids.length === 1 ? "" : "s"}. Your next match is waiting in My
                Day.
              </p>
              <Link href={`/events/${eventId}/my-day`} className="primary-link">
                <CalendarDays size={16} aria-hidden /> Open My Day
              </Link>
            </>
          ) : (
            <>
              <p>
                Follow your teams and we&apos;ll bring their matches together.
                No account needed.
              </p>
              <Link href={`/events/${eventId}/teams`} className="primary-link">
                <Users size={16} aria-hidden /> Find your teams
              </Link>
            </>
          )}
        </WelcomeBanner>
      </div>
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
      {announcements.data?.data.length ? (
        <ul className="space-y-2">
          {announcements.data.data.map((a) => (
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
