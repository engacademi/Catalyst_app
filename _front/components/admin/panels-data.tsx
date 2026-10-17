"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Upload } from "lucide-react";
import { API_BASE, apiGet, apiSend, type Match } from "@/lib/api";
import { formatRelative, formatTime } from "@/lib/format";
import { Badge, Card, EmptyState, ErrorState, Loading, SectionTitle } from "../ui";
import type { AdminEventData } from "./admin-event";
import { useAdminAuth } from "./auth";
import { useAdminMutation, useAdminQuery } from "./hooks";
import { Field, FormError, inputClass, PrimaryButton, SmallButton } from "./form";

type StagedRow = { row: number; external_id: string; action: "add" | "change" | "unchanged" | "error"; changes: string[]; errors: string[] };
type Batch = {
  id: string;
  kind: string;
  filename: string | null;
  state: string;
  summary: {
    add: number;
    change: number;
    unchanged: number;
    error: number;
    warnings?: string[];
    identical_to_batch?: string | null;
    change_events?: number;
    found?: { divisions?: number; clubs?: number; teams?: number; matches?: number; courts?: number };
  };
  error_count: number;
  created_at: string;
  committed_at: string | null;
  errors?: string[];
  rows?: StagedRow[];
};

const ACTION_TONE = { add: "brand", change: "warn", unchanged: "neutral", error: "danger" } as const;

