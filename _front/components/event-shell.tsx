"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Home,
  Info,
  ListOrdered,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useChanges, useEvent } from "@/lib/queries";
import { useFollows, useLastSeen } from "@/lib/follows";
import { Wordmark } from "./brand";

const TABS = [
  { href: "my-day", label: "My Day", icon: CalendarDays },
  { href: "teams", label: "Teams", icon: Users },
  { href: "matches", label: "Matches", icon: ListOrdered },
  { href: "guide", label: "Guide", icon: Info },
  { href: "updates", label: "Updates", icon: Bell },
] as const;

function useUnread(eventId: string) {
  const { data } = useChanges(eventId);
  const { ids } = useFollows(eventId);
  const { lastSeen } = useLastSeen(eventId);
  if (!data) return 0;
  return data.data.filter(
    (c) =>
      c.id > lastSeen &&
      (c.entry_ids.length === 0 || c.entry_ids.some((e) => ids.includes(e))),
  ).length;
}

export function EventShell({
  eventId,
  children,
}: {
  eventId: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { data } = useEvent(eventId);
  const unread = useUnread(eventId);
  const event = data?.data;
  const base = `/events/${eventId}`;
  const isHome = pathname === base;

  return (
    <div className="event-app">
      <aside className="event-sidebar">
        <Link
          href="/"
          aria-label="Olley Catalyst — all events"
          className="sidebar-brand"
        >
          <Wordmark light />
          <p>YOUR COURTSIDE COMPANION</p>
        </Link>
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2 px-4 text-xs text-brand-lime"
        >
          <ArrowLeft size={14} aria-hidden /> All events
        </Link>
        <p className="sidebar-event">THE TOURNAMENT</p>
        <nav aria-label="Desktop event sections" className="sidebar-nav">
          <Link href={base} aria-current={isHome ? "page" : undefined}>
            <Home size={19} aria-hidden /> Event home
          </Link>
          {TABS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={`${base}/${href}`}
              aria-current={
                pathname.startsWith(`${base}/${href}`) ? "page" : undefined
              }
            >
              <Icon size={19} aria-hidden />
              {label}
              {href === "updates" && unread > 0 && (
                <span className="ml-auto text-xs">
                  {unread}
                  <span className="sr-only"> unread</span>
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Image
            src="/brand/ova-logo.png"
            alt="Ontario Volleyball"
            width={32}
            height={45}
          />
          <p>
            For the teams you love.
            <br />
            For every moment on court.
          </p>
          <Link href="/admin">
            <ShieldCheck size={16} aria-hidden /> Staff workspace{" "}
            <ArrowUpRight size={13} aria-hidden />
          </Link>
        </div>
      </aside>

      <div className="event-column">
        <header className="event-header">
          <div className="event-header-inner">
            <Link
              href={base}
              aria-label="Event home"
              className="event-header-brand"
            >
              <Wordmark />
              <div className="event-header-copy">
                <p className="truncate">{event?.title ?? "Your event"}</p>
                <p className="truncate">
                  {event?.venues.map((v) => v.name).join(" · ") ||
                    "Your courtside companion"}
                </p>
              </div>
            </Link>
            <div className="event-header-actions">
              <Link href="/" className="secondary-link">
                <ArrowLeft size={14} aria-hidden /> All events
              </Link>
              <Link
                href={`${base}/updates`}
                className="icon-link"
                aria-label={`Updates${unread > 0 ? `, ${unread} unread` : ""}`}
              >
                <Bell size={19} aria-hidden />
                {unread > 0 && (
                  <span className="unread-count">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            </div>
          </div>
          {event?.is_demo && (
            <p className="demo-notice">
              Demo event · Fictional teams and simulated changes. Not a live
              feed.
            </p>
          )}
        </header>

        <main id="main" className="event-main">
          <div key={pathname} className="route-content">
            {children}
          </div>
          <footer className="event-footer">
            <p>A little closer to the game.</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <Link href="/" className="underline">
                All events
              </Link>
              <Link href="/admin" className="underline">
                Staff & officials
              </Link>
            </div>
          </footer>
        </main>
      </div>

      <nav aria-label="Mobile event sections" className="event-dock">
        <ul>
          {TABS.map(({ href, label, icon: Icon }) => {
            const target = `${base}/${href}`;
            return (
              <li key={href}>
                <Link
                  href={target}
                  aria-current={
                    pathname.startsWith(target) ? "page" : undefined
                  }
                >
                  <Icon aria-hidden size={20} strokeWidth={1.7} />
                  {label}
                  {href === "updates" && unread > 0 && (
                    <span className="unread-count">
                      {unread > 99 ? "99+" : unread}
                      <span className="sr-only"> new</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
