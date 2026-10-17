# CSV interchange format

The app owns this format. It doesn't copy any vendor's export, so staff map an approved export to these columns, and a future vendor adapter emits the same rows. Files are UTF-8, at most 5 MB and 10,000 rows. Unknown columns are rejected in strict mode, which also keeps fields like birthdates out of the system.

Import in this order: entries, then matches, then rosters. Matches and rosters refer to entries by `external_entry_id`, and an id that hasn't been imported is an error. The importer never guesses a team from a similar name.

## entries.csv

| Column | Required | Notes |
| ------ | -------- | ----- |
| external_entry_id | yes | The source's id for this team in this event |
| team_name | yes | |
| division | yes | Created if new |
| club_name | no | |
| division_code | no | Short code such as `15UB D1` |

## matches.csv

| Column | Required | Notes |
| ------ | -------- | ----- |
| external_match_id | yes | |
| division | yes | Must exist |
| venue | yes | Must match a venue set up for the event |
| court | yes | A new court label under a known venue is created on commit |
| status | yes | scheduled, in_progress, completed, cancelled or postponed |
| scheduled_start | no | ISO 8601. Without an offset it's read in the event's timezone. Blank means awaiting schedule |
| home_entry_id, away_entry_id | one of these or a placeholder | |
| home_placeholder, away_placeholder | | Labels such as `W7` or `1st Pool A` until results decide the team |
| work_entry_id | no | The work team the source assigns to referee this match. Must be an imported entry. Leave blank when there is none |
| round | no | Pool A, Quarterfinal, Gold medal |
| set_scores | no | `25-21 22-25 15-12` |
| estimated_start, source_updated_at, source_revision, external_event_id | no | Provenance from the source |

A match missing from a file is left alone. To cancel one, send it with `status=cancelled`.

## rosters.csv

One row per player.

| Column | Required | Notes |
| ------ | -------- | ----- |
| external_entry_id | yes | |
| jersey | yes | 0 to 99, unique within the team |
| display_name | yes | The approved public name, for example first name and last initial |
| position | no | |
| photo_url | no | Kept only when `photo_approved` is yes |
| photo_approved | no | yes or no |
| team_photo_url, team_photo_approved | no | Same rule for the team photo |

A roster goes public only when the upload includes a consent review reference. Without one it's saved as a draft for staff to publish later.
