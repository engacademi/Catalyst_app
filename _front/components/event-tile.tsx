"use client";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Heart, MapPin, Volleyball } from "lucide-react";
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
    photo_url?: string | null;
    photo_credit?: string | null;
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
  const photo = e.venue_locations?.find((v) => v.photo_url);
  return (
    <article className={`event-tile ${e.kind}`}>
      <div className={`event-tile-art ${photo ? "has-photo" : ""}`}>
        {photo?.photo_url && (
          // The venue name is in the tile text, so the photo itself is decorative.
          <Image
            className="event-tile-photo"
            src={photo.photo_url}
            alt=""
            title={photo.photo_credit ?? undefined}
            fill
            sizes="(max-width: 640px) 45vw, 320px"
            unoptimized
          />
        )}
        <span className="eyebrow">
          {e.kind === "beach" ? "SAND. SUN. SERVE." : "MEET YOU COURTSIDE."}
        </span>
        {!photo && <Volleyball size={66} strokeWidth={1} aria-hidden />}
      </div>
      <SaveEventButton slug={e.slug} />
      <div className="event-tile-body">
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{e.kind === "beach" ? "Beach" : "Indoor"}</Badge>
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
                  {venue}
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
