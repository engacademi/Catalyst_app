"use client";
import Image from "next/image";
import { useHydrated } from "@/lib/hydration";
import { useRef } from "react";
import type { Partner } from "@/lib/api";
import {
  trackSponsorClick,
  useSponsorImpressions,
} from "@/lib/sponsor-engagement";

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
import { CourtOverview } from "../court-overview";
import { useEvent, useGuide } from "@/lib/queries";
import { CANT_ATTEND } from "@/lib/ova-rules";
import { MatchDayRules, OfficialDocuments } from "../ova-rules";
import { Card, ErrorState, Loading, PageTitle, SectionTitle } from "../ui";

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
  const hydrated = useHydrated();
  const query = useGuide(eventId);
  const kind = useEvent(eventId).data?.data.kind;
  if (!hydrated || query.isPending) return <Loading label="Loading guide" />;
  if (query.error && !query.data) return <ErrorState error={query.error} />;
  const { venues, items, partners } = query.data.data;
  const general = items.filter(
    (i) => i.kind !== "officials" && !i.kind.startsWith("media_"),
  );
  const officials = items.filter((i) => i.kind === "officials");
  const offers = partners.filter((p) => p.kind !== "sponsor");
  const sponsors = partners.filter((p) => p.kind === "sponsor");

  return (
    // Long words break at 200% text instead of pushing cards past 320px.
    <div className="[overflow-wrap:anywhere]">
      <PageTitle>Venue</PageTitle>

      <SectionTitle>Venues</SectionTitle>
      <div className="grid grid-cols-1 gap-4">
        {venues.map((v) => (
          <Card key={v.id}>
            {v.photo_url && (
              <figure className="venue-photo">
                <Image
                  src={v.photo_url}
                  alt={`Outside ${v.name}`}
                  width={1200}
                  height={800}
                  sizes="(max-width: 640px) 100vw, 640px"
                  unoptimized
                />
                {v.photo_credit && <figcaption>{v.photo_credit}</figcaption>}
              </figure>
            )}
            <h3 id={`venue-${v.id}`} className="scroll-mt-24 font-semibold">
              {v.name}
            </h3>
            {v.address && <p className="text-sm text-muted">{v.address}</p>}
            {v.accessible_entrance && (
              <p className="mt-2 flex gap-2 text-sm">
                <Accessibility
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-brand"
                />
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
              <CourtOverview venue={v} eventId={eventId} />
            )}
            {v.map_url && (
              <a
                href={v.map_url}
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand underline"
                rel="noopener"
                target="_blank"
              >
                Open map <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </Card>
        ))}
      </div>

      <SectionTitle>Getting around</SectionTitle>
      <div className="venue-quick-grid">
        {[
          {
            title: "Parking & directions",
            icon: Car,
            kinds: ["parking", "directions"],
          },
          { title: "Food & drink", icon: Utensils, kinds: ["food"] },
          {
            title: "Accessibility",
            icon: Accessibility,
            kinds: ["accessibility"],
          },
          {
            title: "Help & services",
            icon: LifeBuoy,
            kinds: ["help", "services"],
          },
        ].map(({ title, icon: Icon, kinds }) => {
          const resources = general.filter(
            (item) =>
              kinds.includes(item.kind) ||
              (!Object.keys(ICONS).includes(item.kind) &&
                title === "Help & services"),
          );
          return (
            <Card key={title} className="venue-quick-card">
              <Icon size={20} aria-hidden />
              <h3>{title}</h3>
              <a
                href={`#venue-details-${kinds[0]}`}
                onClick={(e) => {
                  e.preventDefault();
                  const panel = document.getElementById(
                    `venue-details-${kinds[0]}`,
                  ) as HTMLDetailsElement | null;
                  if (panel) panel.open = !panel.open;
                }}
              >
                View details
              </a>
              <details id={`venue-details-${kinds[0]}`}>
                <summary>Information</summary>
                {resources.length ? (
                  resources.map((item) => (
                    <div key={item.id}>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                      {item.link_url && (
                        <a
                          href={item.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          More information
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  <p>Ask the venue welcome desk for details.</p>
                )}
                {kinds[0] === "help" && kind === "indoor" && (
                  <div>
                    <strong>Team can&apos;t make it?</strong>
                    <p>{CANT_ATTEND.body}</p>
                    <a href={`tel:${CANT_ATTEND.phone}`}>
                      Call {CANT_ATTEND.phone}
                    </a>
                  </div>
                )}
              </details>
            </Card>
          );
        })}
      </div>

      {kind && <MatchDayRules kind={kind} />}

      {offers.length > 0 && (
        <>
          <SectionTitle>Tickets, merchandise and the 50/50</SectionTitle>
          <div className="grid grid-cols-1 gap-4">
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
                    {p.booth_location && (
                      <p className="mt-1 text-sm text-muted">
                        Find it: {p.booth_location}
                      </p>
                    )}
                    {p.link_url && (
                      <a
                        href={p.link_url}
                        rel="noopener sponsored"
                        target="_blank"
                        className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-full border border-brand px-4 text-sm font-semibold text-brand"
                      >
                        Go to seller&apos;s site{" "}
                        <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    )}
                    {p.seller_note && (
                      <p className="mt-1 text-xs text-muted">{p.seller_note}</p>
                    )}
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
              <Whistle aria-hidden className="h-4 w-4 text-brand" /> Lead
              resources
            </span>
          </SectionTitle>
          {officials.map((i) => (
            <Card key={i.id} className="mb-2">
              <p className="font-semibold">{i.title}</p>
              <p className="mt-1 whitespace-pre-line text-sm">{i.body}</p>
              {i.link_url && (
                <a
                  href={i.link_url}
                  target="_blank"
                  rel="noopener"
                  className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline"
                >
                  Open official resource
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </Card>
          ))}
          <p className="text-sm">
            Leads can sign in to see their own court assignments in the{" "}
            <a
              href="/admin/assignments"
              className="font-semibold text-brand underline"
            >
              Lead workspace
            </a>
            .
          </p>
        </>
      )}

      {kind && <OfficialDocuments kind={kind} />}

      <EventPartners sponsors={sponsors} />
    </div>
  );
}

function EventPartners({ sponsors }: { sponsors: Partner[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useSponsorImpressions(
    ref,
    sponsors.map((p) => p.id),
    "guide",
  );
  if (!sponsors.length) return null;
  return (
    <>
      <div id="event-partners">
        <SectionTitle>Event partners</SectionTitle>
      </div>
      <div
        ref={ref}
        className="partner-carousel"
        role="region"
        aria-label="Event partners"
        tabIndex={0}
      >
        {sponsors.map((p) => (
          <a
            key={p.id}
            data-sponsor-id={p.id}
            className="partner-logo-card"
            href={p.link_url || "#event-partners"}
            aria-label={p.name}
            target={p.link_url ? "_blank" : undefined}
            rel="noopener noreferrer sponsored"
            onClick={
              p.link_url ? () => trackSponsorClick(p.id, "guide") : undefined
            }
          >
            {p.logo_url ? (
              <Image
                src={p.logo_url}
                alt={p.name}
                width={160}
                height={80}
                unoptimized
              />
            ) : (
              <strong>{p.name}</strong>
            )}
            {p.name.includes("Demo") && <small>Demo partner</small>}
          </a>
        ))}
      </div>
    </>
  );
}
