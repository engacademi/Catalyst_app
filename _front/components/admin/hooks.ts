"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiAuthGet, apiSend, type Match } from "@/lib/api";
import { useAdminAuth } from "./auth";

export function useAdminQuery<T>(path: string | null) {
  const { auth, identity } = useAdminAuth();
  return useQuery({
    // The identity is part of the key so switching users never shows another user's data.
    queryKey: ["admin", identity, path],
    queryFn: () => apiAuthGet<T>(auth, path!),
    enabled: !!path,
    refetchInterval: false,
  });
}

export function useAdminMutation<TBody = unknown, TResult = unknown>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string | ((body: TBody) => string),
) {
  const { auth } = useAdminAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) =>
      apiSend<TResult>(
        auth,
        method,
        typeof path === "function" ? path(body) : path,
        method === "DELETE" ? undefined : body,
      ),
    onSuccess: () => {
      // Staff edits feed public screens too, so refresh both.
      client.invalidateQueries();
    },
  });
}

export function useAdminMatches(eventId: string) {
  const { auth, identity } = useAdminAuth();
  const query = useInfiniteQuery({
    queryKey: ["admin", identity, "assignment-matches", eventId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiAuthGet<{ data: Match[]; next_cursor: number | null }>(
        auth,
        `/v1/admin/events/${eventId}/matches?cursor=${pageParam}`,
      ),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  return {
    ...query,
    data: query.data
      ? { data: query.data.pages.flatMap((p) => p.data) }
      : undefined,
  };
}
