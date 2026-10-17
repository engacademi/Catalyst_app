# Courtside Connected — Preliminary Research & Product Strategy

**Prepared for:** Team Catalyst / Ontario Volleyball Association challenge  
**Research date:** 17 October 2026 UTC (16 October in Toronto)  
**Updated:** 17 October 2026 — expanded Smoothcomp review and final Railway MVP stack.  
**Status:** Preliminary desk research and proposed product strategy; no stakeholder interviews, vendor integration trials, or procurement quotes completed.

## 1. Recommendation

Develop **Courtside Connected**, an OVA-branded, mobile-first event companion that assembles trustworthy competition information, a personalized family itinerary, venue services, and relevant announcements. Pair it with a small staff console and reusable data connectors. Keep AES, TIMU, MyTeam.Click, and OVA's membership systems authoritative for their existing responsibilities.

The strongest initial proposition is: **“Follow your teams once; know where to go, what changed, and what happens next.”** Parents and guardians are the primary design persona, while athletes, spectators, coaches, referees, and staff retain appropriate views. Essential information should work without an account or app-store installation.

Start with one event and one authorized schedule source. Prove reliable changes, source attribution, and reduced staff effort before adding more vendors, native applications, advanced commerce, or AI. Evaluate extending the existing OVAchamps experience before commissioning a replacement.

## 2. What the attachments actually establish

| Attachment | Observed content | Consequence |
|---|---|---|
| IMG_0327.png | Team #19; OVA sponsor; Courtside Connected challenge | Primary product brief is an OVA event companion |
| IMG_0328.png | Fragmented mobile experience; athletes, coaches, families, fans | Broad audience, with event-day usability as the central problem |
| IMG_0329.png | Ontario Championships starting point; roster submissions; AES, TIMU, MyTeam.Click; venue information | Integration and information ownership are core design requirements |
| IMG_0335.png | Functional prototype; personalization, connected data, staff tools, fan engagement | Demonstrate a working journey and meaningful change handling |
| IMG_0336.png | Experience, personalization, system connection, administration, accessibility, scalability, sustainable value | Evaluation criteria and business outcomes |
| IMG_0337.png | Resource labels for platforms, samples, existing app, venue pages | Discovery leads; actual linked roster files and logo archive were not provided |
| IMG_0341.jpeg | Team discussion: merchandise, event companion, parents, coaches/referees, calendars and email logistics | Additional team feature requests, not confirmed OVA procurement requirements |
| IMG_7207.jpeg | OVA presentation: personalization, connection, simpler events | Confirms direction |
| IMG_7208.jpeg / IMG_7209.jpeg | Separate CAIL mission-critical systems / natural-language AI challenge | Separate opportunity; see Appendix A. Do not combine enterprise operations with volleyball product architecture |

Some screenshot sections are cropped, and challenge sections 03–05 are not available. No missing constraints, budget, judging weights, or private sample structures have been invented. The team's “look at Smoothcomp” instruction is treated as a comparative design reference, not a request to migrate OVA competition management.

## 3. Evidence that changes the initial brief

### 3.1 OVA already has an event experience

The OVAchamps news site carries schedule links, roster announcements, check-in guidance, traffic information, and food-service information [S2]. This is an incumbent experience to investigate, not an empty market. Public pages do not establish whether its personalization, accessibility, integrations, or performance satisfy users.

**Implication:** A list of schedules, maps, and sponsors alone is weak differentiation. Test whether users can reliably follow multiple teams, identify a changed match, and find the right venue information faster than today. Obtain the current supplier's extension options and contract constraints.

### 3.2 “Live results” needs a precise definition

OVA's 2026 team handbook says scores are posted shortly after each match and accessed through AES, including through OVAchamps [S3]. AES documentation says publication timing is controlled by the tournament director's configured update interval [S4]. Neither establishes an available point-by-point scoring feed for this project.

**Implication:** Promise **latest published results**, with timestamps and provenance. Only offer live point scores if the source explicitly provides them and an integration trial verifies them. Interface refresh speed cannot fix unpublished source data.

### 3.3 The roster process may already be more structured

The screenshots describe email, form, and spreadsheet submissions. OVA's 2025–26 club administration checklist instead instructs clubs to submit photos and rosters with jersey numbers and positions through MRS for the event app [S5]. These can reflect different stages or seasons; they are not proof that the screenshot brief is wrong.

**Implication:** Map the actual MRS-to-app workflow before building another roster form. Prefer a publication projection of authorized existing data. Ask where staff still reformat, copy, chase approvals, or correct errors.

### 3.4 Multi-venue support is a first-class requirement

