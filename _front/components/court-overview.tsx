import Link from "next/link";
import type { Venue } from "@/lib/api";

export function CourtOverview({
  venue,
  eventId,
}: {
  venue: Venue;
  eventId: string;
}) {
  if (!venue.courts.length) return null;
  return (
    <div className="court-overview">
      <p className="text-xs text-muted">Court overview · schematic</p>
      <ul className="court-map" aria-label={`Courts at ${venue.name}`}>
        {venue.courts.map((court) => (
          <li key={court.id}>
            <Link
              href={`/events/${eventId}/matches?court_id=${court.id}`}
              aria-label={`${court.label}: view matches`}
            >
              <svg viewBox="0 0 120 64" aria-hidden="true">
                <rect x="5" y="5" width="110" height="54" rx="2" />
                <path d="M60 5v54M39 5v54M81 5v54" />
                <path className="court-net" d="M60 1v62" />
              </svg>
              <strong>{court.base_label || court.label}</strong>
              {court.area_label && <small>{court.area_label}</small>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
