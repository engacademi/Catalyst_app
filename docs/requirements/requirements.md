# Requirements

Drafted from [`source/case-brief.md`](source/case-brief.md) and [resources.md](resources.md). Tags in square brackets give the source: `brief §05` is section 05 of the case brief, and `resources: AES` is that resource's entry in resources.md. Items numbered A-NN are assumptions and Q-NN are open questions.

## Problem statement

Athletes, coaches, families and fans at OVA's major competitions have to piece together schedules, results, rosters and event updates from several websites, apps and channels, and search through hundreds of teams to find the ones they care about [brief §02, §03]. Behind the scenes, OVA staff compile rosters by hand from spreadsheets, emails and forms, and each competition may run on a different tournament platform (AES, TIMU or MyTeam.click), so the experience changes from one event to the next [brief §02, §03].

## Users

| User | What they need on tournament day |
| ---- | -------------------------------- |
| Organizer (OVA event staff) | Publish announcements and venue changes quickly without a developer, keep event and sponsor content current, and get rosters into the event without collecting them a second time [brief §03, §04, §05]. |
| Referee or scorekeeper | Scoresheets, the scoring guide and the steps for submitting results [resources: TIMU]. The brief says OVA serves referees [brief §02] but doesn't describe their tournament-day duties, so any need beyond these materials is assumed (A-03). |
| Coach | Their team's matches with times, courts and opponents, where pool results put them in the playoffs, and a correct roster they didn't have to submit twice [brief §03, §04; resources: TIMU]. |
| Player | Next match time and court, results, and a team page with the roster and photo [brief §04]. |
| Spectator or parent | Follow one or more teams, see the next match and live results, and find venue details, parking, announcements, and extras like tickets, merchandise and the 50/50 draw [brief §01, §02, §04]. |

## Goals and non-goals

The hackathon goal is a working, mobile-first prototype that covers the three areas in brief §04:

- A personalized event experience: follow teams and divisions, then see their schedules, results, rosters and updates.
- Connected systems: data from different tournament platforms shown through one experience, without rebuilding those platforms.
- Event management and engagement: simple staff tools for announcements and event content, with room for sponsors and partners.

Out of scope:

- Replacing AES, TIMU, MyTeam.click or OVA's registration platform. That includes building or editing schedules, scoring matches and entering results, which stay in the tournament platforms [brief §02, §05, §07].
- Registration and membership.
- Payments. Tickets, merchandise and 50/50 sales link out to the platforms that already handle them (the 50/50 runs on Ascend Fundraising Solutions) [brief §04; resources: 50/50].
- Media accreditation, which OVA handles in person at its headquarters [resources: sponsorship].

## Functional requirements

### Spectator or parent

- **R-01** Follow any number of teams and divisions, and change the list at any time. [brief §04, §05]
- **R-02** Find a team or division in a few taps by name, club or division, in an event with hundreds of teams (AES Event 2 has 446). [brief §03, §04; resources: AES]
- **R-03** See one schedule for every followed team, with match time, court and opponent. [brief §04, §05; resources: TIMU]
- **R-04** See results for followed teams as they come in, including set scores. [brief §01, §04; resources: TIMU]
- **R-05** See clearly when a followed team's match is rescheduled. [resources: TIMU]
- **R-06** Receive event updates, such as announcements and venue changes, that apply to the event or to followed teams. [brief §04, §05]
- **R-07** Find venue information: address, parking, food accommodation, doors-open time and on-site services. [brief §02, §03; resources: AES, TIMU]
- **R-08** See sponsors and partner offers (tickets, merchandise, the 50/50 draw) placed where they don't get in the way of schedules and results. [brief §04, §05; resources: sponsorship, 50/50]

### Player

Players use R-01 to R-07 as well.

- **R-09** Open a team page with the roster (names and jersey numbers) and the team photo. [brief §02, §04; source: team photo]

### Coach

- **R-10** Follow the team's path through the event: pool matches first, then the playoff slot once pool results decide it. TIMU shows unresolved slots as placeholders such as "W7 vs W8". [resources: TIMU]
- **R-11** Roster details (names, jersey numbers, photos) arrive from OVA's registration platform, so the coach doesn't submit them again. [brief §03, §05]

### Referee or scorekeeper