OVA reports 1,338 teams at Enercare, 58 courts and nine competition days in 2026, plus 68 teams at a separate 4v4 championship. Its current championship page also describes a 2027 multi-city event structure [S1]. Dates and division allocations should be reconfirmed before implementation.

**Implication:** Store event instances, venues and courts separately. A court number alone is not a location. These figures indicate operational scale, but do not reveal unique spectators, app adoption, concurrent users, or addressable revenue.

## 4. Field and market structure

This opportunity sits between three established categories:

1. **Competition systems:** registration, brackets, rules, scoring, standings, progression. Their data is operationally authoritative.
2. **Team-management applications:** attendance, family communication, team schedules and reminders. Their focus is usually a team or organization.
3. **Event-engagement applications:** venue information, personalized agendas, sponsors and attendee services. Their focus is the experience around the event.

Courtside Connected's proposed role is an **experience and integration layer across competition systems**, with volleyball-specific family journeys. That position is commercially plausible but not yet validated. Existing vendors may already offer enough functionality through configuration or partnerships.

### Comparative landscape

Vendor statements below establish advertised capabilities, not independent quality ratings. “Unverified” means this research did not establish the feature or access arrangement; it does not mean the vendor lacks it.

| Platform | Verified or advertised relevance | Useful pattern | What still needs checking |
|---|---|---|---|
| OVAchamps | Existing OVA event news, roster and schedule access [S2–S3] | Existing brand, distribution and content | Current personalization, user analytics, ownership, extensibility, accessibility and renewal cost |
| SportsEngine AES | Volleyball event scheduling/results; configurable publication; correction pathway [S4] | Clear official result ownership | Partner API/export availability, rights, quotas, latency, stable IDs and historical corrections |
| TIMU | Volleyball tournament operations, automated progression, reporting and mobile access; embedding enquiries [S6] | Volleyball-specific operational context | Authorized structured feed; do not treat a ticker as proof of a general API |
| MyTeam.Click | Developer's app listing describes volleyball schedules and score entry [S7] | Mobile access to league information | Tournament exports, beach data model, API permissions; website yielded no readable detail |
| Smoothcomp | Following athletes, academies and events; app schedules, brackets and configurable notifications [S8–S9] | Follow once, then receive relevant changes | Cross-platform OVA integration is unverified; combat-sport workflows are not volleyball rules |
| TeamLinkt | Team app communication, reminders, schedules and parent/coach coordination [S10] | Household and team-oriented information | Event-wide aggregation across existing OVA systems; scope and pricing need vendor discussion |
| Cvent Attendee Hub | Event web/mobile engagement, exhibitor/sponsor discovery and promotional placements [S11–S12] | Venue services, agenda and sponsor administration | Volleyball entities, procurement cost, licensing, integrations and operating burden |

Do not copy Smoothcomp's bracket engine or assume all of its features are free: its app documentation distinguishes premium notification capabilities [S9]. Its most relevant inspiration is persistent following and concise next-match information. TeamLinkt suggests a familiar parent communication model; Cvent demonstrates that sponsorship inventory is an established category, not a new market invention.

### Differentiation hypothesis

The differentiator is the combination of **multi-team household planning + trustworthy cross-source updates + useful venue context + lower organizer effort**. Each element alone is available elsewhere. The defensible asset would be tested connector contracts, identity mappings, event operations knowledge, and a trusted OVA deployment—not a generic AI chat window.

## 5. Users, jobs and purchase decision

| Persona | High-value job | Friction to validate | Product response |
|---|---|---|---|
| Parent/guardian following two teams | Plan arrival and move between matches | Repeated searching, conflicting times, wrong venue | Combined itinerary, conflict warning, court and travel context |
| Casual spectator | Find a team and next match quickly | Account/install friction and unfamiliar divisions | Guest search and shareable team/event links |
| Athlete | Know next match and where to report | Unclear updates and changing opponents | Compact team view; distinguish confirmed versus TBD |
| Coach/team manager | Confirm team information and event instructions | Repeated submissions and inconsistent notices | Roster review and private team operational notices |
| Referee | Find assigned court, time and briefing | Assignments elsewhere; confidentiality | Authorized assignment view, not a new assignment engine |
| OVA event staff | Publish once and resolve exceptions | Duplicate entry and source inconsistencies | Content publishing, mapping review, import health, audit history |
| Sponsor/vendor | Be discoverable at useful moments | Unclear engagement or attribution | Contextual directory placement and aggregate reporting |

**Likely buyer:** OVA event/digital leadership, with operations and privacy/accessibility stakeholders. **Primary users:** attendees and team staff. **Potential partners:** existing event-app supplier, competition vendors, clubs, venue operators, approved merchandise/ticket providers. Buyer, budget owner and procurement process remain unconfirmed.

