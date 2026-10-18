"use client";
import Link from "next/link";
import { useAdminMutation, useAdminQuery } from "./hooks";
import { Card, ErrorState, Loading, SectionTitle } from "../ui";
export function Disputes({ eventId }: { eventId: string }) {
  const query = useAdminQuery<{
    data: {
      id: string;
      match_id: string;
      match_label: string;
      comment: string;
      status: string;
      created_at: string;
    }[];
  }>(`/v1/admin/events/${eventId}/disputes`);
  const resolve = useAdminMutation<{ id: string }>(
    "PATCH",
    (body) => `/v1/admin/disputes/${body.id}/resolve`,
  );
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  return (
    <section>
      <SectionTitle>Score disputes</SectionTitle>
      {query.data?.data.length ? (
        query.data.data.map((d) => (
          <Card key={d.id} className="mb-3">
            <Link
              href={`/events/${eventId}/matches/${d.match_id}`}
              className="underline"
            >
              Match {d.match_label}
            </Link>
            <p className="text-xs text-muted">
              {d.status} · {new Date(d.created_at).toLocaleString()}
            </p>
            <p className="my-2 whitespace-pre-wrap">
              {d.comment || "No comment provided."}
            </p>
            {d.status === "open" && (
              <button
                className="secondary-link"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: d.id })}
              >
                Mark reviewed
              </button>
            )}
          </Card>
        ))
      ) : (
        <p>No score disputes reported.</p>
      )}
      {resolve.error && <ErrorState error={resolve.error} />}
    </section>
  );
}
