"use client";
import Link from "next/link";
import { useNotificationCounts } from "@/components/platform-shell";
export default function Updates() {
  const notifications = useNotificationCounts().filter(
    ({ count, error }) => count > 0 || error,
  );
  return (
    <main id="main" className="platform-main">
      <div className="discovery-heading">
        <h1>Updates</h1>
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
      {!notifications.length && <p>You’re all caught up.</p>}
      <Link href="/" className="secondary-link mt-5">
        Back to Discover
      </Link>
    </main>
  );
}
