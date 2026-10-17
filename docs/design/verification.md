# Redesign verification — 2026-10-17

Base: `main` at `4d3df2df17ce4c889783197642fbbc7d46211cf4` (rechecked against origin before delivery).

## Results

- `npm run lint`: passed without warnings.
- `npm run build`: passed; every existing route compiled and TypeScript passed.
- `npm run test:ui`: **9 passed** in the final run (14.8 seconds).
- `git diff --check`: passed.
- Figma concepts: desktop and mobile compositions reviewed; semantic editable text/frames plus match-card instances, no flattened UI screenshot. Font families explicitly verified as Manrope and DM Sans.
- Browser screenshots: home, My Day and staff workspace reviewed; captures are in `screenshots/`. Fictional fixture data is used.

## Browser coverage

1. All nine attendee routes render without document overflow at 390, 768 and 1440px.
2. Following persists through navigation and reload; team search and result filters retain URL state.
3. The ICS export link retains followed IDs and remains labelled as a snapshot.
4. Published set scores remain visible; missing set scores display a dash.
5. Guide resource links, accessible entrance content and approved roster fields remain visible.
6. Every staff tab and announcement form remains reachable on a phone; arrow-key tab navigation works.
7. Axe reports no WCAG A/AA violations on event discovery, event home, teams, matches, guide and staff home.
8. 320px reflow and reduced-motion behavior pass.
9. All attendee routes load with no browser page errors after fixing the shared-query/Suspense hydration race.

## Issues fixed during QA

- Shared event/feed query data could arrive before a sibling suspense boundary hydrated. Data views now start with the same loading state on server and client, then display cached data.
- Staff tabs now expose panel relationships and use roving focus with Left/Right/Home/End support.
- Card padding overrides remain respected for score and roster tables.
- Guide officials' resource URLs, previously stored but not rendered, now appear as usable links.

## Limits

The suite intercepts API requests with representative responses. It verifies browser rendering, controls, links, state persistence and request parameter behavior; it does not verify real database writes, live Clerk sign-in, third-party feeds or production infrastructure. Backend code and migrations were not changed. PostgreSQL was unavailable in this execution environment. Full screen-reader/manual WCAG conformance testing has not been established.

The environment's normal Playwright binary download failed. Final browser tests used a Chromium binary distributed by `@sparticuz/chromium` in a temporary QA folder, via the optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override. This temporary package is not a production dependency. Standard local testing uses Playwright's regular Chromium install.

Superdesign's CLI was blocked by automatic approval review due to an unknown PostHog analytics payload. No bypass was attempted; Figma, Canva and original code-native SVG artwork supplied the design workflow.

## Review images

- [Home, desktop](screenshots/home-desktop.png)
- [Home, mobile](screenshots/home-mobile.png)
- [My Day, desktop](screenshots/my-day-desktop.png)
- [My Day, mobile](screenshots/my-day-mobile.png)
- [Staff workspace, mobile](screenshots/staff-mobile.png)