## 6. Proposed product and boundaries

### Core experience

A visitor scans an event QR code, follows one or more teams and immediately sees their next match, location, official status and relevant changes. Their event page also provides parking, accessible entrances, food, merchandise, announcements and contact information. Optional sign-in preserves preferences across devices; notifications are an explicit choice.

A parent following teams in different locations sees overlapping matches and venue differences. When the official source changes a court, the itinerary, inbox and calendar representation update consistently. If the source becomes unavailable, the app displays the last checked time and an official-source link rather than implying current knowledge.

### Product structure

- **Companion:** event discovery, team following, household itinerary, latest results, venue guide, alerts and calendar options.
- **Organizer Studio:** approved content, roster publication workflow, connector monitoring, mapping exceptions and analytics.
- **Partner Hub:** sponsor directory, merchandise/ticket links and later attributable commerce integrations.
- **Connect:** canonical data model and replaceable authorized adapters, including a controlled CSV fallback.

These are modules within one product, not four independently deployed systems for the pilot. Detailed requirements, APIs and acceptance criteria appear in the companion catalogue.

### Explicit scope boundaries

Competition scheduling, bracket advancement, refereeing assignments, eligibility decisions, payment processing and membership registration remain with their established owners. The companion displays or links to their outputs. It does not calculate official standings independently, guarantee notification arrival, perform live indoor tracking, or publish minors' information merely because it is present in an import.

## 7. Integration feasibility

| Data area | Expected authoritative owner | Preferred access | Controlled fallback | Current certainty |
|---|---|---|---|---|
| Championship schedules/results | AES/event director | Contracted API, webhook or vendor feed | Approved exports, then source links | Source use verified; API access unverified |
| Indoor regular season | TIMU | Vendor-approved feed | Approved export or authorized embedded view | Platform relevance verified |
| Beach competition | MyTeam.Click per brief | Vendor-approved interface | Export/source links | Brief establishes use; access unverified |
| Membership/roster eligibility | OVA/MRS | Minimal approved export or connector | Club review of an authorized snapshot | MRS roster submission supported by checklist |
| Venue content and notices | OVA/venue | Structured content editor | Staff-approved content import | Access/content ownership to arrange |
| Merchandise/tickets | Existing merchant | Hosted links initially | Clearly labeled merchant website | Supplier and commercial terms unknown |

Do not assume public visibility grants extraction or republication rights. Avoid building the core promise on undocumented scraping. Obtain permitted fields, update frequency, licensing, identity rules, deletion/correction handling, contact and escalation arrangements. A connector spike must exercise an actual changed match, cancellation, correction, timeout, and ambiguous team name.

**Decision gate:** If no reliable authorized schedule feed or timely export exists, position the first release as a personalized information hub with official-source links. Do not market automated schedule-change alerts in that mode. If integration costs exceed the expected benefit, extend the incumbent app or buy/configure an existing product.

## 8. Mobile, calendars, accessibility and trust

### Mobile delivery

A responsive progressive web app is a reasonable pilot choice because a QR code opens the experience immediately. It also supports a reusable codebase and cached event essentials. A native app may later improve distribution and device-specific experiences, but adds release, support and testing work.

Apple documents web push support for Home Screen web apps on supported iOS/iPadOS versions [S13]. Therefore, do not promise push to every visitor opening a normal browser tab. Provide an in-app inbox and optional email; test installation and permission flows on real devices. Notifications are supplementary to official event operations.

### Calendar choices

- **One-time calendar file:** simple export, visibly identified as a snapshot.
- **Subscribed calendar:** maintains a feed; client-controlled polling means updates may arrive late.
- **Google Calendar connection:** optional OAuth integration that updates app-created entries by stable identity; more engineering and support work [S14–S15].

Do not call a static download “sync.” Do not rely on a calendar for urgent court changes. Write only to an app-managed calendar where practical, and do not inspect unrelated personal events for the initial conflict feature.

### Accessibility and youth privacy

Set WCAG 2.2 AA as the engineering target [S16]. Ontario's published website requirement applies to designated public-sector organizations and businesses/non-profits meeting its employee threshold; its stated baseline is WCAG 2.0 AA with specified exceptions [S17]. OVA's exact legal applicability requires organizational review; the product target is deliberately broader than that minimum.

Use readable text, accessible lists alongside maps, keyboard and screen-reader support, visible focus, large controls, reduced motion and information that is not encoded by colour alone. Test actual schedule and notification tasks with users with disabilities.

Public athlete profiles need approved fields and appropriate consent. OPC guidance calls for parent/guardian consent when a child cannot meaningfully consent and emphasizes maturity-appropriate processes [S18]. Do not infer permission from a roster upload. Avoid public birthdates, contact information, school details and personal location tracking. A fan following a team is not proof of guardianship or permission to view a private roster.

