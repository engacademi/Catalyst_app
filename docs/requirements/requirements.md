# Requirements and app plan

This is the single plan for the hackathon build. It merges the earlier requirements draft with the team's research and technical documents, and records which features stay, which are added and which are cut.

Sources and how they're cited:

- `[brief §05]`: a section of the OVA case brief, [`source/case-brief.md`](source/case-brief.md). This is the authority; where anything below conflicts with it, the brief wins.
- `[resources: AES]`: an entry in [resources.md](resources.md).
- `[research S5]`, `[catalogue CC-07]`, `[tech §9]`, `[notes]`: the team's [preliminary research](OVA_Preliminary_Research.md), [product catalogue](OVA_Technical_Product_Catalogue.md), [MVP technical implementation](OVA_MVP_Technical_Implementation.md) and [hackathon notes](Volleyball%20Hackathon_%20Nortes.md). Those documents stay as detailed reference for the longer-term product. Facts quoted from the research weren't re-checked for this plan.

## 1. What the judges are looking for

OVA lists seven outcomes in brief §07. Every decision in this plan points back to at least one of them.

| ID | Judging outcome [brief §07] |
| -- | --------------------------- |
| J1 | Improve the event experience: intuitive, engaging, information easy to find during busy competitions. |
| J2 | Meaningful personalization: follow the teams and divisions people care about, without repeated searching. |
| J3 | Connect existing systems: bring information together from multiple sources without duplicating competition management. |
| J4 | Reduce administrative work: fewer manual roster submissions, less duplicate entry and staff effort. |
| J5 | Accessible experiences for athletes, families, coaches and spectators. |
| J6 | Long-term scalability across competitions and platforms. |
| J7 | Sustainable value: sponsor engagement or revenue that offsets operating costs. |

The brief closes by saying the strongest solutions balance a great participant experience with technical feasibility, ease of maintenance and long-term value for OVA. Brief §06 asks for a functional prototype or proof of concept, not a production service.

The brief's requirements and considerations [brief §05], used as constraints throughout:

| ID | Requirement [brief §05] |
| -- | ----------------------- |
| B-01 | Mobile-first, for phones at or following a live event. |
| B-02 | Personalization: follow multiple teams or divisions; schedules, results and updates for them. |
| B-03 | Systems integration: show how data is collected from existing platforms via APIs, feeds, exports, embeds or similar. |
| B-04 | Flexible architecture: not built around one competition platform. |
| B-05 | Reduced manual work: rosters, jersey numbers and photos flow from OVA's registration system without duplicate submissions. |
| B-06 | Simple content management for non-technical staff. |
| B-07 | Accessibility following AODA/WCAG. |
| B-08 | Privacy and security: collect only necessary information, respect permissions on participant and team data. |
| B-09 | Scalability to other major indoor and beach events. |
| B-10 | Commercial sustainability through sponsorships, partner activations or other revenue. |

## 2. Problem

Athletes, coaches, families and fans at OVA's major competitions piece together schedules, results, rosters and updates from several websites, apps and channels, and search through hundreds of teams to find their own [brief §02, §03]. OVA staff compile rosters by hand, and different competitions run on different tournament platforms (AES, TIMU, MyTeam.click), so no experience stays consistent [brief §02, §03]. The scale is large: the team's research reports 1,338 teams, 58 courts and nine competition days at the Enercare Centre in 2026 [research S1].

OVA already runs an event app, OVAchamps, with schedule links, roster announcements and venue information [brief §02; research S2]. A list of links and sponsors won't stand out against it. The companion has to make personal, changing information faster to find than it is today [research §3.1].

## 3. Product in one line

Follow your teams once, then always know where to go, what changed and what happens next [research §1].

The companion is a mobile web app over the systems OVA already uses. AES, TIMU, MyTeam.click and OVA's registration system stay in charge of their data, and the companion shows where each piece came from and when it was last checked [brief §02; catalogue §1].

