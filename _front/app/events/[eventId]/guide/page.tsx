import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { GuideView } from "@/components/views/guide";

export default function Page({ params }: PageProps<"/events/[eventId]/guide">) {
  return <Suspense fallback={<Loading />}>{params.then((p) => <GuideView {...p} />)}</Suspense>;
}
