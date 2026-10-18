import { MediaView } from "@/components/views/media";
export default async function MediaPage({
  params,
}: PageProps<"/events/[eventId]/media">) {
  const { eventId } = await params;
  return <MediaView eventId={eventId} />;
}
