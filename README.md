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
