# 0018 — Offline fallback for venue Wi-Fi

2026-10-18

R-27 asks for the guide and last-loaded schedule to stay readable on a weak venue connection, labelled with the time they were saved. Reloading the deployed guide offline used to fail with the browser's ERR_INTERNET_DISCONNECTED page.

A hand-written service worker (`_front/public/sw.js`, registered only in production builds) keeps visited public pages network-first with a 4 s timeout, and keeps hashed `/_next/static` assets and images cache-first. Each page load and client-side navigation tells the worker its URL and the assets it used, because the first page loads before the worker exists and client navigations fetch RSC payloads rather than HTML. Pages that render account state (`/`, `/profile`, `/admin`, `/officials`, sign-in) are never stored; an uncached page offline gets a short offline notice. We chose this over Serwist or `experimental.useOffline` to avoid a build plugin and to keep hard-navigation fallback to cached HTML.

The worker never touches `/api/` traffic, so the same-origin rewrite (ADR 0006), Clerk headers and staff requests are unchanged. Public event data is saved by the app instead: successful React Query responses for an allowlist of public keys (event, matches, my-day, saved schedule, guide, announcements, changes, teams, entries, pathway) are written to `localStorage`, trimmed to 80 entries and 7 days. Admin and account queries are not on the list.

Saved data is used only when the browser is offline or a request fails with a network or 5xx error. Online loads never render it, so server and client markup still match during hydration. Whenever saved data is on screen the app shows "Offline — showing schedule saved at <time>" (or "Weak connection — … retrying"), so cached data is never presented as live. Views keep showing data when a later refetch fails instead of replacing it with an error.
