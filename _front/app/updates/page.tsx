"use client";
import Link from "next/link";
import { useNotificationCounts } from "@/components/platform-shell";
export default function Updates() {
  const notifications = useNotificationCounts();
  return (
    <main id="main" className="platform-main">
      <div className="discovery-heading">
        <h1>Updates</h1>
        <p>Changes from your saved tournaments and followed teams.</p>
      </div>
      <ul className="profile-links">
        {notifications.map(({ event, count, error }) => (
          <li key={event.id}>
            <Link href={`/events/${event.slug}/updates`}>
              <span>{event.title}</span>
              <span>{error ? "Feed unavailable" : `${count} unread`} →</span>
            </Link>
          </li>
        ))}
      </ul>
      {!notifications.length && (
        <p>Save a tournament to bring its updates here.</p>
      )}
      <Link href="/" className="secondary-link mt-5">
        Back to Discover
      </Link>
    </main>
  );
}
