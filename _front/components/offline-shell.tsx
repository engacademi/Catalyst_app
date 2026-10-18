"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function register() {
  return navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then(() => navigator.serviceWorker.ready);
}

/** Registers public/sw.js and asks it to keep each visited page for offline reloads. */
export function OfflineShell() {
  const path = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator))
      return;
    let cancelled = false;
    register()
      .then((registration) => {
        if (cancelled || !registration.active) return;
        const assets = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => name.startsWith(`${location.origin}/_next/static/`));
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          document.documentElement.dataset.offlineSaved = location.pathname;
        };
        registration.active.postMessage(
          { type: "save-page", url: location.href, assets },
          [channel.port2],
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path, search]);
  return null;
}
