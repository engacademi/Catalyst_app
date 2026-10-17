"use client";

import { useHydrated } from "@/lib/hydration";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useFollows } from "@/lib/follows";
import { useEvent, useTeams } from "@/lib/queries";
import { TeamAvatar } from "../brand";
import { FollowButton } from "../follow-button";
import { EmptyState, ErrorState, Loading, PageTitle } from "../ui";

export function TeamsView({ eventId }: { eventId: string }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const division = params.get("division") ?? "";
  const [text, setText] = useState(q);
  const event = useEvent(eventId);
  const teams = useTeams(eventId, q, division);
  const { ids } = useFollows(eventId);

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
      <PageTitle
        subtitle={
          ids.length
            ? `Following ${ids.length}`
            : "Tap Follow on every team you care about."
        }
      >
        Teams
      </PageTitle>
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

      <div className="mt-4" aria-live="polite">
        {teams.isPending ? (
          <Loading label="Searching" />
        ) : teams.error ? (
          <ErrorState error={teams.error} />
        ) : teams.data.data.length === 0 ? (
          <EmptyState title="No teams match that search">
            Try a club name or a division code like 15U.
          </EmptyState>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted">
              {teams.data.total} team{teams.data.total === 1 ? "" : "s"}
            </p>
            <ul className="team-grid">
              {teams.data.data.map((t) => (
                <li key={t.id} className="team-tile">
                  <TeamAvatar name={t.team_name} />
                  <Link
                    href={`/events/${eventId}/teams/${t.id}`}
                    className="min-w-0 flex-1 py-2"
                  >
                    <p className="font-semibold break-words">{t.team_name}</p>
                    <p className="text-xs text-muted">
                      {[t.club_name, t.division?.name]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </Link>
                  <FollowButton
                    eventId={eventId}
                    entryId={t.id}
                    teamName={t.team_name}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
