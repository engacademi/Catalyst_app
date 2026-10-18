"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionBanner } from "@/components/connection-banner";
import { OfflineShell } from "@/components/offline-shell";
import { startOfflineCache } from "@/lib/offline-cache";

let browserQueryClient: QueryClient | undefined;

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // Poll visible event data every 30 s; TanStack pauses in the background and
        // refetches on focus and reconnect.
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });
}

function getQueryClient() {
  if (typeof window === "undefined") return makeClient();
  browserQueryClient ??= makeClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  const client = getQueryClient();
  // Restore after hydration so the first client render matches the server's loading state.
  useEffect(() => startOfflineCache(client), [client]);
  return (
    <QueryClientProvider client={client}>
      <Suspense fallback={null}>
        <OfflineShell />
        <ConnectionBanner />
      </Suspense>
      {children}
    </QueryClientProvider>
  );
}
