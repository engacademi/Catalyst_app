"use client";
import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Compass,
  Trophy,
  UserRound,
  Volleyball,
} from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { Wordmark } from "./brand";
import { useEvents } from "@/lib/queries";
import { apiGet, type Change } from "@/lib/api";
import { usePreference } from "@/lib/preferences";
import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("courtside:preferences", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("courtside:preferences", cb);
  };
}
export function useNotificationCounts() {
  const events = useEvents();
  const [saved] = usePreference<string[]>("saved-events", []);
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return JSON.stringify(
          (events.data?.data ?? []).map((e) => [
            e.slug,
            localStorage.getItem(`courtside:follows:${e.slug}`),
            localStorage.getItem(`courtside:seen:${e.slug}`),
          ]),
        );
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );
  const local = new Map<string, { follows: string[]; seen: number }>();
  try {
    for (const [slug, raw, seen] of JSON.parse(snapshot))
      local.set(slug, {
        follows: JSON.parse(raw ?? "[]"),
        seen: Number(seen ?? 0),
      });
  } catch {}
  const selected = (events.data?.data ?? []).filter(
    (e) =>
      saved.includes(e.slug) || (local.get(e.slug)?.follows.length ?? 0) > 0,
  );
  const queries = useQueries({
    queries: selected.map((e) => ({
      queryKey: ["notification-count", e.slug, local.get(e.slug)?.seen ?? 0],
      queryFn: async () => {
        const data: Change[] = [];
        const divisions: Record<string, string> = {};
        let before: number | null = null;
        do {
          const page: {
            data: Change[];
            next_before: number | null;
            divisions?: Record<string, string>;
          } = await apiGet(
            `/v1/events/${e.slug}/changes?after=${local.get(e.slug)?.seen ?? 0}${before ? `&before=${before}` : ""}`,
          );
          data.push(...page.data);
          Object.assign(divisions, page.divisions);
          before = page.next_before ?? null;
        } while (before !== null);
        return { data, divisions };
      },
    })),
  });
  return selected.map((event, i) => {
    const state = local.get(event.slug);
    const page = queries[i].data;
    const count = (page?.data ?? []).filter(
      (c) =>
        c.id > (state?.seen ?? 0) &&
        (saved.includes(event.slug) ||
          (!c.entry_ids.length &&
            !c.division_id &&
            c.entity_type === "announcement") ||
          c.entry_ids.some((id) => state?.follows.includes(id)) ||
          state?.follows.includes(
            `division:${c.division_id ?? page?.divisions[c.entity_id]}`,
          )),
    ).length;
    return { event, count, more: false, error: queries[i].error };
  });
}
const tabs = [
  { href: "/", label: "Discover", icon: Compass },
  { href: "/schedule", label: "My Schedule", icon: CalendarDays },
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/profile", label: "My Profile", icon: UserRound },
];
export function PlatformShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const counts = useNotificationCounts();
  const unread = counts.reduce((n, c) => n + c.count, 0);
  const nav = tabs.map(({ href, label, icon: Icon }) => {
    const active =
      href === "/"
        ? path === "/"
        : path.startsWith(href) ||
          (href === "/tournaments" && path.startsWith("/events/"));
    return (
      <Link key={href} href={href} aria-current={active ? "page" : undefined}>
        <Icon size={21} aria-hidden />
        <span>{label}</span>
        {href === "/profile" && unread > 0 && (
          <span className="unread-count">
            {unread > 99 ? "99+" : unread}
            <span className="sr-only"> unread notifications</span>
          </span>
        )}
      </Link>
    );
  });
  if (path.startsWith("/admin")) return <>{children}</>;
  return (
    <div className="platform-app">
      <div className="volleyball-background" aria-hidden="true">
        <Volleyball strokeWidth={1} />
        <Volleyball strokeWidth={1} />
        <Volleyball strokeWidth={1} />
        <Volleyball strokeWidth={1} />
        <Volleyball strokeWidth={1} />
      </div>
      <header className="platform-header">
        <Link
          href="/"
          aria-label="Olley Catalyst by Ontario Volleyball Association"
        >
          <Wordmark />
          <small className="by-ova">By Ontario Volleyball Association</small>
        </Link>
        <nav className="platform-desktop-nav" aria-label="Main navigation">
          {nav}
        </nav>
        {path === "/" && (
          <Link
            href="/updates"
            className="icon-link"
            aria-label={`Updates${unread ? `, ${unread} unread` : ""}`}
          >
            <Bell size={21} aria-hidden />
            {unread > 0 && (
              <span className="unread-count">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        )}
      </header>
      {children}
      <footer className="platform-footer">
        <Link href="/">
          <Wordmark />
          <small className="by-ova">By Ontario Volleyball Association</small>
        </Link>
        <nav className="footer-socials" aria-label="OVA social media">
          <a
            href="https://www.instagram.com/ova_updates/"
            target="_blank"
            rel="noreferrer"
          >
            Instagram
          </a>
          <a
            href="https://www.facebook.com/OntarioVolleyball/"
            target="_blank"
            rel="noreferrer"
          >
            Facebook
          </a>
          <a href="https://x.com/ova_updates" target="_blank" rel="noreferrer">
            X
          </a>
          <a
            href="https://www.youtube.com/user/TheOVAUpdates"
            target="_blank"
            rel="noreferrer"
          >
            YouTube
          </a>
          <a
            href="https://www.tiktok.com/@ova_updates"
            target="_blank"
            rel="noreferrer"
          >
            TikTok
          </a>
          <a
            href="https://www.threads.net/@ova_updates"
            target="_blank"
            rel="noreferrer"
          >
            Threads
          </a>
          <a
            href="https://www.snapchat.com/add/ova_updates"
            target="_blank"
            rel="noreferrer"
          >
            Snapchat
          </a>
        </nav>
      </footer>
      <nav className="platform-dock" aria-label="Main navigation">
        {nav}
      </nav>
    </div>
  );
}
