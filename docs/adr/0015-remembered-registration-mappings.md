# Remembered registration team mappings

Status: Accepted.

Registration exports (R-22) name teams by the registration system's own IDs, which
rarely match the tournament source's entry IDs. Staff map each registration ID to an
event entry when they preview a roster import. Until now that mapping lived only in the
import batch options, so the next export of the same system asked for every team again.

Committing a roster import now saves each mapping staff submitted as an
`ExternalMapping` row with `entity_type = "registration_team"` on the import's source.
The row reuses the existing table and its `(source_id, entity_type, external_id)`
unique key, so no migration is needed. Mappings are scoped to one source, and through
it to one event. The separate entity type keeps a registration ID from ever resolving
as a tournament entry ID.

When staging a roster import, an entry is resolved in this order: a mapping submitted
with this upload, then a remembered registration mapping, then the source's own entry
mapping. Each preview row records which of these was used (`mapping_source`) and, when
a submitted mapping replaces a remembered one, the entry it replaces. Staff can see the
remembered mappings, change them for the next upload, or forget one. Forgetting one is
audited.

Team photos follow the same rule as athlete photos: an unapproved URL is dropped by the
CSV adapter and never stored. The adapter now flags that it dropped one, and the roster
draft's review records the team photo as `approved`, `withheld` or `none` so the coach
review (R-12) can show that approval is missing.
