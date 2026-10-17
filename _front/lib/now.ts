"use client";

import { useSyncExternalStore } from "react";
import { useEvent } from "./queries";

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

/**
 * The event's current time. While demo time is on it runs from the event's demo time
 * instead of the device clock; otherwise it is the device clock.
 */
export function useEventNow(eventId: string): { now: number; demoTime: boolean } {
  const device = useNow();
  const { data, dataUpdatedAt } = useEvent(eventId);
  const event = data?.data;
  if (!event?.demo_time || !device) return { now: device, demoTime: false };
  return { now: device + (Date.parse(event.now) - dataUpdatedAt), demoTime: true };
}
