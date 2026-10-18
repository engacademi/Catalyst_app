"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEvent } from "@/lib/queries";
import {
  House,
  MapPinned,
  CalendarDays,
  Users,
  GitBranch,
  Images,
} from "lucide-react";
import { SponsorToast } from "./sponsor-toast";
import { useNow } from "@/lib/now";

export function EventShell({
  eventId,
  children,
}: {
  eventId: string;
  children: ReactNode;
}) {
  const path = usePathname();
  const event = useEvent(eventId).data?.data;
  const base = `/events/${eventId}`;
  const links = [
    { href: "", label: "Overview", icon: House },
    { href: "guide", label: "Venue", icon: MapPinned },
    { href: "matches", label: "Matches", icon: CalendarDays },
    { href: "teams", label: "Teams", icon: Users },
    { href: "pathway", label: "Brackets", icon: GitBranch },
    { href: "media", label: "Media", icon: Images },
  ];
  return (
    <div className="tournament-shell">
      <div className="tournament-context">
        <Link href="/tournaments">← Tournaments</Link>
      </div>
      {event?.demo_now && (
        <DemoClockBanner
          iso={event.demo_now}
          serverNow={event.server_now ?? event.demo_now}
        />
      )}
      <nav className="tournament-tabs" aria-label="Tournament sections">
        {links.map(({ href, label, icon: Icon }) => {
          const target = href ? `${base}/${href}` : base;
          return (
            <Link
              key={href}
              aria-label={label}
              title={label}
              href={target}
              aria-current={
                path === target ||
                (href === "matches" && path.startsWith(`${target}/`))
                  ? "page"
                  : undefined
              }
            >
              <Icon size={21} aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      {(path === base || path.startsWith(`${base}/matches/`)) && (
        <SponsorToast key={path} eventId={eventId} />
      )}
      <main id="main" className="platform-main">
        <div key={path} className="route-content">
          {children}
        </div>
      </main>
    </div>
  );
}
function DemoClockBanner({
  iso,
  serverNow,
}: {
  iso: string;
  serverNow: string;
}) {
  const tick = useNow();
  const logical = new Date(
    Date.parse(iso) + Math.max(0, tick - Date.parse(serverNow)),
  );
  return (
    <p role="status" className="demo-notice">
      Demo time ·{" "}
      {logical.toLocaleString("en-CA", {
        timeZone: "America/Toronto",
        dateStyle: "medium",
        timeStyle: "short",
      })}
    </p>
  );
}
