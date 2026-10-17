"use client";

import { useCallback, useSyncExternalStore } from "react";

// Private team labels ("Maya's team") live on this device next to guest follows and are
// never sent to the API. Keyed by canonical entry id, one map per event.
const KEY = (eventId: string) => `courtside:labels:${eventId}`;
const MAX_LENGTH = 40;
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; labels: Labels }>();
const EMPTY: Labels = {};

export type Labels = Readonly<Record<string, string>>;

function read(eventId: string): Labels {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY(eventId));
  } catch {
    return EMPTY;
  }
  const hit = cache.get(eventId);
  if (hit && hit.raw === raw) return hit.labels;
  const labels: Record<string, string> = {};
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [id, value] of Object.entries(parsed)) {
        if (typeof value === "string" && value.trim()) labels[id] = value;
      }
    }
  } catch {}
  cache.set(eventId, { raw, labels });
  return labels;
}

function write(eventId: string, labels: Labels) {
  try {
    if (Object.keys(labels).length) window.localStorage.setItem(KEY(eventId), JSON.stringify(labels));
    else window.localStorage.removeItem(KEY(eventId));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key?.startsWith("courtside:labels:") && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function cleanLabel(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH);
}

export const LABEL_MAX_LENGTH = MAX_LENGTH;

export function useLabels(eventId: string) {
  const labels = useSyncExternalStore(
    subscribe,
    () => read(eventId),
    () => EMPTY,
  );
  // An empty label removes it, so editing to blank and "Remove" behave the same.
  const setLabel = useCallback(
    (entryId: string, text: string) => {
      const next: Record<string, string> = { ...read(eventId) };
      const clean = cleanLabel(text);
      if (clean) next[entryId] = clean;
      else delete next[entryId];
      write(eventId, next);
    },
    [eventId],
  );
  const removeLabel = useCallback((entryId: string) => setLabel(entryId, ""), [setLabel]);
  return { labels, labelFor: (entryId: string | null | undefined) => (entryId ? labels[entryId] : undefined), setLabel, removeLabel };
}