Keep sponsor marketing consent separate from operational subscriptions. CRTC guidance identifies consent, sender identification and unsubscribe requirements for commercial electronic messages [S19]. Whether a particular event message qualifies for an exception requires review; adding promotions to a service message can change the analysis.

## 9. Business model and preliminary economics

### Recommended commercial approach

Use a B2B annual service agreement with a defined event allowance, support coverage and separately scoped integrations. Keep core attendee information free. Offer transparent sponsorship placements and merchant referral arrangements only where they fit OVA's existing contracts. Do not fund the service through selling youth profiles or behavioural targeting.

Suggested packaging for buyer interviews—not validated prices:

| Package | Scope | Price hypothesis in CAD |
|---|---|---|
| Discovery and connector feasibility | Workflow mapping, sample feeds, incumbent assessment, prototype | $8,000–$20,000 one-time |
| Limited event pilot | One source, companion, staff console, basic roster/content import, event support | $35,000–$75,000 incremental delivery |
| Annual managed service | Hosting, updates, agreed events, monitoring and support | $18,000–$45,000/year; new connectors separately scoped |
| Expansion | Multiple associations, additional integrations, native app or managed commerce | Quote only after pilot |

These are proposed sale-price experiments, not cost estimates or competitor quotes. A discounted pilot can be strategically reasonable, but should not conceal the full cost of production delivery.

### Transparent delivery-cost scenario

Assume 12 weeks, 2 engineers at 35 hours/week, plus 280 combined hours of design, product, QA and operations: **1,120 hours**. At an illustrative blended fully loaded cost of **$80–$120/hour**, labour is **$89,600–$134,400**. Add 20% contingency: **$107,520–$161,280**. Vendor licensing, travel, legal review, taxes, app-store work and major upstream changes are excluded. A student prototype using fixtures is much smaller and is not a production pilot.

Annual operating illustration: infrastructure $300–$1,000/month ($3,600–$12,000/year); maintenance 8–20 hours/month at $100/hour ($9,600–$24,000/year); event coverage 40–120 hours at $100/hour ($4,000–$12,000/year). Total **$17,200–$48,000/year**, excluding source licensing, large email/SMS volumes and development amortization. These are planning inputs, not supplier quotes.

### Sponsorship sensitivity

Illustrative only: four event sponsor packages at $2,500 produce $10,000 gross; $50,000 of attributable merchandise sales at a negotiated 5% referral share produces $2,500 gross. Combined $12,500 before selling costs, refunds and fees would not cover the whole operating-cost range. Do not present merchandise GMV as product revenue, or attribute all sponsor sales to the application.

For a $30,000 annual service fee and $12,500 contribution from commercial activity, OVA's remaining expense is $17,500. At an assumed $40/hour value of staff time, time savings alone would require 437.5 hours/year to offset that expense. Experience quality may add value, but it must be measured rather than assumed.

No defensible total-addressable-market estimate can be produced from the supplied team counts. Build a bottom-up account list of associations and event operators, validate annual event spend and procurement ability, then calculate reachable accounts × tested annual contract value. OVA is a potential design partner, not proof of broader demand.

## 10. Build, buy or extend

| Route | Main advantage | Main concern | Recommended use |
|---|---|---|---|
| Extend current OVAchamps | Existing distribution, content and relationships | Contract/API limitations may constrain improvement | First option to investigate |
| Configure an event platform | Faster standard content/sponsor capabilities | Volleyball identity and data integration still required | Request scoped vendor demonstrations |
| Build a custom companion | Precise family journeys and source transparency | Higher maintenance and connector ownership | Proceed if pilot establishes incremental value |
| Replace competition systems | Potentially unified operations | Migration risk and unnecessary scope | Outside this brief |

Evaluate all options against the same scripted tasks: follow two teams; identify a court change; see an unpublished result correctly; find an accessible entrance; correct roster visibility; operate with a failed source. Compare three-year total cost including support, data access, switching and content administration.

## 11. Validation programme and rollout

### Discovery, approximately two weeks

Interview 8–12 parents (including multiple-team households and accessibility needs), 3–5 coaches/managers, 2–3 referees, 3–4 OVA staff, and 2 venue/commercial partners. This is a proposed qualitative sample, not completed research or a representative survey. Observe several real event-day tasks where possible. Map each source, handoff, permission and owner.

Questions: Which information is repeatedly searched? Which changes are missed? How many roster edits occur? Who can approve public photos? How often does staff re-enter the same fields? What must remain visible without sign-in? Which incumbent app metrics are available? Would a buyer pay for this incremental improvement?

### Functional prototype, approximately one to two weeks

