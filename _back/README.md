# Courtside Connected API

FastAPI, SQLAlchemy 2 and PostgreSQL backend for the OVA event companion. It follows `docs/requirements/OVA_MVP_Technical_Implementation.md`: competition platforms stay in charge of schedules and results, and this service stores a normalized copy with provenance, staff content, and a public change feed.

## Run it locally

You need Python 3.12 (`uv` installs it) and a PostgreSQL database.

```sh
cd _back
cp .env.example .env              # point DATABASE_URL at your database
uv sync
uv run alembic upgrade head
uv run python -m app.cli seed     # synthetic demo event, loaded through the CSV importer
uv run uvicorn app.main:app --reload
```

Open http://localhost:8000/docs for the OpenAPI explorer. With `AUTH_MODE=dev`, staff calls take an `X-Dev-User` header. The seed creates `dev-admin` (organization admin) and `dev-official` (an official with two assignments). The API refuses to start in dev auth mode unless `APP_ENV` is `development` or `test`.

Tests run against a real PostgreSQL database, which the suite drops and recreates:

```sh
TEST_DATABASE_URL=postgresql+psycopg://postgres@localhost:5432/courtside_test uv run pytest
```

## Layout

| Path | Contents |
| ---- | -------- |
| `app/main.py` | App, CORS, request IDs, health checks |
| `app/core/` | Settings, database session, Clerk token checks and role grants, ETag responses |
| `app/models.py` | Tables: events, venues, courts, divisions, entries, sources, mappings, matches, sets, announcements, guide items, partner cards, roster publications, assignments, change events, import batches, audit |
| `app/adapters/` | Source adapter protocol and the CSV interchange parser |
| `app/modules/imports.py` | Stage, preview and commit imports |
| `app/modules/matches.py` | Match queries, revisions and change events |
| `app/modules/my_day.py` | Itinerary, next match and overlap warnings across followed teams |
| `app/modules/calendar.py` | ICS snapshot export |
| `app/api/public.py` | Public reads under `/v1` |
| `app/api/admin.py` | Staff workspace under `/v1/admin` |
| `app/api/me.py` | Signed-in user's own data (official assignments) |
| `app/cli.py` | `seed`, `seed-testing`, the `demo-*` demo transitions, `grant`, `aes-load`, `aes-discover`, `myteam-load`, `timu-load` and `geocode-venues` commands |
| `sample_data/` | Example CSVs and the column reference |

## How data gets in

Staff upload a CSV for a source (entries, then matches, then rosters). The API checks every row and returns a preview of adds, changes, unchanged rows and errors. Nothing changes until staff commit. Commit runs in one transaction and refuses a preview that is out of date because another import landed first. Each committed change to a match's time, court, status, result or teams raises the match revision and writes one change event; replaying the same file writes none. A row missing from a file never cancels a match.

Rosters are published only with a consent review reference. Player photos appear only when the row marks them approved; otherwise the importer drops the URL before it reaches the database.

AES JSON, TIMU HTML and MyTeam.click JSON adapters emit the same normalized rows as CSV imports and use the shared refresh/polling pipeline. Automatic polling requires both `authorized` and `auto_sync` in source configuration; `aes-load` performs an explicit refresh but does not enable automatic polling.

To load a real event from AES, run `uv run python -m app.cli aes-load <event_key>` with the key from the AES event URL. It creates the event from AES (title, dates, venue from the event location, America/Toronto), adds an AES source with that `event_key` and `auto_sync` on, syncs pool play into teams and matches. The event keeps AES's real dates and times. The AES key identifies subsequent refreshes even if the upstream title changes. A title/slug collision with another source is refused; connect the source explicitly through the staff workspace instead. Existing staff content and venue coordinates are preserved. Tests use the recorded Event 2 responses in `sample_data/aes_event2/` and never call AES.

`uv run python -m app.cli aes-discover --year 2026` finds the events for you. It searches the public AES event listing for names containing "Ontario Championships", past and upcoming, and runs `aes-load` on each result's key. Re-running it refreshes the same events and adds any new ones AES has listed since. Without `--year` it loads every year AES lists. If one event fails to load, the command reports it, carries on with the rest, and exits non-zero. Tests use the recorded search in `sample_data/aes_search/`. Loading the four 2026 events from AES took about a minute.