## 4. Users

The research makes the parent or guardian following one or more teams the primary persona [research §5], and this plan keeps that focus. The brief names athletes, coaches, families, fans and OVA staff [brief §01, §04].

| User | What they need on tournament day |
| ---- | -------------------------------- |
| Parent or spectator | Find and follow teams in a few taps, see the next match, court and venue, notice changes, find parking, food and entrances [brief §04; research §5]. |
| Player | Next match and where to report, results, own team page [brief §04]. |
| Coach | Their team's matches and playoff path, official notices, a roster they didn't have to submit twice [brief §03, §05]. |
| Referee or scorekeeper | Event briefing, scoresheets and results-submission steps [resources: TIMU]. Assignments only if a source supplies them [research §5]. |
| OVA event staff | Publish announcements and venue changes without a developer, import data once, see when a source is stale [brief §04, §05]. |
| Sponsor or vendor | Be discoverable at useful moments, and see how often people engaged [brief §04; research §5]. |

## 5. Feature decisions

Each decision names the judging outcomes (J) and brief requirements (B) behind it.

### Keep or merge

| Feature | Merged from | Why |
| ------- | ----------- | --- |
| Guest-first entry from a QR code or link; everyone starts as a spectator and roles add permissions | notes ("everyone starts as a spectator"), catalogue CC-01, earlier R-01/R-02 | Value shows before any sign-up, which is the "few taps" goal [brief §04]. No account means no unnecessary personal data (B-08). J1, J2. |
| My Day: Next Match card, combined schedule for everything followed, overlap warning | notes "My day", research §13.3, catalogue CC-02, earlier R-03 | This is the personalization the judges name first (J2, B-02) and the parent's main job [research §5]. Smoothcomp's next-match card is the proven pattern [research §13]. |
| Match centre: Upcoming / In progress / Results tabs, set scores, status, changed-field badges | catalogue CC-03, research §13.3, earlier R-04/R-05/R-10 | Answers "what happened and what's next" in one place (J1). Playoff slots stay "TBD" until results fill them [resources: TIMU]. |
| Freshness and source labels on every schedule and result ("From AES, checked 2 min ago") | catalogue §1 trust contract, tech §7 | This is how the demo shows connected systems honestly (J3). The research found AES posts results after each match, so the app promises "latest published results", not live points [research §3.2, S3]. |
| Updates feed: one in-app feed for schedule changes, results and announcements, filtered to what you follow, showing old and new values | notes "unified notification center", catalogue CC-04, earlier R-06 | "Receive relevant event updates" [brief §04] (J2, J1). In-app delivery needs no contact details (B-08). |
| Event guide: parking, food, entrances, accessible routes, help desk, courts listed by venue | catalogue CC-06, earlier R-07 | Event communication is a named problem [brief §03] (J1). Courts belong to a venue, since "Court 3" exists in more than one building [research §3.4]. |
| Team page with an approved roster (name, jersey number, position) and photo only when approved | catalogue CC-07 (simplified), earlier R-09/R-11 | Rosters are part of the challenge statement. Showing only approved fields covers B-08 for youth athletes [research §8]. |
| Staff console: announcements, venue content, data import with preview and commit, source health | catalogue CC-12, tech §9, earlier R-14/R-15/R-16 | Non-technical staff publish without a developer (B-06, J4). Preview before commit stops bad data reaching parents. |
| Sponsors, merchandise links and the 50/50 draw, placed so they never cover schedules or changes | catalogue CC-10/CC-11 (links only), earlier R-08 | Sustainable value (J7, B-10) without disrupting the experience [brief §04]. |
| Adapter model with one shared data model (event, venue, court, division, team, match, set score) | tech §9, catalogue CC-13, earlier platform section | Lets AES, CSV exports and later TIMU or MyTeam.click feed the same screens (J3, J6, B-04). |
| Accessibility target WCAG 2.2 AA: text alternatives to maps, status not shown by colour alone, 200% zoom, screen reader | research §8, tech §14, earlier R-20 | J5, B-07. The research sets 2.2 AA above Ontario's 2.0 AA baseline. |

