"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
