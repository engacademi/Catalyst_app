import { Suspense } from "react";
import { MyTeamsView } from "@/components/views/my-teams";
import { Loading } from "@/components/ui";
export default async function Page({params}:{params:Promise<{eventId:string}>}) { const {eventId}=await params;return <Suspense fallback={<Loading/>}><MyTeamsView eventId={eventId}/></Suspense>; }
