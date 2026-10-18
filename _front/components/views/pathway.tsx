"use client";
import { useHydrated } from "@/lib/hydration";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, type Match, type SourceInfo } from "@/lib/api";
import { useEvent } from "@/lib/queries";
import { useFollows } from "@/lib/follows";
import { BracketBoard } from "../bracket-board";
import { FreshnessNote } from "../freshness";
import { EmptyState, ErrorState, Loading, PageTitle } from "../ui";

export function PathwayView({ eventId }: { eventId: string }) {
  const hydrated = useHydrated();
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
  if (!hydrated) return <Loading />;
  return (
    <div>
      <PageTitle>Brackets</PageTitle>
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
            <BracketBoard
              key={division}
              eventId={eventId}
              followed={ids}
              rounds={query.data.data
                .map((round) => ({
                  ...round,
                  matches: round.matches.filter(
                    (m) =>
                      !mine ||
                      ids.includes(m.home.entry_id ?? "") ||
                      ids.includes(m.away.entry_id ?? "") ||
                      !m.home.entry_id ||
                      !m.away.entry_id,
                  ),
                }))
                .filter((round) => round.matches.length)}
            />
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
