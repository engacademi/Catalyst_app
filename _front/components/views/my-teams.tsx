"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useHydrated } from "@/lib/hydration";
import Link from "next/link";
import { useFollows, useTeamLabel } from "@/lib/follows";
import { useEntry, useEvent, useTeams } from "@/lib/queries";
import { Card, PageTitle, Loading, ErrorState } from "../ui";
import { LoadMore } from "../load-more";
import { FollowButton } from "../follow-button";
import { MyEventLinks } from "../my-day-links";
export function MyTeamsView({ eventId }: { eventId: string }) {
  const hydrated = useHydrated();
  const { directTeamIds, divisionIds, toggle } = useFollows(eventId);
  const event = useEvent(eventId);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("");
  const teams = useTeams(eventId, query, division);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 200);
    return () => clearTimeout(timer);
  }, [search]);
  if (!hydrated) return <Loading />;
  return (
    <div>
      <PageTitle subtitle="Search for a team, follow it, and add kids’ names as private labels on this device.">
        My teams
      </PageTitle>
      {directTeamIds.length + divisionIds.length > 0 && (
        <MyEventLinks eventId={eventId} current="my-teams" />
      )}
      <section aria-label="Find teams" className="mb-6">
        <div className="filter-panel">
          <label className="relative block">
            <span className="sr-only">Search teams, clubs or divisions</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team, club or division"
              className="min-h-11 w-full rounded-full border border-border bg-surface pl-9 pr-4"
            />
          </label>
          <label>
            <span className="sr-only">Division</span>
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              className="min-h-11 w-full rounded-full border border-border bg-surface px-4"
            >
              <option value="">All divisions</option>
              {event.data?.data.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div aria-live="polite">
          {teams.isPending ? (
            <Loading label="Finding teams" />
          ) : teams.error && !teams.data ? (
            <ErrorState error={teams.error} />
          ) : (
            <>
              {!teams.data?.data.length && (
                <p className="text-sm text-muted">
                  No teams match. Try another team, club or division.
                </p>
              )}
              <ul className="divide-y divide-border">
                {teams.data?.data.map((team) => (
                  <li
                    key={team.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <span className="min-w-0">
                      <Link
                        href={`/events/${eventId}/teams/${team.id}`}
                        className="font-semibold text-brand underline"
                      >
                        {team.team_name}
                      </Link>
                      <small className="block text-muted">
                        {team.division?.name}
                      </small>
                    </span>
                    <FollowButton
                      eventId={eventId}
                      entryId={team.id}
                      teamName={team.team_name}
                    />
                  </li>
                ))}
              </ul>
              <LoadMore query={teams} label="teams" />
            </>
          )}
        </div>
      </section>
      <h2 className="mb-3 font-semibold">Followed teams & kids’ names</h2>
      <ul className="team-grid">
        {directTeamIds.map((id) => (
          <li key={id}>
            <LabelEditor eventId={eventId} id={id} />
          </li>
        ))}
      </ul>
      {!directTeamIds.length && (
        <p className="text-sm text-muted">No individual teams followed yet.</p>
      )}
      {divisionIds.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold">Divisions</h2>
          <ul className="space-y-2">
            {divisionIds.map((id) => (
              <li key={id}>
                <Card className="flex items-center justify-between gap-2">
                  <span className="text-sm">
                    {event.data?.data.divisions.find((d) => d.id === id)
                      ?.name ?? "Followed division"}
                  </span>
                  <button
                    onClick={() => toggle(`division:${id}`)}
                    className="min-h-11 rounded-full border border-border px-4 text-sm"
                  >
                    Unfollow
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
function LabelEditor({ eventId, id }: { eventId: string; id: string }) {
  const entry = useEntry(id);
  const { label, setLabel } = useTeamLabel(eventId, id);
  return (
    <Card>
      {entry.isPending ? (
        <Loading />
      ) : entry.error && !entry.data ? (
        <ErrorState error={entry.error} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/events/${eventId}/teams/${id}`}
              className="font-semibold text-brand underline"
            >
              {entry.data.data.team_name}
            </Link>
            <FollowButton
              eventId={eventId}
              entryId={id}
              teamName={entry.data.data.team_name}
            />
          </div>
          <label className="mt-3 block text-sm">
            Kids’ names / private label
            <input
              maxLength={60}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Maya, Alex"
              className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3"
            />
          </label>
          <p className="mt-1 text-xs text-muted">
            Saved automatically on this device. Separate multiple names with
            commas.
          </p>
        </>
      )}
    </Card>
  );
}
