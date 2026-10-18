# 0020 — OVA venue hub and event logos

Date: 2026-10-18
Status: Accepted

OVA publishes venue maps, parking, food, medical, hotel and streaming details for
its major events on separate ontariovolleyball.org pages: Niagara Falls, Fall
Classic, New Year's Open, Ontario Championships and Winter Beach Tour. Families
had to find the right page for each weekend, and none of the events in the app
showed the logo people know them by.

The app now carries this content in `_front/lib/ova-venues.ts`, keyed by venue
name as the AES, TIMU and MyTeam.click connectors spell it. Any event held at a
known venue shows OVA's details under its own venue card on the Venue tab. A new
`/venues` page lists every venue with its maps and major events, and Discover and
Tournaments show a strip of upcoming major events. The official logos are copied
into `public/ova/` and appear on event tiles, the event header and the Venue tab.

Every map has a written description for screen readers and anyone who can't read
the drawing. Each venue links back to its OVA page with the date it was checked.
Facts that only applied to the last weekend at a venue, such as food hours, say
which weekend they come from.

The 2026 Fall Classic isn't on AES yet; OVA says schedules will be posted by
October 23, 2026. Until then it appears only in the major events strip and on the
venues page. Its logo goes on any imported event whose title says Fall Classic
and either names OVA or is at Cohere Centre or EY Centre, so club exhibitions
with the same name, such as the Strikers Fall Classic, don't get it.

The content lives in the front end, not the database, so staff can't edit it from
the console yet. That fits the demo, since OVA's pages remain the source. Moving
it to guide items per venue is the next step if staff need to change it during an
event.
