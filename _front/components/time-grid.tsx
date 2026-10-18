"use client";
import Link from "next/link";
import { eventColor } from "@/lib/event-colors";
import type { Match } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { workDutyTeam } from "./match-card";
import type { DiscoveryEvent } from "./event-tile";

type CalendarRow = { event: DiscoveryEvent; match: Match };
const HOUR_HEIGHT = 112;
const DISPLAY_MINUTES = 60;
function localMinutes(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  return (
    Number(parts.find((p) => p.type === "hour")?.value) * 60 +
    Number(parts.find((p) => p.type === "minute")?.value)
  );
}
function clockParts(iso: string | null) {
  if (!iso) return { clock: "TBD", period: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  return {
    clock: `${parts.find((p) => p.type === "hour")?.value}:${parts.find((p) => p.type === "minute")?.value}`,
    period: (parts.find((p) => p.type === "dayPeriod")?.value ?? "")
      .replaceAll(".", "")
      .toUpperCase(),
  };
}
function compactName(name: string) {
  const words = name.trim().split(/\s+/);
  return words.length > 1
    ? words
        .slice(0, 3)
        .map((word) => word[0])
        .join("")
        .toUpperCase()
    : name.slice(0, 3).toUpperCase();
}
function localDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "America/Toronto",
  });
}
// Partition overlapping display slots into lanes within each collision group.
function layout(rows: CalendarRow[]) {
  const items = rows
    .map((row) => ({
      ...row,
      start: localMinutes(
        (row.match.estimated_start ?? row.match.scheduled_start)!,
      ),
      lane: 0,
      lanes: 1,
    }))
    .sort((a, b) => a.start - b.start || a.match.id.localeCompare(b.match.id));
  let group: typeof items = [];
  let laneEnds: number[] = [];
  const finish = () => {
    for (const item of group) item.lanes = laneEnds.length;
    group = [];
    laneEnds = [];
  };
  for (const item of items) {
    if (group.length && item.start >= Math.max(...laneEnds)) finish();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane < 0) lane = laneEnds.length;
    item.lane = lane;
    laneEnds[lane] = item.start + DISPLAY_MINUTES;
    group.push(item);
  }
  finish();
  return items;
}
export function TimeGrid({
  rows,
  dates,
  follows,
}: {
  rows: CalendarRow[];
  dates: string[];
  /** Followed team ids per event slug, used to mark work duties. */
  follows?: Map<string, string[]>;
}) {
  const minutes = rows.map((row) =>
    localMinutes((row.match.estimated_start ?? row.match.scheduled_start)!),
  );
  const startHour = minutes.length
    ? Math.max(0, Math.floor(Math.min(...minutes) / 60))
    : 8;
  const endHour = minutes.length
    ? Math.min(
        24,
        Math.max(
          startHour + 4,
          Math.ceil((Math.max(...minutes) + DISPLAY_MINUTES) / 60),
        ),
      )
    : 18;
  const height = (endHour - startHour) * HOUR_HEIGHT;
  const dayLayouts = dates.map((day) =>
    layout(
      rows.filter(
        (row) =>
          localDay(
            (row.match.estimated_start ?? row.match.scheduled_start)!,
          ) === day,
      ),
    ),
  );
  const columns = dayLayouts
    .map(
      (items) =>
        `minmax(${Math.max(dates.length === 7 ? 112 : 60, Math.max(1, ...items.map((item) => item.lanes)) * 86)}px, 1fr)`,
    )
    .join(" ");
  const today = localDay(new Date().toISOString());
  return (
    <div
      className="calendar-scroll time-calendar-scroll"
      tabIndex={0}
      aria-label={`${dates.length} day schedule in America/Toronto. Blocks use one-hour display slots, not confirmed match durations. Scroll for more hours or days.`}
    >
      <p className="sr-only">
        Calendar blocks use one-hour display slots, not confirmed match
        durations. Full match names are available when opening a match.
      </p>

      <div
        className={`calendar-grid time-calendar ${dates.length === 7 ? "full-week" : ""}`}
        style={{
          gridTemplateColumns: `var(--calendar-ruler-width, 36px) ${columns}`,
        }}
      >
        <div className="time-ruler" aria-hidden>
          <div className="time-grid-corner" title="America/Toronto">
            ET
          </div>
          <div className="time-ruler-track" style={{ height }}>
            {Array.from({ length: endHour - startHour }, (_, i) => {
              const hour = startHour + i;
              return (
                <span key={hour} style={{ top: i * HOUR_HEIGHT }}>
                  {hour % 12 || 12}
                  <small>{hour < 12 ? "AM" : "PM"}</small>
                </span>
              );
            })}
          </div>
        </div>
        {dates.map((day) => {
          const date = new Date(`${day}T12:00:00Z`);
          const matches = dayLayouts[dates.indexOf(day)];
          return (
            <section
              key={day}
              className="time-day"
              aria-label={date.toLocaleDateString("en-CA", {
                weekday: "long",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              })}
            >
              <h2>
                <span>
                  {date.toLocaleDateString("en-CA", {
                    weekday: "short",
                    timeZone: "UTC",
                  })}
                </span>
                <time
                  dateTime={day}
                  className={day === today ? "is-today" : ""}
                  aria-current={day === today ? "date" : undefined}
                >
                  {date.getUTCDate()}
                </time>
              </h2>
              <div className="time-day-track" style={{ height }}>
                {!matches.length && (
                  <p className="calendar-empty">No saved matches</p>
                )}
                {matches.map(({ event, match, start, lane, lanes }) => {
                  const time = match.estimated_start ?? match.scheduled_start;
                  const home =
                    match.home.team_name ?? match.home.placeholder ?? "TBD";
                  const away =
                    match.away.team_name ?? match.away.placeholder ?? "TBD";
                  const timeLabel = `${match.estimated_start ? "Est. " : ""}${formatTime(time, "America/Toronto")}`;
                  const clock = clockParts(time);
                  const duty = workDutyTeam(
                    match,
                    follows?.get(event.slug) ?? [],
                  );
                  const label = `${duty ? `Work duty for ${duty}: referee / scorekeeping. ` : ""}${home} vs ${away}, ${timeLabel}, ${match.court?.label ?? "court pending"}, ${event.title}. ${match.status.replaceAll("_", " ")}. One-hour display slot; match duration may vary.`;
                  return (
                    <Link
                      key={`${event.id}-${match.id}`}
                      href={`/events/${event.slug}/matches/${match.id}`}
                      className={`time-block time-block-${eventColor(event.id)} ${duty ? "time-block-duty" : ""}`}
                      data-start-minutes={start}
                      data-dense={lanes > 1}
                      aria-label={label}
                      title={label}
                      style={{
                        top: ((start - startHour * 60) / 60) * HOUR_HEIGHT + 3,
                        height:
                          (Math.min(DISPLAY_MINUTES, 1440 - start) / 60) *
                            HOUR_HEIGHT -
                          6,
                        left: `calc(${(lane / lanes) * 100}% + 3px)`,
                        width: `calc(${100 / lanes}% - 6px)`,
                      }}
                    >
                      <time dateTime={time ?? undefined}>
                        <span>
                          {match.estimated_start ? "~" : ""}
                          {clock.clock}
                        </span>
                        <small>{clock.period}</small>
                      </time>
                      {duty && (
                        <span className="time-block-duty-label">Work duty</span>
                      )}
                      {match.estimated_start && (
                        <span className="time-block-official">
                          Official{" "}
                          {formatTime(match.scheduled_start, "America/Toronto")}
                        </span>
                      )}
                      <strong>
                        <span className="time-block-full-name">{home}</span>
                        <abbr className="time-block-short-name" title={home}>
                          {compactName(home)}
                        </abbr>
                      </strong>
                      <span className="time-block-opponent">
                        vs <span className="time-block-full-name">{away}</span>
                        <abbr className="time-block-short-name" title={away}>
                          {compactName(away)}
                        </abbr>
                      </span>
                      <span className="time-block-court">
                        {match.status !== "scheduled" &&
                          `${match.status === "in_progress" ? "Live" : match.status === "completed" ? "Final" : match.status} · `}
                        {match.court?.label ?? "Court pending"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
