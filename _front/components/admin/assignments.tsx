"use client";

import type { Match } from "@/lib/api";
import { courtPlace, formatDay, formatTime } from "@/lib/format";
import { Card, EmptyState, ErrorState, Loading, PageTitle } from "../ui";
import { useAdminQuery } from "./hooks";

type Assignment = {
  id: string;
  role: string;
  reporting_time: string | null;
  revision: number;
  court: { label: string; area: string | null; venue_name: string } | null;
  match: Match | null;
};

export function Assignments() {
  const query = useAdminQuery<{ data: Assignment[] }>("/v1/me/assignments");
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  return (
    <div>
      <PageTitle subtitle="Only you can see these. Times come from the approved assignment import.">My assignments</PageTitle>
      {query.data.data.length === 0 ? (
        <EmptyState title="No assignments for your account" />
      ) : (
        <ul className="space-y-2">
          {query.data.data.map((a) => {
            const tz = a.match?.timezone ?? "America/Toronto";
            return (
              <li key={a.id}>
                <Card>
                  <p className="font-semibold">{a.role}</p>
                  <p className="text-sm">
                    Report {a.reporting_time ? `${formatDay(a.reporting_time, tz)} at ${formatTime(a.reporting_time, tz)}` : "time to be confirmed"}
                    {a.court && ` to ${courtPlace(a.court)}, ${a.court.venue_name}`}
                  </p>
                  {a.match && (
                    <p className="mt-1 text-sm text-muted">
                      {formatTime(a.match.scheduled_start, tz)}: {a.match.home.team_name ?? a.match.home.placeholder} vs{" "}
                      {a.match.away.team_name ?? a.match.away.placeholder}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">Revision {a.revision}</p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
