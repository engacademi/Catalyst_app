import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { Loading } from "@/components/ui";
import { MatchView } from "@/components/views/match";

export default function Page({ params }: PageProps<"/events/[eventId]/matches/[matchId]">) {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const match = params.then((p) => <MatchView {...p} />);
  return (
    <Suspense fallback={<Loading />}>
      {key ? <ClerkProvider publishableKey={key}>{match}</ClerkProvider> : match}
    </Suspense>
  );
}
