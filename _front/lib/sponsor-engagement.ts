"use client";
import { useEffect, type RefObject } from "react";
import { API_BASE } from "./api";

// Anonymous sponsor counters (R-23). Only the card id, placement and action are sent:
// no user id, device id or anything personal. Views count once per browser session per
// placement; clicks count every time.
export type SponsorPlacement = "ribbon" | "guide" | "message";

type Item = {
  partner_id: string;
  placement: SponsorPlacement;
  action: "view" | "click";
};

const ENDPOINT = `${API_BASE}/v1/sponsor-engagement`;
const seenFallback = new Set<string>();

function send(items: Item[]) {
  if (!items.length) return;
  const body = JSON.stringify({ items });
  try {
    // A beacon survives the page navigating away, so the outbound link never waits on it.
    if (
      navigator.sendBeacon?.(
        ENDPOINT,
        new Blob([body], { type: "application/json" }),
      )
    )
      return;
  } catch {
    // Fall through to fetch.
  }
  fetch(ENDPOINT, {
    method: "POST",
    body,
    keepalive: true,
    headers: { "Content-Type": "application/json" },
  }).catch(() => undefined);
}

function firstViewThisSession(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
    return true;
  } catch {
    if (seenFallback.has(key)) return false;
    seenFallback.add(key);
    return true;
  }
}

export function trackSponsorViews(ids: string[], placement: SponsorPlacement) {
  send(
    [...new Set(ids)]
      .filter((id) =>
        firstViewThisSession(`courtside:sponsor-seen:${placement}:${id}`),
      )
      .map((id) => ({ partner_id: id, placement, action: "view" as const })),
  );
}

export function trackSponsorClick(id: string, placement: SponsorPlacement) {
  send([{ partner_id: id, placement, action: "click" }]);
}

/**
 * Counts a view once a sponsor is at least half on screen. Elements inside `ref` marked
 * with `data-sponsor-id` are watched one by one (guide cards); without them the whole
 * placement counts every sponsor at once (the ribbon cycles through all of them).
 */
export function useSponsorImpressions(
  ref: RefObject<Element | null>,
  ids: string[],
  placement: SponsorPlacement,
) {
  const key = ids.join(",");
  useEffect(() => {
    const node = ref.current;
    if (!node || !key) return;
    const marked = Array.from(
      node.querySelectorAll<HTMLElement>("[data-sponsor-id]"),
    );
    const idsFor = (el: Element) =>
      el instanceof HTMLElement && el.dataset.sponsorId
        ? [el.dataset.sponsorId]
        : key.split(",");
    const targets = marked.length ? marked : [node];
    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => trackSponsorViews(idsFor(el), placement));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          trackSponsorViews(idsFor(entry.target), placement);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.5 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ref, key, placement]);
}
