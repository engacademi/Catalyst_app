"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";

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
    if (Array.isArray(parsed))
      ids = parsed.filter((v) => typeof v === "string");
  } catch {}
  cache.set(eventId, { raw, ids });
  return ids;
}

function write(eventId: string, ids: string[]) {
  try {
    window.localStorage.setItem(KEY(eventId), JSON.stringify(ids));
  } catch {}
  listeners.forEach((l) => l());
  window.dispatchEvent(new Event("courtside:preferences"));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) =>
    e.key?.startsWith("courtside:") && listener();
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
      write(
        eventId,
        current.includes(entryId)
          ? current.filter((id) => id !== entryId)
          : [...current, entryId],
      );
    },
    [eventId],
  );
  const divisionIds = ids
    .filter((id) => id.startsWith("division:"))
    .map((id) => id.slice(9));
  const directTeamIds = ids.filter((id) => !id.startsWith("division:"));
  const selected = useQuery({
    queryKey: [
      "followed-division-entries",
      eventId,
      [...divisionIds].sort().join(","),
    ],
    queryFn: () =>
      apiGet<{ data: string[] }>(
        `/v1/events/${eventId}/selection?division_ids=${divisionIds.join(",")}`,
      ),
    enabled: divisionIds.length > 0,
  });
  return {
    ids: [
      ...new Set([
        ...directTeamIds,
        ...(divisionIds.length ? (selected.data?.data ?? []) : []),
      ]),
    ],
    directTeamIds,
    divisionIds,
    isFollowing: (id: string) => ids.includes(id),
    toggle,
  };
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
      window.dispatchEvent(new Event("courtside:preferences"));
    },
    [key],
  );
  return { lastSeen: value, markSeen };
}

export function useTeamLabel(eventId: string, entryId: string) {
  const key = `courtside:label:${eventId}:${entryId}`;
  const label = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key) ?? "";
      } catch {
        return "";
      }
    },
    () => "",
  );
  const setLabel = useCallback(
    (value: string) => {
      try {
        window.localStorage.setItem(key, value.slice(0, 60));
      } catch {}
      listeners.forEach((l) => l());
      window.dispatchEvent(new Event("courtside:preferences"));
    },
    [key],
  );
  return { label, setLabel };
}
