# 0003: Read-only AES connector for the demo

Date: 2026-10-17. Status: accepted. Supersedes the "CSV first" consequence of ADR 0001.

ADR 0001 planned CSV-only ingestion until OVA granted vendor access. On October 17 we found that the AES results site reads its data from JSON paths that answer without sign-in: event, division playdays, pools, poolsheets (matches with teams, court, scheduled start, set scores and work team) and a last-update timestamp. Real Ontario Championships data is much stronger evidence for "connect existing systems" (brief §07) than a file we wrote, so the demo pulls an AES event live through a read-only adapter, while a second event still comes from CSV to show the app isn't tied to one platform.

## Consequences

- These paths are what the AES web app uses, not a documented public API. They can change without notice, so the adapter must fail visibly (source unavailable, last good data kept) rather than silently.
- Re-displaying AES data needs OVA's permission before any real use (Org Q-03).
- The CSV path stays fully supported; it's how TIMU, MyTeam.click and MRS data arrive until they have their own adapters.
