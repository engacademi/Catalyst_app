import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { UpdatesView } from "@/components/views/updates";

export default function Page({ params }: PageProps<"/events/[eventId]/updates">) {
  return <Suspense fallback={<Loading />}>{params.then((p) => <UpdatesView {...p} />)}</Suspense>;
}
