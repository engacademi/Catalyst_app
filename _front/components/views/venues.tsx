"use client";
import Link from "next/link";
import { useHydrated } from "@/lib/hydration";
import { useEvents } from "@/lib/queries";
import { OVA_VENUES, venueProfile, type OvaVenue } from "@/lib/ova-venues";
import { formatDateRange } from "@/lib/format";
import type { DiscoveryEvent } from "../event-tile";
import { EventLogo, OvaMajorEvents, OvaVenueDetails } from "../ova-venue";
import { Card } from "../ui";

function eventsAt(venue: OvaVenue, events: DiscoveryEvent[]) {
  return events
    .filter((e) => e.venues.some((name) => venueProfile(name)?.id === venue.id))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}

export function VenuesView() {
  const hydrated = useHydrated();
  const query = useEvents();
  // Cached events exist only in the browser, so wait for hydration to use them.
  const events: DiscoveryEvent[] = hydrated ? (query.data?.data ?? []) : [];
  return (
    <main id="main" className="platform-main discovery-page">
      <div className="page-heading">
        <h1 className="font-display">OVA venues</h1>
        <p>
          Maps, parking, food, medical, hotel and event details for every major
          Ontario Volleyball Association venue, in one place.
        </p>
      </div>
      <OvaMajorEvents events={events} />
      <nav className="ova-venue-index" aria-label="Venues on this page">
        {OVA_VENUES.map((v) => (
          <a key={v.id} href={`#${v.id}`}>
            {v.name} · {v.city}
          </a>
        ))}
      </nav>
      <div className="grid grid-cols-1 gap-5">
        {OVA_VENUES.map((venue) => {
          const here = eventsAt(venue, events);
          return (
            <Card key={venue.id} className="[overflow-wrap:anywhere]">
              <OvaVenueDetails venue={venue} appEvents={here} />
              {here.length > 0 && (
                <div className="ova-app-events">
                  <h4>Tournaments here in Olley Catalyst</h4>
                  <ul>
                    {here.map((e) => (
                      <li key={e.id}>
                        <EventLogo event={e} size={36} />
                        <Link href={`/events/${e.slug}/guide`}>{e.title}</Link>
                        <span>{formatDateRange(e.start_date, e.end_date)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </main>
  );
}
