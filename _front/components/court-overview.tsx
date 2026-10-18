import Link from "next/link";
import type { Venue } from "@/lib/api";

type Court = Venue["courts"][number];

/** Courts grouped by hall or area, in the order each area first appears. */
export function groupCourtsByArea(courts: Court[]) {
  const groups = new Map<string, Court[]>();
  for (const court of courts) {
    const area = court.area_label?.trim() ?? "";
    groups.set(area, [...(groups.get(area) ?? []), court]);
  }
  // Courts without an area go last so labelled halls lead the directory.
  return [...groups.entries()]
    .sort(([a], [b]) => Number(!a) - Number(!b))
    .map(([area, list]) => ({ area, courts: list }));
}

export function CourtOverview({
  venue,
  eventId,
}: {
  venue: Venue;
  eventId: string;
}) {
  if (!venue.courts.length) return null;
  const groups = groupCourtsByArea(venue.courts);
  const hasAreas = groups.some((g) => g.area);
  return (
    <div className="court-overview">
      <p className="text-xs text-muted">Court overview · schematic</p>
      {groups.map(({ area, courts }) => {
        const heading = area || (hasAreas ? "Other courts" : "");
        return (
          <section key={area || "none"} className="court-area">
            {heading && <h4 className="court-area-heading">{heading}</h4>}
            <ul
              className="court-map"
              aria-label={`Courts at ${venue.name}${heading ? `, ${heading}` : ""}`}
            >
              {courts.map((court) => (
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
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