export function ImportsPanel({ event }: { event: AdminEventData }) {
  const { auth } = useAdminAuth();
  const history = useAdminQuery<{ data: Batch[] }>(`/v1/admin/events/${event.id}/imports`);
  const commit = useAdminMutation<{ id: string }, { data: Batch }>("POST", (b) => `/v1/admin/imports/${b.id}/commit`);
  const [sourceId, setSourceId] = useState(event.sources[0]?.id ?? "");
  const [kind, setKind] = useState("matches");
  const [consent, setConsent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Batch | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const live = event.sources.find((s) => s.id === sourceId)?.mode === "aes";
  const [liveKind, setLiveKind] = useState<"entries" | "matches">("entries");

  const refresh = async () => {
    setUploading(true);
    setError(null);
    setPreview(null);
    try {
      const json = await apiSend<{ data: Batch }>(auth, "POST", `/v1/admin/sources/${sourceId}/refresh`, { kind: liveKind });
      setPreview(json.data);
    } catch (err) {
      setError(err);
    } finally {
      history.refetch();
      setUploading(false);
    }
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (live) return refresh();
    if (!file) return;
    setUploading(true);
    setError(null);
    setPreview(null);
    const body = new FormData();
    body.set("event_id", event.id);
    body.set("source_id", sourceId);
    body.set("kind", kind);
    body.set("file", file);
    if (kind === "rosters" && consent) body.set("consent_review_ref", consent);
    try {
      const response = await fetch(`${API_BASE}/v1/admin/imports`, { method: "POST", headers: await auth(), body });
      const json = await response.json();
      if (!response.ok) throw new Error(typeof json.detail === "string" ? json.detail : "Upload failed");
      setPreview(json.data);
      history.refetch();
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
    }
  };

  const blocked = !!preview && (preview.error_count > 0 || preview.state !== "staged");

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Upload entries first, then matches, then rosters. You&apos;ll see a preview, and nothing changes until you commit. The column
        reference is in <code>_back/sample_data/README.md</code>.
      </p>
      <Card>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={upload}>
          <Field label="Source">
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={inputClass}>
              {event.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          {live ? (
            <Field label="What to read from AES" hint="Refresh teams first; matches need them. You'll see a preview before anything changes.">
              <select value={liveKind} onChange={(e) => setLiveKind(e.target.value as "entries" | "matches")} className={inputClass}>
                <option value="entries">Divisions, clubs and teams</option>
                <option value="matches">Pool matches, courts and set scores</option>
              </select>
            </Field>
          ) : (
            <>
              <Field label="What's in the file">
                <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
                  <option value="entries">Teams (entries)</option>
                  <option value="matches">Matches and results</option>
                  <option value="rosters">Rosters</option>
                </select>
              </Field>
              <Field label="CSV file" hint="UTF-8, up to 5 MB">
                <input type="file" accept=".csv,text/csv" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
              </Field>
            </>
          )}
          {!live && kind === "rosters" && (
            <Field label="Consent review reference" hint="Required to publish. Leave blank to save rosters as drafts.">
              <input value={consent} onChange={(e) => setConsent(e.target.value)} className={inputClass} />
            </Field>
          )}
          <div className="sm:col-span-2">
            <FormError error={error} />
            <PrimaryButton pending={uploading}>
              {live ? (
                <span className="inline-flex items-center gap-2"><RefreshCw aria-hidden className="h-4 w-4" /> Refresh from AES</span>
              ) : (
                <span className="inline-flex items-center gap-2"><Upload aria-hidden className="h-4 w-4" /> Upload and preview</span>
              )}
            </PrimaryButton>
          </div>
        </form>
      </Card>

      {preview && (
        <section aria-live="polite">
          <SectionTitle>Preview: {preview.filename}</SectionTitle>
          <Card>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="brand">{preview.summary.add} new</Badge>
              <Badge tone="warn">{preview.summary.change} changed</Badge>
              <Badge>{preview.summary.unchanged} unchanged</Badge>
              <Badge tone="danger">{preview.error_count} with errors</Badge>
            </div>
            {preview.summary.found?.teams !== undefined && (
              <p className="mt-2 text-sm">
                Found {preview.summary.found.divisions} divisions, {preview.summary.found.clubs} clubs and {preview.summary.found.teams} teams.
              </p>
            )}
            {preview.summary.found?.matches !== undefined && (
              <p className="mt-2 text-sm">
                Found {preview.summary.found.matches} pool matches on {preview.summary.found.courts} courts.
              </p>
            )}
            {preview.summary.identical_to_batch && <p className="mt-2 text-sm text-muted">This exact data was already committed. Committing again changes nothing.</p>}
            {preview.errors?.map((e) => <p key={e} className="mt-2 text-sm text-danger">{e}</p>)}
            {preview.summary.warnings?.map((w) => <p key={w} className="mt-2 text-sm text-warn">{w}</p>)}
            {!!preview.rows?.length && (
              <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-background text-xs uppercase text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2">Row</th>
                      <th scope="col" className="px-3 py-2">Id</th>
                      <th scope="col" className="px-3 py-2">Result</th>
                      <th scope="col" className="px-3 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.rows.map((r) => (
                      <tr key={`${r.row}-${r.external_id}`}>
                        <td className="px-3 py-1.5 text-muted">{r.row}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{r.external_id}</td>
                        <td className="px-3 py-1.5"><Badge tone={ACTION_TONE[r.action]}>{r.action}</Badge></td>
                        <td className="px-3 py-1.5 text-xs">{r.errors.length ? <span className="text-danger">{r.errors.join("; ")}</span> : r.changes.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 flex items-center gap-3">
              <SmallButton tone="brand" disabled={blocked || commit.isPending} onClick={() => commit.mutate({ id: preview.id }, { onSuccess: (res) => setPreview({ ...preview, ...res.data }) })}>
                {preview.state === "committed" ? "Committed" : commit.isPending ? "Committing…" : "Commit import"}
              </SmallButton>
              {preview.error_count > 0 && <span className="text-sm text-danger">Fix the errors in the file and upload it again.</span>}
              {preview.state === "committed" && <span className="text-sm text-brand">Done. {preview.summary.change_events ?? 0} change notices sent to followers.</span>}
            </div>
            <FormError error={commit.error} />
          </Card>
        </section>
      )}

      <SectionTitle>Recent imports</SectionTitle>
      {history.data?.data.length ? (
        <ul className="space-y-1 text-sm">
          {history.data.data.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
              <Badge tone={b.state === "committed" ? "brand" : b.state === "rejected" ? "danger" : "neutral"}>{b.state}</Badge>
              <span className="font-medium">{b.kind}</span>
              <span className="text-muted">{b.filename}</span>
              <span className="ml-auto text-xs text-muted">{formatRelative(b.created_at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No imports yet.</p>
      )}
    </div>
  );
}

type RosterVersion = { id: string; version: number; state: string; players: { jersey: number; display_name: string; photo_url: string | null }[]; consent_review_ref: string | null; published_at: string | null };

export function RostersPanel({ event }: { event: AdminEventData }) {
  const [entryId, setEntryId] = useState("");
  const [consent, setConsent] = useState("");
  const versions = useAdminQuery<{ data: RosterVersion[] }>(entryId ? `/v1/admin/entries/${entryId}/rosters` : null);
  const publish = useAdminMutation<{ id: string; consent_review_ref: string }>("POST", (b) => `/v1/admin/rosters/${b.id}/publish`);
  const withdraw = useAdminMutation<{ id: string }>("POST", (b) => `/v1/admin/rosters/${b.id}/withdraw`);

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Rosters arrive by CSV import. Only a version with a consent review reference is public, and photos show only when approved.
        Withdrawing a version hides it right away.
      </p>
      <Field label="Team">
        <select value={entryId} onChange={(e) => setEntryId(e.target.value)} className={inputClass}>
          <option value="">Choose a team</option>
          {event.entries.map((e) => <option key={e.id} value={e.id}>{e.team_name}</option>)}
        </select>
      </Field>
      {entryId &&
        (versions.isPending ? (
          <Loading />
        ) : versions.error ? (
          <ErrorState error={versions.error} />
        ) : versions.data.data.length === 0 ? (
          <div className="mt-3"><EmptyState title="No roster imported for this team" /></div>
        ) : (
          <ul className="mt-3 space-y-2">
            {versions.data.data.map((v) => (
              <li key={v.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">Version {v.version}</span>
                    <Badge tone={v.state === "published" ? "brand" : v.state === "draft" ? "warn" : "neutral"}>{v.state}</Badge>
                    {v.consent_review_ref && <span className="text-xs text-muted">Review {v.consent_review_ref}</span>}
                  </div>
                  <p className="mt-2 text-sm">{v.players.map((p) => `#${p.jersey} ${p.display_name}`).join(", ")}</p>
                  <p className="text-xs text-muted">{v.players.filter((p) => p.photo_url).length} approved photos</p>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    {v.state !== "published" && (
                      <>
                        <input placeholder="Consent review reference" value={consent} onChange={(e) => setConsent(e.target.value)} className="min-h-9 rounded-full border border-border px-3 text-sm" aria-label="Consent review reference" />
                        <SmallButton tone="brand" disabled={consent.length < 2} onClick={() => publish.mutate({ id: v.id, consent_review_ref: consent })}>Publish</SmallButton>
                      </>
                    )}
                    {v.state === "published" && <SmallButton tone="danger" onClick={() => withdraw.mutate({ id: v.id })}>Withdraw</SmallButton>}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ))}
      <FormError error={publish.error ?? withdraw.error} />
    </div>
  );
}

export function DemoPanel({ event }: { event: AdminEventData }) {
  const matches = useQuery({
    queryKey: ["demo-matches", event.id],
    queryFn: () => apiGet<{ data: Match[] }>(`/v1/events/${event.id}/matches?status=all&limit=200`),
  });
  const simulate = useAdminMutation<Record<string, unknown>, { data: { change_events: string[] } }>("POST", `/v1/admin/events/${event.id}/simulate-change`);
  const [matchId, setMatchId] = useState("");
  const [court, setCourt] = useState("");
  const [delay, setDelay] = useState("0");
  const [status, setStatus] = useState("");
  const [sets, setSets] = useState("");
  const [result, setResult] = useState<string[] | null>(null);
  const selected = matches.data?.data.find((m) => m.id === matchId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const body: Record<string, unknown> = { match_id: matchId };
    if (court) body.court_label = court;
    if (status) body.status = status;
    if (Number(delay) && selected.scheduled_start) body.scheduled_start = new Date(new Date(selected.scheduled_start).getTime() + Number(delay) * 60000).toISOString();
    if (sets.trim()) body.sets = sets.trim().split(/\s+/).map((s) => s.split("-").map(Number));
    simulate.mutate(body, { onSuccess: (res) => setResult(res.data.change_events) });
  };

  return (
    <div>
      <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
        Demo events only. This pretends the competition platform changed a match, and runs the change through the same revision and
        notice pipeline as a real import. Followers see it labeled as simulated.
      </p>
      <Card>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
          <div className="sm:col-span-2">
            <Field label="Match">
              <select required value={matchId} onChange={(e) => setMatchId(e.target.value)} className={inputClass}>
                <option value="">Choose a match</option>
                {matches.data?.data.map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatTime(m.scheduled_start, m.timezone)} · {m.court?.label ?? "no court"} · {m.home.team_name ?? m.home.placeholder} vs {m.away.team_name ?? m.away.placeholder}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Move to court" hint="Same venue, e.g. Court 4">
            <input value={court} onChange={(e) => setCourt(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Delay (minutes)">
            <input type="number" step={5} value={delay} onChange={(e) => setDelay(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="">No change</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="postponed">Postponed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field label="Set scores" hint="e.g. 25-20 23-25 15-12">
            <input value={sets} onChange={(e) => setSets(e.target.value)} className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <FormError error={simulate.error} />
            <PrimaryButton pending={simulate.isPending}>Simulate change</PrimaryButton>
            {result && (
              <p className="mt-2 text-sm text-brand" role="status">
                {result.length ? `Sent: ${result.join(", ")}` : "No material change, so no notice was sent."}
              </p>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
