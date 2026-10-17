import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { TeamView } from "@/components/views/team";

export default function Page({ params }: PageProps<"/events/[eventId]/teams/[entryId]">) {
  return <Suspense fallback={<Loading />}>{params.then((p) => <TeamView {...p} />)}</Suspense>;
}
