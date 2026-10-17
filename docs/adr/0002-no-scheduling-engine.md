# 0002: The companion displays schedules; it never builds them

Date: 2026-10-17. Status: accepted.

The hackathon guide frames the project as a "tournament scheduling system" with a scheduling engine as its first priority. The OVA brief says schedules stay in AES, TIMU and MyTeam.click, that the goal "is not to replace these existing systems" (§02), and that judges reward connecting them "without duplicating competition-management functionality" (§07). We follow the brief: the companion reads published schedules, pools, brackets and results and shows them faithfully, including placeholders like "W7 vs W8", revisions and cancellations. It never creates, reorders or advances matches. A request to "add scheduling" should be read as better handling of source schedule data, not as an engine.
