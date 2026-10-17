"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEvents } from "@/lib/queries";
import { formatDateRange } from "@/lib/format";
import { Badge, EmptyState, ErrorState, Loading } from "@/components/ui";

export default function Home() {
  const events = useEvents();
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex items-center gap-4">
        <Image src="/brand/ova-logo.png" alt="Ontario Volleyball" width={54} height={76} priority />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Courtside Connected</h1>
          <p className="text-sm text-muted">Your teams, your next match, your event, in one place.</p>
        </div>
      </div>

      <h2 className="mb-2 mt-8 text-base font-semibold">Events</h2>
      {events.isPending ? (
        <Loading label="Loading events" />
      ) : events.error ? (
        <ErrorState error={events.error} />
      ) : events.data.data.length === 0 ? (
        <EmptyState title="No events published yet" />
      ) : (
        <ul className="space-y-2">
          {events.data.data.map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.slug}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 hover:border-brand"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-sm text-muted">
                    {formatDateRange(e.start_date, e.end_date)} · {e.venues.join(", ")}
                  </p>
                  {e.is_demo && (
                    <span className="mt-1 inline-block">
                      <Badge tone="warn">Demo data</Badge>
                    </span>
                  )}
                </div>
                <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-xs text-muted">
        OVA staff: <Link href="/admin" className="underline">open the staff workspace</Link>.
      </p>
    </main>
  );
}
