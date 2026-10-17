import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { EventHomeView } from "@/components/views/event-home";

export default function Page({ params }: PageProps<"/events/[eventId]">) {
  return <Suspense fallback={<Loading />}>{params.then((p) => <EventHomeView {...p} />)}</Suspense>;
}
