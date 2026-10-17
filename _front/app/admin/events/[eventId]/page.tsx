import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { AdminEvent } from "@/components/admin/admin-event";

export default function Page({ params }: PageProps<"/admin/events/[eventId]">) {
  return <Suspense fallback={<Loading />}>{params.then((p) => <AdminEvent {...p} />)}</Suspense>;
}
