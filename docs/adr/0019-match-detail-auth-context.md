# 0019 — Authentication context on match details

Date: 2026-10-18
Status: Accepted

Completed and in-progress match details mount ScoreDispute, whose signed-in
variant calls Clerk's useAuth. Only discovery, profile and staff routes had a
ClerkProvider; the configured public key therefore caused match details to throw
before displaying scores.

Wrap match details in the same conditional ClerkProvider used by the public
profile and discovery pages, inside the existing Suspense boundary. Include the
match-detail route in the Clerk proxy matcher so session handling also applies
there. Do not require authentication to read matches; reporting still requires a
signed-in account and the backend continues to validate the token.

The regression suite renders the actual dispute component with Clerk's real auth
hook through the match route boundary. It covers scheduled, live and completed
matches with and without a public key. The original route fails the two configured
scoring cases; the corrected route passes all six. Run it in CI with
`npm run test:unit`. Browser end-to-end verification remains separate.