### Add

| Feature | Why it's added |
| ------- | -------------- |
| A live AES connector in the demo, reading the open AES event API | The technical plan uses CSV imports only and gates real connectors [tech §1]. But AES's event API returns JSON without signing in [resources: AES], so the demo can pull real Ontario Championships divisions and clubs. A real API pull is far stronger evidence for J3 and B-03 than a hand-made file. Reuse rights still need OVA's confirmation (Q-03). |
| Two sources in the demo: AES for an indoor event and a CSV import for a second event (for example beach, standing in for MyTeam.click or TIMU) | Showing the same screens fed by two different platforms is the clearest proof of B-04 and J6. Beach is named in the scalability requirement (B-09). |
| Follow divisions, not just teams, in the first version | The technical plan defers divisions [tech §1], but the brief asks for "teams or divisions" in both §05 (B-02) and §07 (J2). |
| A visible "submitted once" roster flow: import a registration-system roster export, coach reviews it, staff publish it | J4 and B-05 are judged directly. The research found clubs already submit rosters, jersey numbers and positions through MRS for the event app [research §3.3, S5], so the demo shows MRS data flowing in rather than a new form. |
| Simple sponsor engagement counts (views and clicks per sponsor card) in the staff console | J7 asks for evidence of sponsor value. The catalogue leaves reporting to a later phase [catalogue CC-11, CC-14]; plain aggregate counts are cheap and need no personal data. |

### Remove or defer

| Feature | Decision | Why |
| ------- | -------- | --- |
| SMS reminders | Remove | Not in the brief, costs per message, and commercial messaging needs consent handling [research §8, S19]. The in-app feed meets "receive relevant updates" for the demo. |
| Email and push notifications | Defer | iOS only supports web push for Home Screen apps [research §8, S13], and delivery adds failure cases. The in-app feed proves the personalization. |
| Required attendee login, native accounts, Google sign-in | Defer; sign-in for staff only | Requiring accounts adds friction (J1) and collects data the core journey doesn't need (B-08). Guest follows stay on the device [tech §6]. Optional attendee accounts can come later for cross-device sync. |
| Location access for "events near you" and "scores near you" | Remove | B-08 says collect only necessary information. Championships are a handful of known events, so location adds a permission prompt without much benefit. |
| Google Calendar sync | Defer | OAuth and two-way sync are heavy [catalogue CC-05]. A one-time .ics download, labelled as a snapshot, is enough if time allows. |
| Merchandise checkout, ticket wallet, pickup codes | Remove | Payments are out of scope. Links to the existing merchant and Ascend's 50/50 site cover B-10. |
| Full consent-record workflow and roster state machine | Simplify | The demo uses an "approved for public view" flag per field and per photo. The full workflow is production work [catalogue CC-07]. |
| Referee assignment view | Defer | No source supplies assignments [research §5]. Referees get the briefing and scoresheet links instead. |
| Grounded AI assistant | Remove | Not in the brief; the catalogue already rates it optional [catalogue CC-15]. |
| Pricing packages, pilot cost model, interview programme | Keep out of the build | Useful for the pitch, not for the prototype. One finding matters for J7: sponsorship alone likely won't cover operating costs, so the pitch should pair sponsor value with staff time saved [research §9]. |
| Production operations: job leasing, backup drills, MFA, private file buckets, load targets | Defer | Needed for a live pilot, not a demo [tech §10 to §12]. Team logos and venue images can live in the repo [tech §11]. |
| Lock-screen countdowns, streaming, match recordings, coach coverage boards | Defer | Smoothcomp features that need native apps or new operations [research §13.9]. |
| Dark mode, haptics, micro-animations | Dark mode optional; haptics removed | Nice polish but not judged. Haptics don't apply to a web app. |

