"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, type Match, type SourceInfo } from "@/lib/api";
import { useEvent } from "@/lib/queries";
import { useFollows } from "@/lib/follows";
import { MatchCard } from "../match-card";
import { FreshnessNote } from "../freshness";
import { EmptyState, ErrorState, Loading, PageTitle } from "../ui";

export function PathwayView({ eventId }: { eventId: string }) {
  const event = useEvent(eventId);
  const [chosen, choose] = useState("");
  const params = useSearchParams();
  const division =
    chosen || params.get("division") || event.data?.data.divisions[0]?.id || "";
  const { ids } = useFollows(eventId);
  const [mine, setMine] = useState(false);
  const query = useQuery({
    queryKey: ["pathway", eventId, division],
    queryFn: () =>
      apiGet<{
        data: { label: string; matches: Match[] }[];
        sources: SourceInfo[];
        note: string;
      }>(`/v1/events/${eventId}/pathway?division_id=${division}`),
    enabled: !!division,
  });
  return (
    <div>
      <PageTitle subtitle="Follow the official pool and playoff path, including positions still to be decided.">
        Competition path
      </PageTitle>
      <Link
        href={`/events/${eventId}/matches`}
        className="text-sm font-semibold text-brand underline"
      >
        ← Match list
      </Link>
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="flex-1 text-sm font-medium">
          Division
          <select
            value={division}
            onChange={(e) => choose(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface px-3"
          >
            {event.data?.data.divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => setMine(e.target.checked)}
          />
          My teams and unresolved slots
        </label>
      </div>
      {event.error || query.error ? (
        <ErrorState error={event.error || query.error} />
      ) : !division ? (
        <EmptyState title="No divisions published yet" />
      ) : query.isPending ? (
        <Loading />
      ) : (
        query.data && (
          <>
            <p className="my-4 rounded-xl border border-border bg-surface p-3 text-xs text-muted">
              {query.data.note}
            </p>
            <div className="space-y-6">
              {query.data.data.map((round, i) => {
                const matches = round.matches.filter(
                  (m) =>
                    !mine ||
                    ids.includes(m.home.entry_id ?? "") ||
                    ids.includes(m.away.entry_id ?? "") ||
                    !m.home.entry_id ||
                    !m.away.entry_id,
                );
                return matches.length ? (
                  <section key={round.label} aria-label={round.label}>
                    <h2 className="mb-3 flex items-center gap-2 font-semibold">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs text-white"
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      {round.label}
                    </h2>
                    <ul className="grid gap-3 md:grid-cols-2">
                      {matches.map((m) => (
                        <li key={m.id}>
                          <MatchCard
                            match={m}
                            eventId={eventId}
                            followed={ids}
                            showDay
                          />
                          <p className="mt-1 px-2 text-xs text-muted">
                            Source match {m.source_match_id}
                            {m.home.placeholder || m.away.placeholder
                              ? ` · ${m.home.placeholder ?? m.home.team_name} vs ${m.away.placeholder ?? m.away.team_name}`
                              : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null;
              })}
            </div>
            {query.data.data.length === 0 && (
              <EmptyState title="The source has not published this division's path" />
            )}
            <FreshnessNote sources={query.data.sources} />
          </>
        )
      )}
    </div>
  );
}
