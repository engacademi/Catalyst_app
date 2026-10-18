"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { CloudOff, WifiLow } from "lucide-react";
import {
  isConnectionError,
  isRestored,
  isSavedOffline,
} from "@/lib/offline-cache";

type Status = {
  mode: "online" | "offline" | "weak" | "saved";
  savedAt: number | null;
};

const ONLINE = JSON.stringify({ mode: "online", savedAt: null });

function savedLabel(at: number) {
  const date = new Date(at);
  const time = date.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}, ${time}`;
}

/** Says when the page shows saved data rather than a live answer from the API. */
export function ConnectionBanner() {
  const client = useQueryClient();
  const path = usePathname();
  const subscribe = useCallback(
    (cb: () => void) => {
      const offQueries = client.getQueryCache().subscribe(cb);
      const offOnline = onlineManager.subscribe(cb);
      return () => {
        offQueries();
        offOnline();
      };
    },
    [client],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      // Only public queries on screen count; staff and account requests stay out of it.
      const shown = client
        .getQueryCache()
        .getAll()
        .filter(
          (q) => isSavedOffline(q.queryKey) && q.getObserversCount() > 0,
        );
      const failing = shown.some((q) => {
        const error = q.state.fetchFailureReason ?? q.state.error;
        return (
          (q.state.fetchFailureCount > 0 || q.state.status === "error") &&
          isConnectionError(error)
        );
      });
      const offline = !onlineManager.isOnline();
      const saved = shown.filter(
        (q) =>
          q.state.data !== undefined &&
          (offline ||
            failing ||
            (isRestored(q) && q.state.fetchStatus === "fetching")),
      );
      const mode: Status["mode"] = offline
        ? "offline"
        : failing
          ? "weak"
          : saved.length
            ? "saved"
            : "online";
      if (mode === "online") return ONLINE;
      const savedAt = saved.length
        ? Math.min(...saved.map((q) => q.state.dataUpdatedAt))
        : null;
      return JSON.stringify({ mode, savedAt });
    },
    () => ONLINE,
  );
  const { mode, savedAt } = JSON.parse(snapshot) as Status;
  if (mode === "online" || path.startsWith("/admin")) return null;
  const subject = path.endsWith("/guide") ? "venue guide" : "schedule";
  const saved = savedAt
    ? `showing ${subject} saved at ${savedLabel(savedAt)}`
    : null;
  const text =
    mode === "offline"
      ? saved
        ? `Offline — ${saved} · times and scores may have changed`
        : "Offline — nothing saved for this page yet · it will load when you reconnect"
      : mode === "weak"
        ? saved
          ? `Weak connection — ${saved} · retrying…`
          : "Weak connection — retrying…"
        : `Updating — ${saved}`;
  const Icon = mode === "offline" ? CloudOff : WifiLow;
  return (
    <p
      role="status"
      className={`connection-banner connection-banner--${mode}`}
      data-mode={mode}
    >
      <Icon aria-hidden size={16} />
      <span>{text}</span>
    </p>
  );
}