## 6. Functional requirements for the hackathon build

Priority: **Must** is needed for the demo script in section 9, **Should** is built if time allows, **Later** is out of the hackathon. Tags give the source.

### Parent, spectator or player

- **R-01** (Must) Open an event from a QR code or link and browse it without an account. [brief §04; catalogue CC-01]
- **R-02** (Must) Search teams by name, club or division in an event with hundreds of teams, and follow any number of teams and divisions. Follows stay on the device. [B-02; resources: AES; tech §6]
- **R-03** (Must) My Day shows a Next Match card (team, opponent, time, venue, court, freshness) and a combined schedule for followed teams, with a warning when two followed matches overlap. Next Match ordering and overlap warnings use a match's estimated start when it has one, labelled as an estimate. When an estimated start passes and the source hasn't marked the match started, the card says "Expected to start soon", never "In progress". Each followed division gets its own collapsible section below, so a 32-team division doesn't bury the user's own teams. [B-02; research §13.3; catalogue CC-02; grilling Q6]
- **R-32** (Must) Give a followed team a private label, such as "Maya's team", stored only on the device; My Day shows the label. There is no search or following of individual players. [B-08; research §13.4; grilling Q9; Org Q-12]
- **R-35** (Must) A "My teams" page lists every followed team with its label. Following is the only way to save a team; there is no separate favourite or saved list. Follows apply to one event. [grilling Q13]
- **R-33** (Must) When the source fills a placeholder with a followed team, Updates says so ("Next match set: Gold medal vs Venom Havoc, Court 12, 2:00 pm") and My Day shows the match straight away. [grilling Q12]
- **R-28** (Must) When the source assigns a followed team a work duty, My Day shows it as its own item ("Work duty: referee Match 5, Court 53, 9:00"), separate from the team's matches. Nothing shows when the source has none. [resources: AES; grilling Q7; Org Q-10]
- **R-29** (Must) Every court shows its area label next to its number ("Court 53 · Hall C"), and the guide lists courts by area. [research §3.4; grilling Q8; Org Q-11]
- **R-04** (Must) Match centre with Upcoming, In progress and Results tabs and filters by division, venue and court. "In progress" appears only when the source says so. [brief §04; tech §8]
- **R-05** (Must) Results show set scores as published by the source; a missing score shows as pending, never 0-0. [resources: TIMU; catalogue CC-03]
- **R-06** (Must) A changed time or court shows the old and new values, on the match and in the Updates feed. [resources: TIMU; catalogue CC-04]
- **R-07** (Must) Updates feed with announcements and changes for followed teams and divisions, plus event-wide notices. [brief §04; notes]
- **R-08** (Must) Event guide with venue address, parking, food, accessible entrances and routes, help desk and a court list per venue. [brief §02, §03; catalogue CC-06]
- **R-09** (Should) Team page with roster names, jersey numbers, positions and team photo, showing only approved fields. [brief §02; research S5; B-08]
- **R-10** (Should) Download followed matches as an .ics file labelled as a snapshot. [catalogue CC-05]
- **R-11** (Must) Sponsor cards, merchandise links and the 50/50 draw appear in the guide and between sections, never above a schedule change. [B-10; resources: 50/50, sponsorship]

### Coach

- **R-12** (Should) Review the team's imported roster before staff publish it, flagging a missing photo approval. [B-05; catalogue CC-07, CC-08]
- **R-13** (Later) Verified coach role with team-only notices and acknowledgements. [catalogue CC-08]

### Referee or scorekeeper

- **R-14** (Should) Event briefing page with scoresheets, scoring guide and results-submission steps. [resources: TIMU]
- **R-15** (Later) Personal assignment list, only if an authorized source supplies assignments. [research §5; catalogue CC-09]

### OVA event staff

