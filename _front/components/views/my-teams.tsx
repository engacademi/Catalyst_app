"use client";

import Link from "next/link";
import { useState } from "react";
import { Tag, X } from "lucide-react";
import { useFollows } from "@/lib/follows";
import { LABEL_MAX_LENGTH, cleanLabel, useLabels } from "@/lib/labels";
import { useMyDay } from "@/lib/queries";
import { EmptyState, ErrorState, Loading, PageTitle, SectionTitle } from "../ui";

export function MyTeamsView({ eventId }: { eventId: string }) {
  const { ids, toggle } = useFollows(eventId);
  const { labelFor, setLabel, removeLabel } = useLabels(eventId);
  const query = useMyDay(eventId, ids);

  const unfollow = (entryId: string) => {
    removeLabel(entryId);
    toggle(entryId);
  };

  return (
    <div>
      <PageTitle subtitle="Everything you follow at this event, with your private labels.">My teams</PageTitle>

      <SectionTitle>Teams</SectionTitle>
      {ids.length === 0 ? (
        <EmptyState title="You aren't following any teams yet">
          <Link href={`/events/${eventId}/teams`} className="font-semibold text-brand underline">
            Find teams
          </Link>
        </EmptyState>
      ) : query.isPending ? (
        <Loading label="Loading your teams" />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {ids.map((id) => {
            const team = query.data.data.entries.find((e) => e.id === id);
            const teamName = team?.team_name ?? "Team no longer listed";
            const label = labelFor(id);
            return (
              <li key={id} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {label && (
                      <span className="mb-1 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">
                        {label}
                      </span>
                    )}
                    {team ? (
                      <Link href={`/events/${eventId}/teams/${id}`} className="block truncate font-semibold">
                        {teamName}
                      </Link>
                    ) : (
                      <p className="truncate font-semibold italic text-muted">{teamName}</p>
                    )}
                    {team && (
                      <p className="truncate text-sm text-muted">
                        {[team.club_name, team.division?.name].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => unfollow(id)}
                    aria-label={`Unfollow ${teamName}`}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-3 text-sm font-medium text-brand-strong hover:border-danger hover:text-danger"
                  >
                    <X aria-hidden className="h-4 w-4" /> Unfollow
                  </button>
                </div>
                <LabelEditor
                  key={label ?? ""}
                  teamName={teamName}
                  label={label}
                  onSave={(text) => setLabel(id, text)}
                  onRemove={() => removeLabel(id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted">
        Follows and labels are saved on this device only. Labels are never sent to Courtside or the event organizer.
      </p>
    </div>
  );
}

function LabelEditor({
  teamName,
  label,
  onSave,
  onRemove,
}: {
  teamName: string;
  label: string | undefined;
  onSave: (text: string) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(label ?? "");
  const changed = cleanLabel(text) !== (label ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(text);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Private label for {teamName}</span>
        <Tag aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={LABEL_MAX_LENGTH}
          placeholder="Add a label, like Maya's team"
          className="min-h-11 w-full rounded-full border border-border bg-surface pl-9 pr-4 text-base"
        />
      </label>
      <button
        type="submit"
        disabled={!changed}
        className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-white disabled:opacity-40"
      >
        {label ? "Save" : "Add"}
      </button>
      {label && (
        <button
          type="button"
          onClick={onRemove}
          className="min-h-11 rounded-full border border-border px-4 text-sm font-medium text-muted hover:text-danger"
        >
          Remove label
        </button>
      )}
    </form>
  );
}
