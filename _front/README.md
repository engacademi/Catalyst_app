# Courtside Connected web

Next.js App Router frontend for the OVA event companion. It's a mobile-first site for attendees plus a staff workspace at `/admin`. All data comes from the FastAPI service in `../_back`; this app holds no database connection or domain logic.

## Run it locally

Start the API first (see `../_back/README.md`), then:

```sh
cd _front
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. The seeded demo event lives at `/events/demo-championships`. Without a Clerk key, `/admin` shows a dev user picker (`dev-admin`, `dev-official`, or a guest with no roles).

## API connection in deployments

Set `API_BASE_URL` to the HTTPS FastAPI origin in both Vercel Production and Preview environments, then rebuild. The existing `NEXT_PUBLIC_API_BASE_URL` setting remains supported. Vercel builds fail with a configuration error if neither is set, rather than shipping requests to a visitor's localhost.

Browsers use `/api/backend/v1/...` on the app's own origin. Next.js forwards that fixed prefix to FastAPI, including authorization headers, CSV uploads and calendar downloads. Authentication and role checks remain in FastAPI. New preview domains therefore do not need to be added to the backend CORS allowlist just to load data; Clerk's authorized-party checks still apply to signed-in requests.

Run `npm run test:transport` for browser and HTTP regression checks against a local backend without CORS headers. These verify token forwarding, denied anonymous staff requests, CSV bodies and calendar attachments. `npm run test:ui` checks the application screens using fixtures.

## Screens

| Route | What it does |
| ----- | ------------ |
| `/` | Published events |
| `/events/[eventId]` | Event home: follow prompt, announcements, venues |
| `/events/[eventId]/my-day` | Every followed team's matches in one list, next match first, overlap warnings, results, calendar download |
| `/events/[eventId]/teams` | Search by team, club or division, follow and unfollow |
| `/events/[eventId]/teams/[entryId]` | Team page with matches and the approved roster |
| `/events/[eventId]/matches` | Upcoming, in progress and results, with venue, court, division and my-teams filters kept in the URL |
| `/events/[eventId]/matches/[matchId]` | Match detail, set scores, change history and source |
| `/events/[eventId]/guide` | Venues, accessible entrances, parking, food, help, officials' briefing, merchandise, 50/50 and sponsors |
| `/events/[eventId]/updates` | Event notices and changes to followed teams, filtered on the device |
| `/admin` | Staff events list and new event form |
| `/admin/events/[eventId]` | Announcements, CSV imports with preview and commit, venue and guide content, partner cards, roster publishing, source status, demo change simulator, audit log |
| `/admin/assignments` | An official's own assignments |

Follows are stored in `localStorage` under the event, so guests never need an account. Event data polls every 30 seconds while the tab is visible and refetches on focus and reconnect.

## Stack

Next.js 16 with Cache Components, React 19, Tailwind CSS 4, TanStack Query 5, React Hook Form with Zod, Lucide icons and Clerk. Run `npm run lint`, `npx tsc --noEmit` and `npm run build` before pushing.
