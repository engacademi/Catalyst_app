import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { MatchesView } from "@/components/views/matches";

export default function Page({ params }: PageProps<"/events/[eventId]/matches">) {
  return <Suspense fallback={<Loading />}>{params.then((p) => <MatchesView {...p} />)}</Suspense>;
}
