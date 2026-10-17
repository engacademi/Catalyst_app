"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Info, ListOrdered, Users } from "lucide-react";
import { useChanges, useEvent } from "@/lib/queries";
import { useFollows, useLastSeen } from "@/lib/follows";
import { formatDay, formatTime } from "@/lib/format";
import { useEventNow } from "@/lib/now";

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
  return data.data.filter((c) => c.id > lastSeen && (c.entry_ids.length === 0 || c.entry_ids.some((e) => ids.includes(e))))
    .length;
}

export function EventShell({ eventId, children }: { eventId: string; children: ReactNode }) {
  const pathname = usePathname();
  const { data } = useEvent(eventId);
  const unread = useUnread(eventId);
  const event = data?.data;
  const base = `/events/${eventId}`;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-2">
          <Link href={base} className="flex shrink-0 items-center" aria-label="Event home">
            <Image src="/brand/ova-logo.png" alt="Ontario Volleyball" width={27} height={38} priority />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{event?.title ?? "Loading event"}</p>
            {event && (
              <p className="truncate text-xs text-muted">{event.venues.map((v) => v.name).join(" · ") || "Venue to be announced"}</p>
            )}
          </div>
        </div>
        {event?.demo_time && <DemoTimeBanner eventId={eventId} timeZone={event.timezone} />}
        {event?.replay && (
          <p role="status" className="bg-info-soft px-4 py-1 text-center text-xs font-medium text-info">
            Replaying {new Intl.DateTimeFormat("en-CA", { month: "long", timeZone: "UTC" }).format(new Date(event.start_date))}{" "}
            results at demo time
          </p>
        )}
        {event?.is_demo && (
          <p className="bg-warn-soft px-4 py-1 text-center text-xs font-medium text-warn">
            Demo event with fictional teams and simulated changes. Not a live feed.
          </p>
        )}
      </header>

      <main id="main" className="flex-1 px-4 pb-28 pt-4">
        {children}
      </main>

      <nav
        aria-label="Event sections"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid max-w-3xl grid-cols-5">
          {TABS.map(({ href, label, icon: Icon }) => {
            const target = `${base}/${href}`;
            const active = pathname.startsWith(target);
            return (
              <li key={href}>
                <Link
                  href={target}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                    active ? "font-semibold text-brand" : "text-muted"
                  }`}
                >
                  <Icon aria-hidden className="h-5 w-5" />
                  {label}
                  {href === "updates" && unread > 0 && (
                    <span className="absolute right-[22%] top-1.5 rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                      {unread}
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

function DemoTimeBanner({ eventId, timeZone }: { eventId: string; timeZone: string }) {
  const { now, demoTime } = useEventNow(eventId);
  if (!demoTime) return null;
  const iso = new Date(now).toISOString();
  return (
    <p role="status" className="bg-info-soft px-4 py-1 text-center text-xs font-semibold text-info">
      Demo time: {formatDay(iso, timeZone)}, {formatTime(iso, timeZone)}. Schedules show this time, not today&apos;s date.
    </p>
  );
}
