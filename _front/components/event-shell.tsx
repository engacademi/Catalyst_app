"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEvent } from "@/lib/queries";
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
    ["", "Overview"],
    ["matches", "Matches"],
    ["teams", "Teams"],
    ["pathway", "Brackets"],
    ["guide", "Venue guide"],
  ];
  return (
    <div className="tournament-shell">
      <div className="tournament-context">
        <Link href="/tournaments">← Tournaments</Link>
        <span>{event?.title ?? "Tournament"}</span>
      </div>
      {event?.demo_now && (
        <DemoClockBanner
          iso={event.demo_now}
          serverNow={event.server_now ?? event.demo_now}
        />
      )}
      <nav className="tournament-tabs" aria-label="Tournament sections">
        {links.map(([href, label]) => {
          const target = href ? `${base}/${href}` : base;
          return (
            <Link
              key={href}
              href={target}
              aria-current={
                path === target ||
                (href === "matches" && path.startsWith(`${target}/`))
                  ? "page"
                  : undefined
              }
            >
              {label}
            </Link>
          );
        })}
      </nav>
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