- **R-16** (Must) Staff sign in to a console; attendees never need to. [B-08; tech §6]
- **R-17** (Must) Publish, schedule and expire announcements, targeted to the event or a division, without a developer. [B-06; catalogue CC-12]
- **R-30** (Must) Mark a court as running late by about N minutes. Every match on that court shows the delay notice beside its unchanged official time, with who posted it and when; the notice expires, and followers of affected teams get it in Updates. The app never moves an official time itself. Each affected match that hasn't started also shows an estimated start ("Official 9:00 · Est. ~9:20, OVA staff"), worked out as its official time plus the posted delay. Staff can post one notice for a single court or for every court in an area at once. A notice lasts as long as staff choose when posting (default 60 minutes), can be cleared early, and disappears when it expires. If the source publishes its own revised time for a match, the source's time replaces the staff estimate for that match while the notice text stays visible. [grilling Q5, Q11, Q15, Q16; ADR 0002; Org Q-09]
- **R-31** (Must) Give each court an area label, such as "Hall C, north side". [grilling Q8]
- **R-18** (Must) Edit venue, parking, food and sponsor content. [B-06; brief §04]
- **R-19** (Must) Connect an event to its source by configuration: the AES event key, or a CSV import. The AES connector reads divisions, teams, pools, matches, courts, set scores, work teams and the update timestamp; brackets are included if they share the pool format. [B-04; tech §9; grilling Q4; ADR 0003]
- **R-20** (Must) CSV import shows a preview of added, changed and errored rows before commit; a missing row never cancels a match. [tech §9; catalogue CC-12]
- **R-34** (Must) Demo mode lets staff set the event's current time, shown in a "Demo time" banner on every screen; My Day, Next Match and delay notices use it. Freshness ages stay on real time on purpose, because each source check is stamped with the real time it ran, so an age measured against demo time would be wrong. The clock ticks forward from the set time, and a "+15 min" control jumps it ahead. It's unavailable outside demo mode. [grilling Q10, Q14]
- **R-21** (Must) Source health: last successful check per source, and a visible warning to attendees when a source is stale or down. [catalogue §9; tech §7]
- **R-22** (Should) Import a roster export from the registration system and publish approved fields. [B-05; research §3.3]
- **R-23** (Should) See view and click counts per sponsor card. [J7; catalogue CC-11]

### All users

- **R-24** (Must) Works one-handed on a phone, with main navigation in thumb reach: My Day, Teams, Guide, Updates, More. [B-01; notes; catalogue §2]
- **R-25** (Must) Meets WCAG 2.2 AA on the core journeys. [B-07; research §8]
- **R-26** (Must) Collects no personal data from attendees; public views show only approved roster fields; no youth contact details, birthdates or locations. [B-08; research §8]
- **R-27** (Should) Keeps the guide and last-loaded schedule readable on a weak venue connection, labelled with the time it was saved. [catalogue CC-06; notes]

## 7. Out of scope

- Building or editing schedules, brackets, scoring or official results. The tournament platforms own these, and the brief rules out duplicating competition management [brief §02, §07; tech §1].
- Registration, membership and eligibility decisions [catalogue §1].
- Payments of any kind, including tickets, merchandise and 50/50 sales [section 5].
- Media accreditation, which OVA handles in person [resources: sponsorship].

## 8. How the systems connect

| Source | What it supplies | How the build reads it | Status |
| ------ | ---------------- | ---------------------- | ------ |
| AES | Events, divisions, clubs, teams; pools with matches, courts, scheduled starts, set scores and work teams; last-update timestamp | JSON from `results.advancedeventsystems.com/api/event/<key>` and its division, pool and poolsheet paths | Confirmed open without sign-in on Event 2 (October 17). Team rosters returned empty for that event. |
| TIMU | Pools, playoffs, courts, set scores, venue notes | HTML only, no feed found [resources: TIMU] | Demo uses a CSV export standing in for TIMU. |
| MyTeam.click | Schedules (beach, per the research) | Unknown [resources: MyTeam.click] | Demo uses a CSV export standing in for it. |
| OVA registration (MRS) | Rosters, jersey numbers, positions, photos | CSV export [research S5] | Demo uses a synthetic export. |
| OVA staff | Announcements, venue content, sponsors | Staff console | Built in the app. |

