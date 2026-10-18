"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import type { Match, Participant } from "@/lib/api";
import { formatTime } from "@/lib/format";

type Round = { label: string; matches: Match[] };
const COLUMN = 232,
  CARD = 118,
  GAP = 20,
  HEADER = 42;
// Only connect explicit source winner/loser references, never guessed seeds.
export function feederId(label: string | null) {
  return (
    label
      ?.trim()
      .match(
        /^(?:Winner(?: of)?|Loser(?: of)?|W|L)\s*(?:Match\s*|#)?([A-Za-z0-9_-]+)$/i,
      )?.[1] ?? null
  );
}
export function BracketBoard({
  rounds,
  eventId,
  followed,
}: {
  rounds: Round[];
  eventId: string;
  followed: string[];
}) {
  const [selected, select] = useState("");
  const [roundIndex, setRound] = useState(0);
  const [allRounds, showAll] = useState(true);
  const [zoom, setZoom] = useState(1);
  const index = Math.min(roundIndex, Math.max(0, rounds.length - 1));
  const visible = allRounds ? rounds : rounds.slice(index, index + 1);
  const positions = new Map<string, { x: number; y: number }>();
  const boardHeight =
    Math.max(1, ...visible.map((round) => round.matches.length)) * (CARD + GAP);
  visible.forEach((round, column) =>
    round.matches.forEach((match, row) => {
      const feeders = [match.home, match.away]
        .map((side) => feederId(side.placeholder))
        .map((id) => (id ? positions.get(id) : undefined))
        .filter((position): position is { x: number; y: number } => !!position);
      const y = feeders.length
        ? feeders.reduce((sum, p) => sum + p.y, 0) / feeders.length
        : ((row + 0.5) * boardHeight) / round.matches.length;
      positions.set(match.source_match_id, { x: column * COLUMN, y });
    }),
  );
  const final = rounds.length ? rounds[rounds.length - 1] : undefined;
  const championship =
    final?.matches.length === 1 &&
    /final|gold|championship/i.test(final.label) &&
    !/semi|quarter|bronze/i.test(final.label)
      ? final.matches[0]
      : undefined;
  const champion =
    championship?.status === "completed" &&
    championship.sets_won &&
    championship.sets_won.home !== championship.sets_won.away
      ? championship.sets_won.home > championship.sets_won.away
        ? championship.home
        : championship.away
      : null;
  const totalWidth =
    visible.length * COLUMN + (allRounds && champion ? COLUMN : 0);
  const links = visible.flatMap((round, column) =>
    round.matches.flatMap((match) =>
      [match.home, match.away].flatMap((side) => {
        const id = feederId(side.placeholder);
        const from = id ? positions.get(id) : undefined;
        if (!from || from.x >= column * COLUMN) return [];
        const x1 = from.x + COLUMN - 24,
          x2 = column * COLUMN;
        const y2 = HEADER + (positions.get(match.source_match_id)?.y ?? 0);
        return [
          {
            key: `${match.id}-${id}`,
            d: `M${x1},${HEADER + from.y}H${x1 + 12}V${y2}H${x2}`,
          },
        ];
      }),
    ),
  );
  function team(side: Participant, match: Match, home: boolean) {
    const winner =
      match.status === "completed" &&
      match.sets_won &&
      (home
        ? match.sets_won.home > match.sets_won.away
        : match.sets_won.away > match.sets_won.home);
    return (
      <button
        type="button"
        className={`bracket-team ${winner ? "is-winner" : ""}`}
        aria-pressed={!!side.entry_id && selected === side.entry_id}
        disabled={!side.entry_id}
        onClick={() => select(selected === side.entry_id ? "" : side.entry_id!)}
      >
        <span>
          {side.team_name || side.placeholder || "TBD"}
          {side.entry_id && followed.includes(side.entry_id) ? " ♥" : ""}
        </span>
        <strong>
          {match.sets_won
            ? home
              ? match.sets_won.home
              : match.sets_won.away
            : "–"}
        </strong>
        {winner && <Trophy size={13} aria-label="Winner" />}
      </button>
    );
  }
  return (
    <div className="bracket-experience">
      <div className="bracket-controls">
        <button
          type="button"
          className="icon-link"
          disabled={index === 0}
          aria-label="Previous round"
          onClick={() => setRound(index - 1)}
        >
          <ChevronLeft aria-hidden size={20} />
        </button>
        <label>
          Round
          <select
            aria-label="Bracket round"
            value={index}
            onChange={(e) => setRound(Number(e.target.value))}
          >
            {rounds.map((round, i) => (
              <option key={`${round.label}-${i}`} value={i}>
                {round.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="icon-link"
          disabled={index >= rounds.length - 1}
          aria-label="Next round"
          onClick={() => setRound(index + 1)}
        >
          <ChevronRight aria-hidden size={20} />
        </button>
        <button
          type="button"
          className="secondary-link"
          aria-pressed={allRounds}
          onClick={() => showAll(!allRounds)}
        >
          {allRounds ? "Focus round" : "All rounds"}
        </button>
      </div>
      <label className="bracket-zoom">
        Zoom
        <select
          aria-label="Bracket zoom"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        >
          <option value={0.6}>60%</option>
          <option value={0.8}>80%</option>
          <option value={1}>100%</option>
          <option value={1.2}>120%</option>
        </select>
      </label>
      <label className="bracket-team-filter">
        Trace a team
        <select value={selected} onChange={(e) => select(e.target.value)}>
          <option value="">All teams</option>
          {[
            ...new Map(
              rounds.flatMap((round) =>
                round.matches.flatMap((match) =>
                  [match.home, match.away]
                    .filter((side) => side.entry_id)
                    .map(
                      (side) =>
                        [side.entry_id!, side.team_name || "Team"] as const,
                    ),
                ),
              ),
            ).entries(),
          ].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <p role="status" className="text-sm text-muted my-3">
          Highlighting this team’s published matches.{" "}
          <button className="underline" onClick={() => select("")}>
            Clear
          </button>
        </p>
      )}
      <div
        className="bracket-scroll"
        tabIndex={0}
        aria-label="Competition bracket. Scroll horizontally to explore rounds."
      >
        <div
          className="bracket-viewport"
          style={{
            width: totalWidth * zoom,
            height: (HEADER + boardHeight) * zoom,
          }}
        >
          <div
            className={`bracket-board ${allRounds ? "all-rounds" : ""}`}
            style={{
              width: totalWidth,
              height: HEADER + boardHeight,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            {allRounds && (
              <svg
                className="bracket-connections"
                width={totalWidth}
                height={HEADER + boardHeight}
                aria-hidden
              >
                {links.map((link) => (
                  <path key={link.key} d={link.d} />
                ))}
              </svg>
            )}
            {visible.map((round, i) => (
              <section
                className="bracket-round"
                key={`${round.label}-${i}`}
                aria-label={round.label}
              >
                <h2>{round.label}</h2>
                <ol style={{ height: boardHeight, position: "relative" }}>
                  {round.matches.map((match) => (
                    <li
                      key={match.id}
                      style={{
                        position: "absolute",
                        top:
                          (positions.get(match.source_match_id)?.y ?? 0) -
                          CARD / 2,
                        width: COLUMN - 24,
                      }}
                      className={`bracket-match ${selected && [match.home.entry_id, match.away.entry_id].includes(selected) ? "is-traced" : selected ? "is-muted" : ""}`}
                    >
                      <div className="bracket-match-heading">
                        <span>
                          {match.status === "in_progress"
                            ? "Live"
                            : match.status === "completed"
                              ? "Final"
                              : formatTime(
                                  match.scheduled_start,
                                  match.timezone,
                                )}
                        </span>
                        <small>#{match.source_match_id}</small>
                      </div>
                      {team(match.home, match, true)}
                      {team(match.away, match, false)}
                      <Link href={`/events/${eventId}/matches/${match.id}`}>
                        {match.court?.label || "Court pending"} · Match details
                        <span className="sr-only">
                          : {match.home.team_name || match.home.placeholder} vs{" "}
                          {match.away.team_name || match.away.placeholder}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            {allRounds && champion && (
              <section
                className="bracket-champion"
                style={{
                  paddingTop:
                    HEADER +
                    (positions.get(championship!.source_match_id)?.y ??
                      boardHeight / 2) -
                    45,
                }}
              >
                <Trophy size={32} aria-hidden />
                <small>Champion</small>
                <strong>
                  {champion.team_name || champion.placeholder || "TBD"}
                </strong>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
