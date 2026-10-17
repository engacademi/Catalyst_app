"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { apiGet, type Match } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { useEvents } from "@/lib/queries";
import { useEventSelections, usePreference } from "@/lib/preferences";
import { useHydrated } from "@/lib/hydration";
import { MatchCard } from "../match-card";
import { ErrorState, Loading, EmptyState } from "../ui";
import { FreshnessNote } from "../freshness";

export function dateKey(iso: string, timeZone = "America/Toronto") {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone });
}
export function shiftDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function ScheduleView() {
  const events = useEvents();
  const hydrated = useHydrated();
  const all = events.data?.data ?? [];
  const follows = useEventSelections(all);
  const [saved] = usePreference<string[]>("saved-events", []);
  const [hidden, setHidden] = usePreference<string[]>(
    "hidden-schedule-events",
    [],
  );
  const [mode, setMode] = usePreference<"list" | "calendar">(
    "schedule-mode",
    "calendar",
  );
  const [days, setDays] = useState(3);
  const [start, setStart] = useState("");
  const selected = all.filter(
    (e) => saved.includes(e.slug) || (follows.get(e.slug)?.length ?? 0) > 0,
  );
  const queries = useQueries({
    queries: selected.map((event) => {
      const ids = follows.get(event.slug) ?? [];
      return {
        queryKey: [
          "saved-schedule",
          event.slug,
          saved.includes(event.slug),
          ids.join(","),
        ],
        enabled: !hidden.includes(event.slug),
        queryFn: async () => {
          const params = new URLSearchParams({ limit: "200" });
          if (!saved.includes(event.slug)) {
            params.set(
              "entry_ids",
              ids.filter((id) => !id.startsWith("division:")).join(","),
            );
            params.set(
              "division_ids",
              ids
                .filter((id) => id.startsWith("division:"))
                .map((id) => id.slice(9))
                .join(","),
            );
          }
          const matches = new Map<string, Match>();
          let cursor: number | null = 0;
          let sources: import("@/lib/api").SourceInfo[] = [];
          do {
            const page: {
              data: Match[];
              next_cursor: number | null;
              sources: typeof sources;
            } = await apiGet(
              `/v1/events/${event.slug}/matches?${params}&cursor=${cursor}`,
            );
            for (const match of page.data) matches.set(match.id, match);
            sources = page.sources;
            cursor = page.next_cursor;
          } while (cursor !== null);
          return { matches: [...matches.values()], sources };
        },
      };
    }),
  });
  const visible = selected.filter((e) => !hidden.includes(e.slug));
  const rows = selected
    .flatMap((event, i) =>
      hidden.includes(event.slug)
        ? []
        : (queries[i].data?.matches ?? []).map((match) => ({ event, match })),
    )
    .sort((a, b) =>
      (
        a.match.estimated_start ??
        a.match.scheduled_start ??
        "9999"
      ).localeCompare(
        b.match.estimated_start ?? b.match.scheduled_start ?? "9999",
      ),
    );
  const today = dateKey(new Date().toISOString());
  const initialDay = rows.find(
    (r) =>
      (r.match.estimated_start ?? r.match.scheduled_start ?? "") >=
      new Date().toISOString(),
  )?.match;
  const first =
    start ||
    (initialDay
      ? dateKey((initialDay.estimated_start ?? initialDay.scheduled_start)!)
      : rows[0]?.match.scheduled_start
        ? dateKey(rows[0].match.scheduled_start)
        : today);
  const dates = Array.from({ length: days }, (_, i) => shiftDay(first, i));
  const inRange = rows.filter((r) => {
    const time = r.match.estimated_start ?? r.match.scheduled_start;
    return !!time && dates.includes(dateKey(time));
  });
  const waiting = rows.filter((r) => !r.match.scheduled_start);
  const renderMatch = ({ event, match }: (typeof rows)[number]) => (
    <div key={`${event.id}-${match.id}`} className="schedule-match">
      <Link className="schedule-event-label" href={`/events/${event.slug}`}>
        {event.title}
      </Link>
      {mode === "calendar" ? (
        <Link
          href={`/events/${event.slug}/matches/${match.id}`}
          className="calendar-match-card"
        >
          <time>{formatTime(match.scheduled_start, match.timezone)}</time>
          {match.estimated_start && (
            <span className="text-warn">
              Est. ~{formatTime(match.estimated_start, match.timezone)}
            </span>
          )}
          <strong>
            {match.home.team_name ?? match.home.placeholder ?? "TBD"}
          </strong>
          <span className="calendar-versus">vs</span>
          <strong>
            {match.away.team_name ?? match.away.placeholder ?? "TBD"}
          </strong>
          <span>{match.court?.label ?? "Court pending"}</span>
          <span className="calendar-match-status">
            {match.status.replaceAll("_", " ")}
          </span>
        </Link>
      ) : (
        <MatchCard match={match} eventId={event.slug} showDay />
      )}
    </div>
  );
  return (
    <main id="main" className="platform-main">
      <div className="discovery-heading">
        <p className="eyebrow text-brand">YOUR GAME PLAN</p>
        <h1>My Schedule</h1>
        <p>
          Only saved tournaments and matches for teams or divisions you follow.
        </p>
      </div>
      {!hydrated || events.isPending ? (
        <Loading />
      ) : events.error ? (
        <ErrorState error={events.error} />
      ) : !selected.length ? (
        <EmptyState title="Your schedule starts with a favourite">
          <p>
            Save a tournament or follow a team to see their matches here. No
            account needed.
          </p>
          <Link className="primary-link mt-4" href="/tournaments">
            Find tournaments
          </Link>
        </EmptyState>
      ) : (
        <>
          <details className="schedule-visibility">
            <summary>
              Show or hide tournaments · {visible.length} visible
            </summary>
            <div>
              {selected.map((e) => (
                <label key={e.id}>
                  <input
                    type="checkbox"
                    checked={!hidden.includes(e.slug)}
                    onChange={() =>
                      setHidden(
                        hidden.includes(e.slug)
                          ? hidden.filter((id) => id !== e.slug)
                          : [...hidden, e.slug],
                      )
                    }
                  />
                  {e.title}
                </label>
              ))}
            </div>
          </details>
          <div className="schedule-controls">
            <div className="segmented">
              {["calendar", "list"].map((m) => (
                <button
                  key={m}
                  aria-pressed={mode === m}
                  onClick={() => setMode(m as typeof mode)}
                >
                  {m === "calendar" ? "Calendar" : "List"}
                </button>
              ))}
            </div>
            <div className="segmented">
              {[3, 7].map((n) => (
                <button
                  key={n}
                  aria-pressed={days === n}
                  onClick={() => setDays(n)}
                >
                  {n === 3 ? "3 days" : "Full week"}
                </button>
              ))}
            </div>
          </div>
          <div className="date-controls">
            <button
              aria-label="Previous period"
              onClick={() => setStart(shiftDay(first, -days))}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <label>
              <span className="sr-only">Schedule start date</span>
              <input
                type="date"
                value={first}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <button
              aria-label="Next period"
              onClick={() => setStart(shiftDay(first, days))}
            >
              <ChevronRight size={18} aria-hidden />
            </button>
            <button onClick={() => setStart(today)}>Today</button>
          </div>
          <p className="mb-3 text-xs text-muted">
            Times shown in America/Toronto. Match cards also show the
            event&apos;s local time.
          </p>
          {queries.some(
            (q, i) => !hidden.includes(selected[i].slug) && q.isPending,
          ) && <Loading label="Loading your matches" />}
          {queries.map((q, i) =>
            !hidden.includes(selected[i].slug) && q.error ? (
              <div key={selected[i].id}>
                <p>{selected[i].title}</p>
                <ErrorState error={q.error} />
              </div>
            ) : null,
          )}
          {!visible.length ? (
            <EmptyState title="All tournaments are hidden">
              Use the visibility controls above to show them again.
            </EmptyState>
          ) : mode === "calendar" ? (
            <div
              className="calendar-scroll"
              tabIndex={0}
              aria-label={`${days} day schedule, scroll horizontally for more days`}
            >
              <div className={`calendar-grid ${days === 7 ? "full-week" : ""}`}>
                {dates.map((day) => (
                  <section key={day}>
                    <h2>
                      {new Date(`${day}T12:00:00Z`).toLocaleDateString(
                        "en-CA",
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        },
                      )}
                    </h2>
                    {inRange
                      .filter(
                        (r) =>
                          dateKey(
                            (r.match.estimated_start ??
                              r.match.scheduled_start)!,
                          ) === day,
                      )
                      .map(renderMatch)}
                    {!inRange.some(
                      (r) =>
                        dateKey(
                          (r.match.estimated_start ?? r.match.scheduled_start)!,
                        ) === day,
                    ) && <p className="calendar-empty">No saved matches</p>}
                  </section>
                ))}
              </div>
            </div>
          ) : inRange.length ? (
            <div className="schedule-list">{inRange.map(renderMatch)}</div>
          ) : (
            <EmptyState title="No matches in this period">
              Choose another date or extend to a full week.
            </EmptyState>
          )}
          {!!waiting.length && (
            <details className="mt-5">
              <summary className="min-h-11">
                Awaiting a start time ({waiting.length})
              </summary>
              {waiting.map(renderMatch)}
            </details>
          )}
          {queries.map((q, i) =>
            !hidden.includes(selected[i].slug) && q.data ? (
              <FreshnessNote key={selected[i].id} sources={q.data.sources} />
            ) : null,
          )}
        </>
      )}
    </main>
  );
}
