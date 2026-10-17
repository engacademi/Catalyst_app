import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { TeamsView } from "@/components/views/teams";

export default function Page({ params }: PageProps<"/events/[eventId]/teams">) {
  return <Suspense fallback={<Loading />}>{params.then((p) => <TeamsView {...p} />)}</Suspense>;
}
