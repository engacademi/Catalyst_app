"use client";

import { useState } from "react";
import type { DelayNotice, Match } from "@/lib/api";
import { courtPlace, formatTime } from "@/lib/format";
import { Card, EmptyState, ErrorState, Loading, SectionTitle } from "../ui";
import type { AdminEventData } from "./admin-event";
import { useAdminMutation, useAdminQuery } from "./hooks";
import { Field, FormError, inputClass, PrimaryButton, SmallButton } from "./form";

type ActiveNotice = DelayNotice & { court: NonNullable<Match["court"]> };

export function DelaysPanel({ event }: { event: AdminEventData }) {
  const notices = useAdminQuery<{ data: ActiveNotice[] }>(`/v1/admin/events/${event.id}/delay-notices`);
  const [form, setForm] = useState({ court: "", minutes: "20", duration: "60" });
  const post = useAdminMutation<{ minutes: number; duration_minutes: number }>("POST", `/v1/admin/courts/${form.court}/delay-notices`);
  const clear = useAdminMutation<{ id: string }>("POST", (b) => `/v1/admin/delay-notices/${b.id}/clear`);
  const courts = event.venues.flatMap((v) => v.courts.map((c) => ({ ...c, venue: v.name })));

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Tell attendees a court is running late. Matches on that court that haven&apos;t started show their official start plus an
        estimated start. Official starts never change, and a time published by the source replaces your estimate. The notice ends on
        its own when its duration runs out, by the event&apos;s time.
      </p>
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.court) return;
            post.mutate({ minutes: Number(form.minutes), duration_minutes: Number(form.duration) });
          }}
        >
          <Field label="Court">
            <select required value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} className={inputClass}>
              <option value="">Choose a court</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {courtPlace(c)}, {c.venue}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Running late by (minutes)">
            <input type="number" min={1} max={600} required value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Notice lasts (minutes)">
            <input type="number" min={5} max={1440} required value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className={inputClass} />
          </Field>
          <div className="flex items-end">
            <PrimaryButton pending={post.isPending}>Post delay</PrimaryButton>
          </div>
        </form>
        <FormError error={post.error} />
      </Card>

      <SectionTitle>Active notices</SectionTitle>
      {notices.isPending ? (
        <Loading />
      ) : notices.error ? (
        <ErrorState error={notices.error} />
      ) : notices.data.data.length === 0 ? (
        <EmptyState title="No courts running late">Posted notices show here until they end or you clear them.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {notices.data.data.map((n) => (
            <li key={n.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {courtPlace(n.court)}, {n.court.venue_name}: about {n.minutes} min late
                  </p>
                  <p className="text-sm text-muted">
                    Posted {formatTime(n.posted_at, event.timezone)}, ends {formatTime(n.expires_at, event.timezone)}
                  </p>
                </div>
                <SmallButton disabled={clear.isPending} onClick={() => clear.mutate({ id: n.id })}>
                  Clear now
                </SmallButton>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <FormError error={clear.error} />
    </div>
  );
}
