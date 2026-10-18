"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import { useEvent } from "./queries";

// Guest follows stay on this device. The ids are canonical entry ids from the API, so a
// later sign-in can merge them into an account without guessing.
const KEY = (eventId: string) => `courtside:follows:${eventId}`;

// Event routes accept a UUID or a slug, but Schedule, Profile, Discover and saved events all
// key by slug. Device state is therefore always stored under the slug; the URL id is used only
// until the event has loaded.
export function useEventKey(eventId: string) {
  const slug = useEvent(eventId).data?.data.slug;
  useEffect(() => {
    if (slug && slug !== eventId) migrateEventKeys(eventId, slug);
  }, [eventId, slug]);
  return slug ?? eventId;
}

// Moves follows, read state and labels saved under an event's UUID onto its slug.
export function migrateEventKeys(id: string, slug: string) {
  if (!id || id === slug) return;
  let changed = false;
  try {
    const store = window.localStorage;
    const oldFollows = store.getItem(KEY(id));
    if (oldFollows !== null) {
      const parse = (raw: string | null) => {
        try {
          const v = raw ? JSON.parse(raw) : [];
          return Array.isArray(v)
            ? v.filter((x): x is string => typeof x === "string")
            : [];
        } catch {
          return [];
        }
      };
      const merged = [
        ...new Set([...parse(store.getItem(KEY(slug))), ...parse(oldFollows)]),
      ];
      store.setItem(KEY(slug), JSON.stringify(merged));
      store.removeItem(KEY(id));
      changed = true;
    }
    const oldSeen = store.getItem(`courtside:seen:${id}`);
    if (oldSeen !== null) {
      const seen = Math.max(
        Number(oldSeen) || 0,
        Number(store.getItem(`courtside:seen:${slug}`)) || 0,
      );
      store.setItem(`courtside:seen:${slug}`, String(seen));
      store.removeItem(`courtside:seen:${id}`);
      changed = true;
    }
    const prefix = `courtside:label:${id}:`;
    const labelKeys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k?.startsWith(prefix)) labelKeys.push(k);
    }
    for (const k of labelKeys) {
      const target = `courtside:label:${slug}:${k.slice(prefix.length)}`;
      if (!store.getItem(target)) store.setItem(target, store.getItem(k) ?? "");
      store.removeItem(k);
      changed = true;
    }
  } catch {
    return;
  }
  if (changed) {
    listeners.forEach((l) => l());
    window.dispatchEvent(new Event("courtside:preferences"));
  }
}
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
  const key = useEventKey(eventId);
  const ids = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => EMPTY,
  );
  const toggle = useCallback(
    (entryId: string) => {
      const current = read(key);
      write(
        key,
        current.includes(entryId)
          ? current.filter((id) => id !== entryId)
          : [...current, entryId],
      );
    },
    [key],
  );
  const divisionIds = ids
    .filter((id) => id.startsWith("division:"))
    .map((id) => id.slice(9));
  const directTeamIds = ids.filter((id) => !id.startsWith("division:"));
  const selected = useQuery({
    queryKey: [
      "followed-division-entries",
      key,
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
  const key = `courtside:seen:${useEventKey(eventId)}`;
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
  const key = `courtside:label:${useEventKey(eventId)}:${entryId}`;
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
