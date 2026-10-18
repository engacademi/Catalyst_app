# 0012: Announcements enter the change feed when they become visible

Date: 2026-10-18. Status: accepted.

The change feed's id is the guest's unread cursor. Publishing a scheduled announcement used to write its change event straight away, while the feed hid the notice until its publication time. A guest who opened Updates in between moved their cursor past the hidden notice, so it never showed as new once it appeared. Now the change event is written when the notice becomes visible (R-07, R-17). Publishing writes it at once for a notice that is already live. For a scheduled notice, the first feed read after its publication time writes it, and the unique key on change events keeps concurrent reads from writing it twice. `latest_id` only counts rows a guest can see now. We chose this over a background scheduler because the demo clock can jump forward, and a read-time check follows it with no extra process.

A division notice lists every team in its division as its audience, in the feed and in `/announcements`, so a parent who follows one team gets that division's briefings. Updates, the event overview and unread counts all apply one relevance rule (`_front/lib/relevance.ts`) on the device, which keeps follows private.
