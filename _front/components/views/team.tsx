"use client";
import { useHydrated } from "@/lib/hydration";

import Link from "next/link";
import Image from "next/image";
import { UserRound } from "lucide-react";
import { useEntry } from "@/lib/queries";
import { useFollows } from "@/lib/follows";
import { FollowButton } from "../follow-button";
import { FreshnessNote } from "../freshness";
import { MatchCard } from "../match-card";
import { Card, EmptyState, ErrorState, Loading, SectionTitle } from "../ui";

export function TeamView({
  eventId,
  entryId,
}: {
  eventId: string;
  entryId: string;
}) {
  const hydrated = useHydrated();
  const query = useEntry(entryId);
  const { ids } = useFollows(eventId);
  if (!hydrated || query.isPending) return <Loading label="Loading team" />;
  if (query.error) return <ErrorState error={query.error} />;
  const team = query.data.data;

  return (
    <div>
      <div className="team-profile flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">
            {team.team_name}
          </h1>
          <p className="text-sm text-muted">
            {[team.club_name, team.division?.name].filter(Boolean).join(" · ")}
          </p>
        </div>
        <FollowButton
          eventId={eventId}
          entryId={team.id}
          teamName={team.team_name}
        />
      </div>

      {team.roster?.team_photo_url && (
        <div className="relative mt-4 aspect-video overflow-hidden rounded-xl border border-border bg-background">
          <Image
            src={team.roster.team_photo_url}
            alt={`${team.team_name} team photo`}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      <Link
        href={`/events/${eventId}/pathway${team.division ? `?division=${team.division.id}` : ""}`}
        className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand underline"
      >
        Follow this division’s pool & playoff path →
      </Link>
      <SectionTitle>Matches</SectionTitle>
      {team.matches.length ? (
        <ul className="match-list">
          {team.matches.map((m) => (
            <li key={m.id}>
              <MatchCard
                match={m}
                eventId={eventId}
                followed={[...ids, team.id]}
                showDay
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No matches published for this team yet" />
      )}

      <SectionTitle>Roster</SectionTitle>
      {team.roster ? (
        <Card className="p-0">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{team.team_name} roster</caption>
            <thead className="border-b border-border text-xs uppercase text-muted">
              <tr>
                <th scope="col" className="px-4 py-2">
                  #
                </th>
                <th scope="col" className="px-4 py-2">
                  Athlete
                </th>
                <th scope="col" className="px-4 py-2">
                  Position
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {team.roster.players.map((p) => (
                <tr key={`${p.jersey}-${p.display_name}`}>
                  <td className="px-4 py-2 font-mono font-bold tabular-nums">
                    {p.jersey}
                  </td>
                  <td className="flex items-center gap-2 px-4 py-2">
                    {p.photo_url ? (
                      <Image
                        src={p.photo_url}
                        alt=""
                        width={28}
                        height={28}
                        className="rounded-full"
                        unoptimized
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-background"
                      >
                        <UserRound className="h-4 w-4 text-muted" />
                      </span>
                    )}
                    {p.display_name}
                  </td>
                  <td className="px-4 py-2 text-muted">{p.position ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState title="Roster not published">
          The team&apos;s approved roster will appear here once it&apos;s
          published.
        </EmptyState>
      )}
      {team.roster && (
        <p className="mt-2 text-xs text-muted">
          Approved roster, version {team.roster.version}. Photos appear only
          with consent.
        </p>
      )}

      <FreshnessNote sources={query.data.sources} />
    </div>
  );
}