Use synthetic teams and clearly labeled fixtures. Demonstrate event entry, following two teams, a combined itinerary, one changed court, stale-source handling, a venue guide, merchandise links and staff publishing. Include a test email or push only to consenting internal testers. A simulated connector must be labeled simulated.

### Production pilot, approximately ten to fourteen weeks after access is secured

Implement one source, complete privacy/accessibility review, rehearse failure recovery, train staff and run one limited event. Avoid a first-ever launch across all championship venues. Add the remaining sources only after integration and staffing gates pass.

### Proposed success measures

| Measure | Definition | Pilot target, subject to baseline |
|---|---|---|
| Task success | Participant finds next match and correct court unaided | ≥90% in observed tasks |
| Time to answer | Median time to find match plus location | ≥30% lower than current flow |
| Repeat data entry | Staff minutes spent re-entering approved content/rosters | ≥30% reduction |
| Schedule parity | Sampled published fields matching the authoritative source | ≥99.5%; investigate every wrong-team mapping |
| Alert creation delay | Validated source change to internal inbox creation | p95 ≤60 seconds, excluding source publication/polling |
| Source transparency | Stale/outage cases visibly identified | 100% of injected scenarios |
| Accessibility | Critical user journeys with manual and assistive-tech review | No unresolved blocking defects |
| Adoption | Unique users following ≥1 team / unique event users | Establish baseline first; do not invent adoption |

Instrument only what is needed. Measure activation, repeat use, task success and staff time rather than screen time. Segment by event/day and device without exposing small groups or individual minors to sponsors.

## 12. Principal risks and discovery decisions

| Risk | Severity | Mitigation / stop condition |
|---|---|---|
| No permitted structured feed | Critical | Secure rights and sample data; otherwise constrain claims and use source links |
| Wrong team identity across systems | Critical | Stable mapping, manual review, fail closed for ambiguous records |
| Stale court/time presented as current | High | Freshness state, provenance, authoritative corrections and outage banner |
| Youth data overexposure | High | Publication-specific consent and field allowlist; restricted originals |
| Duplicate roster workflow | High | Confirm MRS flow before introducing new collection |
| Existing app already meets needs | Commercially high | Compare actual journeys and extension pricing before custom build |
| Network congestion at venue | High | Small payloads, cached public essentials, onsite signage and help desk |
| Too many alerts | Medium | Categories, deduplication, digest and quiet hours |
| Sponsor revenue disappoints | Medium | Base service economics must stand without speculative conversion |
| Event-day support gap | High | Named operator, escalation rota, rehearsed rollback and incident communications |

Before committing: obtain OVA owner and budget; current app analytics and contract; vendor contacts and access terms; roster/publication policy; exact pilot scope; venue connectivity and map files; support coverage; approved languages; and baseline staff effort.

## 13. Smoothcomp review and feature adaptation

**Added 17 October 2026.** This is an extensive desk review of official Smoothcomp app documentation, documented interface examples, organizer documentation and current product announcements. No authenticated app session, Pro purchase, organizer-console test or performance benchmark was performed. Published capabilities are distinguished from proposed OVA features. No Smoothcomp API availability or internal implementation is assumed.

### 13.1 Product model and relevance

Smoothcomp connects athlete identity, academy membership, registration, scheduling and results within an operational ecosystem. Its mobile app documentation describes personalized competition access, while distinguishing Pro notifications, activity feeds and lock-screen countdowns [SC1]. Exact Canadian prices and entitlements have not been validated and can change.

The main lesson for OVA is to organize event information around **who I follow and what happens next**. OVA depends on multiple competition systems, so equivalent presentation requires trustworthy identity mappings and source updates. Adapting a screen does not supply the data behind it.

### 13.2 Detailed capability assessment

