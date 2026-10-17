"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { EventSummary, SourceInfo, Venue } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { Badge, Card, ErrorState, Loading, SectionTitle } from "../ui";
import { useAdminMutation, useAdminQuery } from "./hooks";
import { Field, FormError, inputClass, PrimaryButton, SmallButton } from "./form";
import { AnnouncementsPanel, ContentPanel } from "./panels-content";
import { DemoClockPanel, DemoPanel, ImportsPanel, RostersPanel } from "./panels-data";

export type AdminEventData = EventSummary & {
  venues: Venue[];
  sources: (SourceInfo & { generation: number })[];
  entries: { id: string; team_name: string; club_name: string | null }[];
};

const TABS = ["Announcements", "Imports", "Content", "Rosters", "Sources", "Demo clock", "Demo tools", "Audit"] as const;
type Tab = (typeof TABS)[number];

export function AdminEvent({ eventId }: { eventId: string }) {
  const [tab, setTab] = useState<Tab>("Announcements");
  const query = useAdminQuery<{ data: AdminEventData }>(`/v1/admin/events/${eventId}`);
  const update = useAdminMutation("PATCH", `/v1/admin/events/${eventId}`);
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  const event = query.data.data;
  const tabs = TABS.filter((t) => t !== "Demo tools" || event.is_demo);

  return (
    <div>
      <Link href="/admin" className="text-sm text-muted">← All events</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone={event.status === "published" ? "brand" : "neutral"}>{event.status}</Badge>
            {event.start_date} to {event.end_date} · {event.entries.length} teams
            <Link href={`/events/${event.slug}`} className="inline-flex items-center gap-1 text-brand underline" target="_blank">
              Attendee view <ExternalLink aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <div className="flex gap-2">
          {event.status !== "published" ? (
            <SmallButton tone="brand" disabled={update.isPending} onClick={() => update.mutate({ status: "published", expected_revision: event.revision })}>
              Publish event
            </SmallButton>
          ) : (
            <SmallButton disabled={update.isPending} onClick={() => update.mutate({ status: "draft", expected_revision: event.revision })}>
              Unpublish
            </SmallButton>
          )}
        </div>
      </div>
      <FormError error={update.error} />

      <div role="tablist" aria-label="Event tools" className="mt-4 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 shrink-0 border-b-2 px-3 text-sm ${tab === t ? "border-brand font-semibold text-brand" : "border-transparent text-muted"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="pt-4" role="tabpanel">
        {tab === "Announcements" && <AnnouncementsPanel event={event} />}
        {tab === "Imports" && <ImportsPanel event={event} />}
        {tab === "Content" && <ContentPanel event={event} />}
        {tab === "Rosters" && <RostersPanel event={event} />}
        {tab === "Sources" && <SourcesPanel event={event} />}
        {tab === "Demo clock" && <DemoClockPanel event={event} />}
        {tab === "Demo tools" && <DemoPanel event={event} />}
        {tab === "Audit" && <AuditPanel eventId={event.id} />}
      </div>
    </div>
  );
}

function SourcesPanel({ event }: { event: AdminEventData }) {
  const patch = useAdminMutation<{ id: string; status: string }>("PATCH", (b) => `/v1/admin/sources/${b.id}`);
  const create = useAdminMutation("POST", `/v1/admin/events/${event.id}/sources`);
  const [form, setForm] = useState({ name: "", mode: "manual_import", official_url: "" });

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        A source is where competition data comes from. CSV imports work today. AES, TIMU and MyTeam.click sources are labels until a
        connector is authorized; their data still arrives by CSV.
      </p>
      <ul className="space-y-2">
        {event.sources.map((s) => (
          <li key={s.id}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-muted">
                    {s.mode} · {s.freshness.replace("_", " ")} · last import {formatRelative(s.last_import_at)} · generation {s.generation}
                  </p>
                </div>
                <label className="text-sm">
                  <span className="sr-only">Status for {s.name}</span>
                  <select
                    value={s.status}
                    onChange={(e) => patch.mutate({ id: s.id, status: e.target.value })}
                    className="min-h-9 rounded-full border border-border bg-surface px-3"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </label>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <FormError error={patch.error} />
      <SectionTitle>Add a source</SectionTitle>
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ ...form, official_url: form.official_url || null });
          }}
        >
          <Field label="Name">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Platform">
            <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className={inputClass}>
              <option value="manual_import">CSV import</option>
              <option value="aes">AES (CSV for now)</option>
              <option value="timu">TIMU (CSV for now)</option>
              <option value="myteam">MyTeam.click (CSV for now)</option>
            </select>
          </Field>
          <Field label="Official results page">
            <input type="url" value={form.official_url} onChange={(e) => setForm({ ...form, official_url: e.target.value })} className={inputClass} />
          </Field>
          <div className="sm:col-span-3">
            <FormError error={create.error} />
            <PrimaryButton pending={create.isPending}>Add source</PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}

type AuditRow = { id: number; action: string; target_type: string; old_revision: number | null; new_revision: number | null; created_at: string; summary: Record<string, unknown> };

function AuditPanel({ eventId }: { eventId: string }) {
  const query = useAdminQuery<{ data: AuditRow[] }>(`/v1/admin/events/${eventId}/audit`);
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Audit log</caption>
        <thead className="border-b border-border text-xs uppercase text-muted">
          <tr>
            <th scope="col" className="px-3 py-2">When</th>
            <th scope="col" className="px-3 py-2">Action</th>
            <th scope="col" className="px-3 py-2">Revision</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {query.data.data.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-3 py-2 text-muted">{formatRelative(r.created_at)}</td>
              <td className="px-3 py-2">{r.action}</td>
              <td className="px-3 py-2 text-muted">{r.old_revision ?? "–"} → {r.new_revision ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
