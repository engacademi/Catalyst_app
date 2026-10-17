"use client";

import {
  Accessibility,
  Car,
  ExternalLink,
  HeartPulse,
  LifeBuoy,
  MapPin,
  Shirt,
  Ticket,
  Utensils,
  Whistle,
  type LucideIcon,
} from "lucide-react";
import { courtsByArea } from "@/lib/format";
import { useGuide } from "@/lib/queries";
import { Badge, Card, ErrorState, Loading, PageTitle, SectionTitle } from "../ui";

const ICONS: Record<string, LucideIcon> = {
  parking: Car,
  accessibility: Accessibility,
  food: Utensils,
  services: HeartPulse,
  help: LifeBuoy,
  directions: MapPin,
  officials: Whistle,
};

export function GuideView({ eventId }: { eventId: string }) {
  const query = useGuide(eventId);
  if (query.isPending) return <Loading label="Loading guide" />;
  if (query.error) return <ErrorState error={query.error} />;
  const { venues, items, partners } = query.data.data;
  const general = items.filter((i) => i.kind !== "officials");
  const officials = items.filter((i) => i.kind === "officials");
  const offers = partners.filter((p) => p.kind !== "sponsor");
  const sponsors = partners.filter((p) => p.kind === "sponsor");

  return (
    <div>
      <PageTitle>Event guide</PageTitle>

      <SectionTitle>Venues</SectionTitle>
      <div className="space-y-2">
        {venues.map((v) => (
          <Card key={v.id}>
            <h3 id={`venue-${v.id}`} className="scroll-mt-24 font-semibold">{v.name}</h3>
            {v.address && <p className="text-sm text-muted">{v.address}</p>}
            {v.accessible_entrance && (
              <p className="mt-2 flex gap-2 text-sm">
                <Accessibility aria-hidden className="h-4 w-4 shrink-0 text-brand" />
                <span>
                  <span className="font-medium">Accessible entrance: </span>
                  {v.accessible_entrance}
                </span>
              </p>
            )}
            {v.directions && (
              <p className="mt-2 flex gap-2 text-sm">
                <MapPin aria-hidden className="h-4 w-4 shrink-0 text-brand" />
                <span>{v.directions}</span>
              </p>
            )}
            {v.courts.length > 0 && (
              <dl className="mt-2 space-y-1 text-sm">
                {courtsByArea(v.courts).map(([area, courts]) => (
                  <div key={area ?? ""}>
                    <dt className="inline font-medium">{area ?? (v.courts.some((c) => c.area) ? "Other courts" : "Courts")}: </dt>
                    <dd className="inline text-muted">{courts.map((c) => c.label).join(", ")}</dd>
                  </div>
                ))}
              </dl>
            )}
            {v.map_url && (
              <a href={v.map_url} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand underline" rel="noopener" target="_blank">
                Open map <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </Card>
        ))}
      </div>

      <SectionTitle>Getting around</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        {general.map((i) => {
          const Icon = ICONS[i.kind] ?? LifeBuoy;
          return (
            <Card key={i.id}>
              <h3 className="flex items-center gap-2 font-semibold">
                <Icon aria-hidden className="h-4 w-4 text-brand" /> {i.title}
              </h3>
              <p className="mt-1 whitespace-pre-line text-sm">{i.body}</p>
              {i.link_url && (
                <a href={i.link_url} className="mt-2 inline-block text-sm font-semibold text-brand underline" rel="noopener" target="_blank">
                  More information<span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </Card>
          );
        })}
      </div>

      {offers.length > 0 && (
        <>
          <SectionTitle>Tickets, merchandise and the 50/50</SectionTitle>
          <div className="space-y-2">
            {offers.map((p) => (
              <Card key={p.id}>
                <div className="flex items-start gap-3">
                  {p.kind === "merchandise" ? (
                    <Shirt aria-hidden className="h-5 w-5 text-brand" />
                  ) : (
                    <Ticket aria-hidden className="h-5 w-5 text-brand" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm">{p.body}</p>
                    {p.booth_location && <p className="mt-1 text-sm text-muted">Find it: {p.booth_location}</p>}
                    {p.link_url && (
                      <a
                        href={p.link_url}
                        rel="noopener sponsored"
                        target="_blank"
                        className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-full border border-brand px-4 text-sm font-semibold text-brand"
                      >
                        Go to seller&apos;s site <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    )}
                    {p.seller_note && <p className="mt-1 text-xs text-muted">{p.seller_note}</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {officials.length > 0 && (
        <>
          <SectionTitle>
            <span className="flex items-center gap-2">
              <Whistle aria-hidden className="h-4 w-4 text-brand" /> Referees and scorekeepers
            </span>
          </SectionTitle>
          {officials.map((i) => (
            <Card key={i.id} className="mb-2">
              <p className="font-semibold">{i.title}</p>
              <p className="mt-1 whitespace-pre-line text-sm">{i.body}</p>
            </Card>
          ))}
          <p className="text-sm">
            Officials can sign in to see their own court assignments in the{" "}
            <a href="/admin/assignments" className="font-semibold text-brand underline">officials area</a>.
          </p>
        </>
      )}

      {sponsors.length > 0 && (
        <>
          <SectionTitle>Event partners</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {sponsors.map((p) => (
              <Card key={p.id}>
                <Badge>Sponsored</Badge>
                <p className="mt-2 font-semibold">{p.name}</p>
                <p className="text-sm">{p.body}</p>
                {p.booth_location && <p className="mt-1 text-sm text-muted">Booth: {p.booth_location}</p>}
                {p.link_url && (
                  <a href={p.link_url} rel="noopener sponsored" target="_blank" className="mt-2 inline-block text-sm font-semibold text-brand underline">
                    Visit {p.name}<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
