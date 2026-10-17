# 0006: Route browser API traffic through the app origin

Status: accepted

Production FastAPI contains the demo championship and serves requests successfully. Vercel preview builds lacked the API URL and defaulted to localhost; preview origins also failed the backend CORS preflight. Both public events and authenticated staff requests therefore failed in the browser before receiving application data.

Use a fixed `/api/backend/v1` Next.js rewrite to the configured FastAPI origin. This preserves methods, authorization, multipart uploads, query strings and binary responses without duplicating backend logic. Keep the existing `NEXT_PUBLIC_API_BASE_URL` setting compatible, prefer server-only `API_BASE_URL`, and require one in Vercel builds. Configure the existing deployed API URL for Production and Preview.

The backend still enforces Clerk JWT verification and role grants. The rewrite has a fixed destination, exposes no arbitrary proxy target and does not grant staff access. Do not reset the existing populated demo event to repair a network configuration issue.
