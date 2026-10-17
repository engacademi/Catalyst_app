# 0008: Less copy, softer surfaces, and a start-time calendar

The October 17 follow-up request refines the mobile flow in ADR 0007.

- Keep optional public browsing and existing routes. Remove the redundant My event day/My teams navigation tabs; a team-label icon beside the tournament heart opens the existing private-label workflow.
- Render courtside picks only when a visible tournament is explicitly saved. Followed-team selections still populate My Schedule and notifications.
- Move location controls into the nearby section, remove editorial header/section taglines, and keep search/type/date controls on two rows. Visibility is an eye control beside Today, with its tournament checkboxes in a compact popover.
- Use one consistent brand subtitle: “By Ontario Volleyball Association”. Add restrained shadows, translucent navigation and form surfaces, selective entrance fades and toggle transitions. Respect reduced-motion preferences.
- Remove the large demo-event banner, retaining smaller demo-data indicators and source provenance. The demo-clock notice remains when a simulated clock is explicitly active.
- The home route can reuse the configured Clerk application to show a personal greeting. Its middleware matcher now includes `/`; no new key, role or account requirement is introduced. Guests retain the existing public home experience.
- Calendar columns use an hourly time rail in America/Toronto, day/date headers, a highlighted current date and blocks positioned by start time (estimated start when available). The API does not supply end times, so one-hour display slots are explicitly described in accessible labels and match tooltips. These are not confirmed durations.
- Overlapping display slots use separate lanes. Dense overlap blocks use compact team initials, with full names in their accessible label, tooltip and linked match details. Status remains available as text, rather than being conveyed by colour alone.

No backend schema or environment-variable change is required for this refinement. The migration and external-feed dependencies documented for ADR 0007 still apply.
