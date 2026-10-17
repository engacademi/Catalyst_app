# 0001: Stack, hosting and repository layout

Date: 2026-10-17. Status: accepted.

## Context

`OVA_MVP_Technical_Implementation.md` picks Next.js on Vercel for the web app and FastAPI with PostgreSQL on Railway for the API. It suggests `apps/web` and `services/api` as paths, but the team had already created `_front/` and `_back/` at the repo root.

## Decision

- The backend lives in `_back/`: FastAPI, SQLAlchemy 2, psycopg 3, Alembic, PyJWT for Clerk token checks. Railway builds it from `_back/Dockerfile` and runs `alembic upgrade head` as the pre-deploy step, behind a PostgreSQL advisory lock.
- The frontend lives in `_front/`: Next.js App Router, TypeScript, Tailwind CSS, TanStack Query, Lucide icons, and Clerk for staff sign-in. Vercel builds it with `_front` as the root directory.
- The browser calls the Railway API directly. Next.js holds no domain logic and no database connection.

## Consequences

- The first release ingests data through the app's own CSV format (`_back/sample_data/README.md`). Live AES, TIMU and MyTeam.click adapters come later, behind the same adapter protocol, once OVA has access.
- Guests follow teams on their device only. Accounts, the durable inbox and the background worker are left for a later increment; the public change feed covers updates for guests now.
- Local development uses `AUTH_MODE=dev` with an `X-Dev-User` header. The API refuses to start that way outside development and test.