| Documented Smoothcomp capability | Value | Proposed OVA adaptation | Priority and constraint |
|---|---|---|---|
| Home-page next match, multiple-match navigation and links to bracket/event [SC2] | Immediate preparation information | Next Match card with team, opponent, time, court, venue and freshness | MVP; show TBD when unresolved |
| Upcoming, Now and Finished match tabs; participant/academy/category/mat filters [SC3] | Fast discovery in large events | Upcoming / In Progress / Results with team/division/day/venue/court filters | MVP; source must confirm in-progress state |
| Following athletes, academies and events with alerts [SC4] | Avoids repeated searches | Follow teams, clubs and divisions, with optional notifications | MVP team following; no private access implied |
| Family shared profiles, separately from coach management [SC5] | Combines household participation | Combined household itinerary across followed teams | MVP itinerary; dependent identity management deferred |
| Dynamic estimates based on tournament progress [SC6] | Helps preparation as timing changes | Official revised/estimated starts alongside scheduled time | Conditional on authoritative data |
| Pro lock-screen match countdown with preceding-match progress [SC7] | Glanceable event awareness | In-app scheduled-time countdown; later native live status | Native feature deferred; web MVP does not promise parity |
| Activity feed and notification preferences [SC1, SC8] | Relevant updates collected together | Durable Updates inbox, filters and revision-based deduplication | MVP inbox; external delivery later |
| Manager/coach/member permissions and member approvals [SC9] | Controlled delegation | OVA-approved event/team role grants and roster review | Basic roles in MVP; MRS retains eligibility |
| Academy ongoing/upcoming events and registration management [SC9] | Team-wide operations overview | Coach view with matches, briefing, check-in link and review status | Basic view; registration remains upstream |
| Mat overview and schedule detail sidebar [SC3, SC10] | Navigation retains context | Court list plus match bottom sheet on phone and side panel on desktop | MVP list; court board later |
| Scheduler dropzone, filtering, pin/collapse, drag/drop and save/cancel [SC10] | Makes complex planning explicit | Staged import preview, filtered exception queue and publish/cancel actions | Adapt interaction principles; no scheduler |
| Organizer streaming with scoreboard overlays [SC11] | Match-linked viewing | Approved stream links on match/court pages | Links only initially |
| Newly announced Coach Companion and coaching coordination [SC12] | Distributes coaching attention | Future club staff coverage board and conflict warnings | Expansion; separate from referee allocation |
| Newly announced Smoothrecorder and match-linked recordings [SC12] | Associates footage with competition context | Future permission-controlled match media links | Deferred pending privacy, moderation and cost review |

### 13.3 Recommended interface adaptations

**My Day:** One prominent Next Match card above the itinerary; team chips retain context while switching. Default to all followed teams. Display the selected event and venue clearly. A parent should not need to open the full tournament bracket to find a court.

**Matches:** Preserve filters when opening and closing details. Use upcoming, in-progress and results tabs, with an accessible filter sheet. Show winners with text and score, not colour alone. Do not infer a match is live from its scheduled start passing.

**Match detail:** Use a mobile bottom sheet or desktop side panel. Prioritize opponent, location and time; then provide bracket, directions, calendar and approved stream links. A changed court displays old and new values. A deep link points to the canonical match rather than a transient filtered row.

**Updates:** Separate operational changes, results and optional promotions. Identify affected team, timestamp and revision. Keep critical event information prominent without overwhelming the home screen with unrelated activity.

**Event Guide:** Offer parking, food, accessible routes, merchandise and sponsor discovery between matches. These are useful companion services, but the urgent next-match task should stay easy to find.

These are original OVA proposals informed by public product patterns; they do not reproduce Smoothcomp branding, code, proprietary scheduling algorithms or design assets.

### 13.4 Household access versus coach authority

Smoothcomp's family documentation distinguishes shared profiles from coach management [SC5]. Its My Matches documentation illustrates matches across shared profiles and events [SC2]. For OVA, a parent can obtain the essential benefit by following multiple teams without creating child identities.

Store household labels privately. Following a team grants public information only; it does not prove guardianship. If dependent records are added later, require an explicit, revocable and appropriately verified relationship. Coaches need organization/event/team grants, separate from personal preferences. Do not copy a first-creator ownership rule for existing OVA clubs: authorized staff must verify the grant.

### 13.5 Dynamic timing: the crucial adaptation limit

Smoothcomp documents ETAs using current time, remaining matches and estimated duration, updated with competition progress [SC6]. That operates within its scheduling/result ecosystem. Volleyball introduces variable sets, warmups, work duties, court delays and unresolved bracket dependencies.

Use this timing hierarchy: official published start; official revised start; official estimate with freshness; only later, a separately validated application estimate. Preserve the distinction between schedule and estimate. Do not infer “three matches until yours” from an unordered export. Stop estimate countdowns when stale, and avoid presenting a completed-but-unscored match as currently playing.

An OVA companion should initially offer a clear time and status rather than an unsupported precision claim. Official source links and visible update times remain available when the source is unavailable.

### 13.6 Notification and entitlement lessons

Smoothcomp's FAQ and troubleshooting guide distinguish following, user preferences, permissions and Pro capabilities [SC1, SC8]. OVA should make these states inspectable: followed team, enabled category, verified email, push support and permission. A source that has not published matches is different from a disabled notification channel.

Lock-screen Live Countdown is documented as a Pro feature [SC7]. Treat it as a future native-app benchmark. Ordinary PWA notifications do not provide an equivalent native live-status surface. Keep essential OVA schedule and operational information free; organizer subscriptions and appropriate sponsorship can fund the experience. This is a proposed OVA model, not evidence about Smoothcomp's commercial performance.

