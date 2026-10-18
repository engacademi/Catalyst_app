"use client";
import { ContentEditor } from "./content-editor";
import { VenueCourts } from "./court-editor";
import { VenueEditor } from "./venue-editor";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Announcement, GuideItem, Partner } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { Badge, Card, ErrorState, Loading, SectionTitle } from "../ui";
import type { AdminEventData } from "./admin-event";
import { useAdminMutation, useAdminQuery } from "./hooks";
import {
  Field,
  FormError,
  inputClass,
  PrimaryButton,
  SmallButton,
} from "./form";

const announcementSchema = z.object({
  title: z.string().min(3, "Give it a short title").max(200),
  body: z.string().min(1, "Write the message").max(4000),
  category: z.enum(["general", "schedule", "venue", "safety"]),
  entry_id: z.string().optional(),
  publish_at: z.string().optional(),
  expire_at: z.string().optional(),
});
type AnnouncementForm = z.infer<typeof announcementSchema>;

export function AnnouncementsPanel({ event }: { event: AdminEventData }) {
  const list = useAdminQuery<{ data: (Announcement & { state: string })[] }>(
    `/v1/admin/events/${event.id}/announcements`,
  );
  const create = useAdminMutation(
    "POST",
    `/v1/admin/events/${event.id}/announcements`,
  );
  const publish = useAdminMutation<{ id: string }>(
    "POST",
    (b) => `/v1/admin/announcements/${b.id}/publish`,
  );
  const archive = useAdminMutation<{ id: string }>(
    "POST",
    (b) => `/v1/admin/announcements/${b.id}/archive`,
  );
  const form = useForm<AnnouncementForm>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: "", body: "", category: "general", entry_id: "" },
  });
  const errors = form.formState.errors;

  const submit = (publishNow: boolean) =>
    form.handleSubmit((values) =>
      create.mutate(
        {
          ...values,
          entry_id: values.entry_id?.startsWith("division:")
            ? null
            : values.entry_id || null,
          division_id: values.entry_id?.startsWith("division:")
            ? values.entry_id.slice(9)
            : null,
          publish_at: values.publish_at
            ? new Date(values.publish_at).toISOString()
            : null,
          expire_at: values.expire_at
            ? new Date(values.expire_at).toISOString()
            : null,
        },
        {
          onSuccess: (res) => {
            const created = (res as { data: Announcement }).data;
            if (publishNow) publish.mutate({ id: created.id });
            form.reset();
          },
        },
      ),
    );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 font-semibold">New announcement</h2>
        <form className="space-y-3" onSubmit={submit(false)}>
          <Field label="Title">
            <input
              {...form.register("title")}
              className={inputClass}
              aria-invalid={!!errors.title}
            />
            {errors.title && (
              <span className="text-xs text-danger">
                {errors.title.message}
              </span>
            )}
          </Field>
          <Field label="Message">
            <textarea
              {...form.register("body")}
              rows={4}
              className={`${inputClass} py-2`}
              aria-invalid={!!errors.body}
            />
            {errors.body && (
              <span className="text-xs text-danger">{errors.body.message}</span>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Category">
              <select {...form.register("category")} className={inputClass}>
                <option value="general">General</option>
                <option value="schedule">Schedule</option>
                <option value="venue">Venue</option>
                <option value="safety">Safety</option>
              </select>
            </Field>
            <Field label="Who sees it" hint="Event, division or one team">
              <select {...form.register("entry_id")} className={inputClass}>
                <option value="">Everyone at the event</option>
                {event.divisions?.map((d) => (
                  <option key={d.id} value={`division:${d.id}`}>
                    Division · {d.name}
                  </option>
                ))}
                {event.entries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.team_name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Publish at (optional)"
              hint="Leave blank for immediate publication"
            >
              <input
                type="datetime-local"
                {...form.register("publish_at")}
                className={inputClass}
              />
            </Field>
            <Field label="Expires at (optional)">
              <input
                type="datetime-local"
                {...form.register("expire_at")}
                className={inputClass}
              />
            </Field>
          </div>
          <FormError error={create.error ?? publish.error} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={submit(true)}
              className="min-h-11 rounded-full bg-brand px-5 font-semibold text-white hover:bg-brand-strong"
            >
              Publish / schedule
            </button>
            <button
              type="submit"
              className="min-h-11 rounded-full border border-border px-5 font-medium"
            >
              Save draft
            </button>
          </div>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 font-semibold">All announcements</h2>
        {list.isPending ? (
          <Loading />
        ) : list.error ? (
          <ErrorState error={list.error} />
        ) : (
          <ul className="space-y-2">
            {list.data.data.map((a) => (
              <li key={a.id}>
                <Card>
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        a.state === "published"
                          ? "brand"
                          : a.state === "draft"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {a.state}
                    </Badge>
                    <Badge>{a.category}</Badge>
                    {a.entry_id && (
                      <Badge tone="info">
                        {event.entries.find((e) => e.id === a.entry_id)
                          ?.team_name ?? "One team"}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 font-semibold">{a.title}</p>
                  <p className="whitespace-pre-line text-sm">{a.body}</p>
                  <ContentEditor
                    key={`${a.id}-${a.revision}`}
                    method="PATCH"
                    path={`/v1/admin/announcements/${a.id}`}
                    initial={{
                      title: a.title,
                      body: a.body,
                      category: a.category,
                      expected_revision: a.revision,
                    }}
                    fields={[
                      {
                        name: "title",
                        label: "Title",
                        required: true,
                        minLength: 3,
                        maxLength: 200,
                      },
                      {
                        name: "body",
                        label: "Message",
                        multiline: true,
                        required: true,
                        maxLength: 4000,
                      },
                      {
                        name: "category",
                        label: "Category",
                        options: ["general", "schedule", "venue", "safety"],
                      },
                    ]}
                  />
                  <p className="mt-1 text-xs text-muted">
                    {a.publish_at
                      ? `Published ${formatRelative(a.publish_at)}`
                      : "Not published"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {a.state === "draft" && (
                      <SmallButton
                        tone="brand"
                        onClick={() => publish.mutate({ id: a.id })}
                      >
                        Publish
                      </SmallButton>
                    )}
                    {a.state !== "archived" && (
                      <SmallButton onClick={() => archive.mutate({ id: a.id })}>
                        Archive
                      </SmallButton>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const GUIDE_KINDS = [
  "parking",
  "food",
  "accessibility",
  "directions",
  "services",
  "help",
  "officials",
  "media_photo",
  "media_video",
  "media_album",
];
const GUIDE_LABELS: Record<string, string> = {
  media_photo: "Media · Photo",
  media_video: "Media · Video",
  media_album: "Media · Album",
  officials: "Lead resources",
};
const PARTNER_KINDS = [
  "sponsor",
  "merchandise",
  "tickets",
  "fundraiser",
  "activity",
];

export function ContentPanel({ event }: { event: AdminEventData }) {
  return (
    <div className="space-y-8">
      <VenuesSection event={event} />
      <GuideSection event={event} />
      <PartnersSection event={event} />
      <SponsorReportSection event={event} />
    </div>
  );
}

function VenuesSection({ event }: { event: AdminEventData }) {
  const create = useAdminMutation(
    "POST",
    `/v1/admin/events/${event.id}/venues`,
  );
  const [form, setForm] = useState({
    name: "",
    address: "",
    accessible_entrance: "",
    directions: "",
  });
  return (
    <section>
      <SectionTitle>Venues</SectionTitle>
      <ul className="mb-3 grid gap-2 sm:grid-cols-2">
        {event.venues.map((v) => (
          <li key={v.id}>
            <Card>
              <p className="font-semibold">{v.name}</p>
              <p className="text-sm text-muted">{v.address}</p>
              <VenueEditor venue={v} />
              <VenueCourts venue={v} />
              <p className="text-sm">
                Courts:{" "}
                {v.courts.map((c) => c.label).join(", ") ||
                  "added by match imports"}
              </p>
            </Card>
          </li>
        ))}
      </ul>
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(form, {
              onSuccess: () =>
                setForm({
                  name: "",
                  address: "",
                  accessible_entrance: "",
                  directions: "",
                }),
            });
          }}
        >
          <Field
            label="Venue name"
            hint="Match imports refer to venues by this exact name"
          >
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Address">
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Accessible entrance">
            <input
              value={form.accessible_entrance}
              onChange={(e) =>
                setForm({ ...form, accessible_entrance: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Directions inside">
            <input
              value={form.directions}
              onChange={(e) => setForm({ ...form, directions: e.target.value })}
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <FormError error={create.error} />
            <PrimaryButton pending={create.isPending}>Add venue</PrimaryButton>
          </div>
        </form>
      </Card>
    </section>
  );
}

function GuideSection({ event }: { event: AdminEventData }) {
  const guide = useAdminQuery<{ data: { items: GuideItem[] } }>(
    `/v1/admin/events/${event.id}/guide-items`,
  );
  const create = useAdminMutation(
    "POST",
    `/v1/admin/events/${event.id}/guide-items`,
  );
  const remove = useAdminMutation<{ id: string }>(
    "DELETE",
    (b) => `/v1/admin/guide-items/${b.id}`,
  );
  const [form, setForm] = useState({
    kind: "parking",
    title: "",
    body: "",
    link_url: "",
  });
  return (
    <section>
      <SectionTitle>Venue Guide & Media</SectionTitle>

      <ul className="mb-3 space-y-2">
        {guide.data?.data.items.map((i) => (
          <li key={i.id}>
            <Card>
              <div>
                <Badge>{i.kind}</Badge>
                <p className="mt-1 font-semibold">{i.title}</p>
                <p className="text-sm">{i.body}</p>
                <ContentEditor
                  key={`${i.id}-${i.revision}`}
                  path={`/v1/admin/guide-items/${i.id}`}
                  initial={{
                    kind: i.kind,
                    title: i.title,
                    body: i.body,
                    link_url: i.link_url,
                    venue_id: i.venue_id,
                    sort: i.sort,
                    expected_revision: i.revision,
                  }}
                  fields={[
                    {
                      name: "kind",
                      label: "Type",
                      options: GUIDE_KINDS,
                      optionLabels: GUIDE_LABELS,
                    },
                    {
                      name: "title",
                      label: "Title",
                      required: true,
                      minLength: 2,
                      maxLength: 200,
                    },
                    {
                      name: "body",
                      label: "Details",
                      multiline: true,
                      maxLength: 4000,
                    },
                    { name: "link_url", label: "Link", type: "url" },
                    { name: "sort", label: "Display order", type: "number" },
                  ]}
                />
              </div>
              <SmallButton
                tone="danger"
                onClick={() => remove.mutate({ id: i.id })}
              >
                Remove
              </SmallButton>
            </Card>
          </li>
        ))}
      </ul>
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              { ...form, link_url: form.link_url || null },
              {
                onSuccess: () =>
                  setForm({ ...form, title: "", body: "", link_url: "" }),
              },
            );
          }}
        >
          <Field label="Type">
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className={inputClass}
            >
              {GUIDE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {GUIDE_LABELS[k] ?? k}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Details">
              <textarea
                rows={3}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className={`${inputClass} py-2`}
              />
            </Field>
          </div>
          <Field label="Link (required for Media)">
            <input
              type="url"
              required={form.kind.startsWith("media_")}
              pattern={
                form.kind.startsWith("media_") ? "https://.*" : undefined
              }
              value={form.link_url}
              onChange={(e) => setForm({ ...form, link_url: e.target.value })}
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <FormError error={create.error ?? remove.error} />
            <PrimaryButton pending={create.isPending}>
              Add guide item
            </PrimaryButton>
          </div>
        </form>
      </Card>
    </section>
  );
}

function PartnersSection({ event }: { event: AdminEventData }) {
  const list = useAdminQuery<{ data: Partner[] }>(
    `/v1/admin/events/${event.id}/partners`,
  );
  const create = useAdminMutation(
    "POST",
    `/v1/admin/events/${event.id}/partners`,
  );
  const remove = useAdminMutation<{ id: string }>(
    "DELETE",
    (b) => `/v1/admin/partners/${b.id}`,
  );
  const empty = {
    kind: "sponsor",
    name: "",
    body: "",
    link_url: "",
    booth_location: "",
    seller_note: "",
  };
  const [form, setForm] = useState(empty);
  return (
    <section>
      <SectionTitle>Sponsors, merchandise, tickets and the 50/50</SectionTitle>
      <p className="mb-2 text-xs text-muted">
        These appear in the Event guide, below schedules and results, and always
        link out to the seller. No payments run here.
      </p>
      <ul className="mb-3 grid gap-2 sm:grid-cols-2">
        {list.data?.data.map((p) => (
          <li key={p.id}>
            <Card className="space-y-3">
              <div>
                <Badge>{p.kind}</Badge>
                <p className="mt-1 font-semibold">{p.name}</p>
                <p className="text-sm text-muted">{p.booth_location}</p>
                <ContentEditor
                  key={`${p.id}-${p.revision}`}
                  path={`/v1/admin/partners/${p.id}`}
                  initial={{
                    kind: p.kind,
                    name: p.name,
                    body: p.body,
                    link_url: p.link_url,
                    logo_url: p.logo_url,
                    booth_location: p.booth_location,
                    seller_note: p.seller_note,
                    sort: p.sort,
                    active: p.active,
                    expected_revision: p.revision,
                  }}
                  fields={[
                    { name: "kind", label: "Type", options: PARTNER_KINDS },
                    {
                      name: "name",
                      label: "Name",
                      required: true,
                      minLength: 2,
                      maxLength: 200,
                    },
                    {
                      name: "body",
                      label: "Description",
                      multiline: true,
                      maxLength: 2000,
                    },
                    { name: "link_url", label: "Website", type: "url" },
                    { name: "logo_url", label: "Logo URL" },
                    { name: "booth_location", label: "Booth" },
                    { name: "seller_note", label: "Seller note" },
                    { name: "sort", label: "Display order", type: "number" },
                    { name: "active", label: "Visible" },
                  ]}
                />
              </div>
              <SmallButton
                tone="danger"
                onClick={() => remove.mutate({ id: p.id })}
              >
                Remove
              </SmallButton>
            </Card>
          </li>
        ))}
      </ul>
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              {
                ...form,
                link_url: form.link_url || null,
                booth_location: form.booth_location || null,
                seller_note: form.seller_note || null,
              },
              { onSuccess: () => setForm(empty) },
            );
          }}
        >
          <Field label="Type">
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className={inputClass}
            >
              {PARTNER_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Name">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Description">
            <input
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Seller link" hint="https only">
            <input
              type="url"
              pattern="https://.*"
              value={form.link_url}
              onChange={(e) => setForm({ ...form, link_url: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Booth location">
            <input
              value={form.booth_location}
              onChange={(e) =>
                setForm({ ...form, booth_location: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Seller and refund note">
            <input
              value={form.seller_note}
              onChange={(e) =>
                setForm({ ...form, seller_note: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <FormError error={create.error ?? remove.error} />
            <PrimaryButton pending={create.isPending}>Add card</PrimaryButton>
          </div>
        </form>
      </Card>
    </section>
  );
}

type SponsorReportRow = {
  partner_id: string;
  name: string;
  logo_url: string | null;
  active: boolean;
  placements: Record<
    "ribbon" | "guide" | "message",
    { views: number; clicks: number }
  >;
  views: number;
  clicks: number;
  ctr: number | null;
};

function formatCtr(ctr: number | null) {
  return ctr === null ? "–" : `${(ctr * 100).toFixed(1)}%`;
}

function SponsorReportSection({ event }: { event: AdminEventData }) {
  const report = useAdminQuery<{ data: SponsorReportRow[] }>(
    `/v1/admin/events/${event.id}/sponsor-report`,
  );
  const rows = report.data?.data ?? [];
  const total = rows.reduce(
    (sum, r) => ({ views: sum.views + r.views, clicks: sum.clicks + r.clicks }),
    { views: 0, clicks: 0 },
  );
  return (
    <section aria-label="Sponsor engagement">
      <SectionTitle
        action={
          <SmallButton onClick={() => report.refetch()}>Refresh</SmallButton>
        }
      >
        Sponsor engagement
      </SectionTitle>
      <p className="mb-2 text-xs text-muted">
        Views count once per visitor session when a sponsor shows on screen in
        the Discover ribbon, this event&apos;s venue page or a sponsor message.
        Clicks count each visit to the sponsor&apos;s site. Counts are anonymous
        totals; no personal data is collected.
      </p>
      {report.isPending ? (
        <Loading label="Loading sponsor engagement" />
      ) : report.error ? (
        <ErrorState error={report.error} />
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No sponsor cards for this event yet. Add one above.
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Sponsor
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  Views
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  Clicks
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  CTR
                </th>
                <th scope="col" className="px-4 py-3">
                  Ribbon · Venue · Message
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.partner_id} className="border-t border-border">
                  <th scope="row" className="px-4 py-2 font-semibold">
                    <span className="flex items-center gap-3">
                      {r.logo_url && (
                        <span className="sponsor-mark guide-sponsor-logo">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={r.logo_url} alt="" />
                        </span>
                      )}
                      <span>
                        {r.name}
                        {!r.active && (
                          <span className="ml-2 text-xs font-normal text-muted">
                            hidden
                          </span>
                        )}
                      </span>
                    </span>
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.views}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.clicks}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCtr(r.ctr)}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted tabular-nums">
                    {r.placements.ribbon.views}/{r.placements.ribbon.clicks} ·{" "}
                    {r.placements.guide.views}/{r.placements.guide.clicks} ·{" "}
                    {r.placements.message.views}/{r.placements.message.clicks}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <th scope="row" className="px-4 py-3">
                  All sponsors
                </th>
                <td className="px-3 py-3 text-right tabular-nums">
                  {total.views}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {total.clicks}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatCtr(total.views ? total.clicks / total.views : null)}
                </td>
                <td className="px-4 py-3 text-xs font-normal text-muted">
                  views/clicks
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </section>
  );
}
