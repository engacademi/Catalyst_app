"use client";
import { useHydrated } from "@/lib/hydration";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoadMore } from "../load-more";
import { useFollows } from "@/lib/follows";
import { dayKey, formatDay } from "@/lib/format";
import { useEvent, useMatches } from "@/lib/queries";
import { FreshnessNote } from "../freshness";
import { MatchCard } from "../match-card";
import {
  EmptyState,
  ErrorState,
  Loading,
  PageTitle,
  SectionTitle,
} from "../ui";

const STATUS_TABS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "in_progress", label: "In progress" },
  { value: "results", label: "Results" },
  { value: "all", label: "All" },
];
const FILTERS = [
  "status",
  "venue_id",
  "court_id",
  "division_id",
  "mine",
] as const;

export function MatchesView({ eventId }: { eventId: string }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const event = useEvent(eventId);
  const { ids, directTeamIds, divisionIds } = useFollows(eventId);

  const status = params.get("status") ?? "upcoming";
  const mine = params.get("mine") === "1";
  const api = new URLSearchParams({ status });
  for (const key of ["venue_id", "court_id", "division_id"] as const) {
    const v = params.get(key);
    if (v) api.set(key, v);
  }
  if (mine) {
    api.set("entry_ids", directTeamIds.join(","));
    api.set("division_ids", divisionIds.join(","));
  }
  const matches = useMatches(eventId, api);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "venue_id") next.delete("court_id");
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const hasFilters = FILTERS.some((f) => f !== "status" && params.get(f));
  const venues = event.data?.data.venues ?? [];
  const courts =
    venues.find((v) => v.id === params.get("venue_id"))?.courts ??
    venues.flatMap((v) => v.courts);

  const groups = new Map<string, NonNullable<typeof matches.data>["data"]>();
  for (const m of matches.data?.data ?? []) {
    const key = dayKey(m.estimated_start ?? m.scheduled_start, m.timezone);
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }

  if (!hydrated) return <Loading />;
  return (
    <div>
      <PageTitle subtitle="Every court. Every team. The latest published schedule and results.">
        Match centre
      </PageTitle>
      <Link
        href={`/events/${eventId}/pathway`}
        className="mb-4 inline-flex min-h-11 items-center rounded-full border border-brand bg-surface px-4 text-sm font-semibold text-brand"
      >
        View pool & playoff path →
      </Link>
      <div role="group" aria-label="Match status" className="status-tabs">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}

            aria-pressed={status === t.value}
            onClick={() => set("status", t.value)}
            className={`min-h-10 rounded-full text-sm ${status === t.value ? "bg-brand font-semibold text-white" : "text-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="filter-panel mt-4">
        <Select
          label="Venue"
          value={params.get("venue_id") ?? ""}
          onChange={(v) => set("venue_id", v)}
          options={venues.map((v) => [v.id, v.name])}
          all="All venues"
        />
        <Select
          label="Court"
          value={params.get("court_id") ?? ""}
          onChange={(v) => set("court_id", v)}
          options={courts.map((c) => [c.id, c.label])}
          all="All courts"
        />
        <Select
          label="Division"
          value={params.get("division_id") ?? ""}
          onChange={(v) => set("division_id", v)}
          options={(event.data?.data.divisions ?? []).map((d) => [
            d.id,
            d.name,
          ])}
          all="All divisions"
        />
        <label className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm">
          <input
            type="checkbox"
            checked={mine}
            disabled={!ids.length && !divisionIds.length}
            onChange={(e) => set("mine", e.target.checked ? "1" : "")}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          My teams only
        </label>
      </div>
      {hasFilters && (
        <button
          onClick={() => router.replace(`${pathname}?status=${status}`)}
          className="mt-2 text-sm font-semibold text-brand underline"
        >
          Reset filters
        </button>
      )}

      <div className="mt-2" aria-live="polite">
        {matches.isPending ? (
          <Loading label="Loading matches" />
        ) : matches.error ? (
          <ErrorState error={matches.error} />
        ) : matches.data!.data.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No matches here">
              {status === "in_progress"
                ? "A match only shows as in progress when the competition source says so."
                : "Try another status or reset the filters."}
            </EmptyState>
          </div>
        ) : (
          [...groups.entries()].map(([key, list]) => (
            <section key={key}>
              <SectionTitle>
                {key === "tbd"
                  ? "Time to be confirmed"
                  : formatDay(
                      list[0].estimated_start ?? list[0].scheduled_start,
                      list[0].timezone,
                    )}
              </SectionTitle>
              <ul className="match-list">
                {list.map((m) => (
                  <li key={m.id}>
                    <MatchCard match={m} eventId={eventId} followed={ids} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      <LoadMore query={matches} label="matches" />
      <FreshnessNote sources={matches.data?.sources} />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  all,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[][];
  all: string;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-full border border-border bg-surface px-3 text-sm"
      >
        <option value="">{all}</option>
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
