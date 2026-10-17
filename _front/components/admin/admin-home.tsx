"use client";

import Link from "next/link";
import { useState } from "react";
import type { EventSummary } from "@/lib/api";
import { Badge, Card, EmptyState, ErrorState, Loading, PageTitle, SectionTitle } from "../ui";
import { useAdminMutation, useAdminQuery } from "./hooks";
import { Field, FormError, inputClass, PrimaryButton } from "./form";

type Me = { grants: { role: string; event_id: string | null }[]; is_staff: boolean };

export function AdminHome() {
  const me = useAdminQuery<Me>("/v1/admin/me");
  const events = useAdminQuery<{ data: EventSummary[] }>("/v1/admin/events");
  if (me.isPending || events.isPending) return <Loading />;
  if (me.error) return <ErrorState error={me.error} />;
  if (events.error) return <ErrorState error={events.error} />;
  const isAdmin = me.data.grants.some((g) => g.role === "admin");
  const isOfficial = me.data.grants.some((g) => g.role === "official");

  return (
    <div>
      <PageTitle subtitle="Publish announcements, import schedules and rosters, and keep event content current.">Events</PageTitle>
      {isOfficial && (
        <p className="mb-4 text-sm">
          You have an official&apos;s role. <Link href="/admin/assignments" className="font-semibold text-brand underline">See your assignments</Link>.
        </p>
      )}
      {events.data.data.length === 0 ? (
        <EmptyState title="No events you can manage">
          Ask an OVA administrator to grant you staff access for an event.
        </EmptyState>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {events.data.data.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/events/${e.id}`} className="block rounded-xl border border-border bg-surface p-4 hover:border-brand">
                <p className="font-semibold">{e.title}</p>
                <p className="text-sm text-muted">{e.start_date} to {e.end_date}</p>
                <div className="mt-2 flex gap-2">
                  <Badge tone={e.status === "published" ? "brand" : "neutral"}>{e.status}</Badge>
                  <Badge>{e.kind}</Badge>
                  {e.is_demo && <Badge tone="warn">demo</Badge>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {isAdmin && <CreateEvent />}
    </div>
  );
}

function CreateEvent() {
  const create = useAdminMutation("POST", "/v1/admin/events");
  const [form, setForm] = useState({ title: "", slug: "", kind: "indoor", start_date: "", end_date: "", is_demo: false });
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <>
      <SectionTitle>New event</SectionTitle>
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(form, { onSuccess: () => setForm({ ...form, title: "", slug: "" }) });
          }}
        >
          <Field label="Title">
            <input required minLength={3} value={form.title} onChange={(e) => set("title", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Link name" hint="Lowercase letters, numbers and dashes, e.g. beach-2027">
            <input required pattern="[a-z0-9][a-z0-9-]+" value={form.slug} onChange={(e) => set("slug", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Type">
            <select value={form.kind} onChange={(e) => set("kind", e.target.value)} className={inputClass}>
              <option value="indoor">Indoor</option>
              <option value="beach">Beach</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Starts">
              <input type="date" required value={form.start_date} onChange={(e) => set("start_date", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Ends">
              <input type="date" required value={form.end_date} onChange={(e) => set("end_date", e.target.value)} className={inputClass} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs text-muted">New events start as drafts with one CSV import source. Publish from the event page when ready.</p>
            <FormError error={create.error} />
            <PrimaryButton pending={create.isPending}>Create event</PrimaryButton>
          </div>
        </form>
      </Card>
    </>
  );
}
