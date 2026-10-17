"use client";
import { useState } from "react";
import type { Match } from "@/lib/api";
import type { AdminEventData } from "./admin-event";
import { useAdminMatches, useAdminMutation } from "./hooks";
import { Card, ErrorState, Loading } from "../ui";
import {
  Field,
  FormError,
  inputClass,
  PrimaryButton,
  SmallButton,
} from "./form";
export function MatchEditorPanel({ event }: { event: AdminEventData }) {
  const query = useAdminMatches(event.id);
  const [search, setSearch] = useState("");
  return (
    <section>
      <h2 className="text-lg font-bold">Match details & bracket slots</h2>
      <p className="mb-4 text-sm text-muted">
        Edit imported schedules here. Connected AES/TIMU/MyTeam matches must be
        changed in their official platform, then refreshed under Sources.
        Bracket changes update displayed slots; this is not an automatic bracket
        generator.
      </p>
      <input
        aria-label="Search staff matches"
        className={inputClass}
        placeholder="Search team, round or match number"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <div className="mt-4 space-y-3">
          {query.data?.data
            .filter((m) =>
              `${m.home.team_name} ${m.away.team_name} ${m.round_label} ${m.source_match_id}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((m) => (
              <ImportedMatch
                key={`${m.id}-${m.revision}`}
                match={m}
                event={event}
              />
            ))}
          {query.hasNextPage && (
            <SmallButton
              disabled={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              Load more matches
            </SmallButton>
          )}
        </div>
      )}
    </section>
  );
}
function ImportedMatch({
  match: m,
  event,
}: {
  match: Match;
  event: AdminEventData;
}) {
  const [scores, setScores] = useState(
    m.sets.filter((s) => s.home != null && s.away != null).map((s) => `${s.home}-${s.away}`).join(" "),
  );
  const [scoreError, setScoreError] = useState("");
  const [form, setForm] = useState({
    scheduled_start: m.scheduled_start ?? "",
    court_id: m.court?.id ?? "",
    round_label: m.round_label ?? "",
    status: m.status,
    home_entry_id: m.home.entry_id ?? "",
    away_entry_id: m.away.entry_id ?? "",
    home_placeholder: m.home.placeholder ?? "",
    away_placeholder: m.away.placeholder ?? "",
  });
  const save = useAdminMutation("PATCH", `/v1/admin/matches/${m.id}`);
  const source = event.sources.find((s) => s.id === m.source.id);
  const editable =
    source && ["manual_import", "demo_fixture"].includes(source.mode);
  return (
    <Card>
      <details>
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">
          {m.home.team_name ?? m.home.placeholder ?? "TBD"} vs{" "}
          {m.away.team_name ?? m.away.placeholder ?? "TBD"} · {m.round_label}
        </summary>
        {editable ? (
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const valid =
                !scores.trim() ||
                /^\d{1,3}-\d{1,3}(\s+\d{1,3}-\d{1,3}){0,4}$/.test(
                  scores.trim(),
                );
              if (!valid) {
                setScoreError(
                  "Use home-away scores separated by spaces, e.g. 25-21 25-19.",
                );
                return;
              }
              setScoreError("");
              save.mutate({
                ...form,
                sets: scores.trim()
                  ? scores
                      .trim()
                      .split(/\s+/)
                      .map((set) => set.split("-").map(Number))
                  : [],
                expected_revision: m.revision,
                scheduled_start: form.scheduled_start || null,
                court_id: form.court_id || null,
                home_entry_id: form.home_entry_id || null,
                away_entry_id: form.away_entry_id || null,
              });
            }}
          >
            <Field
              label="Official start (ISO with timezone)"
              hint="Example: 2026-10-17T14:00:00-04:00"
            >
              <input
                className={inputClass}
                value={form.scheduled_start}
                onChange={(e) =>
                  setForm({ ...form, scheduled_start: e.target.value })
                }
              />
            </Field>
            <Field label="Court">
              <select
                className={inputClass}
                value={form.court_id}
                onChange={(e) => setForm({ ...form, court_id: e.target.value })}
              >
                <option value="">Unassigned</option>
                {event.venues.flatMap((v) =>
                  v.courts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {v.name} · {c.label}
                    </option>
                  )),
                )}
              </select>
            </Field>
            <Field label="Round / bracket stage">
              <input
                className={inputClass}
                value={form.round_label}
                onChange={(e) =>
                  setForm({ ...form, round_label: e.target.value })
                }
              />
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as Match["status"],
                  })
                }
              >
                {[
                  "scheduled",
                  "in_progress",
                  "completed",
                  "cancelled",
                  "postponed",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            {(["home", "away"] as const).map((slot) => (
              <div key={slot}>
                <Field label={`${slot} team`}>
                  <select
                    className={inputClass}
                    value={form[`${slot}_entry_id`]}
                    onChange={(e) =>
                      setForm({ ...form, [`${slot}_entry_id`]: e.target.value })
                    }
                  >
                    <option value="">Unresolved bracket slot</option>
                    {event.entries.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.team_name}
                      </option>
                    ))}
                  </select>
                </Field>
                {!form[`${slot}_entry_id`] && (
                  <Field label={`${slot} placeholder`}>
                    <input
                      className={inputClass}
                      value={form[`${slot}_placeholder`]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [`${slot}_placeholder`]: e.target.value,
                        })
                      }
                    />
                  </Field>
                )}
              </div>
            ))}
            <Field
              label="Set scores"
              hint="Home-away, separated by spaces. Example: 25-21 22-25 15-12"
            >
              <input
                className={inputClass}
                value={scores}
                onChange={(e) => setScores(e.target.value)}
              />
            </Field>
            {scoreError && <p role="alert">{scoreError}</p>}
            <FormError error={save.error} />
            {save.isSuccess && <p role="status">Match updated.</p>}
            <PrimaryButton pending={save.isPending}>Save match</PrimaryButton>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted">
            This source owns its official schedule. Make changes upstream and
            refresh under Sources.
          </p>
        )}
      </details>
    </Card>
  );
}
