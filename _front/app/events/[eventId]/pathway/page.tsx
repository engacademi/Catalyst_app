import { Suspense } from "react";
import { PathwayView } from "@/components/views/pathway";
import { Loading } from "@/components/ui";
export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <Suspense fallback={<Loading />}><PathwayView eventId={eventId} /></Suspense>;
}
