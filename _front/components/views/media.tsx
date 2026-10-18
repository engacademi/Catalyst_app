"use client";
import Image from "next/image";
import { Camera, Film, Images } from "lucide-react";
import { useGuide } from "@/lib/queries";
import { Card, EmptyState, ErrorState, Loading, PageTitle } from "../ui";

export function MediaView({ eventId }: { eventId: string }) {
  const query = useGuide(eventId);
  if (query.isPending) return <Loading label="Loading event media" />;
  if (query.error) return <ErrorState error={query.error} />;
  const media = query.data.data.items.filter(
    (item) =>
      item.kind.startsWith("media_") && item.link_url?.startsWith("https://"),
  );
  return (
    <div>
      <PageTitle>Media</PageTitle>
      {media.length ? (
        <ul className="media-grid">
          {media.map((item) => {
            const Icon =
              item.kind === "media_video"
                ? Film
                : item.kind === "media_album"
                  ? Images
                  : Camera;
            return (
              <li key={item.id}>
                <Card>
                  <a
                    href={item.link_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="media-link"
                  >
                    {item.kind === "media_photo" ? (
                      <Image
                        src={item.link_url!}
                        alt={item.title}
                        width={800}
                        height={600}
                        unoptimized
                        className="media-photo"
                      />
                    ) : (
                      <div className="media-placeholder">
                        <Icon size={34} aria-hidden />
                      </div>
                    )}
                    <h2>
                      <Icon size={17} aria-hidden />
                      {item.title}
                    </h2>
                    {item.body && <p>{item.body}</p>}
                    <small>
                      {item.kind === "media_photo"
                        ? "Open photo"
                        : item.kind === "media_album"
                          ? "View album"
                          : "Watch video"}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </small>
                  </a>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No media published yet">
          Event photos, videos and albums will appear here when shared by OVA.
        </EmptyState>
      )}
    </div>
  );
}
