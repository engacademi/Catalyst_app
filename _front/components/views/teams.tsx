"use client";
import { useHydrated } from "@/lib/hydration";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useFollows } from "@/lib/follows";
import { useEvent, useTeams } from "@/lib/queries";
import { TeamAvatar } from "../brand";
import { LoadMore } from "../load-more";
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

      <section className="mt-5" aria-labelledby="division-follows">
        <h2 id="division-follows" className="text-sm font-semibold">
          Follow a whole division
        </h2>
        <p className="mt-1 text-xs text-muted">
          Every team and unresolved playoff slot, including teams added later.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {event.data?.data.divisions
            .filter(
              (d) =>
                !q ||
                d.name.toLowerCase().includes(q.toLowerCase()) ||
                d.code?.toLowerCase().includes(q.toLowerCase()),
            )
            .map((d) => (
              <button
                key={d.id}
                aria-pressed={isFollowing(`division:${d.id}`)}
                onClick={() => toggle(`division:${d.id}`)}
                className={`min-h-11 rounded-full border px-4 text-sm font-medium ${isFollowing(`division:${d.id}`) ? "border-brand bg-brand-soft text-brand-strong" : "border-border bg-surface"}`}
              >
                {isFollowing(`division:${d.id}`) ? "Following · " : "+ "}
                {d.name}
              </button>
            ))}
        </div>
        <p className="sr-only" role="status">
          {divisionIds.length} divisions followed
        </p>
      </section>
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
            <ul className="team-grid">
              {teams.data!.data.map((t) => (
                <li key={t.id} className="team-tile">
                  <TeamAvatar name={t.team_name} />
                  <Link
                    href={`/events/${eventId}/teams/${t.id}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="break-words font-semibold">{t.team_name}</p>
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
            <LoadMore query={teams} label="teams" />
          </>
        )}
      </div>
    </div>
  );
}