Each source goes through an adapter that maps it into the shared data model. Screens only read the shared model, so adding a platform means writing one adapter [tech §9]. Each record keeps its source and the time it was last checked. If a source fails, attendees see the last good data with a warning, never an empty schedule [catalogue §9].

## 9. Demo script

Use fictional players throughout and label simulated data as simulated [catalogue §11].

The demo uses two events, both prepared by one command (`uv run python -m app.cli demo-setup`, see the README) with demo time set to April 19, 9:40 am:

- Event A is the real Ontario Championships Event 2, read from AES by its event key. The event is over, but at demo time it plays back as it stood that morning: matches not yet due show as upcoming, and their real results appear as demo time passes them. It shows the live connection, real results and source freshness. Its court areas are demo groupings until OVA supplies a court map (Org Q-11). If AES can't be reached, the command loads recorded Event 2 responses and the source says so.
- Event B is simulated: fictional teams imported from CSV in place of a MyTeam.click or TIMU event, with upcoming matches at demo time. It carries Next Match, delays, work duties and the playoff fill.

| Step | Event | What the judges see | Outcomes |
| ---- | ----- | ------------------- | -------- |
| 1 | B | A parent scans a QR code, finds their child's team, a sibling's team and a division in a few taps, follows all three and labels the first team "Maya's team", with no account. | J1, J2 |
| 2 | B | My Day (demo time April 19, 9:40 am) shows Maya's next match with "Court 53 · Hall C", a work duty later that morning, and the division in its own section. | J1, J2 |
| 3 | A and B | Event A shows real Ontario Championships Event 2 data pulled from AES; Event B shows an event imported from CSV. Both use the same screens, and each shows its source and check time. | J3, J6 |
| 4 | B | Staff post "Hall C courts ~20 min late". Maya's card shows "Official 10:00 · Est. ~10:20, OVA staff", and My Day now warns that it overlaps the sibling's 11:00 match. | J1, J4 |
| 5 | B | Jump the demo clock ahead and import the playoff results file. The Gold medal slot (W7 vs W8) fills in, and Updates shows "Next match set: Gold medal, Court 12, 2:00 pm". | J1, J2 |
| 6 | B | Staff import an updated CSV; the preview shows one court change, they commit it, and followers see old and new courts. Staff also publish a parking announcement in under a minute. | J3, J4 |
| 7 | B | A coach reviews a roster imported from the registration export; one photo isn't approved, so the public team page leaves it out. | J4, B-08 |
| 8 | B | The guide shows sponsor cards, a merchandise link and the 50/50 draw; the staff console shows views and clicks per sponsor. | J7 |
| 9 | A | The AES source is switched off; the app keeps the last schedule and shows a "source unavailable since…" warning. | J3, J1 |
| 10 | B | My Day is used with a screen reader and at 200% zoom. | J5 |

## 10. Build plan

The stack is the team's decision in the technical implementation: Next.js on Vercel, FastAPI and PostgreSQL on Railway, Clerk for sign-in [tech §2]. For a hackathon, three simplifications would save time, and each needs the team's agreement and an ADR:

- Use Clerk only for the staff console, since attendees don't sign in.
- Run update fan-out inside the API request instead of a separate worker service.
- Keep logos, team images and venue graphics in the repo instead of a file bucket [tech §11].

Suggested order, so a working demo exists early:

1. Shared data model, AES adapter and CSV adapter, seeded with one AES event and one CSV event.
2. Event page, team search, following and My Day.
3. Match centre, freshness labels and the Updates feed.
4. Staff console: import preview and commit, announcements, venue content.
5. Event guide, sponsors, merchandise and 50/50.
6. Roster import, coach review and team page.
7. Accessibility pass, weak-network handling and .ics export.

