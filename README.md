# Catalyst_app: Courtside Connected

A mobile-first companion for Ontario Volleyball Association events. Fans, families, players and coaches follow teams and see their matches, results, rosters, announcements and venue information in one place. OVA staff publish announcements, import schedules and rosters, and manage event content without a developer.

The case study and requirements are in `docs/requirements/`. `OVA_MVP_Technical_Implementation.md` sets the scope and stack for this first release.

| Folder | What it is | Hosted on |
| ------ | ---------- | --------- |
| `_back/` | FastAPI + PostgreSQL API ([README](_back/README.md)) | Railway |
| `_front/` | Next.js web app ([README](_front/README.md)) | Vercel |
| `docs/adr/` | Architecture decisions | |
| `docs/deployment.md` | How to wire Railway, Vercel and Clerk | |

## Quick start

```sh
# API (needs PostgreSQL)
cd _back && cp .env.example .env && uv sync && uv run alembic upgrade head
uv run python -m app.cli seed && uv run uvicorn app.main:app --reload

# Web, in another terminal
cd _front && cp .env.example .env.local && npm install && npm run dev
```

Then open http://localhost:3000/events/demo-championships. The demo event uses fictional teams and is labeled as simulated everywhere it appears.

## Demo setup

One command prepares both events for the demo script (section 9 of `docs/requirements/requirements.md`) and sets each event's demo time to April 19, 9:40 am:

```sh
cd _back
uv run python -m app.cli demo-setup              # --offline skips AES and loads the recorded responses
DEMO_MODE=true uv run uvicorn app.main:app --reload
```

- Event A (`/events/ontario-championships-event-2`) is the real Ontario Championships Event 2. The command connects it to AES by its event key, then refreshes and commits teams and matches. The event is over, so every match shows its result. OVA hasn't supplied a court map, so courts are grouped into halls by number and each area is labelled "(demo area)". If AES can't be reached, the command loads the recorded Event 2 responses in `_back/sample_data/aes_event2/` (two divisions) and names the source "AES Event 2 (recorded responses, not live)".
- Event B (`/events/ontario-championships-simulated`) is simulated. Its fictional teams, matches and roster come from the CSV files in `_back/sample_data/demo/` and stand in for a MyTeam.click or TIMU event. At demo time Maya's team (Lakeview Lightning 16U) plays next at 10:00 on Court 53 in Hall C and has a work duty at 11:00. Its sibling team (Lakeview Lightning 14U) plays at 11:00 on Court 12, so a 20-minute Hall C delay makes the two overlap. The Gold medal match waits on W7 vs W8.

During the demo the presenter uploads two files from `_back/sample_data/demo/` to Event B as matches imports. `step-5-playoff-filled.csv` fills the Gold medal match, which posts "Next match set". `step-6-court-change.csv` moves one of Maya's matches to another court.

Each run deletes and rebuilds both events, so running it again resets the demo after a rehearsal. Follows saved on a phone point at the old teams and have to be made again. The AES check time is when the command ran, and the source shows as stale 30 minutes later, so run it shortly before presenting. `seed` still loads the older single demo event.