To load OVA's upcoming beach events, run `uv run python -m app.cli myteam-load`. It reads the active OVA season from MyTeam.click's public JSON and creates or refreshes one beach event, in America/Toronto with its real date and venue, for each event dated today or later. It skips cancelled events. Each event gets a MyTeam.click source keyed by the event id, with `auto_sync` on. Until the draw is published, an event shows only its divisions and accepted teams. After that, polling brings in matches with courts, teams, scores and work teams. MyTeam.click doesn't publish clock times for OVA matches, so those matches have no scheduled start. Running the command again updates the same events. Tests use the recorded responses in `sample_data/myteam/` and never call MyTeam.click.

To load upcoming OVA indoor tournaments from TIMU, run `uv run python -m app.cli timu-load`. It reads the tournament list at timu.ca/ova and, for each tournament dated today or later, creates or refreshes one event (title, date, venue and address, America/Toronto) with a TIMU source keyed by its tournament id and `auto_sync` on, then syncs teams and matches. Pass `--tid 4190` to load one tournament. Running it again changes nothing unless TIMU changed. A match takes its start time from the schedule grid; TIMU shows only the first wave's time before the day and `**` for later rounds, so those matches stay "awaiting schedule" until TIMU publishes a time. Playoff slots such as `W7` stay placeholders. Tests use the trimmed pages in `sample_data/timu/` and never call TIMU.

Discover's "Near Toronto" list needs venue coordinates. Each loader looks up its event's venues on OpenStreetMap Nominatim when they have none, using the address and then the name, and stores the latitude, longitude and, if missing, the city. Lookups wait one second between requests, as Nominatim's usage policy asks. A failed lookup leaves the venue as it was and the load carries on. To fill in venues loaded before this, run `uv run python -m app.cli geocode-venues`; it only looks up venues that still have no coordinates, so running it again sends no requests. Tests use the recorded responses in `sample_data/geocode/` and never call Nominatim.

## Main endpoints

Public, no token needed:

- `GET /v1/events` and `GET /v1/events/{id or slug}`
- `GET /v1/events/{id}/teams?q=` searches team, club, division name and code
- `GET /v1/events/{id}/matches?status=upcoming|in_progress|results&entry_ids=&court_id=&venue_id=&division_id=&date=`
- `GET /v1/events/{id}/my-day?entry_ids=a,b`
- `GET /v1/events/{id}/changes?after=<cursor>` is the change feed that guests filter on their device
- `GET /v1/events/{id}/announcements`, `GET /v1/events/{id}/guide`
- `GET /v1/events/{id}/calendar.ics?entry_ids=`
- `GET /v1/entries/{id}` returns the team, its approved roster and its matches
- `GET /v1/matches/{id}` returns detail with change history

Every schedule response carries a `sources` list with a freshness value. A CSV source always reports `imported_snapshot` and its import time, never "live".

Staff, with a role grant: events, venues, sources, imports, announcements (draft, publish, archive), guide items, partner cards, roster publish and withdraw, audit log, and `simulate-change` for demo events.

Staff roles are granted only from the CLI:

```sh
uv run python -m app.cli grant --subject user_2abc... --role admin
uv run python -m app.cli grant --subject user_2xyz... --role staff --event demo-championships
```

## Compatibility with mobile flows (PRs 22 and 23)

The `seed`, `seed-testing`, `grant` and `aes-load` commands coexist. Railway pre-deploy migrates and runs `seed-testing`, which rebuilds the synthetic demo event and the two test tournaments around the current time and adds the staff showcase once (see the demo scenario in `docs/implementation-workflows.md`); it never touches real events and does not fetch AES. Run `aes-load` explicitly for approved events. No additional migration or environment variable is required for AES.

AES events use real dates and completed results, without a demo flag or replay clock. The April 2026 Championships therefore appears in Discover under Past or All dates, rather than Upcoming & ongoing. To include it in Nearby, use the staff venue editor to enter verified city/latitude/longitude. No coordinates are inferred from its name. PR 22's access controls also apply to AES events: local official-match edits return 409; update the schedule in AES and refresh. Staff can still edit venue, guide and sponsor content.

The adapter currently loads pool play only. Bracket-only days are not fetched. Published partial set scores do not prove live status; only a winner confirms completion in the supported AES payload. Missing pool flags, malformed collections, missing selected divisions and unresolved participant IDs fail visibly.
