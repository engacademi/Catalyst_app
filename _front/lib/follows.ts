"use client";

import { useCallback, useSyncExternalStore } from "react";

// Guest follows stay on this device. The ids are canonical entry ids from the API, so a
// later sign-in can merge them into an account without guessing.
const KEY = (eventId: string) => `courtside:follows:${eventId}`;
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; ids: string[] }>();
const EMPTY: string[] = [];

function read(eventId: string): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY(eventId));
  } catch {
    return EMPTY;
  }
  const hit = cache.get(eventId);
  if (hit && hit.raw === raw) return hit.ids;
  let ids: string[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) ids = parsed.filter((v) => typeof v === "string");
  } catch {}
  cache.set(eventId, { raw, ids });
  return ids;
}

function write(eventId: string, ids: string[]) {
  try {
    window.localStorage.setItem(KEY(eventId), JSON.stringify(ids));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key?.startsWith("courtside:") && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useFollows(eventId: string) {
  const ids = useSyncExternalStore(
    subscribe,
    () => read(eventId),
    () => EMPTY,
  );
  const toggle = useCallback(
    (entryId: string) => {
      const current = read(eventId);
      write(eventId, current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId]);
    },
    [eventId],
  );
  return { ids, isFollowing: (id: string) => ids.includes(id), toggle };
}

// The last change the guest has seen, so Updates can mark new items. Local only.
export function useLastSeen(eventId: string) {
  const key = `courtside:seen:${eventId}`;
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return Number(window.localStorage.getItem(key) ?? 0);
      } catch {
        return 0;
      }
    },
    () => 0,
  );
  const markSeen = useCallback(
    (id: number) => {
      try {
        window.localStorage.setItem(key, String(id));
      } catch {}
      listeners.forEach((l) => l());
    },
    [key],
  );
  return { lastSeen: value, markSeen };
}
