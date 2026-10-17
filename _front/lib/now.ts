"use client";

import { useSyncExternalStore } from "react";

let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => {
    now = Date.now();
    listeners.forEach((l) => l());
  }, 60_000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** The current time, refreshed every minute, safe to read during render. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => 0,
  );
}
