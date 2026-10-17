# Deploying to Railway and Vercel

The API and database run on Railway. The web app runs on Vercel. Clerk handles staff sign-in. Do the steps in this order, because each one produces a value the next one needs.

## 1. Clerk

1. Create a Clerk application for this project, separate from any other Eng Academi app.
2. Copy the publishable key (`pk_...`) and secret key (`sk_...`).
3. Copy the Frontend API URL, for example `https://your-app.clerk.accounts.dev`. This is the token issuer the API checks.

## 2. Railway: database and API

1. Create a Railway project and add a PostgreSQL service.
2. Add a service from the GitHub repo `engacademi/Catalyst_app`. In its settings, set Root Directory to `_back` and the config file path to `/_back/railway.json`. Railway then builds `_back/Dockerfile`, runs `alembic upgrade head` before each deploy, and checks `/health/ready`.
3. Set the API service variables:

   | Variable | Value |
   | -------- | ----- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (the private reference; the API converts the scheme for psycopg) |
   | `APP_ENV` | `production` |
   | `AUTH_MODE` | `clerk` |
   | `AUTH_ISSUER` | Clerk Frontend API URL |
   | `CORS_ALLOWED_ORIGINS` | Your Vercel production URL, comma-separated if there are several. No wildcards |
   | `CLERK_AUTHORIZED_PARTIES` | Same list as `CORS_ALLOWED_ORIGINS` |
   | `PUBLIC_WEB_URL` | Your Vercel production URL |

   Railway sets `PORT` itself. Keep the database private; only the API gets a public domain.
4. Under Networking, generate a public domain for the API, for example `https://courtside-api.up.railway.app`. Open `/health/ready` on it to confirm the database connection.
5. Load the demo event and grant yourself admin from a shell inside the service (`railway ssh` with the API service selected):

   ```sh
   python -m app.cli seed
   python -m app.cli grant --subject user_xxx --role admin
   ```

   The subject is your Clerk user id, shown in the Clerk dashboard after you sign in once. Grant event staff with `--role staff --event <slug>`.
6. Turn on database backups in the Postgres service settings and do a test restore before a live event.

## 3. Vercel: web app

1. Import the same GitHub repo into Vercel and set Root Directory to `_front`. Vercel detects Next.js.
2. Set the environment variables:

   | Variable | Value |
   | -------- | ----- |
   | `NEXT_PUBLIC_API_BASE_URL` | The Railway API domain from step 2.4 |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
   | `CLERK_SECRET_KEY` | Clerk secret key |

   `NEXT_PUBLIC_` values are built into the bundle, so redeploy after changing them.
3. Deploy, then copy the production URL into the Railway variables `CORS_ALLOWED_ORIGINS`, `CLERK_AUTHORIZED_PARTIES` and `PUBLIC_WEB_URL`, and redeploy the API.
4. In Clerk, add the Vercel domain to the application's allowed origins.

## 4. Previews and staging

Vercel builds a preview for every pull request. Don't add preview URLs to production CORS. To test previews end to end, create a Railway `staging` environment with its own database, point the Vercel Preview environment's `NEXT_PUBLIC_API_BASE_URL` at it, and add the preview domain pattern you use to staging's CORS list.

## 5. Smoke test

- `/events/demo-championships` loads on a phone and shows the demo banner.
- Follow two teams and check that My Day lists both.
- Sign in at `/admin`, publish an announcement, and see it on Updates.
- Use Demo tools to move a match to another court, and see the change on Updates within 30 seconds.
