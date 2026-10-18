# 0011 — Event navigation, media and Team Lead dashboard

2026-10-18

The current user requests supersede the original prototype role labels and navigation. Public event pages use six fixed accessible icon tabs: Overview, Venue Guide, Matches, Teams, Brackets and Media. Source details remain available on match pages. Court graphics are explicitly schematic; they do not claim to represent a real facility floor plan.

Brackets display source rounds and set winners, let users trace a team, and connect only explicit winner/loser match references. They never calculate advancement, seeds or tie-breaks. Unknown progression stays unresolved.

Media reuses audited, event-scoped guide-item CRUD with media_photo, media_video and media_album types and required HTTPS links. No new database tables or storage service is required. Staff publish only media they have approval to share. Photos render as images, videos/albums open the supplied external URL; there is no arbitrary HTML or iframe execution.

Athlete and Team Lead replace Player and Officer in the user interface. Existing player/officer profile values and coach/official grant values remain wire/storage compatibility details, preserving followers, assignments and roster access. Account preferences never grant editing privileges. Existing OVA-scoped grant enforcement remains authoritative.

The user confirmed that staff sign-in now works. Railway production HTTP logs also show successful /v1/admin/me and /v1/admin/events calls. No authentication policy is relaxed. Dashboard improvements add searchable/filterable events and deep links to editing tools; selected tools are retained in the URL.

The supplied OVA trillium image is copied unchanged for background decorations and favicon. The generated transparent illustration is saved in _front/public/discover-volleyball.png, created with the built-in image tool from the two supplied editorial volleyball references, using forest green, sage, lime and ivory, an airborne athlete and ball, no text/logos, full-body composition and a transparent background.

The schedule Visibility popover uses custom animated switches over native accessible checkboxes, stable event colour markers, visible/hidden status, bulk show/hide controls, keyboard Escape dismissal and a labelled close action.

Discover artwork is a non-interactive background layer at 13% opacity, contained within the page with its original aspect ratio and anchored to the headline end so the ball follows its final punctuation. Search, filters and cards stay above it, and the illustration reserves no vertical layout space.

The shared Olley wordmark now uses the supplied OVA trillium emblem in headers, footers and the staff workspace. The athlete illustration is reduced to 60vw (180–420px) and positioned from the headline rather than the page edge.
