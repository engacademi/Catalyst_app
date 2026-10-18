"use client";
import Link from "next/link";
import { API_BASE } from "@/lib/api";
import { useState } from "react";

import { useAdminAuth } from "./auth";
import { useAdminMatches, useAdminMutation, useAdminQuery } from "./hooks";
import {
  Field,
  FormError,
  inputClass,
  PrimaryButton,
  SmallButton,
} from "./form";
import { LoadMore } from "../load-more";
import { Card, ErrorState, Loading, SectionTitle } from "../ui";
import type { AdminEventData } from "./admin-event";

export function ConnectionsPanel({ event }: { event: AdminEventData }) {
  const create = useAdminMutation(
    "POST",
    `/v1/admin/events/${event.id}/sources`,
  );
  const [form, setForm] = useState({
    name: "",
    mode: "aes",
    key: "",
    division: "",
    venue: "",
    auto: false,
    authorized: false,
  });
  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Connect a published competition source. Schedules stay in the original
        system; the companion checks for changes centrally.
      </p>
      <div className="space-y-3">
        {event.sources.map((s) => (
          <Connection key={s.id} source={s} />
        ))}
      </div>
      <SectionTitle>Add a connection</SectionTitle>
      <Card>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              name: form.name,
              mode: form.mode,
              config: {
                authorized: form.authorized,
                auto_sync: form.auto,
                event_key: form.mode === "aes" ? form.key : undefined,
                tournament_id: form.mode === "timu" ? form.key : undefined,
                division: form.division || undefined,
                venue: form.venue || undefined,
              },
              official_url:
                form.mode === "timu"
                  ? `https://www.timu.ca/scoreboards/results.php?tid=${form.key}`
                  : null,
            });
          }}
        >
          <Field label="Source name">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Platform">
            <select
              value={form.mode}
              onChange={(e) =>
                setForm({ ...form, mode: e.target.value, key: "" })
              }
              className={inputClass}
            >
              <option value="aes">AES · published event API</option>
              <option value="timu">TIMU · published results</option>
              <option value="manual_import">Approved CSV export</option>
            </select>
          </Field>
          {form.mode !== "manual_import" && (
            <Field
              label={
                form.mode === "aes" ? "AES event key" : "TIMU tournament id"
              }
              hint="Copy from the official event URL."
            >
              <input
                required
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                className={inputClass}
              />
            </Field>
          )}
          {form.mode === "timu" && (
            <>
              <Field label="Division name (optional)">
                <input
                  value={form.division}
                  onChange={(e) =>
                    setForm({ ...form, division: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Venue name">
                <input
                  required
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </>
          )}
          {form.mode !== "manual_import" && (
            <div className="space-y-3 sm:col-span-2">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  required
                  checked={form.authorized}
                  onChange={(e) =>
                    setForm({ ...form, authorized: e.target.checked })
                  }
                />
                I have permission to read and display this event.
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.auto}
                  onChange={(e) => setForm({ ...form, auto: e.target.checked })}
                />
                Check automatically every 15 minutes
              </label>
            </div>
          )}
          <div className="sm:col-span-2">
            <FormError error={create.error} />
            <PrimaryButton pending={create.isPending}>Add source</PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
function Connection({
  source: s,
}: {
  source: AdminEventData["sources"][number];
}) {
  const patch = useAdminMutation("PATCH", `/v1/admin/sources/${s.id}`);
  const refresh = useAdminMutation<
    undefined,
    {
      data: {
        ok: boolean;
        message?: string;
        entries?: number;
        matches?: number;
        divisions?: number;
      };
    }
  >("POST", `/v1/admin/sources/${s.id}/refresh`);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{s.name}</h2>
          <p className="mt-1 text-xs text-muted">
            {s.mode} · {s.freshness.replaceAll("_", " ")} · {s.status}
          </p>
          <p className="mt-1 text-xs text-muted">
            Last check:{" "}
            {s.last_checked_at
              ? new Date(s.last_checked_at).toLocaleString()
              : "Not checked yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SmallButton
            onClick={() =>
              patch.mutate({
                status: s.status === "paused" ? "active" : "paused",
              })
            }
          >
            {s.status === "paused" ? "Resume" : "Pause"}
          </SmallButton>
          {["aes", "timu"].includes(s.mode) && (
            <SmallButton
              tone="brand"
              disabled={refresh.isPending || s.status === "paused"}
              onClick={() => refresh.mutate(undefined)}
            >
              {refresh.isPending ? "Checking…" : "Check now"}
            </SmallButton>
          )}
        </div>
      </div>
      {s.last_error && (
        <p
          className="mt-3 rounded-lg bg-warn-soft p-3 text-sm text-warn"
          role="status"
        >
          {s.last_error}
        </p>
      )}
      {refresh.data && (
        <p className="mt-3 text-sm" role="status">
          {refresh.data.data.ok
            ? `Checked: ${refresh.data.data.entries} entries, ${refresh.data.data.matches} matches, ${refresh.data.data.divisions} divisions.`
            : refresh.data.data.message}
        </p>
      )}
      {s.config?.capabilities?.divisions &&
        !s.config?.capabilities?.matches && (
          <p className="mt-2 text-xs text-warn">
            Event summary checked. This source has not supplied match data yet.
          </p>
        )}
      <FormError error={refresh.error ?? patch.error} />
    </Card>
  );
}

export function RegistrationPanel({ event }: { event: AdminEventData }) {
  const { auth } = useAdminAuth();
  const [headers, setHeaders] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<Record<string, string>>({});
  const [source, setSource] = useState(event.sources[0]?.id ?? "");
  const [mapping, setMapping] = useState<{ external: string; entry: string }[]>(
    [{ external: "", entry: "" }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [preview, setPreview] = useState<{
    id: string;
    state: string;
    error_count: number;
    errors: string[];
    summary: Record<string, number>;
    rows: {
      row: number;
      action: string;
      errors: string[];
      external_id: string;
      data: {
        entry_id?: string | null;
        mapping_source?: "submitted" | "remembered" | "source_id" | null;
        previous_entry_id?: string | null;
        team_photo_status?: string;
      };
    }[];
  } | null>(null);
  const commit = useAdminMutation<{ id: string }>(
    "POST",
    (b) => `/v1/admin/imports/${b.id}/commit`,
  );
  // Mappings committed earlier for this source apply automatically; staff only change them.
  const saved = useAdminQuery<{
    data: { external_id: string; entry_id: string; team_name: string }[];
  }>(source ? `/v1/admin/sources/${source}/registration-mappings` : null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const forget = useAdminMutation<{ external: string }>(
    "DELETE",
    (b) =>
      `/v1/admin/sources/${source}/registration-mappings/${encodeURIComponent(b.external)}`,
  );
  const teamName = (id?: string | null) =>
    event.entries.find((t) => t.id === id)?.team_name ?? "an unknown team";
  async function inspect(chosen: File) {
    setFile(chosen);
    setError(null);
    setPreview(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", chosen);
      const res = await fetch(`${API_BASE}/v1/admin/registration/columns`, {
        method: "POST",
        headers: await auth(),
        body,
      });
      const json = await res.json();
      if (!res.ok) throw Error(json.detail);
      setHeaders(json.data);
      setColumns(
        Object.fromEntries((json.data as string[]).map((h) => [h, h])),
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("event_id", event.id);
      body.set("source_id", source);
      body.set("kind", "rosters");
      body.set(
        "column_mapping",
        JSON.stringify(
          Object.fromEntries(
            Object.entries(columns).filter(
              ([k, v]) => FIELDS.some(([f]) => f === k) && v,
            ),
          ),
        ),
      );
      body.set(
        "team_mapping",
        JSON.stringify(
          Object.fromEntries(
            [
              ...(saved.data?.data ?? [])
                .filter(
                  (m) =>
                    overrides[m.external_id] &&
                    overrides[m.external_id] !== m.entry_id,
                )
                .map((m) => [m.external_id, overrides[m.external_id]]),
              ...mapping
                .filter((m) => m.external && m.entry)
                .map((m) => [m.external, m.entry]),
            ],
          ),
        ),
      );
      const res = await fetch(`${API_BASE}/v1/admin/imports`, {
        method: "POST",
        headers: await auth(),
        body,
      });
      const json = await res.json();
      if (!res.ok) throw Error(json.detail);
      setPreview(json.data);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="mb-4 rounded-xl border border-brand/30 bg-brand-soft p-4">
        <h2 className="font-semibold">
          Submitted once. Reviewed before publication.
        </h2>
        <p className="mt-1 text-sm">
          Use the registration system&apos;s existing export. Map its columns
          and team identities, preview the import, then let the assigned coach
          review the draft. Staff publish after approval.
        </p>
      </div>
      <Card>
        <form onSubmit={upload} className="space-y-4">
          <Field label="Registration export (CSV)">
            <input
              type="file"
              accept=".csv,text/csv"
              required
              onChange={(e) => {
                if (e.target.files?.[0]) inspect(e.target.files[0]);
              }}
              className={inputClass}
            />
          </Field>
          <Field label="Registration source">
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setOverrides({});
              }}
              className={inputClass}
            >
              {event.sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          {headers.length > 0 && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {FIELDS.map(([key, label]) => (
                  <Field key={key} label={label}>
                    <select
                      required={[
                        "external_entry_id",
                        "jersey",
                        "display_name",
                      ].includes(key)}
                      value={columns[key] ?? ""}
                      onChange={(e) =>
                        setColumns({ ...columns, [key]: e.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">Do not import</option>
                      {headers.map((h) => (
                        <option key={h}>{h}</option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
              {(saved.data?.data.length ?? 0) > 0 && (
                <div className="rounded-xl border border-border p-3">
                  <h3 className="font-semibold">Remembered team mappings</h3>
                  <p className="text-xs text-muted">
                    Saved from earlier imports of this source and applied
                    automatically. Change a team only if the registration ID
                    now belongs to a different entry.
                  </p>
                  <ul className="mt-2 divide-y divide-border">
                    {saved.data!.data.map((m) => (
                      <li
                        key={m.external_id}
                        className="grid items-end gap-2 py-2 sm:grid-cols-[1fr_1fr_auto]"
                      >
                        <p className="text-sm">
                          <span className="font-mono">{m.external_id}</span>
                          <span className="block text-xs text-muted">
                            Remembered: {m.team_name}
                          </span>
                        </p>
                        <Field label="Event entry">
                          <select
                            value={overrides[m.external_id] ?? m.entry_id}
                            onChange={(e) =>
                              setOverrides({
                                ...overrides,
                                [m.external_id]: e.target.value,
                              })
                            }
                            className={inputClass}
                          >
                            {event.entries.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.team_name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <SmallButton
                          disabled={forget.isPending}
                          onClick={() =>
                            forget.mutate({ external: m.external_id })
                          }
                        >
                          Forget
                        </SmallButton>
                      </li>
                    ))}
                  </ul>
                  <FormError error={forget.error} />
                </div>
              )}
              <h3 className="font-semibold">Map new registration team IDs</h3>
              <p className="text-xs text-muted">
                Use exact IDs from the export. Remembered IDs and IDs that
                already match this source need no mapping. New mappings are
                saved when you commit.
              </p>
              {mapping.map((m, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-2">
                  <Field label={`Registration team ID ${i + 1}`}>
                    <input
                      value={m.external}
                      onChange={(e) =>
                        setMapping(
                          mapping.map((x, j) =>
                            j === i ? { ...x, external: e.target.value } : x,
                          ),
                        )
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Event entry">
                    <select
                      value={m.entry}
                      onChange={(e) =>
                        setMapping(
                          mapping.map((x, j) =>
                            j === i ? { ...x, entry: e.target.value } : x,
                          ),
                        )
                      }
                      className={inputClass}
                    >
                      <option value="">Choose team</option>
                      {event.entries.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.team_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              ))}
              <SmallButton
                onClick={() =>
                  setMapping([...mapping, { external: "", entry: "" }])
                }
              >
                Add team mapping
              </SmallButton>
              <div>
                <PrimaryButton pending={busy}>
                  Preview registration import
                </PrimaryButton>
              </div>
            </>
          )}
          <FormError error={error} />
        </form>
      </Card>
      {preview && (
        <Card className="mt-4">
          <h3 className="font-semibold">Import preview</h3>
          <p className="my-2 text-sm">
            {preview.summary.add} new · {preview.summary.change} changed ·{" "}
            {preview.error_count} errors
          </p>
          {preview.errors.map((e) => (
            <p key={e} className="text-sm text-danger">
              {e}
            </p>
          ))}
          <ul className="max-h-64 overflow-y-auto text-sm">
            {preview.rows.map((row) => (
              <li key={row.row} className="border-b border-border py-2">
                Row {row.row}: {row.action}
                {row.external_id ? ` · ${row.external_id}` : ""}
                {row.data?.entry_id ? ` → ${teamName(row.data.entry_id)}` : ""}
                {row.errors.length ? ` · ${row.errors.join("; ")}` : ""}
                {row.data?.mapping_source && (
                  <span className="block text-xs text-muted">
                    {row.data.mapping_source === "remembered"
                      ? "Team mapping remembered from an earlier import"
                      : row.data.mapping_source === "source_id"
                        ? "Matches the tournament team ID"
                        : row.data.previous_entry_id
                          ? `Mapping changed from ${teamName(row.data.previous_entry_id)}; saved on commit`
                          : "New mapping; saved on commit"}
                    {row.data.team_photo_status === "withheld" &&
                      " · Team photo withheld, approval missing"}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <SmallButton
              disabled={
                preview.error_count > 0 ||
                preview.state !== "staged" ||
                commit.isPending
              }
              tone="brand"
              onClick={() =>
                commit.mutate(
                  { id: preview.id },
                  {
                    onSuccess: () =>
                      setPreview({ ...preview, state: "committed" }),
                  },
                )
              }
            >
              {preview.state === "committed"
                ? "Drafts created · awaiting coach review"
                : "Commit as roster drafts"}
            </SmallButton>
          </div>
          <FormError error={commit.error} />
        </Card>
      )}
      <p className="mt-3 text-xs text-muted">
        No vendor-specific MRS export format is assumed. Photos without explicit
        approval are withheld.
      </p>
    </div>
  );
}
function TeamPhotoStatus({
  status,
  url,
}: {
  status: "approved" | "withheld" | "none";
  url: string | null;
}) {
  if (status === "withheld")
    return (
      <p
        role="status"
        className="mt-2 rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm text-warn"
      >
        <span className="font-semibold">
          Team photo withheld: awaiting approval.
        </span>{" "}
        The export included a team photo without approval, so it will not be
        published. Ask staff to send an approved photo before you approve.
      </p>
    );
  if (status === "approved" && url)
    return (
      <div className="mt-2 flex items-center gap-3 text-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Approved team photo"
          className="h-14 w-20 rounded-md object-cover"
        />
        <span>Team photo approved and will be published.</span>
      </div>
    );
  return <p className="mt-2 text-sm text-muted">No team photo submitted.</p>;
}

const FIELDS = [
  ["external_entry_id", "Registration team ID"],
  ["jersey", "Jersey number"],
  ["display_name", "Approved public display name"],
  ["position", "Position"],
  ["photo_url", "Athlete photo URL"],
  ["photo_approved", "Photo approval (yes/no)"],
  ["team_photo_url", "Team photo URL"],
  ["team_photo_approved", "Team photo approval (yes/no)"],
];

type Assignment = {
  id: string;
  subject: string;
  role: string;
  match_id: string;
  reporting_time: string;
  revision: number;
};
export function AssignmentPanel({ event }: { event: AdminEventData }) {
  const list = useAdminQuery<{ data: Assignment[] }>(
    `/v1/admin/events/${event.id}/assignments`,
  );
  const matches = useAdminMatches(event.id);
  const [form, setForm] = useState({
    id: "",
    subject: "",
    role: "First referee",
    match_id: "",
    reporting_time: "",
    revision: 1,
  });
  const [done, setDone] = useState("");
  const save = useAdminMutation<Record<string, unknown>>(
    form.id ? "PUT" : "POST",
    form.id
      ? `/v1/admin/assignments/${form.id}`
      : `/v1/admin/events/${event.id}/assignments`,
  );
  const remove = useAdminMutation<{ id: string }>(
    "DELETE",
    (b) => `/v1/admin/assignments/${b.id}`,
  );
  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Private assignments are visible only to the assigned official. First
        grant their Clerk subject an official role for this event. For bulk
        imports, choose Assignments in the Imports tab.
      </p>
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              {
                subject: form.subject,
                role: form.role,
                match_id: form.match_id,
                reporting_time: new Date(form.reporting_time).toISOString(),
                expected_revision: form.revision,
              },
              {
                onSuccess: () => {
                  setDone("Assignment saved");
                  setForm({
                    ...form,
                    id: "",
                    subject: "",
                    match_id: "",
                    reporting_time: "",
                  });
                },
              },
            );
          }}
        >
          <Field label="Official's Clerk subject">
            <input
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Role">
            <input
              required
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Match">
            <select
              required
              value={form.match_id}
              onChange={(e) => setForm({ ...form, match_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Choose match</option>
              {matches.data?.data.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.source_match_id}: {m.home.team_name ?? m.home.placeholder}{" "}
                  vs {m.away.team_name ?? m.away.placeholder}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reporting time" hint="Your device's local timezone">
            <input
              required
              type="datetime-local"
              value={form.reporting_time}
              onChange={(e) =>
                setForm({ ...form, reporting_time: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <div>
            <PrimaryButton pending={save.isPending}>
              {form.id ? "Save changes" : "Assign official"}
            </PrimaryButton>
          </div>
          <FormError error={save.error ?? remove.error} />
          <p role="status" className="text-sm text-brand">
            {done}
          </p>
        </form>
      </Card>
      <LoadMore query={matches} label="matches for assignment" />
      {matches.error && <ErrorState error={matches.error} />}
      <SectionTitle>Assigned Leads</SectionTitle>
      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <ErrorState error={list.error} />
      ) : (
        <ul className="space-y-2">
          {list.data.data.map((a) => (
            <li key={a.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{a.role}</p>
                    <p className="text-xs text-muted">
                      {a.subject} ·{" "}
                      {new Date(a.reporting_time).toLocaleString()} · Revision{" "}
                      {a.revision}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <SmallButton
                      onClick={() => {
                        const date = new Date(a.reporting_time);
                        setForm({
                          ...a,
                          reporting_time: new Date(
                            date.getTime() - date.getTimezoneOffset() * 60000,
                          )
                            .toISOString()
                            .slice(0, 16),
                        });
                      }}
                    >
                      Edit
                    </SmallButton>
                    <SmallButton
                      tone="danger"
                      onClick={() => remove.mutate({ id: a.id })}
                    >
                      Remove
                    </SmallButton>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CoachReviews() {
  const list = useAdminQuery<{
    data: {
      id: string;
      team: string;
      version: number;
      state: string;
      players: {
        jersey: number;
        display_name: string;
        photo_url: string | null;
      }[];
      review: { state?: string; photos_withheld?: number; note?: string };
      team_photo_url: string | null;
      team_photo_status: "approved" | "withheld" | "none";
    }[];
  }>("/v1/me/roster-reviews");
  const review = useAdminMutation<{
    id: string;
    approved: boolean;
    note: string;
  }>("POST", (b) => `/v1/me/roster-reviews/${b.id}`);
  const [notes, setNotes] = useState<Record<string, string>>({});
  return (
    <div>
      <h1 className="text-2xl font-bold">Roster review</h1>
      <p className="mt-2 text-sm text-muted">
        Review the existing registration export for your assigned team. Staff
        publish after you approve this version.
      </p>
      <Link
        href="/admin"
        className="my-3 inline-block text-sm text-brand underline"
      >
        Staff home
      </Link>
      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <ErrorState error={list.error} />
      ) : list.data.data.length === 0 ? (
        <p className="mt-4 text-sm">No rosters assigned for your review.</p>
      ) : (
        list.data.data.map((r) => (
          <Card key={r.id} className="mt-4">
            <h2 className="font-semibold">
              {r.team} · Version {r.version}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {r.review.state ?? "Pending"} · {r.review.photos_withheld ?? 0}{" "}
              photos withheld because approval was missing
            </p>
            <TeamPhotoStatus
              status={r.team_photo_status}
              url={r.team_photo_url}
            />
            <ul className="my-3 divide-y divide-border">
              {r.players.map((p) => (
                <li
                  key={`${p.jersey}-${p.display_name}`}
                  className="flex justify-between gap-2 py-2 text-sm"
                >
                  <span>
                    #{p.jersey} {p.display_name}
                  </span>
                  <span className="text-muted">
                    {p.photo_url ? "Photo approved" : "No public photo"}
                  </span>
                </li>
              ))}
            </ul>
            {r.state === "draft" && (
              <>
                <Field label="Review note">
                  <textarea
                    value={notes[r.id] ?? ""}
                    onChange={(e) =>
                      setNotes({ ...notes, [r.id]: e.target.value })
                    }
                    maxLength={1000}
                    className={`${inputClass} py-2`}
                  />
                </Field>
                <div className="mt-3 flex flex-wrap gap-2">
                  <SmallButton
                    tone="brand"
                    disabled={review.isPending}
                    onClick={() =>
                      review.mutate({
                        id: r.id,
                        approved: true,
                        note: notes[r.id] ?? "",
                      })
                    }
                  >
                    Approve this version
                  </SmallButton>
                  <SmallButton
                    disabled={review.isPending || !notes[r.id]?.trim()}
                    onClick={() =>
                      review.mutate({
                        id: r.id,
                        approved: false,
                        note: notes[r.id] ?? "",
                      })
                    }
                  >
                    Request correction
                  </SmallButton>
                </div>
              </>
            )}
          </Card>
        ))
      )}
      <FormError error={review.error} />
    </div>
  );
}
