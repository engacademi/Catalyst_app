"use client";
import Link from "next/link";
import { CalendarDays, Heart, MapPin, Volleyball, Waves } from "lucide-react";
import type { EventSummary } from "@/lib/api";
import { usePreference } from "@/lib/preferences";
import { formatDateRange } from "@/lib/format";
import { Badge } from "./ui";
export type DiscoveryEvent = EventSummary & {
  venues: string[];
  venue_locations?: {
    city: string | null;
    address?: string | null;
    name?: string;
    latitude: number | null;
    longitude: number | null;
  }[];
  team_count?: number;
  match_count?: number;
};
export function SaveEventButton({ slug }: { slug: string }) {
  const [saved, setSaved] = usePreference<string[]>("saved-events", []);
  const active = saved.includes(slug);
  return (
    <button
      type="button"
      className="save-event"
      aria-pressed={active}
      aria-label={active ? "Unsave tournament" : "Save tournament"}
      onClick={() =>
        setSaved(active ? saved.filter((s) => s !== slug) : [...saved, slug])
      }
    >
      <Heart size={20} fill={active ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
export function EventTile({
  event: e,
  distance,
}: {
  event: DiscoveryEvent;
  distance?: number | null;
}) {
  return (
    <article className={`event-tile ${e.kind}`}>
      <div className="event-tile-art">
        <span className="eyebrow">
          {e.kind === "beach" ? "SAND. SUN. SERVE." : "MEET YOU COURTSIDE."}
        </span>
        {e.kind === "beach" ? (
          <Waves size={66} strokeWidth={1} aria-hidden />
        ) : (
          <Volleyball size={66} strokeWidth={1} aria-hidden />
        )}
        <SaveEventButton slug={e.slug} />
      </div>
      <div className="event-tile-body">
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{e.kind === "beach" ? "Beach" : "Indoor"}</Badge>
          {e.is_demo && <Badge tone="warn">Demo data</Badge>}
        </div>
        <h3>
          <Link href={`/events/${e.slug}`}>{e.title}</Link>
        </h3>
        <p>
          <CalendarDays size={14} aria-hidden />
          {formatDateRange(e.start_date, e.end_date)}
        </p>
        <p>
          <MapPin size={14} aria-hidden />
          {e.venues.length ? (
            <span className="event-venue-links">
              {e.venues.map((venue, index) => (
                <a
                  key={`${venue}-${index}`}
                  className="venue-directions"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(e.venue_locations?.[index]?.address || [venue, e.venue_locations?.[index]?.city].filter(Boolean).join(", "))}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Directions to ${venue}`}
                >
                  {venue} ↗
                </a>
              ))}
            </span>
          ) : (
            "Venue to be announced"
          )}
        </p>
        {distance != null && (
          <small>About {Math.round(distance)} km away</small>
        )}
      </div>
    </article>
  );
}
