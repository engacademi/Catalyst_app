"use client";

import { useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export function Loading({ label = "Loading" }: { label?: string }) {
  const online = useSyncExternalStore(
    onlineManager.subscribe,
    () => onlineManager.isOnline(),
    () => true,
  );
  if (!online)
    return (
      <div
        role="status"
        className="loading-state my-4 rounded-xl border border-border bg-surface p-4 text-sm"
      >
        <h2 className="font-semibold">You&apos;re offline</h2>
        <p className="mt-1 text-muted">
          This content hasn&apos;t been saved on this device yet. It will load
          when you reconnect.
        </p>
      </div>
    );
  return (
    <p
      role="status"
      className="loading-state flex items-center gap-3 text-sm text-muted"
    >
      <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> {label}…
    </p>
  );
}
