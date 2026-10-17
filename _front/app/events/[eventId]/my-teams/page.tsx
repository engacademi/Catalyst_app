import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { MyTeamsView } from "@/components/views/my-teams";

export default function Page({ params }: PageProps<"/events/[eventId]/my-teams">) {
  return <Suspense fallback={<Loading />}>{params.then((p) => <MyTeamsView {...p} />)}</Suspense>;
}
