"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Heart,
  MapPin,
  ShieldCheck,
  Volleyball,
  Waves,
} from "lucide-react";
import { useEvents } from "@/lib/queries";
import { formatDateRange } from "@/lib/format";
import { Badge, EmptyState, ErrorState, Loading } from "@/components/ui";
import { CourtArt, Wordmark } from "@/components/brand";

export default function Home() {
  const events = useEvents();
  return (
    <main id="main" className="home-shell">
      <header className="home-nav">
        <Link href="/" aria-label="Olley Catalyst home">
          <Wordmark />
        </Link>
        <div className="home-nav-links">
          <span>Your courtside companion</span>
          <Link href="/admin" className="secondary-link">
            <ShieldCheck size={15} aria-hidden /> Staff sign in
          </Link>
        </div>
      </header>
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow text-brand">A LITTLE CLOSER TO THE GAME</p>
          <h1>
            Big moments.
            <br />
            <span>Right here.</span>
          </h1>
          <p>
            Your teams, the next court, and everything in between. Settle in —
            your tournament day starts here.
          </p>
          <div className="home-hero-actions">
            <a href="#events" className="primary-link">
              Find your event <ArrowDown size={16} aria-hidden />
            </a>
          </div>
          <div className="home-trust">
            <ShieldCheck size={16} aria-hidden /> No account needed. Just bring
            your team spirit.
          </div>
        </div>
        <CourtArt />
      </section>

      <section
        id="events"
        className="home-events"
        aria-labelledby="events-title"
      >
        <div className="home-section-heading">
          <div>
            <p className="eyebrow mb-2 text-muted">FIND YOUR COURTSIDE</p>
            <h2 id="events-title">What&apos;s on court</h2>
          </div>
          <p className="text-xs text-muted">
            Indoor or beach. Every team has a home here.
          </p>
        </div>
        {events.isPending ? (
          <Loading label="Loading events" />
        ) : events.error ? (
          <ErrorState error={events.error} />
        ) : events.data.data.length === 0 ? (
          <EmptyState title="The next great day is on its way">
            Published events will appear here.
          </EmptyState>
        ) : (
          <ul className="event-grid">
            {events.data.data.map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.slug}`} className="discovery-card">
                  <div className="discovery-card-top">
                    <span className="discovery-icon">
                      {e.kind === "beach" ? (
                        <Waves size={27} aria-hidden />
                      ) : (
                        <Volleyball size={27} aria-hidden />
                      )}
                    </span>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge tone="brand">
                        {e.kind === "beach"
                          ? "Beach volleyball"
                          : "Indoor volleyball"}
                      </Badge>
                      {e.is_demo && <Badge tone="warn">Demo data</Badge>}
                    </div>
                  </div>
                  <h3>{e.title}</h3>
                  <p className="discovery-card-detail">
                    <CalendarDays size={15} className="shrink-0" aria-hidden />
                    {formatDateRange(e.start_date, e.end_date)}
                  </p>
                  <p className="discovery-card-detail">
                    <MapPin size={15} className="shrink-0" aria-hidden />
                    {e.venues.join(", ") || "Venue to be announced"}
                  </p>
                  <div className="discovery-card-bottom">
                    <span>Explore the event</span>
                    <ArrowRight size={19} aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Your event companion" className="home-features">
        <div>
          <Heart size={23} className="text-brand" aria-hidden />
          <h3>Your teams, together.</h3>
          <p>
            Follow the teams you care about. Their matches come together in your
            own day.
          </p>
        </div>
        <div>
          <CalendarDays size={23} className="text-brand" aria-hidden />
          <h3>One less thing to juggle.</h3>
          <p>
            Find the next match, the right court, and the latest published
            results in one place.
          </p>
        </div>
        <div>
          <MapPin size={23} className="text-brand" aria-hidden />
          <h3>Feel at home here.</h3>
          <p>
            Parking, food, accessible entrances, and a helping hand — all in
            your event guide.
          </p>
        </div>
      </section>
      <footer className="home-footer">
        <div className="ova-lockup">
          <Image
            src="/brand/ova-logo.png"
            alt="Ontario Volleyball"
            width={28}
            height={39}
          />
          <p>
            Made for the volleyball community.
            <br />
            Olley Catalyst · Your courtside companion
          </p>
        </div>
        <Link href="/admin" className="underline">
          OVA staff & officials{" "}
          <ArrowRight size={12} className="inline" aria-hidden />
        </Link>
      </footer>
    </main>
  );
}
