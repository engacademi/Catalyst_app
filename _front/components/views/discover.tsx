"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type Match } from "@/lib/api";
import { formatTime } from "@/lib/format";
import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import { useEvents } from "@/lib/queries";
import { usePreference, useLocalFollows } from "@/lib/preferences";
import { EventTile, type DiscoveryEvent } from "../event-tile";
import { EmptyState, ErrorState, Loading } from "../ui";
const TORONTO = { latitude: 43.6532, longitude: -79.3832 };
export function distanceKm(a: typeof TORONTO, b: typeof TORONTO) {
  const r = Math.PI / 180;
  const d =
    Math.sin(((b.latitude - a.latitude) * r) / 2) ** 2 +
    Math.cos(a.latitude * r) *
      Math.cos(b.latitude * r) *
      Math.sin(((b.longitude - a.longitude) * r) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(d), Math.sqrt(1 - d));
}
function nearest(e: DiscoveryEvent, location: typeof TORONTO) {
  const distances = (e.venue_locations ?? [])
    .filter((v) => v.latitude != null && v.longitude != null)
    .map((v) =>
      distanceKm(location, { latitude: v.latitude!, longitude: v.longitude! }),
    );
  return distances.length ? Math.min(...distances) : null;
}
function SavedEventPreview({ event }: { event: DiscoveryEvent }) {
  const follows = useLocalFollows(event.slug);
  const [saved] = usePreference<string[]>("saved-events", []);
  const params = new URLSearchParams({ status: "upcoming", limit: "1" });
  if (!saved.includes(event.slug)) {
    params.set(
      "entry_ids",
      follows.filter((id) => !id.startsWith("division:")).join(","),
    );
    params.set(
      "division_ids",
      follows
        .filter((id) => id.startsWith("division:"))
        .map((id) => id.slice(9))
        .join(","),
    );
  }
  const query = useQuery({
    queryKey: ["discovery-next", event.slug, params.toString()],
    queryFn: () =>
      apiGet<{ data: Match[] }>(`/v1/events/${event.slug}/matches?${params}`),
  });
  const match = query.data?.data[0];
  return (
    <div>
      <EventTile event={event} />
      {match && (
        <Link
          className="saved-next"
          href={`/events/${event.slug}/matches/${match.id}`}
        >
          <strong>
            Next published match ·{" "}
            {formatTime(
              match.estimated_start ?? match.scheduled_start,
              match.timezone,
            )}
          </strong>
          <span>
            {match.home.team_name ?? match.home.placeholder ?? "TBD"} vs{" "}
            {match.away.team_name ?? match.away.placeholder ?? "TBD"}
          </span>
          <span>{match.court?.label ?? "Court pending"} →</span>
        </Link>
      )}
    </div>
  );
}
function FollowedEvent({ event }: { event: DiscoveryEvent }) {
  const follows = useLocalFollows(event.slug);
  return follows.length ? (
    <li>
      <SavedEventPreview event={event} />
    </li>
  ) : null;
}
export function DiscoverView({ catalogue = false }: { catalogue?: boolean }) {
  const events = useEvents();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [period, setPeriod] = useState("all");
  const [location, setLocation] = useState(TORONTO);
  const [locationLabel, setLocationLabel] = useState("Toronto");
  const [message, setMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [saved] = usePreference<string[]>("saved-events", []);
  const [interests] = usePreference<string[]>("interests", []);
  const [attended] = usePreference<string[]>("attended", []);
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Location is unavailable. Showing Toronto instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        });
        setLocationLabel("your location");
        setMessage(
          "Location stays in this tab and is not sent to our servers.",
        );
        setLocating(false);
      },
      () => {
        setMessage("Location wasn't shared. Showing Toronto instead.");
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false },
    );
  };
  const all: DiscoveryEvent[] = events.data?.data ?? [];
  const filtered = all.filter(
    (e) =>
      (kind === "all" || e.kind === kind) &&
      `${e.title} ${e.venues.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (period === "all" ||
        (period === "upcoming"
          ? e.end_date >=
            new Date().toLocaleDateString("en-CA", { timeZone: e.timezone })
          : e.end_date <
            new Date().toLocaleDateString("en-CA", { timeZone: e.timezone }))),
  );
  const near = filtered
    .map((event) => ({ event, distance: nearest(event, location) }))
    .filter((x) => x.distance != null && x.distance <= 100)
    .sort((a, b) => a.distance! - b.distance!);
  const preferredKinds = new Set([
    ...interests,
    ...all
      .filter((e) => saved.includes(e.slug) || attended.includes(e.slug))
      .map((e) => e.kind),
  ]);
  const recommended = filtered.filter(
    (e) => preferredKinds.has(e.kind) && !saved.includes(e.slug),
  );
  const popular = [...filtered].sort(
    (a, b) => (b.team_count ?? 0) - (a.team_count ?? 0),
  );
  return (
    <main id="main" className="platform-main discovery-page">
      <div className="discovery-heading">
        <p className="eyebrow text-brand">YOUR PLACE, COURTSIDE</p>
        <h1>{catalogue ? "Tournaments" : "Find your next game."}</h1>
        <p>
          {catalogue
            ? "Explore every published tournament in the OVA companion."
            : "The teams you love. The games around you."}
        </p>
      </div>
      {!catalogue && (
        <div className="location-strip">
          <span>
            <MapPin size={17} aria-hidden />
            Near {locationLabel} <small>· 100 km</small>
          </span>
          <button onClick={requestLocation} disabled={locating}>
            {locating ? "Locating…" : "Use my location"}
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="mb-3 text-xs text-muted">
          {message}
        </p>
      )}
      <div className="discovery-search">
        <Search size={19} aria-hidden />
        <input
          aria-label="Search tournaments"
          placeholder="Search tournaments or venues"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="discovery-filters">
        <div className="segmented" aria-label="Tournament type">
          {["all", "indoor", "beach"].map((k) => (
            <button
              key={k}
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
            >
              {k === "all"
                ? "All volleyball"
                : k === "indoor"
                  ? "Indoor"
                  : "Beach"}
            </button>
          ))}
        </div>
        <select
          aria-label="Tournament dates"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="all">All dates</option>
          <option value="upcoming">Upcoming & ongoing</option>
          <option value="past">Past events</option>
        </select>
      </div>
      {events.isPending ? (
        <Loading label="Loading tournaments" />
      ) : events.error ? (
        <ErrorState error={events.error} />
      ) : (
        <>
          {!catalogue && (
            <>
              <section className="saved-discovery">
                <h2>Your courtside picks</h2>
                <p className="section-description">
                  Saved tournaments and the teams you follow, first.
                </p>
                <ul className="event-carousel">
                  {filtered.map((e) =>
                    saved.includes(e.slug) ? (
                      <li key={e.id}>
                        <SavedEventPreview event={e} />
                      </li>
                    ) : (
                      <FollowedEvent key={e.id} event={e} />
                    ),
                  )}
                </ul>
                <p className="saved-empty">
                  Save a tournament with the heart, or follow a team to bring it
                  here.
                </p>
              </section>
              <section>
                <h2>Near {locationLabel}</h2>
                <p className="section-description">
                  Published venues within 100 km.
                </p>
                {near.length ? (
                  <ul className="event-carousel">
                    {near.map((x) => (
                      <li key={x.event.id}>
                        <EventTile {...x} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No nearby venues with a confirmed location">
                    Browse all tournaments below. Events without venue
                    coordinates are still available.
                  </EmptyState>
                )}
              </section>
              <section>
                <div className="section-row">
                  <h2>Picked for you</h2>
                  <Link href="/profile">Edit interests →</Link>
                </div>
                <p className="section-description">
                  Based on your interests, saved tournaments and events you mark
                  as attended.
                </p>
                {recommended.length ? (
                  <ul className="event-carousel">
                    {recommended.map((e) => (
                      <li key={e.id}>
                        <EventTile event={e} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-inline">
                    Choose Indoor or Beach in your profile to discover more
                    games you like.
                  </p>
                )}
              </section>
              <section>
                <h2>Popular on court</h2>
                <p className="section-description">
                  The largest competitions by published team count.
                </p>
                <ul className="event-carousel">
                  {popular.slice(0, 8).map((e) => (
                    <li key={e.id}>
                      <EventTile event={e} />
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
          <section>
            <div className="section-row">
              <h2>
                {catalogue
                  ? `${filtered.length} tournaments`
                  : "Explore all tournaments"}
              </h2>
              {!catalogue && <Link href="/tournaments">See all →</Link>}
            </div>
            {filtered.length ? (
              <ul className="event-grid">
                {filtered.map((e) => (
                  <li key={e.id}>
                    <EventTile event={e} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No tournaments match your filters" />
            )}
          </section>
          {catalogue && (
            <p className="catalogue-note">
              Looking for a tournament that has not been connected yet?{" "}
              <a
                href="https://www.ontariovolleyball.org/"
                target="_blank"
                rel="noreferrer"
              >
                Visit the official OVA website ↗
              </a>
              . This directory includes published connected events; it is not
              yet the complete OVA season calendar.
            </p>
          )}
        </>
      )}
    </main>
  );
}
