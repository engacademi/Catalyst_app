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
  const [form, setForm] = useState({ target: "", minutes: "20", duration: "60" });
  const courts = event.venues.flatMap((v) => v.courts.map((c) => ({ ...c, venue: v.name })));
  const areas = event.venues.flatMap((v) =>
    [...new Set(v.courts.flatMap((c) => (c.area ? [c.area] : [])))].map((area) => ({
      key: `area:${v.id}:${area}`,
      venueId: v.id,
      venue: v.name,
      area,
      count: v.courts.filter((c) => c.area === area).length,
    })),
  );
  const area = areas.find((a) => a.key === form.target);
  const post = useAdminMutation<{ minutes: number; duration_minutes: number; area?: string }>("POST", () =>
    area ? `/v1/admin/venues/${area.venueId}/delay-notices` : `/v1/admin/courts/${form.target.slice("court:".length)}/delay-notices`,
  );
  const clear = useAdminMutation<{ id: string }>("POST", (b) => `/v1/admin/delay-notices/${b.id}/clear`);

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Tell attendees a court is running late. Matches on that court that haven&apos;t started show their official start plus an
        estimated start. Official starts never change, and a time published by the source replaces your estimate. The notice ends on
        its own when its duration runs out, by the event&apos;s time. Choosing an area posts a separate notice for each of its
        courts, so you can clear them one at a time.
      </p>
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.target) return;
            post.mutate({ minutes: Number(form.minutes), duration_minutes: Number(form.duration), ...(area && { area: area.area }) });
          }}
        >
          <Field label="Court or area">
            <select required value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className={inputClass}>
              <option value="">Choose a court or area</option>
              {areas.length > 0 && (
                <optgroup label="Whole area">
                  {areas.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.area}, {a.venue} ({a.count} court{a.count === 1 ? "" : "s"})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="One court">
                {courts.map((c) => (
                  <option key={c.id} value={`court:${c.id}`}>
                    {courtPlace(c)}, {c.venue}
                  </option>
                ))}
              </optgroup>
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
