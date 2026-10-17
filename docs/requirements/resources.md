# Resources

Every link and file provided for the OVA event companion case. Files are stored as received in [`source/`](source/). Links were opened on 2026-10-16. The notes say what in each one matters for schedules, results and the event experience.

## Links

### OVA Media and Sponsorship

- **URL:** https://www.ontariovolleyball.org/ocs-sponsorship
- **Type:** sponsorship / media policy
- Lists the 2026 Ontario Championships sponsors: Canuckstuff, Hudson Travel Group, Hudl, Mikasa Sports Canada, Government of Ontario, Destination Toronto, City of Toronto, Six Pack Recruiting and Timu. It also gives reach figures: 55,000+ athletes, coaches and spectators, 18.6M Instagram views, and 150k+ livestream views on CBC Connect.
- Nothing on scheduling. It does give the sponsor list a companion could feature. Media must register and pick up accreditation at OVA Headquarters because events involve youth athletes, which bears on privacy rules for photos and rosters.
- Tiers, prices and the linked press-release PDF weren't readable.
- This link was given twice in the list. It's indexed once.

### AES results: 2026 Ontario Championships, Event 2

- **URL:** https://results.advancedeventsystems.com/event/MjAyNl9PbnRhcmlvX0NoYW1waW9uc2hpcHNfX19FdmVudF8yX182djZHX19UTFNHX18xNVVCXw2/home (Google Analytics query parameters removed)
- **Type:** schedule / results (tournament-management platform)
- The page is a JavaScript app and showed no readable content when fetched. The same event key returns JSON from `https://results.advancedeventsystems.com/api/event/<key>` without signing in. The key is base64 for `2026_Ontario_Championships___Event_2__6v6G__TLSG__15UB`.
- The JSON gives the event: "2026 Ontario Championships - Event 2 (6v6G, TLSG, 15UB)", April 19 to 21, 2026, at the Enercare Centre (100 Princes' Blvd, Toronto). It covers 90 clubs and 15 divisions with 446 teams in total: 15U Boys D1 to D2, 6v6 Girls D1 to D6 and TLS Girls D1 to D7.
- Each division has an ID, name, short code (such as "15UB D1"), team count, colour and finished flag, and each club has an ID and name. I only fetched this top-level record. Pool, match and court endpoints weren't explored.

### TIMU results: 6v6 Girls Bugarski Cup, Select A

- **URL:** https://www.timu.ca/scoreboards/results.php?tid=3960
- **Type:** schedule / results (tournament-management platform)
- A one-day tournament on Sunday, March 1, 2026, starting at 9:00am, with 9 teams in Pools A to C on Courts 1 to 3. Pool matches are best 2 of 3. Playoffs run through quarterfinals, semifinals, gold, bronze, and 5th/7th and 9th place games.
- Results are rendered as server-side HTML: each match shows set counts and set scores, rescheduled matches are marked in amber, and playoff slots are named like "W7 vs W8". No export, feed or API link is visible, so reading this data would mean scraping the HTML.
- The page includes venue info (doors open 8:20am, parking in the lot) and a "Submit Results To OVA" guide. No standings table was found.

### MyTeam.click schedule

- **URL:** https://myteam.click/schedule/69a9c99aa3c28f5a62ef1235
- **Type:** schedule (tournament-management platform)
- **Couldn't read.** The page is a JavaScript app, and fetching it returned only the title "MyTeam.Click". The page source didn't show an API address either. Its contents are unknown until it's opened in a browser.

### OVA accommodations (behind SportsEngine sign-in)

- **URL:** https://user.sportngin.com/users/sign_in?user_return_to=https%3A%2F%2Fwww.ontariovolleyball.org%2Faccommodations
- **Type:** venue / travel (login wall)
- **Couldn't read.** The link opens a SportsEngine sign-in form. Going straight to https://www.ontariovolleyball.org/accommodations redirects to the same login, so nothing on the page is visible without an account.
- This suggests OVA's website runs on SportsEngine. That isn't confirmed.

### OVA 50/50

- **URL:** https://ova5050.org
- **Type:** fundraising / raffle
- Two draws in 2026. The Ontario Championships draw had its Early Bird on Apr 16 and its Grand Prize of $25,115 on Apr 28. The Beach Ontario Championships draw had its Early Bird on Jul 29 and its Grand Prize of $1,675 on Aug 18.
- Run on Ascend Fundraising Solutions under Lottery Licence RAF1499817, with a Rules of Play PDF (January 2026). Ticket prices and age or location limits aren't on the page.
- Nothing on scheduling. The draw dates track the events, so the companion could link to or promote the draw for each event.

## Files in `source/`

| File | Description |
| ---- | ----------- |
| `case-brief.md` | The case brief and challenge statement as pasted by the organizer, unedited. |
| `Toronto Skyline Volleyball Team Portrait.png` | Team photo of "Toronto Skyline VC": 12 players in jerseys numbered 1 to 12, with two staff. A sample of the photo and jersey-number data a roster would show. |
| `Full Colour Logo/Primary_Preferred.png` | OVA primary logo, full colour (green mark, grey "ONTARIO", green "Volleyball"), for light backgrounds. |
| `Full Colour Logo/Primary_Preferred.jpg` | Same full-colour logo as a high-resolution JPG on white. |
| `Full Colour Logo/Primary_Preferred_DarkBG.png` | Full-colour logo for dark backgrounds. The white lettering is invisible on a white preview. |
| `Full Colour Logo/Primary_Preferred_LightBG.eps` | Vector (EPS) version of the full-colour logo for light backgrounds. Not previewed. |
| `Full Colour Logo/Primary_Preferred_DarkBG.eps` | Vector (EPS) version of the full-colour logo for dark backgrounds. Not previewed. |
| `Full Colour Logo/OVA Medallion.eps` | Vector (EPS) file named "OVA Medallion". Not previewed, so the design is unconfirmed. |
| `BW Logo/Primary_Monochrome.jpg` | OVA logo in one dark slate grey, on white. |
| `BW Logo/Primary_Monochrome_DarkBG.png` | One-colour white logo for dark backgrounds. It appears blank on a white preview. |
| `BW Logo/Primary_Monochrome_DarkBG.eps` | Vector (EPS) version of the white one-colour logo. Not previewed. |
