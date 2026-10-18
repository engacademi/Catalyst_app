"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type Match } from "@/lib/api";
import { formatDay, formatTime } from "@/lib/format";
import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import { useEvents } from "@/lib/queries";
import { usePreference, useLocalFollows } from "@/lib/preferences";
import { EventTile, type DiscoveryEvent } from "../event-tile";
import { EmptyState, ErrorState, Loading } from "../ui";
import { SponsorRibbon } from "../sponsor-ribbon";
import { DiscoveryGreeting } from "../discovery-greeting";
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
  const params = new URLSearchParams({ status: "upcoming", limit: "5" });
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
  const match = query.data?.data.find((m) => {
    const start = m.estimated_start ?? m.scheduled_start;
    return !!start && Date.parse(start) > new Date().getTime();
  });
  return (
    <div className="compact-pick">
      <EventTile event={event} />
      {match && (
        <Link
          className="saved-next"
          href={`/events/${event.slug}/matches/${match.id}`}
        >
          <strong>
            Next published match ·{" "}
            {formatDay(
              match.estimated_start ?? match.scheduled_start,
              match.timezone,
            )}
            ,{" "}
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
export function DiscoverView({
  catalogue = false,
  personalized = false,
}: {
  catalogue?: boolean;
  personalized?: boolean;
}) {
  const events = useEvents();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 180);
    return () => clearTimeout(timer);
  }, [search]);
  const suggestions = useQuery({
    queryKey: ["discovery-search", debounced],
    queryFn: () =>
      apiGet<{
        data: {
          id: string;
          kind: string;
          label: string;
          context?: string;
          href: string;
          event_slug: string;
        }[];
      }>(`/v1/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2,
  });
  const [kind, setKind] = useState("all");
  const [period, setPeriod] = useState("all");
  const [location, setLocation] = useState(TORONTO);
  const [locationLabel, setLocationLabel] = useState("Toronto");
  const [locationChoice, setLocationChoice] = useState("current");
  const locationSelection = useRef("current");
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
        if (locationSelection.current !== "current") return;
        setLocation({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        });
        setLocationLabel("your location");
        setMessage("");
        setLocating(false);
      },
      () => {
        if (locationSelection.current !== "current") return;
        setLocation(TORONTO);
        setLocationLabel("Toronto");
        setLocationChoice("Toronto");
        setMessage("Location wasn’t shared. Showing Toronto instead.");
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false },
    );
  };
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (locationSelection.current !== "current") return;
        setLocation({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        });
        setLocationLabel("your location");
      },
      () => {
        if (locationSelection.current !== "current") return;
        setLocationChoice("Toronto");
        setMessage("Location wasn’t shared. Showing Toronto instead.");
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }, []); // Request browser permission once; Toronto is the fallback.
  const cities = [
    { name: "Toronto", latitude: 43.6532, longitude: -79.3832 },
    { name: "Ottawa", latitude: 45.4215, longitude: -75.6972 },
    { name: "Hamilton", latitude: 43.2557, longitude: -79.8711 },
    { name: "London", latitude: 42.9849, longitude: -81.2453 },
    { name: "Waterloo", latitude: 43.4643, longitude: -80.5204 },
  ];
  const all: DiscoveryEvent[] = events.data?.data ?? [];
  const filtered = all.filter(
    (e) =>
      (kind === "all" || e.kind === kind) &&
      (`${e.title} ${e.venues.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()) ||
        (debounced === search.trim() &&
          debounced.length >= 2 &&
          suggestions.data?.data.some(
            (result) => result.event_slug === e.slug,
          ))) &&
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
        {catalogue ? (
          <h1>Tournaments</h1>
        ) : personalized ? (
          <DiscoveryGreeting />
        ) : (
          <h1>Find your next game.</h1>
        )}
      </div>
      <div
        className="discovery-search"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setSearchOpen(false);
        }}
      >
        <Search size={19} aria-hidden />
        <input
          aria-label="Search teams, tournaments or venues"
          placeholder="teams, tournaments or venues"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSearchOpen(false);
          }}
          aria-haspopup="true"
          aria-controls="discovery-results"
        />
        {searchOpen && search.trim().length >= 2 && (
          <div
            id="discovery-results"
            role="region"
            className="search-results"
            aria-label="Search results"
          >
            {suggestions.isFetching || search.trim() !== debounced ? (
              <p role="status">Searching…</p>
            ) : suggestions.error ? (
              <p role="alert">Search is unavailable. Try again.</p>
            ) : suggestions.data?.data.length ? (
              suggestions.data.data.map((result) => (
                <Link
                  key={`${result.kind}-${result.id}`}
                  href={result.href}
                  onClick={() => setSearchOpen(false)}
                >
                  <span className="result-kind">{result.kind}</span>
                  <strong>{result.label}</strong>
                  {result.context && <small>{result.context}</small>}
                </Link>
              ))
            ) : (
              <p role="status">No matching teams, tournaments or venues.</p>
            )}
            <button type="button" onClick={() => setSearchOpen(false)}>
              Close results
            </button>
          </div>
        )}
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
              {filtered.some((e) => saved.includes(e.slug)) && (
                <section className="saved-discovery reveal-section">
                  <h2>Your courtside picks</h2>
                  <ul className="event-carousel">
                    {filtered
                      .filter((e) => saved.includes(e.slug))
                      .map((e) => (
                        <li key={e.id}>
                          <SavedEventPreview event={e} />
                        </li>
                      ))}
                  </ul>
                </section>
              )}
              <SponsorRibbon />
              <section className="reveal-section">
                <h2>Near {locationLabel}</h2>
                <div className="location-strip">
                  <span>
                    <MapPin size={17} aria-hidden />
                    Within 100 km
                  </span>
                  <select
                    aria-label="Event location"
                    value={locationChoice}
                    disabled={locating}
                    onChange={(e) => {
                      const value = e.target.value;
                      locationSelection.current = value;
                      setLocationChoice(value);
                      if (value === "current") requestLocation();
                      else {
                        const city = cities.find((c) => c.name === value)!;
                        setLocation(city);
                        setLocationLabel(city.name);
                        setMessage("");
                      }
                    }}
                  >
                    <option value="current">
                      {locating ? "Locating…" : "Current location"}
                    </option>
                    {cities.map((city) => (
                      <option key={city.name} value={city.name}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </div>
                {message && (
                  <p role="status" className="mb-3 text-xs text-muted">
                    {message}
                  </p>
                )}
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
              <section className="reveal-section">
                <div className="section-row">
                  <h2>Picked for you</h2>
                  <Link href="/profile">Edit interests →</Link>
                </div>

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
                    Choose interests in your profile.
                  </p>
                )}
              </section>
              <section className="reveal-section">
                <h2>Popular on court</h2>

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
