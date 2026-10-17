"use client";
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("courtside:preferences", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("courtside:preferences", callback);
  };
}
export function usePreference<T>(
  key: string,
  fallback: T,
): [T, (value: T) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(`courtside:${key}`);
      } catch {
        return null;
      }
    },
    () => null,
  );
  let value = fallback;
  try {
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      value = (
        Array.isArray(fallback)
          ? Array.isArray(parsed)
            ? parsed.filter((v) => typeof v === "string")
            : fallback
          : parsed
      ) as T;
    }
  } catch {}
  return [
    value,
    (next) => {
      try {
        localStorage.setItem(`courtside:${key}`, JSON.stringify(next));
      } catch {}
      window.dispatchEvent(new Event("courtside:preferences"));
    },
  ];
}
export function useLocalFollows(eventId: string) {
  const [ids] = usePreference<string[]>(`follows:${eventId}`, []);
  return ids;
}
export function useEventSelections(events: { slug: string }[]) {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return JSON.stringify(
          events.map((e) => [
            e.slug,
            localStorage.getItem(`courtside:follows:${e.slug}`),
          ]),
        );
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );
  const result = new Map<string, string[]>();
  try {
    for (const [slug, ids] of JSON.parse(raw))
      result.set(slug, JSON.parse(ids ?? "[]"));
  } catch {}
  return result;
}
