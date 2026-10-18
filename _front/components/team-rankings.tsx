"use client";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type Match } from "@/lib/api";
import { ErrorState, Loading } from "./ui";

export function TeamRankings({
  eventId,
  division,
}: {
  eventId: string;
  division: string;
}) {
  const query = useQuery({
    queryKey: ["team-rankings", eventId, division],
    queryFn: async () => {
      const matches: Match[] = [];
      let cursor: number | null = 0;
      do {
        const page: { data: Match[]; next_cursor: number | null } =
          await apiGet(
            `/v1/events/${eventId}/matches?status=results&limit=200&cursor=${cursor}`,
          );
        matches.push(...page.data);
        cursor = page.next_cursor;
      } while (cursor !== null);
      return matches;
    },
    refetchInterval: 30_000,
  });
  if (query.isPending) return <Loading label="Loading rankings" />;
  if (query.error && !query.data) return <ErrorState error={query.error} />;
  const divisions = new Map<
    string,
    {
      name: string;
      teams: Map<string, { name: string; points: number; played: Set<string> }>;
    }
  >();
  for (const match of query.data) {
    if (
      match.status !== "completed" ||
      (division && match.division?.id !== division)
    )
      continue;
    const scored = match.sets.filter(
      (set) => set.home !== null && set.away !== null,
    );
    if (!scored.length) continue;
    const key = match.division?.id ?? "unassigned";
    if (!divisions.has(key))
      divisions.set(key, {
        name: match.division?.name ?? "Open",
        teams: new Map(),
      });
    const teams = divisions.get(key)!.teams;
    for (const side of ["home", "away"] as const) {
      const team = match[side];
      if (!team.entry_id) continue;
      if (!teams.has(team.entry_id))
        teams.set(team.entry_id, {
          name: team.team_name ?? "Team",
          points: 0,
          played: new Set(),
        });
      const row = teams.get(team.entry_id)!;
      if (row.played.has(match.id)) continue;
      row.points += scored.reduce((sum, set) => sum + (set[side] ?? 0), 0);
      row.played.add(match.id);
    }
  }
  return (
    <section className="rankings-panel" aria-label="Team Rankings">
      <p className="text-xs text-muted">
        Total points scored in completed matches, grouped by division. Equal
        totals share a rank.
      </p>
      {divisions.size ? (
        [...divisions].map(([id, group]) => {
          const rows = [...group.teams].sort(
            (a, b) =>
              b[1].points - a[1].points || a[1].name.localeCompare(b[1].name),
          );
          return (
            <table key={id}>
              <caption className="text-left font-semibold mt-4">
                {group.name}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Team</th>
                  <th scope="col">Played</th>
                  <th scope="col">Points</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([teamId, row]) => (
                  <tr key={teamId}>
                    <td>
                      {rows.findIndex(([, r]) => r.points === row.points) + 1}
                    </td>
                    <th scope="row">{row.name}</th>
                    <td>{row.played.size}</td>
                    <td>{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })
      ) : (
        <p>No completed match scores available yet.</p>
      )}
    </section>
  );
}
