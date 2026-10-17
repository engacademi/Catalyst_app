# Account roles, discovery and event access

Status: Accepted for PR #22.

## Account identity and event permissions

Registration offers Spectator, Player, and Officer (Coach or Referee). Clerk still handles identity, passwords, sessions and deletion. The selected role is carried to the profile after signup and saved through `/v1/me/profile`. New accounts have no editing grants. Player and spectator preferences grant the same public browsing access. Players can select a published tournament team; this is a self-selected association and never edits a roster.

Account preferences live in `account_profiles`; following lives in `account_follows`. A player must explicitly enable discoverability. Authenticated accounts can find those players by display name and follow/unfollow them. Only the player can read their full followers list. No email, contact details, birthdate, roster photo or Clerk subject is returned by the player directory. Disabling discoverability removes incoming follows. Disabling an account removes it from results. Existing saved tournaments, team follows and notification read state remain browser preferences, and are rendered as profile lists.

OVA administrators manage event-scoped staff, coach and referee grants through the Event access tab. Coaches require a team belonging to that event. Only administrators in the event's organization can grant/revoke. Self-selected Officer preferences never create grants. Staff, coaches and referees can edit public event information explicitly granted to them; unrelated events stay inaccessible. Assignment administration/imports remain staff/admin-only; officials retain the private My assignments screen. Each write checks the current grants in the API, including expiry, and records an audit entry. Admin bootstrap remains `python -m app.cli grant --subject <clerk-user-id> --role admin`.

## Staff workspace

Event tools cover title/dates/type/publication; CSV staging and commit; manual match start, court, bracket participants/placeholders, stage, status and set scores; announcements; private draft guide editing; venue maps/address/accessibility/location; court creation/labels/areas and delays; partner editing/visibility/order; roster publication/review/withdrawal; registration, assignments, source connections and audit history. Revision checks protect event, match, announcement, partner and guide edits. Connected competition platforms remain authoritative: edits to their official matches must be made upstream and refreshed. This release displays and edits bracket slots; it does not generate tournament brackets automatically.

## Origin mismatch

The reported portal error was `Token issued for another origin`. Railway's `CLERK_AUTHORIZED_PARTIES` and `PUBLIC_WEB_URL` were set to the canonical controlled frontend `https://catalyst-five-gamma.vercel.app`, and the existing production build was redeployed. Code also adds the exact configured canonical origin to the explicit allowlist, normalizing a trailing slash. JWT signature, issuer, expiry and authorized-party validation remain mandatory. Every approved preview URL must be added explicitly to `CLERK_AUTHORIZED_PARTIES` and `CORS_ALLOWED_ORIGINS`; arbitrary `*.vercel.app` origins and client-provided Origin headers are never trusted. Vercel deployment listing returned 403 for the connected account, so preview-domain validation could not be performed.

## Discovery and motion

Location requests browser permission on entry and falls back to Toronto. Users can select a city from the location menu. Coordinates stay in the tab. Search uses a bounded public `/v1/search` endpoint across published tournaments, teams/clubs and venue names/cities/addresses, with escaped search text and navigable suggestions. Every listed venue has its own Google Maps directions link.

Sponsors are sourced from active sponsor partner records on published events, deduplicated by name. The animated ribbon pauses for hover/focus; duplicated visuals are hidden from assistive technology. Volleyball particles are decorative and noninteractive. Reduced-motion preferences disable continuous motion. Customizable native select popovers use the site branding where supported; other browsers retain styled, accessible native select controls.

## Deployment and testing fixtures

Migration `0004` creates the two account tables. Railway's pre-deploy commands run `alembic upgrade head`, then `python -m app.cli seed-testing`. The seed adds exactly two synthetic tournaments only when their slugs do not already exist: Lakeside Beach Open with completed past matches, and Autumn Invitational with completed, simulated live, and future matches. It never resets the original event or existing tournaments. Fixture dates/statuses are a snapshot taken at first insertion, not an external live feed. Fictional sponsors and test venues are explicitly identified in data. Production data insertion occurs when this PR's backend is deployed; the earlier auth-only redeploy does not contain these code changes.

The frontend needs `API_BASE_URL` (or the supported `NEXT_PUBLIC_API_BASE_URL` fallback) and Clerk's publishable key; the backend needs its existing database URL, Clerk issuer/JWKS configuration, canonical frontend URL, authorized-party list and CORS origins. No geocoding, maps API key or sponsor service is required. Real tournament schedules/rosters still require OVA-approved source access and consent review.

## Validation

Frontend lint, TypeScript and production build pass; 27 mobile/browser checks pass, including accessibility and the new discovery flows. All 54 backend/unit contract checks pass against disposable PGlite. New contract checks exercise search, idempotent fixtures, profile/follower privacy, self-escalation denial, scoped grants/revocation, draft-content revision conflicts, courts and scores. Contract database checks use disposable PGlite with autocommit and prepared statements disabled for its socket multiplexer; they do not verify production PostgreSQL transaction isolation or concurrent write behavior. Run the committed API suite against disposable PostgreSQL before production release. Clerk's real signed-in flow requires an account session; no user credentials were supplied or read during implementation.

## Follow-up production setup

The deployment now explicitly runs `alembic upgrade head` followed by `python -m app.cli seed-testing` in the existing Railway API service. This inserts two test tournaments without resetting existing data. The UI follow-up moves saved-card hearts to the whole card’s top-right corner, gives carousels enough padding for rounded shadows, aligns select text consistently, removes direction-link arrow glyphs, and doubles decorative volleyball opacity from 0.065 to 0.13. Three background balls become five (the 50% increase rounds up to a whole ball).
