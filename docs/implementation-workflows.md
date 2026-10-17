# Companion workflows delivered by this PR

## Features

- Entry and division following, local private labels, My Teams, team-first My Day, separate division sections, Next Match and work duties.
- Read-only AES hierarchy adapter with timestamp checks, bounded requests, source status and opt-in scheduled refresh. AES live validation is blocked by HTTP 403 in the implementation environment; representative contract tests are not proof of the current live schema.
- Separate TIMU HTML adapter, tested on actual event 3960 data; CSV fallback for schedule data and other approved exports.
- Competition path displaying source pool/playoff rounds, source match IDs and unresolved labels without an advancement engine.
- Mapped registration CSV import, exact entry mapping, coach review, staff publication and irreversible withdrawal of a version.
- Private official assignment list, staff management and bulk assignment CSV preview/commit.
- Official scoresheets, scoring guide and results-submission links in the event guide.
- Team/match pagination and older update history; division-targeted, scheduled and expiring announcements.
- Court area labels, expiring court/area delay notices, staff-attributed estimates and demo clock controls.
- Phone browser journeys, automated accessibility checks and CI using PostgreSQL 16.

## After merging

1. Railway's existing pre-deploy command runs `alembic upgrade head` and applies migration `0002`. No separate SQL scripts are needed. API/web redeployments install the updated lockfiles.
2. No new environment variables, buckets or worker services are required. Existing Clerk, database, CORS and API URL settings still apply.
3. Create a source in **Sources**, enter the AES event key or TIMU tournament ID, confirm authorization and choose automatic checking if wanted. Click **Check now** and inspect the reported counts/status. A source schema error needs a verified payload and mapping correction; do not label it working by substituting fixtures.
4. TIMU results can be connected with tournament ID `3960` and venue `Notre Dame CSS` for a permitted historical demonstration. Its results lack exact match starts; add an approved CSV schedule if needed. This does not establish OVA permission to republish.
5. Use **Registration** to upload the existing roster export, map selected public columns, explicitly map registration team IDs, preview and commit drafts. No real MRS export was supplied; this is a configurable export workflow, not a verified native MRS connector.
6. Grant the reviewer a scoped coach role in the API service shell:

   `python -m app.cli grant --subject user_... --role coach --event EVENT_SLUG --entry ENTRY_UUID`

   They review at `/admin/roster-reviews`; staff then publish from **Rosters** with the consent-review reference.
7. Grant officials with `--role official --event EVENT_SLUG`. Use **Assignments** for private management or **Imports → Private official assignments** for bulk imports.
8. Configure court areas and notices in **Courts & clock**. Demo clock controls only appear for demo events.
9. The synthetic seed includes `dev-admin`, `dev-official` and `dev-coach` for local development only. Existing seeded events can be reset with `seed --reset` **only when their synthetic data is disposable**; production Clerk role grants are separate.

## Assignment CSV

```csv
external_assignment_id,subject,external_match_id,role,reporting_time
DUTY-1,user_example,MATCH-1,First referee,2026-04-19T08:30:00-04:00
```

Match IDs resolve within the selected event/source. Subjects must already have an unexpired official role for that event. Reimporting the same assignment is idempotent; missing rows do not remove existing assignments.

## Verification and limits

Run backend tests with a disposable PostgreSQL database; the suite recreates its public schema. Run frontend lint, typecheck, build, then Playwright against the seeded API and web app. CI provisions PostgreSQL 16 and runs the same suite plus axe checks.

Automated accessibility results apply to the tested routes and states. They do not certify WCAG 2.2 AA compliance; manual keyboard, screen-reader and browser zoom checks remain part of release verification.