### 13.7 Organizer tools and administrative work

The scheduler's visible unscheduled area and explicit save/cancel workflow [SC10] suggest a useful OVA import pattern: stage rows, highlight unresolved mappings, compare old/new fields, validate before commit, then publish with an audit record. Keep unresolved work visible instead of silently discarding it.

Do not introduce draggable official match times in the companion. Staff correction requests go to the source owner; the app can display an official operational notice without changing source provenance. A rollback restores the companion projection and retains history. Coach coverage and referee assignments remain separate entities and workflows.

### 13.8 Latest ecosystem developments

An official announcement dated 6 October 2026 states that Smoothcomp joined the Gymdesk family and announces Coach Companion and Smoothrecorder [SC12]. This expands the comparison beyond athlete/fan viewing to staff coordination and recordings. These newly announced products have not been independently evaluated for adoption, reliability or complete entitlements.

Smoothstreamer is documented as an organizer streaming application [SC11]; Smoothrecorder is a separate recording proposition [SC12]. Neither establishes that OVA can immediately reproduce video production without rights, consent, infrastructure and operating staff.

### 13.9 Build order and validation

| Stage | Adaptations | Release evidence |
|---|---|---|
| Fast MVP | Next Match, multi-team itinerary, persistent filters, status tabs, match drawer, Updates inbox, staged imports | Complete parent/admin journey with synthetic and approved sample data |
| Expansion | Email/push, court board, coach coverage, subscribed calendar, source-supplied estimated timing | Reliable revisions, delivery controls and source contracts |
| Separate business case | Native lock-screen status, media production, athlete career profiles, predictive ETA | Device/account tests, privacy review and measurable user benefit |
| Outside scope | Weigh-ins, combat-sport scoring, bracket generation, paid registration and membership replacement | Existing systems retain these responsibilities |

Validate with timed tasks: follow two teams; find the next court; recognize a changed time; understand a stale estimate; handle unpublished brackets; inspect multiple team matches as a coach; find a roster publication problem. No measured task-time or satisfaction improvement is claimed before testing.

### 13.10 Smoothcomp source register

Official materials retrieved 17 October 2026; older help articles can lag current releases. No unsupported private integration access was used.

