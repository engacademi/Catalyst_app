"use client";
import Link from "next/link";
import { Bell, CalendarClock, Tags } from "lucide-react";
import { useEventKey, useFollows } from "@/lib/follows";
import { useNotificationCounts } from "./platform-shell";

// Personal shortcuts for one event. The global dock stays at four destinations (ADR 0007),
// so My Day, My teams and the event's Updates feed are reached from the event itself.
export function MyDayPanel({ eventId }: { eventId: string }) {
  const { directTeamIds, divisionIds } = useFollows(eventId);
  const unread = useEventUnread(eventId);
  const base = `/events/${eventId}`;
  const following = directTeamIds.length + divisionIds.length > 0;
  const summary = [
    directTeamIds.length &&
      `${directTeamIds.length} team${directTeamIds.length === 1 ? "" : "s"}`,
    divisionIds.length &&
      `${divisionIds.length} division${divisionIds.length === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <section className="my-day-panel" aria-labelledby="my-day-panel-title">
      <p className="eyebrow text-brand">MY EVENT DAY</p>
      <h2 id="my-day-panel-title">
        {following ? `Following ${summary}` : "Make this event yours"}
      </h2>
      <p className="my-day-panel-copy">
        {following
          ? "Your next court, overlap warnings, work duties and a calendar file in one place."
          : "Follow a team or a whole division to get your next court, overlap warnings and a calendar file."}
      </p>
      <div className="my-day-panel-actions">
        <Link
          href={following ? `${base}/my-day` : `${base}/teams`}
          className="primary-link"
        >
          <CalendarClock size={17} aria-hidden />
          {following ? "Open My event day" : "Find your teams"}
        </Link>
        {following && (
          <Link href={`${base}/my-teams`} className="secondary-link">
            <Tags size={15} aria-hidden /> My teams & labels
          </Link>
        )}
        <Link
          href={`${base}/updates`}
          className="secondary-link"
          aria-label={`Event updates${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell size={15} aria-hidden /> Updates
          {unread > 0 && (
            <span className="my-day-unread">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
      </div>
    </section>
  );
}

// Shown once a guest follows something, so the label editor and My Day are the obvious next step.
export function FollowNextSteps({
  eventId,
  entryId,
  teamName,
}: {
  eventId: string;
  entryId?: string;
  teamName?: string;
}) {
  const { directTeamIds, divisionIds, isFollowing } = useFollows(eventId);
  const base = `/events/${eventId}`;
  const show = entryId
    ? isFollowing(entryId)
    : directTeamIds.length + divisionIds.length > 0;
  return (
    <div aria-live="polite">
      {show && (
        <div className="follow-next-steps">
          <p>
            {teamName
              ? `Following ${teamName}. Give it a private label, then see your day.`
              : "Label the teams you follow, then see your day."}
          </p>
          <div className="my-day-panel-actions">
            <Link href={`${base}/my-day`} className="primary-link">
              <CalendarClock size={17} aria-hidden /> Open My event day
            </Link>
            <Link href={`${base}/my-teams`} className="secondary-link">
              <Tags size={15} aria-hidden /> Add a private label
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// Secondary links between the personal event pages.
export function MyEventLinks({
  eventId,
  current,
}: {
  eventId: string;
  current: "my-day" | "my-teams";
}) {
  const unread = useEventUnread(eventId);
  const base = `/events/${eventId}`;
  return (
    <nav className="my-day-panel-actions mb-5" aria-label="My event">
      {current === "my-teams" ? (
        <Link href={`${base}/my-day`} className="primary-link">
          <CalendarClock size={17} aria-hidden /> Open My event day
        </Link>
      ) : (
        <Link href={`${base}/my-teams`} className="secondary-link">
          <Tags size={15} aria-hidden /> My teams & labels
        </Link>
      )}
      <Link
        href={`${base}/updates`}
        className="secondary-link"
        aria-label={`Event updates${unread ? `, ${unread} unread` : ""}`}
      >
        <Bell size={15} aria-hidden /> Updates
        {unread > 0 && (
          <span className="my-day-unread">{unread > 99 ? "99+" : unread}</span>
        )}
      </Link>
    </nav>
  );
}

function useEventUnread(eventId: string) {
  const key = useEventKey(eventId);
  return useNotificationCounts().find((c) => c.event.slug === key)?.count ?? 0;
}