- **R-12** Reach the scoresheets, scoring guide and results-submission steps for the platform the event uses. [resources: TIMU]
- **R-13** See their court and match assignments, paired with which times they are on their respective courts/matches. [assumed, A-03]

### Organizer

- **R-14** Publish announcements and venue updates from a simple screen, with no developer involved. [brief §04, §05]
- **R-15** Manage event content: venue details, parking, sponsor and partner placements, and links to tickets, merchandise and the 50/50. [brief §04]
- **R-16** Connect an event to its tournament platform (AES, TIMU, MyTeam.click or another) through configuration, without code changes. [brief §04, §05]
- **R-17** Bring in rosters, jersey numbers and photos from the registration platform in bulk, without retyping them. [brief §03, §05]
- **R-18** Set up a new event, indoor or beach, on the same app. [brief §05]

### All users

- **R-19** Work well on a phone in a busy venue. [brief §05]
- **R-20** Follow AODA and WCAG accessibility principles. [brief §05]
- **R-21** Collect only the data the app needs, and respect permissions on participant and team data. Many athletes are youth, which OVA's media policy treats with care. [brief §05; resources: sponsorship]
- **R-22** Get data from each platform by whatever it supports: API, data feed, structured export or embed. [brief §05; resources: AES, TIMU]

## Schedules, results and connected systems

The brief's challenge statement asks for one companion that brings together rosters, schedules, results, event updates, partners and event services "from multiple systems" [brief, challenge statement]. Schedules and results are managed in external tournament platforms such as AES, TIMU and MyTeam.click, and different competitions use different platforms [brief §02, §03]. The companion connects to these platforms and leaves them in charge of the competition.

### What the brief requires

- Work with the existing systems. "The goal is not to replace these existing systems" [brief §02], and a strong solution brings information together "without duplicating competition-management functionality" [brief §07].
- Stay independent of any one platform. The design should avoid being built around a single competition platform and adapt to different systems "without rebuilding the entire application", with AES, TIMU and MyTeam.click named as examples [brief §04, §05].
- Use whatever integration each platform allows: APIs, data feeds, structured exports, embeds or other approaches [brief §05].
- Combine three inputs in one experience: rosters from OVA's registration platform, schedules and results from the tournament systems, and event content from OVA staff [brief §04].
- Personalize what each person sees. Users follow several teams or divisions and get schedules, results and updates for those, without searching through hundreds of teams each time [brief §03, §04, §05].
- Handle the size of a major event, with hundreds of teams and multiple venues [brief §03], and carry over to other major indoor and beach events beyond the Ontario Championships [brief §05].
- Stay practical to maintain, without extensive custom development or ongoing technical support [brief §03].

### What the platforms show today

The resources show what the companion would read from each platform.

- AES Event 2 of the 2026 Ontario Championships ran April 19 to 21 at the Enercare Centre in Toronto, with 446 teams from 90 clubs across 15 divisions (15U Boys D1 and D2, 6v6 Girls D1 to D6, TLS Girls D1 to D7). Its API returns JSON with an ID, name, short code and team count for each division [resources: AES].
- The TIMU Bugarski Cup ran on one day across Courts 1 to 3. Teams played best-2-of-3 pool matches, then playoffs through gold, bronze and placement matches. Playoff slots stay as placeholders such as "W7 vs W8" until earlier results fill them (A-04), and rescheduled matches are marked in amber. TIMU publishes this as HTML with no export or feed [resources: TIMU].
- MyTeam.click's content and format are unknown (Q-02).

The platforms structure the same things differently: AES uses JSON with numeric IDs, while TIMU uses HTML with text labels. A shared model (event, division, pool, team, match, court, set score) that each platform maps into would let the same screens work for any platform (R-16, R-22).

### Not covered by any source

Match length, rest between matches, daily time windows, court counts at the Enercare Centre and referee duties don't appear in the brief or the resources (Q-05, Q-06). The tournament platforms own these rules, so the companion only needs to display what the platforms publish.

## Data available