## 11. Data available

| Data | Where | Format |
| ---- | ----- | ------ |
| Events, divisions, clubs | AES API | JSON, open [resources: AES] |
| Pools, playoffs, set scores, venue notes | TIMU results page | HTML [resources: TIMU] |
| Rosters with jersey numbers and positions | MRS | Submitted by clubs for the event app [research S5]; no sample provided |
| Event scale | OVA championships page | 1,338 teams, 58 courts, nine days at Enercare in 2026 [research S1] |
| Existing event app content | OVAchamps | Schedule links, check-in, traffic and food information [research S2] |
| Team photo and OVA logos | `source/` | PNG, JPG, EPS |
| Sponsors | OVA sponsorship page | Names via logo links [resources: sponsorship] |
| 50/50 draws | ova5050.org | Draw dates and prizes [resources: 50/50] |
| Accommodations | OVA site | Behind sign-in, unread [resources: accommodations] |

## 12. Assumptions

- **A-01** A mobile web app satisfies "mobile-first"; the brief doesn't require a native app.
- **A-02** Guests can follow teams with follows stored on the device, which fits B-08 though the brief doesn't say it.
- **A-03** Real club and team names from AES can appear in the demo; all player names are fictional.
- **A-04** The AES paths the AES web app uses (`division/<id>/playdays`, `division/<id>/pools/<date>`, `poolsheet/<playId>`, `timestamp`) stay open and stable through the hackathon. They were confirmed working on October 17 but aren't a documented public API.
- **A-05** A CSV export is a fair stand-in for TIMU and MyTeam.click in the demo, since neither offers a feed we could find.
- **A-06** "W7 vs W8" in TIMU playoffs means the winners of matches 7 and 8.
- **A-07** The team's research figures (1,338 teams, 58 courts, MRS roster submission) are accurate; they weren't re-checked for this plan.

## 13. Open questions for the team

- **Q-01** ~~How long is the hackathon?~~ It ends October 18 at 12:30 pm. Still open: how long the demo is, and whether there's a rubric beyond brief §07.
- **Q-02** ~~Do we agree to the three stack simplifications in section 10?~~ Settled in code by ADR 0001: Clerk sign-in is for staff only, and accounts and the background worker are deferred.

## 14. Org questions

Only OVA can answer these. Nothing in the build should guess at them.

- **Q-03** May the companion read and re-display AES, TIMU and MyTeam.click data, and is there an approved feed for each?
- **Q-04** Can MRS export rosters, and which fields may be shown publicly?
- **Q-05** How is OVAchamps run today, and would OVA extend it or replace it? [research §3.1]
- **Q-06** Which channels carry announcements today, and does OVA want push or email later?
- **Q-07** What sponsor tiers exist, and what placements do sponsors expect?
- **Q-08** What does "TLS" mean in "TLS Girls"?
- **Q-09** When courts run late, does the tournament director update start times or courts in AES during the day, or are delays only announced on site?
- **Q-10** Are work-team duties (teams refereeing other matches) used at the Ontario Championships? The Event 2 match we checked showed "No Work Team".
- **Q-12** Would OVA ever allow attendees to search for or follow individual players by name, and what consent would that need? Until then the app only supports private labels on followed teams (R-32).
- **Q-11** Is there a court layout map for the Enercare Centre showing which hall or area each of the 58 courts is in?

## 15. Success criteria

The demo succeeds if every step in section 9 runs live on a phone, and each of J1 to J7 is shown at least once. For the pitch, the research proposes measurable pilot targets OVA could judge a real rollout by [research §11]:

- At least 90% of people find their next match and correct court unaided.
- The time to find a match and its location drops by at least 30%.
- Staff minutes spent re-entering rosters and content drop by at least 30%.
- Published fields match the official source at least 99.5% of the time.
- No blocking accessibility defects on the core journeys.
