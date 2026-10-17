# Courtside Connected

A mobile companion for Ontario Volleyball Association competitions. It brings schedules, results, rosters and event information from existing systems into one personalized view.

## Competition structure

**Event**:
One competition instance with its own dates, venues and divisions, such as "2026 Ontario Championships, Event 2".
_Avoid_: Tournament (when a specific instance is meant), championship

**Division**:
A group of teams that compete against each other within an event, defined by age or format and tier, such as "15U Boys Division 1".
_Avoid_: Category, bracket, age group

**Entry**:
A team's participation in one event and division. The same club team in two events is two entries.
_Avoid_: Registration, team (when the event-specific participation is meant)

**Pool**:
A round-robin group within a division on a given day, such as "Pool A".
_Avoid_: Group, flight

**Placeholder**:
A match slot whose team isn't decided yet, labelled by how it will be filled, such as "W7" (winner of match 7).
_Avoid_: TBD team, empty slot

**Court**:
A playing surface at a venue, identified by its number and an area label such as "Court 53 · Hall C". Court numbers are only unique within a venue.
_Avoid_: Field, net

**Delay notice**:
A staff-posted, expiring notice that a court is running about N minutes behind. It sits beside the official start time and never replaces it.
_Avoid_: Reschedule, new start time

**Official start**:
The start time the source publishes for a match.
_Avoid_: Scheduled time (when the source's value specifically is meant)

**Estimated start**:
An expected start shown beside the official start, either published by the source or worked out from a delay notice. Always labelled with who it came from.
_Avoid_: ETA, predicted time, live time

**Work team**:
A team assigned by the source to referee or keep score for another match.
_Avoid_: Ref team, duty team

**Work duty**:
A match a followed entry is assigned to as the work team. It shows in My Day apart from the entry's own matches.
_Avoid_: Ref assignment, shift

## Data and trust

**Source**:
An external system that owns a kind of competition data for an event, such as AES for schedules and results or MRS for rosters. The source is always authoritative.
_Avoid_: Feed, provider, integration

**Freshness**:
How recently the companion successfully checked a source, shown alongside the data it supplied.
_Avoid_: Live, sync status

## People and following

**Follow**:
An attendee's choice to track an entry or a division, which shapes My Day and Updates. A follow grants no access to private information.
_Avoid_: Subscribe, favourite, save

**Label**:
A private name an attendee gives a followed entry, such as "Maya's team", kept only on their device.
_Avoid_: Nickname, player follow

**My Day**:
The personal view of upcoming matches and changes for everything an attendee follows.
_Avoid_: Itinerary, dashboard, home
