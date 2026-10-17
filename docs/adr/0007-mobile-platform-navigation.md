# 0007: Platform-wide mobile discovery and saved schedule

The October 17 UX request supersedes the older navigation, geolocation and optional-account decisions in requirements sections 5 and R-24/R-26. Keep guest access to every public event, and retain the source-of-truth boundary for official competition systems.

## Decisions

- Four persistent destinations: Discover, My Schedule, Tournaments, My Profile. Existing event routes remain valid and use horizontal tournament subnavigation. Staff tools are reached from Profile.
- Discover begins with saved events and followed teams, then nearby, interest-based and largest-by-team-count discovery. Popularity is a transparent proxy, not a fabricated audience metric.
- Toronto is the default reference location. Browser location is requested only after the user chooses “Use my location”; denial and timeout keep the fallback. Coordinates of the attendee stay in React memory and are never sent to the API or persisted.
- Public venue coordinates are optional and staff-maintained. Unlocated venues remain searchable but are excluded from distance results. Sample coordinates for the synthetic demo represent the Toronto city reference point, not verified venue navigation.
- Follows, saved events, visibility, interests, attendance and notification read state remain on the device. Optional Clerk account settings do not imply cross-device synchronization. No demographic inference, birthdate collection or youth profiling.
- The global schedule includes all matches for saved tournaments and only selected team/division matches otherwise. Calendar starts with three days; full week scrolls inside its own region. All date buckets use America/Toronto and each match retains its event timezone label/time.
- Notification badges count all unread pages, using existing event change feeds. Saving a tournament subscribes to all its changes; following a team/division subscribes to relevant changes and event-wide announcements. The Updates shortcut appears only in Discover's header; feeds remain reachable in Profile.
- Local staff editing of imported matches requires a current revision, an event staff grant and event-owned courts/participants. Edits use the shared change/audit pipeline. Connected AES/TIMU/MyTeam schedules remain upstream-owned; refresh their source after edits in the official platform. Bracket slots can be edited for imported data; no bracket-generation engine or write-back connector is introduced.
- The catalogue includes published connected events. A complete OVA season list requires an approved official calendar/feed/export, which has not been provided. Never represent synthetic fixtures as a complete real season.
