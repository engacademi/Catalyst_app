# Mobile search selection

Discover and Tournaments share `DiscoverView`. Its blur handler removed the
suggestion list when focus left the input with a null `relatedTarget`. Mobile
Safari can do this before dispatching a result's click, leaving the user on the
same page.

Dismiss suggestions on a document pointer event or focus entering an actual
outside element instead. Keep native Next links and their touch, keyboard and
modified-click behavior. Escape works from the entire search region; explicit
Close results and selection also dismiss it. Listeners are removed on closure
or unmount. The search input reports its expanded state and respects the public
API's 150-character limit.

Tapping the already focused input reopens dismissed suggestions. Match search
previously controlled its input directly from router state and replaced the URL
on every keystroke; rapid typing could collapse `Northern` to `n`. Keep input
state immediately and debounce URL updates. Match and team inputs accept
external URL changes when there are no newer edits, preserving Back navigation.
Match and My Teams inputs also respect their respective API length limits.

The event Teams page placed results in a closed details section. Searching or
changing division now opens that section, including initial URL filters, while
retaining manual expand/collapse. Its input respects the 100-character API limit.

Regression coverage exercises null-target blur followed by touch navigation for
team, tournament and venue results on both entry pages; outside dismissal,
reopening, clearing, keyboard activation and Teams result navigation. Existing
My Teams and staff event-filter coverage is retained. API responses in UI tests
are fixtures; these checks do not certify production data or physical iOS devices.
