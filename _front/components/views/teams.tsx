"use client";
import { teamColor } from "@/lib/event-colors";
import { useHydrated } from "@/lib/hydration";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useFollows } from "@/lib/follows";
import { useEvent, useTeams } from "@/lib/queries";
import { TeamRankings } from "../team-rankings";
import { LoadMore } from "../load-more";
import { EmptyState, ErrorState, Loading, PageTitle } from "../ui";

export function TeamsView({ eventId }: { eventId: string }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const division = params.get("division") ?? "";
  const [text, setText] = useState(q);
  const [rankings, showRankings] = useState(false);
  const event = useEvent(eventId);
  const teams = useTeams(eventId, q, division);
  const { ids, divisionIds, isFollowing, toggle } = useFollows(eventId);

  // Keep the search in the URL so it survives refresh and can be shared.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (text === q) return;
      const next = new URLSearchParams(params);
      if (text) next.set("q", text);
      else next.delete("q");
      router.replace(`${pathname}?${next}`, { scroll: false });
    }, 250);
    return () => clearTimeout(timer);
  }, [text, q, params, pathname, router]);

  const setDivision = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("division", value);
    else next.delete("division");
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  if (!hydrated) return <Loading />;
  return (
    <div>
      <PageTitle>Teams</PageTitle>
      <div className="filter-panel">
        <label className="relative block">
          <span className="sr-only">Search teams, clubs or divisions</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Team, club or division"
            className="min-h-11 w-full rounded-full border border-border bg-surface pl-9 pr-4 text-base"
          />
        </label>
        <label className="block">
          <span className="sr-only">Division</span>
          <select
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="min-h-11 w-full rounded-full border border-border bg-surface px-4 text-base"
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

      <details className="team-picker">
        <summary>Follow teams · {ids.length} selected</summary>
        <div className="team-picker-options">
          {event.data?.data.divisions.map((d) => (
            <label key={d.id} className="team-picker-option">
              <input
                type="checkbox"
                checked={isFollowing(`division:${d.id}`)}
                onChange={() => toggle(`division:${d.id}`)}
              />
              <span>Entire {d.name} division</span>
            </label>
          ))}
          <p className="sr-only" role="status">
            {divisionIds.length} divisions followed
          </p>
          <div className="mt-5" aria-live="polite">
            {teams.isPending ? (
              <Loading label="Searching" />
            ) : teams.error ? (
              <ErrorState error={teams.error} />
            ) : teams.data!.data.length === 0 ? (
              <EmptyState title="No teams match that search">
                Try a club name or a division code like 15U.
              </EmptyState>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted">
                  {teams.data!.total} team{teams.data!.total === 1 ? "" : "s"}
                </p>
                <ul>
                  {teams.data!.data.map((t) => (
                    <li
                      key={t.id}
                      className="team-picker-option"
                      style={
                        isFollowing(t.id)
                          ? {
                              borderLeft: `4px solid ${teamColor(t.id)}`,
                              paddingLeft: 8,
                            }
                          : undefined
                      }
                    >
                      <label className="flex min-w-0 flex-1 items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isFollowing(t.id)}
                          onChange={() => toggle(t.id)}
                        />
                        <span>
                          {t.team_name}
                          <small className="block text-muted">
                            {t.division?.name}
                          </small>
                        </span>
                      </label>
                      <Link href={`/events/${eventId}/teams/${t.id}`}>
                        Details
                        <span className="sr-only"> for {t.team_name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <LoadMore query={teams} label="teams" />
              </>
            )}
          </div>
        </div>
      </details>
      <button
        type="button"
        className="secondary-link mt-4"
        aria-expanded={rankings}
        onClick={() => showRankings(!rankings)}
      >
        Team Rankings
      </button>
      {rankings && <TeamRankings eventId={eventId} division={division} />}
    </div>
  );
}
