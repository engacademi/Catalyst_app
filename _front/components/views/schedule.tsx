"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { apiGet, type Match } from "@/lib/api";
import { formatDateRange, formatDay, formatTime } from "@/lib/format";
import { useEvents } from "@/lib/queries";
import { useEventSelections, usePreference } from "@/lib/preferences";
import { useHydrated } from "@/lib/hydration";
import { MatchCard } from "../match-card";
import { ErrorState, Loading, EmptyState } from "../ui";
import { TimeGrid } from "../time-grid";
import { eventColor } from "@/lib/event-colors";

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
    .sort((a, b) => {
      const at =
        Date.parse(a.match.estimated_start ?? a.match.scheduled_start ?? "") ||
        Infinity;
      const bt =
        Date.parse(b.match.estimated_start ?? b.match.scheduled_start ?? "") ||
        Infinity;
      return at === bt ? 0 : at - bt;
    });
  const today = dateKey(new Date().toISOString());
  const initialDay = rows.find(
    (r) =>
      Date.parse(r.match.estimated_start ?? r.match.scheduled_start ?? "") >=
      new Date().getTime(),
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
        <MatchCard
          match={match}
          eventId={event.slug}
          showDay
          showSource={false}
        />
      )}
    </div>
  );
  return (
    <main id="main" className="platform-main">
      <div className="discovery-heading">
        <h1>My Schedule</h1>
      </div>
      {!hydrated || events.isPending ? (
        <Loading />
      ) : events.error && !events.data ? (
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
            <details
              className="schedule-visibility"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.currentTarget.open = false;
                  e.currentTarget.querySelector("summary")?.focus();
                }
              }}
              onBlur={(e) => {
                if (
                  e.relatedTarget &&
                  !e.currentTarget.contains(e.relatedTarget)
                )
                  e.currentTarget.open = false;
              }}
            >
              <summary title="Visibility">
                <Eye size={18} aria-hidden />
                <span className="sr-only">Visibility</span>
              </summary>
              <div
                className="visibility-panel"
                role="region"
                aria-label="Calendar visibility"
              >
                <div className="visibility-panel-header">
                  <div>
                    <p className="visibility-panel-heading">
                      <Eye size={16} aria-hidden /> Visibility
                    </p>
                    <p className="visibility-caption">
                      {visible.length} of {selected.length} events shown
                    </p>
                  </div>
                  <button
                    type="button"
                    className="visibility-close"
                    aria-label="Close visibility"
                    onClick={(e) => {
                      const details = e.currentTarget.closest("details");
                      if (details) {
                        details.open = false;
                        details.querySelector("summary")?.focus();
                      }
                    }}
                  >
                    <X size={17} aria-hidden />
                  </button>
                </div>
                <div className="visibility-options">
                  {selected.map((e) => (
                    <label className="visibility-option" key={e.id}>
                      <input
                        type="checkbox"
                        aria-label={e.title}
                        checked={!hidden.includes(e.slug)}
                        onChange={() =>
                          setHidden(
                            hidden.includes(e.slug)
                              ? hidden.filter((id) => id !== e.slug)
                              : [...hidden, e.slug],
                          )
                        }
                      />
                      <span
                        className={`event-colour event-colour-${eventColor(e.id)}`}
                        aria-hidden
                      />
                      <span className="visibility-option-text">
                        <strong>{e.title}</strong>
                      </span>
                      <span className="visibility-switch" aria-hidden>
                        <span />
                      </span>
                    </label>
                  ))}
                </div>
                <div className="visibility-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setHidden(
                        hidden.filter(
                          (id) => !selected.some((e) => e.slug === id),
                        ),
                      )
                    }
                  >
                    Show all
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHidden([
                        ...new Set([...hidden, ...selected.map((e) => e.slug)]),
                      ])
                    }
                  >
                    Hide all
                  </button>
                </div>
              </div>
            </details>
          </div>
          {queries.some(
            (q, i) => !hidden.includes(selected[i].slug) && q.isPending,
          ) && <Loading label="Loading your matches" />}
          {queries.map((q, i) =>
            !hidden.includes(selected[i].slug) && q.error && !q.data ? (
              <div key={selected[i].id}>
                <p>{selected[i].title}</p>
                <ErrorState error={q.error} />
              </div>
            ) : null,
          )}
          {queries.map((q, i) =>
            !hidden.includes(selected[i].slug) &&
            q.data &&
            !q.data.matches.length ? (
              <p key={selected[i].id} className="empty-inline">
                {selected[i].title}: the draw isn’t published yet.
              </p>
            ) : null,
          )}
          {!visible.length ? (
            <EmptyState title="All tournaments are hidden">
              Use the visibility controls above to show them again.
            </EmptyState>
          ) : !rows.length &&
            queries.every(
              (q, i) => hidden.includes(selected[i].slug) || q.isSuccess,
            ) ? (
            <EmptyState title="The draw isn’t published yet">
              Matches will appear here once the organizer publishes them.
            </EmptyState>
          ) : mode === "calendar" ? (
            <TimeGrid rows={inRange} dates={dates} />
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
              {waiting.map((r) => (
                <div key={`${r.event.id}-${r.match.id}`}>
                  <p className="mt-3 text-xs text-muted">
                    {r.event.title} ·{" "}
                    {r.match.estimated_start
                      ? formatDay(r.match.estimated_start, r.match.timezone)
                      : formatDateRange(r.event.start_date, r.event.end_date)}
                  </p>
                  {renderMatch(r)}
                </div>
              ))}
            </details>
          )}
        </>
      )}
    </main>
  );
}
