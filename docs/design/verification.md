# Redesign verification — 2026-10-17

Initial base: `4d3df2df17ce4c889783197642fbbc7d46211cf4`. Integrated main at `12f6cbca6cc7c099d08d89cc41d8fd9652a8f76b` after new companion workflows merged during publication.

## Results

- `npm run lint`: passed without warnings.
- `npm run build`: passed; every existing route compiled and TypeScript passed.
- `npm run test:ui`: **10 passed** in the final merged run (18.3 seconds).
- Backend source unit checks: `uv run pytest tests_unit -q` — **6 passed**.
- `git diff --check`: passed.
- Figma concepts: desktop and mobile compositions reviewed; semantic editable text/frames plus match-card instances, no flattened UI screenshot. Font families explicitly verified as Manrope and DM Sans.
- Browser screenshots: home, My Day and staff workspace reviewed; captures are in `screenshots/`. Fictional fixture data is used.

## Browser coverage

1. All eleven attendee routes render without document overflow at 390, 768 and 1440px.
2. Following persists through navigation and reload; team search and result filters retain URL state.
3. The ICS export link retains followed IDs and remains labelled as a snapshot.
4. Published set scores remain visible; missing set scores display a dash.
5. Guide resource links, accessible entrance content and approved roster fields remain visible.
6. All ten staff tabs and announcement form remains reachable on a phone; arrow-key tab navigation works.
7. Axe reports no WCAG A/AA violations on event discovery, event home, teams, matches, guide and staff home.
8. 320px reflow and reduced-motion behavior pass.
9. All attendee routes load with no browser page errors after fixing the shared-query/Suspense hydration race.

10. Merged workflows: division follows, private labels, collapsible division schedules, competition paths and staff estimate notices remain usable.

## Issues fixed during QA

- Shared event/feed query data could arrive before a sibling suspense boundary hydrated. Data views now start with the same loading state on server and client, then display cached data.
- Staff tabs now expose panel relationships and use roving focus with Left/Right/Home/End support.
- Card padding overrides remain respected for score and roster tables.
- Guide officials’ resource links from the merged workflows remain displayed.

## Limits

The suite intercepts API requests with representative responses. It verifies browser rendering, controls, links, state persistence and request parameter behavior; it does not verify real database writes, live Clerk sign-in, third-party feeds or production infrastructure. This redesign adds no backend code or migration beyond the newly merged main workflows. PostgreSQL was unavailable in this execution environment. Full screen-reader/manual WCAG conformance testing has not been established.

The environment's normal Playwright binary download failed. Final browser tests used a Chromium binary distributed by `@sparticuz/chromium` in a temporary QA folder, via the optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override. This temporary package is not a production dependency. Standard local testing uses Playwright's regular Chromium install.

Superdesign's CLI was blocked by automatic approval review due to an unknown PostHog analytics payload. No bypass was attempted; Figma, Canva and original code-native SVG artwork supplied the design workflow.

## Review images

- [Home, desktop](screenshots/home-desktop.png)
- [Home, mobile](screenshots/home-mobile.png)
- [My Day, desktop](screenshots/my-day-desktop.png)
- [My Day, mobile](screenshots/my-day-mobile.png)
- [Staff workspace, mobile](screenshots/staff-mobile.png)
