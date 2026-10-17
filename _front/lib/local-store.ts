"use client";

import { useSyncExternalStore } from "react";

// One device-local store for guest state (follows, labels, last seen). Values are JSON in
// localStorage under "courtside:" keys; every hook re-renders when any of them changes,
// in this tab or another.
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

/** The parsed value at key, the same object until the stored text changes. */
export function readStored<T>(key: string, parse: (raw: unknown) => T, empty: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return empty;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value = empty;
  try {
    if (raw !== null) value = parse(JSON.parse(raw));
  } catch {}
  cache.set(key, { raw, value });
  return value;
}

/** Store value at key, or remove the key when value is null. */
export function writeStored(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
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

export function useStored<T>(key: string, parse: (raw: unknown) => T, empty: T): T {
  return useSyncExternalStore(
    subscribe,
    () => readStored(key, parse, empty),
    () => empty,
  );
}
