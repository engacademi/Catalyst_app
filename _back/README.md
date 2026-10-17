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
uv run python -m app.cli demo-setup   # the two demo-script events: AES Event 2 and a simulated CSV event
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
| `app/adapters/` | Source adapter protocol, the CSV interchange parser and the read-only AES adapter |
| `app/modules/imports.py` | Stage, preview and commit imports |
| `app/modules/refresh.py` | Refresh a live source into a staged import; record failed checks |
| `app/modules/matches.py` | Match queries, revisions and change events |
| `app/modules/my_day.py` | Itinerary, next match and overlap warnings across followed teams |
| `app/modules/calendar.py` | ICS snapshot export |
| `app/api/public.py` | Public reads under `/v1` |
| `app/api/admin.py` | Staff workspace under `/v1/admin` |
| `app/api/me.py` | Signed-in user's own data (official assignments) |
| `app/cli.py` | `seed`, `demo-setup` and `grant` commands |
| `app/demo_setup.py` | Builds the two demo-script events (see the root README) |
| `sample_data/` | Example CSVs and the column reference; `demo/` holds Event B's files, `aes_event2/` the recorded AES responses |

## How data gets in

Staff upload a CSV for a source (entries, then matches, then rosters). The API checks every row and returns a preview of adds, changes, unchanged rows and errors. Nothing changes until staff commit. Commit runs in one transaction and refuses a preview that is out of date because another import landed first. Each committed change to a match's time, court, status, result or teams raises the match revision and writes one change event; replaying the same file writes none. A row missing from a file never cancels a match.

Rosters are published only with a consent review reference. Player photos appear only when the row marks them approved; otherwise the importer drops the URL before it reaches the database.

An AES source reads the AES results site by its event key (ADR 0003). Staff press refresh (`POST /v1/admin/sources/{id}/refresh`), which stages divisions, clubs and teams (`kind: entries`) or pool matches (`kind: matches`) for the same preview and commit as an upload. Refresh and commit teams before matches. Matches come from each pool's poolsheet with teams, court, official start, set scores and work team. AES courts go under the event's venue with their AES labels; if the event has no venue yet, the AES location becomes one. AES team, division, court and match ids become external mappings, so a renamed team stays the same entry. The AES last-update time becomes the source's upstream update time. If AES times out, returns an HTTP error or sends something other than JSON, the refresh fails, the last committed data stays, and the source shows as unavailable until the next good refresh. Tests replay the recorded responses in `sample_data/aes_event2/` and never call AES.

TIMU and MyTeam.click adapters are not built yet. A source can be marked `timu` or `myteam` for labeling, and their data arrives by CSV.

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

With `DEMO_MODE=true`, staff can also set an event's demo time (`PUT /v1/admin/events/{id}/demo-clock`), jump it ahead (`POST .../demo-clock/jump`, 15 minutes by default) and clear it (`DELETE .../demo-clock`). Demo time ticks forward with real time from the moment it is set. Event responses carry `now` (the event's current time) and `demo_time` (true while demo time is on), and My Day picks the next match by that time. Without demo mode, setting demo time is refused and `now` is the real time.

Staff can post a delay notice for a court (`POST /v1/admin/courts/{id}/delay-notices` with `minutes` and an optional `duration_minutes`, 60 by default), list the active ones (`GET /v1/admin/events/{id}/delay-notices`) and clear one early (`POST /v1/admin/delay-notices/{id}/clear`). Posting and clearing are audited, and each writes a change event for followers of teams still to play on that court. A notice expires by the event's current time, so demo time counts. While it is active, every match on the court that hasn't started keeps its official `scheduled_start` and gets an `estimated_start` of official start plus the delay, with `estimated_start_by: "ova_staff"` and the notice in `delay_notice`. When the source publishes its own estimated start, that time is used instead (`estimated_start_by: "source"`) and the notice is still shown.

Staff can switch a source to unavailable from the console (`PATCH /v1/admin/sources/{id}` with `status: unavailable`); the source then shows "unavailable since" that moment until it is set back to active.

Staff roles are granted only from the CLI:

```sh
uv run python -m app.cli grant --subject user_2abc... --role admin
uv run python -m app.cli grant --subject user_2xyz... --role staff --event demo-championships
```
