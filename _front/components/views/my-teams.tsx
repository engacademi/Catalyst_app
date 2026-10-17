"use client";
import { useHydrated } from "@/lib/hydration";
import Link from "next/link";
import { useFollows, useTeamLabel } from "@/lib/follows";
import { useEntry, useEvent } from "@/lib/queries";
import { Card, PageTitle, Loading, ErrorState } from "../ui";
import { FollowButton } from "../follow-button";
export function MyTeamsView({ eventId }: { eventId: string }) {
  const hydrated = useHydrated();
  const { directTeamIds, divisionIds, toggle } = useFollows(eventId);
  const event = useEvent(eventId);
  if (!hydrated) return <Loading />;
  return (
    <div>
      <PageTitle subtitle="One follow list for this event. Private labels stay on this device.">
        My teams
      </PageTitle>
      <Link
        href={`/events/${eventId}/teams`}
        className="mb-4 inline-flex min-h-11 items-center font-semibold text-brand underline"
      >
        Find more teams & divisions →
      </Link>
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
      ) : entry.error ? (
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
            Private label
            <input
              maxLength={60}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Maya’s team"
              className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3"
            />
          </label>
        </>
      )}
    </Card>
  );
}