| ID | Source |
|---|---|
| SC1 | [Mobile app FAQ](https://support.smoothcomp.com/article/392-q-a-about-the-mobile-app) |
| SC2 | [My matches](https://support.smoothcomp.com/article/90-find-out-your-dynamic-starting-timeWEIGH-INSAll) |
| SC3 | [Finding matches](https://support.smoothcomp.com/article/75-find-out-who-is-fighting-right-now) |
| SC4 | [Following profiles/events](https://support.smoothcomp.com/article/357-how-to-follow-a-profile) |
| SC5 | [Family/shared profiles](https://support.smoothcomp.com/article/185-how-can-i-manage-different-profiles-from-one-account) |
| SC6 | [Scheduling and ETA](https://support.smoothcomp.com/article/73-how-to-schedule-your-tournament) |
| SC7 | [Live Countdown](https://support.smoothcomp.com/article/361-live-activity) |
| SC8 | [App troubleshooting](https://support.smoothcomp.com/article/393-troubleshooting-mobile-app) |
| SC9 | [Coach account](https://support.smoothcomp.com/article/286-how-to-use-your-coach-account) |
| SC10 | [New scheduler](https://support.smoothcomp.com/article/310-new-scheduler) |
| SC11 | [Smoothstreamer](https://support.smoothcomp.com/article/297-smoothstreamer) |
| SC12 | [Smoothcomp/Gymdesk announcement](https://smoothcomp.com/en/about/smoothcomp-gymdesk) |

## 14. Final MVP technology decision

Use Next.js, TypeScript, Tailwind and shadcn/ui on Vercel; FastAPI and PostgreSQL on Railway; SQLAlchemy/Alembic; Clerk authentication; Railway object storage for approved non-sensitive assets; and a database-backed background worker. Initial updates are in-app, with CSV ingestion and ICS export. This replaces the earlier Supabase suggestion. No live application migration has been performed.

Railway provides hosting and infrastructure; it does not automatically replace Supabase Auth, authorization policies, storage APIs or realtime subscriptions. Implement those responsibilities explicitly. Use the new **OVA_MVP_Technical_Implementation.md** as the controlling MVP build plan; the catalogue remains the broader feature reference.

Railway documents private S3-compatible buckets and presigned serving, but also lists unsupported features including server-side encryption and object versioning. Avoid storing sensitive original youth documents in the MVP; if later required, use reviewed encrypted storage or application-level encryption and a separate key-management design. Confirm current capabilities before procurement.

References: [Railway FastAPI](https://docs.railway.com/guides/fastapi), [PostgreSQL](https://docs.railway.com/databases/postgresql), [Storage buckets](https://docs.railway.com/storage-buckets), [Clerk Python integration](https://clerk.com/articles/how-to-add-authentication-to-a-python-backend).

## Appendix A — Separate CAIL opportunity in the attachment set

The two CAIL slides ask how natural language can help newer IT operators understand, monitor and troubleshoot mission-critical systems while retaining expert knowledge. CAIL's own site confirms a NonStop-focused product area [S20]. The slides' “one of only three companies” claim has not been independently verified and is not used as a market-size claim.

A suitable distinct concept would be an **evidence-grounded operations assistant**: approved documentation retrieval; timestamped read-only telemetry; explanation of alerts; expert-reviewed diagnostic runbooks; incident handover summaries; and a training sandbox. It should show system/version context and source citations. Any later action execution requires allowlisted operations, scoped credentials, approval, an audit trail and independently tested recovery procedures.

This is a separate enterprise buyer, security model and research programme. The attached CAIL information is too limited for a credible full technical catalogue or market assessment. It is deliberately not blended into the OVA recommendation; the supplied OVA brief and team discussion provide the basis for the requested two-file package.

## Sources and research limitations

All sources below were retrieved in this research session on 17 October 2026 UTC. Search extraction was used where direct rendering was blocked. Vendor pages are evidence of their own published claims, not independently tested performance. No public API access was confirmed for AES, TIMU, MyTeam.Click or MRS. Actual sample roster documents, private contracts and usage analytics were unavailable.

| ID | Source | Used for |
|---|---|---|
| S1 | [OVA Ontario Championships](https://www.ontariovolleyball.org/ontario-championships) | Event scale and current multi-city context; direct fetch returned 403, search extraction available |
| S2 | [OVAchamps news](https://ovachamps.prezappxd.com/ova-news-1) | Existing app content and operational communication |
| S3 | [OVA 2026 Team Information Handbook](https://cdn3.sportngin.com/attachments/document/d618-3355531/OC_s_Team_Information_Handbook_2026_FINAL_V1.1.pdf) | AES access and after-match result publication |
| S4 | [SportsEngine AES FAQ](https://aes-help.sportsengine.com/en/articles/8267441-faq) | Publication cadence and correction ownership |
| S5 | [OVA 2025–26 Club Administration Checklist](https://cdn4.sportngin.com/attachments/document/d35c-3450795/Club_Admin_Checklist__2025-26_.pdf) | MRS roster/photo submission |
| S6 | [TIMU for associations](https://timu.ca/associations.html) | Published tournament and mobile capabilities |
| S7 | [MyTeam.Click developer app listing](https://apps.apple.com/ca/app/myteam-click/id1201835665) | Schedule and score-entry description |
| S8 | [Smoothcomp follow/unfollow](https://support.smoothcomp.com/article/357-how-to-follow-a-profile) | Persistent following |
| S9 | [Smoothcomp app questions](https://support.smoothcomp.com/article/392-q-a-about-the-mobile-app) | App and premium-notification capabilities |
| S10 | [TeamLinkt team app](https://teamlinkt.com/sports-management-software/team-app) | Team communication and reminders |
| S11 | [Cvent Attendee Hub](https://www.cvent.com/en/event-marketing-management/attendee-hub) | Event engagement category |
| S12 | [Cvent monetization guidance](https://support.cvent.com/articles/en_US/Knowledge/Monetizing-Your-Attendee-Hub) | Sponsor placement patterns |
| S13 | [Apple web-push documentation](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers) | Home Screen web-app constraints |
| S14 | [Google Calendar incremental synchronization](https://developers.google.com/workspace/calendar/api/guides/sync) | Calendar synchronization design |
| S15 | [Google Calendar events update](https://developers.google.com/workspace/calendar/api/v3/reference/events/update) | Updating existing calendar entries |
| S16 | [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Accessibility engineering target |
| S17 | [Ontario website accessibility guidance](https://www.ontario.ca/page/how-make-websites-accessible) | Applicability and provincial baseline |
| S18 | [OPC meaningful consent guidance](https://www.priv.gc.ca/en/privacy-topics/privacy-for-businesses/appropriate-handling-of-personal-information/collecting-personal-information-and-consent/consent/gl_omc_201805/) | Youth privacy and consent principles |
| S19 | [CRTC CASL consent guidance](https://crtc.gc.ca/eng/com500/guide.htm) | Commercial-message controls |
| S20 | [CAIL with NonStop](https://cail.com/cail-with-nonstop/) | Separate attachment context only |
