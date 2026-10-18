"use client";

import {
  hashKey,
  onlineManager,
  type Query,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { ApiError } from "./api";

// Public event data is saved on this device so the guide and last-loaded schedule stay
// readable on venue Wi-Fi. Account and staff queries (admin, account-*) are never saved.
const STORAGE_KEY = "courtside:offline-cache:v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 80;
const PUBLIC_QUERIES = new Set([
  "events",
  "event",
  "my-day",
  "matches",
  "guide",
  "announcements",
  "changes",
  "entry",
  "match",
  "teams",
  "pathway",
  "team-rankings",
  "saved-schedule",
  "discovery-next",
  "discovery-sponsors",
  "profile-saved-teams",
]);

type Saved = { key: QueryKey; data: unknown; at: number };

/** dataUpdatedAt of each query restored from storage, until a live fetch replaces it. */
const restored = new Map<string, number>();

export function isSavedOffline(queryKey: QueryKey) {
  return typeof queryKey[0] === "string" && PUBLIC_QUERIES.has(queryKey[0]);
}

export function isRestored(query: Query) {
  return restored.get(query.queryHash) === query.state.dataUpdatedAt;
}

/** Network failures and gateway errors, as opposed to a real 4xx answer from the API. */
export function isConnectionError(error: unknown) {
  return !(error instanceof ApiError) || error.status >= 500;
}

function readSaved(): Saved[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - MAX_AGE_MS;
    return parsed.filter(
      (s): s is Saved =>
        Array.isArray(s?.key) &&
        isSavedOffline(s.key) &&
        typeof s.at === "number" &&
        s.at > cutoff &&
        s.data !== undefined,
    );
  } catch {
    return [];
  }
}

/** Fill queries that have no live answer with their saved copy. Without `only`, every
 * saved query is restored; with it, just that query. */
function restoreSaved(client: QueryClient, only?: string) {
  for (const { key, data, at } of readSaved()) {
    const hash = hashKey(key);
    if (only && hash !== only) continue;
    const existing = client.getQueryState(key);
    if (existing?.data !== undefined && existing.dataUpdatedAt >= at) continue;
    client.setQueryData(key, data, { updatedAt: at });
    restored.set(hash, at);
  }
}

function writeSaved(client: QueryClient) {
  const byHash = new Map(readSaved().map((s) => [hashKey(s.key), s]));
  for (const query of client.getQueryCache().getAll()) {
    const { data, dataUpdatedAt } = query.state;
    if (!isSavedOffline(query.queryKey) || data === undefined) continue;
    if (isRestored(query)) continue;
    byHash.set(query.queryHash, {
      key: query.queryKey,
      data,
      at: dataUpdatedAt,
    });
  }
  let entries = [...byHash.values()]
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_ENTRIES);
  while (entries.length) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      return;
    } catch {
      // Storage full: keep the newest half and try again.
      entries = entries.slice(0, Math.floor(entries.length / 2));
    }
  }
}

/** Save each successful public response, and fall back to the saved copy only when the
 * network is down or a request fails. Online loads never render saved data, so server
 * and client markup still match during hydration. */
export function startOfflineCache(client: QueryClient) {
  onlineManager.setOnline(navigator.onLine);
  if (!navigator.onLine) restoreSaved(client);
  const offOnline = onlineManager.subscribe((online) => {
    if (!online) restoreSaved(client);
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    writeSaved(client);
  };
  // A full page load can follow within the debounce window; save before leaving.
  window.addEventListener("pagehide", flush);
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || !isSavedOffline(event.query.queryKey))
      return;
    const { action, query } = event;
    if (
      (action.type === "failed" || action.type === "error") &&
      query.state.data === undefined &&
      isConnectionError(action.error)
    ) {
      restoreSaved(client, query.queryHash);
      return;
    }
    if (action.type !== "success" || action.manual) return;
    clearTimeout(timer);
    timer = setTimeout(flush, 500);
  });
  return () => {
    flush();
    window.removeEventListener("pagehide", flush);
    offOnline();
    unsubscribe();
  };
}
