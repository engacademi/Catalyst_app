"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiAuthGet, apiSend } from "@/lib/api";
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
      apiSend<TResult>(auth, method, typeof path === "function" ? path(body) : path, method === "DELETE" ? undefined : body),
    onSuccess: () => {
      // Staff edits feed public screens too, so refresh both.
      client.invalidateQueries();
    },
  });
}
