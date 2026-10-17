# Mobile user flow: implementation and setup

## Implemented

- Shared mobile navigation: Discover, My Schedule, Tournaments, My Profile; raised dock with safe-area padding, desktop navigation, “By OVA” in top and bottom branding.
- Discover: immediate tournament search; saved events/followed teams first with next published match; Toronto default, consent-based near-me within 100 km, denied/unavailable-location fallback; interest/attendance-based recommendations; popular competitions by published team count; all events.
- My Schedule: saved tournaments plus followed team/division matches across events; default three-day calendar, full week, list mode, period navigation, start-date picker, per-tournament visibility persisted locally, unscheduled section and source freshness. All API pages are fetched; no first-100-matches limit.
- Tournaments: search title/venue, indoor/beach and date filters; overview, live/upcoming carousels, team search, division following, roster pages, court/venue filters, server-side match search, brackets, guide/maps/parking/food/accessibility, source freshness. Existing event links remain valid.
- Profile: guest-first login/register with Clerk when configured, account/security/session controls and deletion through Clerk, interests, saved events, attendance, notifications with unread counts, staff/official/coach workflow links. All public browsing remains open.
- Staff: existing announcements, delay notices, court labels, clock, sources, import preview/commit, assignments, rosters, guide and sponsor tools remain. Added event title/type/date editing, venue/address/map/coordinate editing, and revision-checked editing of imported match time/court/status/round/participants/bracket placeholders with change feed and audit entries.

## Deployment sequence

1. Deploy backend first. Run `cd _back && uv run alembic upgrade head` with the target Railway database. Migration `0003` adds nullable venue city/latitude/longitude; it also gives only the synthetic demo sample Toronto coordinates. Existing real events are not geocoded automatically.
2. Railway's existing `_back/railway.json` already runs `alembic upgrade head` before deployment. Confirm the service root remains `_back` and uses that configuration. Do not seed/reset real event data to apply this change.
3. Deploy the frontend with `_front` as its root. Keep the existing `API_BASE_URL` Railway HTTPS origin in every Vercel environment that should reach the API. No new map, geocoding, or recommendation API key is required.
4. In Staff → event → Content → venue → Edit venue & discovery location, enter verified latitude and longitude together, address, city and map URL. Nearby search excludes venues with missing coordinates; their event cards still appear in the full list. Use verified venue coordinates for real events, not the demo's city-centre samples.

## Connections and content needed

| Feature | Required connection/setup | Current boundary |
| --- | --- | --- |
| Optional attendee login/register | Vercel `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; Clerk production application/domain; enable desired signup methods. Existing middleware now also covers `/profile`. | Guest browsing works without Clerk. Account controls are provided by Clerk. |
| Staff authentication | Railway `AUTH_MODE=clerk`, `AUTH_ISSUER`, `CLERK_JWKS_URL`, `CLERK_AUTHORIZED_PARTIES` matching deployment origins; existing database connection. | New registrations never grant staff access. Do not enable dev auth in production. |
| Event permissions | An administrator grants scoped roles with `uv run python -m app.cli grant --subject user_... --role staff --event event-slug`. Use `--role official` for assignments; coach grants additionally require the team's `--entry` UUID. | No public self-promotion or role-grant interface. Clerk identity management is separate from application event grants. |
| Full OVA season catalogue | An authorized OVA calendar/export/feed covering indoor, beach, age groups and dates. Publish/import its events through approved staff workflows. | Only connected, published events are listed. The official OVA website is linked for unconnected events. A complete season feed has not been supplied or integrated. |
| Live matches/results/brackets | Approved AES event key/feed or vendor exports through Sources/Imports; configure scheduled refresh using existing sync tooling. TIMU/MyTeam need approved feeds or exports. | The UI polls published app data every 30 seconds; it does not invent live status or live points. API polling is separate from upstream ingestion. |
| Staff schedule/bracket changes | For manual-import/demo sources use Matches & brackets. For connected sources change the official platform, then refresh. | No upstream write-back and no bracket generator. Later imports of the same match may replace local imported-data edits; keep the export authoritative. |
| Maps, parking, food and accessibility | Staff-maintained venue map URL/address and guide items. An approved court map is needed for actual hall/court directions. | Existing guide renders supplied content; no paid mapping SDK needed. |
| Near-me | HTTPS plus browser geolocation permission and verified public venue coordinates. | Toronto fallback; no attendee location storage or backend transmission. |
| Personalized discovery | User-selected interests, local saved/followed events, manually marked attendance. | No demographics inferred; no external ML service. Popularity uses team count. |
| Notifications | Existing change feeds and persisted last-seen IDs. | In-app only; push/email/SMS delivery needs separate opt-in and delivery integrations. |
| Cross-device personal data | Future authenticated preferences/follow API and guest-to-account merge. | Current saves/follows/interests/attendance remain on the browser even after login; this is explicitly disclosed in Profile. |

Existing environment variable names are documented in `_front/.env.example`, `_back/.env.example` and `docs/deployment.md`. Apply environment changes to previews separately from production. No new secret is introduced by this work.

## Validation

Run frontend lint, typecheck and build; `npm run test:ui` for fixtures and responsive/accessibility journeys; API tests require a disposable PostgreSQL database via `TEST_DATABASE_URL`. Never run the destructive test fixture against a production database. The repository CI provisions an isolated PostgreSQL service.

Validation completed locally: frontend lint/typecheck/production build; 17-test existing/new browser suite plus the additional notification-read regression (18 distinct checks); responsive views at 320/390/768/1440 px; automated axe checks; six existing API unit tests; new coordinate/match schema checks; Python compilation and migration SQL generation through `0003`. The new PostgreSQL integration regressions are included in `_back/tests/test_mobile_flow.py` but were not executed locally because no disposable PostgreSQL server is available. No production database migration or deployment has been performed.

## October 17 visual and calendar refinement

The follow-up update reduces header/section copy, hides empty saved-event sections, places location controls under Nearby, and moves Visibility beside Today. Branding uses the full Ontario Volleyball Association subtitle. Card/navigation surfaces use restrained shadow/transparency; entrance fades and toggle transitions respect reduced motion. The event overview uses compact attendance and team-label controls; legacy routes remain usable.

My Schedule now uses an hourly, start-positioned calendar with separate lanes for overlaps. Its one-hour display slots are not confirmed match durations. Dense blocks use initials while retaining full accessible match names and links. The optional signed-in home greeting reuses the existing Clerk key and root-route middleware; no new configuration or database migration is needed for these refinements. Guest flows and browser-local preferences are unchanged.
