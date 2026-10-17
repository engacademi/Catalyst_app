# AES imports and mobile/staff flows

Status: Accepted for the PR 23 compatibility update.

PR 22 (`feat/mobile-flow`) supplies mobile discovery, account profiles, event grants,
venue coordinates and the idempotent synthetic testing seed. PR 23
(`feat/aes-real-data`) replaces the speculative AES parser with one based on recorded
responses and adds `aes-load`. Both originally branched from the same main commit.

There is one overlapping implementation file, `app/cli.py`. Its changes add separate
commands, so both commands must remain. The synthetic seed and AES loader are not
duplicate features: one provides fictional upcoming/live scenarios, while the other
copies real, upstream-owned results. Both use the existing normalized import pipeline;
there must be no second scheduler, match model, permission system or frontend API.

The AES source's event key identifies repeat loads. An upstream title change must not
create another event or break browser follows and event-scoped grants. An unrelated
slug collision fails before writing; ambiguous duplicate source keys require staff
resolution. Repeat imports preserve staff metadata, including venue coordinates.

The loader validates event keys through the adapter's shared URL builder. Missing pool
flags, invalid collections, missing selected divisions and unresolved participant IDs
fail visibly before the snapshot reaches the import pipeline. Set scores alone do not
prove a match is currently live; winner flags establish completed results. Bracket-only
days remain unsupported by this pool reader.

Real imports keep their real dates and remain non-demo events. No replay clock, fake
future dates or guessed venue coordinates are added. The staff venue editor provides
verified coordinates for Nearby; past/all-date filtering provides access to the archived
Championships event. The shared staff API refuses local edits to AES-owned matches.
Railway retains migration/seed-testing pre-deploy commands; AES ingestion remains an
explicit command, with automatic polling enabled separately in source configuration.

Compatibility regression coverage loads recorded AES data alongside the synthetic
seed, repeats it after an upstream rename, verifies staff venue metadata in the public
listing, and confirms connected-match edits return 409. Additional checks reject title
collisions and malformed vendor data. No new migration is needed beyond PR 22's 0004.
