"use client";
import { Disputes } from "./disputes";

import { EventAccess } from "./event-access";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { MatchEditorPanel } from "./match-editor";
import { EventDetailsPanel } from "./event-details";
import { ExternalLink } from "lucide-react";
import type { Division, EventSummary, SourceInfo, Venue } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { Badge, Card, ErrorState, Loading } from "../ui";
import { useAdminMutation, useAdminQuery } from "./hooks";
import { FormError, SmallButton } from "./form";
import { AnnouncementsPanel, ContentPanel } from "./panels-content";
import { CourtOperations } from "./court-operations";
import {
  ConnectionsPanel,
  RegistrationPanel,
  AssignmentPanel,
} from "./operations";
import { DemoPanel, ImportsPanel, RostersPanel } from "./panels-data";

export type AdminEventData = EventSummary & {
  divisions?: Division[];
  venues: Venue[];
  sources: (SourceInfo & {
    generation: number;
    last_error?: string;
    config?: { capabilities?: { divisions?: boolean; matches?: boolean } };
  })[];
  entries: { id: string; team_name: string; club_name: string | null }[];
};

const TABS = [
  "Event details",
  "Matches & brackets",
  "Announcements",
  "Imports",
  "Content",
  "Rosters",
  "Registration",
  "Assignments",
  "Courts & clock",
  "Sources",
  "Demo tools",
  "Audit",
  "Event access",
] as const;
type Tab = (typeof TABS)[number];

export function AdminEvent({ eventId }: { eventId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const chosen = params.get("tool") as Tab | null;
  const requestedTab =
    chosen && TABS.includes(chosen) ? chosen : "Announcements";
  const setTab = (next: Tab) =>
    router.replace(`?tool=${encodeURIComponent(next)}`, { scroll: false });
  const query = useAdminQuery<{ data: AdminEventData }>(
    `/v1/admin/events/${eventId}`,
  );
  const me = useAdminQuery<{
    grants: { role: string; event_id?: string | null }[];
  }>("/v1/admin/me");
  const update = useAdminMutation("PATCH", `/v1/admin/events/${eventId}`);
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  const event = query.data.data;
  const tabs = TABS.filter(
    (t) =>
      (t !== "Demo tools" || event.is_demo) &&
      (t !== "Assignments" ||
        me.data?.grants.some(
          (g) =>
            g.role === "admin" ||
            (g.role === "staff" && (!g.event_id || g.event_id === event.id)),
        )) &&
      (t !== "Event access" || me.data?.grants.some((g) => g.role === "admin")),
  );

  const tab = tabs.includes(requestedTab) ? requestedTab : "Announcements";
  return (
    <div>
      <Link href="/admin" className="text-sm text-muted">
        ← All events
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone={event.status === "published" ? "brand" : "neutral"}>
              {event.status}
            </Badge>
            {event.start_date} to {event.end_date} · {event.entries.length}{" "}
            teams
            <Link
              href={`/events/${event.slug}`}
              className="inline-flex items-center gap-1 text-brand underline"
              target="_blank"
            >
              Attendee view <ExternalLink aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <div className="flex gap-2">
          {event.status !== "published" ? (
            <SmallButton
              tone="brand"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  status: "published",
                  expected_revision: event.revision,
                })
              }
            >
              Publish event
            </SmallButton>
          ) : (
            <SmallButton
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  status: "draft",
                  expected_revision: event.revision,
                })
              }
            >
              Unpublish
            </SmallButton>
          )}
        </div>
      </div>
      <FormError error={update.error} />

      <div role="tablist" aria-label="Event tools" className="staff-tabs">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            id={`staff-tab-${t.replaceAll(" ", "-")}`}
            aria-controls="staff-panel"
            tabIndex={tab === t ? 0 : -1}
            onKeyDown={(e) => {
              const index = tabs.indexOf(t);
              let next = index;
              if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
              else if (e.key === "ArrowLeft")
                next = (index - 1 + tabs.length) % tabs.length;
              else if (e.key === "Home") next = 0;
              else if (e.key === "End") next = tabs.length - 1;
              else return;
              e.preventDefault();
              setTab(tabs[next]);
              e.currentTarget.parentElement
                ?.querySelectorAll("button")
                [next]?.focus();
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div
        id="staff-panel"
        className="pt-4"
        role="tabpanel"
        aria-labelledby={`staff-tab-${tab.replaceAll(" ", "-")}`}
        tabIndex={0}
      >
        {tab === "Event access" && <EventAccess event={event} />}
        {tab === "Matches & brackets" && <MatchEditorPanel event={event} />}
        {tab === "Event details" && <EventDetailsPanel event={event} />}
        {tab === "Announcements" && <AnnouncementsPanel event={event} />}
        {tab === "Imports" && <ImportsPanel event={event} />}
        {tab === "Content" && <ContentPanel event={event} />}
        {tab === "Rosters" && <RostersPanel event={event} />}
        {tab === "Sources" && <ConnectionsPanel event={event} />}
        {tab === "Registration" && <RegistrationPanel event={event} />}
        {tab === "Assignments" && <AssignmentPanel event={event} />}
        {tab === "Courts & clock" && (
          <>
            <CourtOperations event={event} />
            <Disputes eventId={event.id} />
          </>
        )}
        {tab === "Demo tools" && <DemoPanel event={event} />}
        {tab === "Audit" && <AuditPanel eventId={event.id} />}
      </div>
    </div>
  );
}

type AuditRow = {
  id: number;
  action: string;
  target_type: string;
  old_revision: number | null;
  new_revision: number | null;
  created_at: string;
  summary: Record<string, unknown>;
};

function AuditPanel({ eventId }: { eventId: string }) {
  const query = useAdminQuery<{ data: AuditRow[] }>(
    `/v1/admin/events/${eventId}/audit`,
  );
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Audit log</caption>
        <thead className="border-b border-border text-xs uppercase text-muted">
          <tr>
            <th scope="col" className="px-3 py-2">
              When
            </th>
            <th scope="col" className="px-3 py-2">
              Action
            </th>
            <th scope="col" className="px-3 py-2">
              Revision
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {query.data.data.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-3 py-2 text-muted">
                {formatRelative(r.created_at)}
              </td>
              <td className="px-3 py-2">{r.action}</td>
              <td className="px-3 py-2 text-muted">
                {r.old_revision ?? "–"} → {r.new_revision ?? "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
