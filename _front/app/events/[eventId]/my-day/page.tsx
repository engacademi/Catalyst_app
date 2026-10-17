import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { MyDayView } from "@/components/views/my-day";

export default function Page({ params }: PageProps<"/events/[eventId]/my-day">) {
  return <Suspense fallback={<Loading />}>{params.then((p) => <MyDayView {...p} />)}</Suspense>;
}
