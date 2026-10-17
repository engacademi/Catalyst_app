"use client";

import { useCallback, useSyncExternalStore } from "react";

// Guest follows stay on this device. The ids are canonical entry ids from the API, so a
// later sign-in can merge them into an account without guessing.
const KEY = (eventId: string) => `courtside:follows:${eventId}`;
const DIVISION_KEY = (eventId: string) => `courtside:division-follows:${eventId}`;
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; ids: string[] }>();
const EMPTY: string[] = [];

function read(key: string): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return EMPTY;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.ids;
  let ids: string[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) ids = parsed.filter((v) => typeof v === "string");
  } catch {}
  cache.set(key, { raw, ids });
  return ids;
}

function write(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
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

function useIdList(key: string) {
  const ids = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => EMPTY,
  );
  const toggle = useCallback(
    (id: string) => {
      const current = read(key);
      write(key, current.includes(id) ? current.filter((v) => v !== id) : [...current, id]);
    },
    [key],
  );
  return { ids, isFollowing: (id: string) => ids.includes(id), toggle };
}

export function useFollows(eventId: string) {
  return useIdList(KEY(eventId));
}

// Followed divisions, stored next to the followed entries and just as local.
export function useDivisionFollows(eventId: string) {
  return useIdList(DIVISION_KEY(eventId));
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
