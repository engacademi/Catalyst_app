"use client";
import Image from "next/image";
import Link from "next/link";
import {
  BedDouble,
  CalendarClock,
  Car,
  ExternalLink,
  FileText,
  HeartPulse,
  Map as MapIcon,
  MapPin,
  ShieldCheck,
  Sparkles,
  Utensils,
  Video,
  type LucideIcon,
} from "lucide-react";
import {
  OVA_CHECKED,
  appEventFor,
  eventSeries,
  upcomingMajorEvents,
  type OvaDetail,
  type OvaLink,
  type OvaMap,
  type OvaMajorEvent,
  type OvaVenue,
} from "@/lib/ova-venues";
import type { DiscoveryEvent } from "./event-tile";

const DETAIL_ICONS: Record<OvaDetail["kind"], LucideIcon> = {
  parking: Car,
  food: Utensils,
  services: HeartPulse,
  rules: ShieldCheck,
  schedule: CalendarClock,
  travel: BedDouble,
  streaming: Video,
  tourism: Sparkles,
};

const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

const CHECKED = new Date(`${OVA_CHECKED}T12:00:00`).toLocaleDateString(
  "en-CA",
  { month: "long", day: "numeric", year: "numeric" },
);

/** The OVA event logo for an app event, or nothing when it has none. */
export function EventLogo({
  event,
  className = "",
  size = 72,
}: {
  event: { title: string; venues?: string[] };
  className?: string;
  size?: number;
}) {
  const series = eventSeries(event);
  if (!series) return null;
  const { logo } = series;
  return (
    <Image
      className={`event-logo ${className}`}
      src={logo.src}
      alt={logo.alt}
      width={size}
      height={Math.round((size * logo.height) / logo.width)}
      unoptimized
    />
  );
}

function OutLink({ link }: { link: OvaLink }) {
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer">
      {link.label}
      <ExternalLink aria-hidden size={13} />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function VenueMap({ map, venue }: { map: OvaMap; venue: string }) {
  return (
    <figure className="ova-map">
      <a
        href={map.src}
        target="_blank"
        rel="noopener"
        aria-label={`${venue} ${map.title}, full size (opens in a new tab)`}
      >
        <Image
          src={map.src}
          alt={`${venue} ${map.title}. A text description follows.`}
          width={map.width}
          height={map.height}
          sizes="(max-width: 700px) 100vw, 680px"
          unoptimized
        />
      </a>
      <figcaption>
        <details>
          <summary>
            <MapIcon aria-hidden size={15} /> {map.title}: text description
          </summary>
          <ul>
            {map.description.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      </figcaption>
    </figure>
  );
}

export function MajorEventCard({
  event,
  appEvent,
}: {
  event: OvaMajorEvent;
  appEvent?: DiscoveryEvent;
}) {
  return (
    <article className="ova-major-event">
      <Image
        src={event.series.logo.src}
        alt={event.series.logo.alt}
        width={84}
        height={Math.round(
          (84 * event.series.logo.height) / event.series.logo.width,
        )}
        unoptimized
      />
      <div>
        <h4>{event.title}</h4>
        <p className="ova-major-dates">{event.dates}</p>
        <ul>
          {event.summary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="ova-links">
          {appEvent && (
            <Link href={`/events/${appEvent.slug}`}>
              Open in Olley Catalyst →
            </Link>
          )}
          {event.links.map((link) => (
            <OutLink key={link.url} link={link} />
          ))}
        </p>
      </div>
    </article>
  );
}

/** Everything OVA publishes about a venue, under the app's own venue card. */
export function OvaVenueDetails({
  venue,
  appEvents = [],
  showEvents = true,
}: {
  venue: OvaVenue;
  appEvents?: DiscoveryEvent[];
  showEvents?: boolean;
}) {
  return (
    <section
      className="ova-venue"
      aria-labelledby={`ova-venue-${venue.id}`}
      id={venue.id}
    >
      <div className="ova-venue-head">
        {venue.logo && (
          <Image
            src={venue.logo.src}
            alt={venue.logo.alt}
            width={120}
            height={Math.round((120 * venue.logo.height) / venue.logo.width)}
            unoptimized
          />
        )}
        <div>
          <h3 id={`ova-venue-${venue.id}`}>{venue.name}</h3>
          <p className="text-sm text-muted">{venue.address ?? venue.city}</p>
        </div>
      </div>
      <p className="mt-2 text-sm">{venue.intro}</p>

      {showEvents && venue.events.length > 0 && (
        <div className="ova-major-list">
          {venue.events.map((event) => (
            <MajorEventCard
              key={event.title}
              event={event}
              appEvent={appEventFor(event, appEvents, today())}
            />
          ))}
        </div>
      )}

      {venue.maps.map((map) => (
        <VenueMap key={map.src} map={map} venue={venue.name} />
      ))}

      <div className="ova-details">
        {venue.details.map((detail) => {
          const Icon = DETAIL_ICONS[detail.kind];
          return (
            <details key={detail.title}>
              <summary>
                <Icon aria-hidden size={17} /> {detail.title}
              </summary>
              <ul>
                {detail.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {detail.links && (
                <p className="ova-links">
                  {detail.links.map((link) => (
                    <OutLink key={link.url} link={link} />
                  ))}
                </p>
              )}
            </details>
          );
        })}
      </div>

      {venue.documents.length > 0 && (
        <p className="ova-links ova-documents">
          <FileText aria-hidden size={15} />
          {venue.documents.map((link) => (
            <OutLink key={link.url} link={link} />
          ))}
        </p>
      )}
      <p className="ova-source">
        From the <OutLink link={venue.source} />, checked {CHECKED}. OVA updates
        these details before each event.
      </p>
    </section>
  );
}

/** Logos of OVA's coming major events, each opening the event or its venue. */
export function OvaMajorEvents({ events }: { events: DiscoveryEvent[] }) {
  const upcoming = upcomingMajorEvents(today());
  if (!upcoming.length) return null;
  return (
    <section className="ova-major-strip" aria-labelledby="ova-major-title">
      <div className="section-row">
        <h2 id="ova-major-title">OVA major events</h2>
        <Link href="/venues">All OVA venues →</Link>
      </div>
      <ul className="event-carousel">
        {upcoming.map(({ event, venues }) => {
          // A tour across several venues opens the hub; one venue opens its event.
          const app =
            venues.length === 1 ? appEventFor(event, events, today()) : null;
          return (
            <li key={event.title}>
              <Link
                className="ova-major-tile"
                href={app ? `/events/${app.slug}` : `/venues#${venues[0].id}`}
              >
                <Image
                  src={event.series.logo.src}
                  alt=""
                  width={96}
                  height={Math.round(
                    (96 * event.series.logo.height) / event.series.logo.width,
                  )}
                  unoptimized
                />
                <strong>{event.title}</strong>
                <span>{event.dates}</span>
                <span>
                  <MapPin aria-hidden size={13} />{" "}
                  {venues.length === 1
                    ? `${venues[0].name}, ${venues[0].city}`
                    : venues.map((v) => v.city).join(" and ")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
