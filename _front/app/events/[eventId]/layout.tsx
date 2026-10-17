import { Suspense } from "react";
import { EventShell } from "@/components/event-shell";
import { Loading } from "@/components/ui";

export default function EventLayout({ children, params }: LayoutProps<"/events/[eventId]">) {
  return (
    <Suspense fallback={<Loading label="Loading event" />}>
      {params.then(({ eventId }) => (
        <EventShell eventId={eventId}>{children}</EventShell>
      ))}
    </Suspense>
  );
}