| Data | Where it lives | Format | Access |
| ---- | -------------- | ------ | ------ |
| Event details, divisions, clubs | AES | JSON from `results.advancedeventsystems.com/api/event/<key>` | Open, no sign-in. Pool, match and court data not yet checked (A-08). |
| Pools, playoffs, courts, results, venue notes | TIMU | Server-rendered HTML | Open. No export or feed found, so it would need scraping. |
| Schedule | MyTeam.click | Unknown (JavaScript app) | Couldn't read (Q-02). |
| Rosters, jersey numbers, team photos | OVA registration platform | Not provided. Clubs currently send spreadsheets, emails and forms [brief §02]. | None yet (Q-04). |
| Sample team photo | `source/Toronto Skyline Volleyball Team Portrait.png` | PNG | In repo. |
| OVA logos | `source/Full Colour Logo/`, `source/BW Logo/` | PNG, JPG, EPS | In repo. |
| Sponsor list | OVA sponsorship page | HTML with logo links | Open. Tiers and prices not listed. |
| 50/50 draws | ova5050.org (Ascend Fundraising Solutions) | HTML | Open. |
| Accommodations | OVA website | Behind SportsEngine sign-in | Couldn't read (Q-03). |
| Announcements, parking, venue updates | Separate channels today [brief §02] | No samples provided | None yet (Q-10). |

Two past events have public data that could serve as demo data: AES Event 2 (April 2026, all 15 divisions marked finished) and the TIMU Bugarski Cup (March 1, 2026) [resources: AES, TIMU]. Whether they can be shown publicly is open (Q-08).

## Assumptions

These are inferred, not read in any source.

- **A-01** The prototype can be a mobile web app. The brief asks for mobile-first but doesn't require a native app.
- **A-02** Fans can follow teams without creating an account, with their follows stored on the device. This follows from the brief's "collect only necessary information" [brief §05], but the brief doesn't say it.
- **A-03** Referees and scorekeepers have court or match assignments that are worth showing in the app. No source describes their duties.
- **A-04** In TIMU's playoff labels, "W7 vs W8" means the winners of matches 7 and 8.
- **A-05** OVA's website runs on SportsEngine, judging by the sign-in page in front of the accommodations page. It's unknown whether rosters live there too.
- **A-06** Following a whole club is worth offering, since 90 clubs entered 446 teams in Event 2.
- **A-07** Past AES and TIMU events can be used as demo data.
- **A-08** The AES API also serves pools, matches and courts for each division, since the AES web app shows them. Only the event summary has been fetched.

## Open questions

- **Q-01** Hackathon logistics: how long it runs, team size, demo format, and whether there's a judging rubric beyond brief §07.
- **Q-02** What does the MyTeam.click page contain, and does MyTeam.click offer an API or export?
- **Q-03** What's on the accommodations page behind the SportsEngine sign-in?
- **Q-04** Which registration platform holds rosters, and can it export names, jersey numbers and photos?
- **Q-05** How long are matches, how much rest do teams get between them, what are the daily time windows, and how many courts does the Enercare Centre event use?
- **Q-06** Who referees matches (assigned officials or teams on work duty), and how are duties scheduled?
- **Q-07** What does "TLS" stand for in "TLS Girls"?
- **Q-08** Can real team and player names from past events appear in a public demo, given that many athletes are youth?
- **Q-09** What are the other numbered Ontario Championships events, and do they use AES as well?
- **Q-10** Which channels does OVA use for announcements today, and does it want push notifications?
- **Q-11** Does TIMU give organizers a feed or export that isn't visible on the public page?
- **Q-12** What sponsor tiers exist, and what placements do sponsors expect?

## Success criteria

A winning demo would show these on a phone (proposed, based on brief §06 and §07):

1. A parent follows two teams in different divisions in a few taps and sees one combined schedule with times and courts.
2. Schedules and results from two different platforms, such as AES and TIMU, appear on the same screens, and the user can't tell which platform each came from.
3. A match is rescheduled or a result comes in, and the follower sees the change.
4. A staff member publishes an announcement from a simple screen, and it reaches phones with no developer involved.
5. A team page shows the roster, jersey numbers and photo from an import, with nothing retyped.
6. Sponsor and 50/50 placements appear without blocking schedules or results.
7. The screens pass basic accessibility checks: contrast, screen-reader labels and resizable text.

OVA will judge it against the seven outcomes in brief §07: a better event experience, meaningful personalization, connected existing systems, less administrative work, accessibility, long-term scalability, and sustainable value from sponsors or other revenue. The brief says the strongest solutions balance a great participant experience with technical feasibility, ease of maintenance and long-term value for OVA.
