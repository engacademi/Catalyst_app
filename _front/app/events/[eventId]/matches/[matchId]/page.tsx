import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { MatchView } from "@/components/views/match";

export default function Page({ params }: PageProps<"/events/[eventId]/matches/[matchId]">) {
  return <Suspense fallback={<Loading />}>{params.then((p) => <MatchView {...p} />)}</Suspense>;
}
