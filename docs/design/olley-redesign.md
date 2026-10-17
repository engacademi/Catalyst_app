# Olley Catalyst — design and implementation

## Design references

Editable desktop and mobile concepts: https://www.figma.com/design/7NLQ9s6vXkrhTd8SvkgRkf

Canva illustration concept: https://www.canva.com/M/MAHYSUIDj-4?utm_source=OC-AaBlKrqBJJNF&utm_campaign=agent_connector_create_image_asset_opened

The supplied meeting/calendar and sports interfaces informed the rounded card system, compact mobile navigation and score emphasis. The volleyball illustrations informed court geometry, the net and an arcing ball. Production uses an original lightweight vector drawing in `components/brand.tsx`; supplied artwork is not copied into the application.

## Research translated into decisions

| Source | Finding and decision |
| --- | --- |
| [OVA Ontario Championships](https://www.ontariovolleyball.org/ontario-championships) | The official indexed page presents the championships as a community festival as well as competition. Use warm copy and familiar venue guidance alongside match information. Search retrieval succeeded; a direct page fetch returned HTTP 403. |
| [Volleyball Canada Youth Nationals](https://volleyball.ca/en/competitions/2026-youth-nationals/mississauga-2026) | Event information covers schedules, championship tiers, accommodation and practical venue planning. Keep the guide and all official results destinations easy to reach. |
| [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | WCAG 2.2 AA specifies 24px targets with exceptions; main navigation, follow buttons and form actions aim for at least 44px. |
| [W3C motion guidance](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) | Offer a reduced-motion experience. Decorative entrance motion and hover displacement are disabled through `prefers-reduced-motion`. |
| Local Next.js 16.4.2 docs: CSS, fonts, server/client components | Keep existing client query hooks, use Next font self-hosting and shared CSS tokens; avoid new runtime animation or illustration dependencies. |

## Foundations

| Role | Value |
| --- | --- |
| Headings | Manrope, 700–800, tighter tracking |
| Body and labels | DM Sans, 400–700 |
| Primary | Forest `#164C3B`; hover `#103A2D` |
| Page / surface | `#F3F5F1` / `#FFFFFF` |
| Secondary accents | Sage `#E8F0E3`, lime `#D5E8AF` |
| Primary / muted text | `#1D332B` / `#5D6C63` |
| Standard card | 22–28px radius, fine border, restrained shadow |
| Motion | 180ms feedback; 350ms page entrance; one 850ms ball entrance |
| Responsive navigation | Bottom dock below 1100px; persistent desktop rail at 1100px and above |

## Implemented screen coverage

| Screen or feature | Treatment / retained behavior |
| --- | --- |
| Event discovery | Illustrated landing hero, indoor/beach event cards, actual dates/venues, demo labels, staff entry |
| Event home | Personalized welcome, shortcuts to teams/matches/guide, announcements, venue information, provenance |
| My Day | Designed empty state, emphasized next match, chronological groups, overlaps, pending matches, results, ICS snapshot |
| Teams | Search and division filter retain URL state; responsive team tiles; initials avatars; original follow controls/storage |
| Team detail | Profile header, matches, approved roster fields, consent-filtered photos and version label |
| Match centre | Status filter buttons, venue/court/division filters, followed-team filter, grouped matches |
| Match detail | Score table with missing scores shown as a dash, schedule/location, history, source timestamps |
| Updates | Notice cards, unread accents, old/new values, automatic refresh and local read markers |
| Event guide | Section anchors, venues, court list, parking, accessibility, food, help, officials, partner links |
| Staff authentication | Branded shell and sign-in surface; existing Clerk modal and local development identity behavior |
| Staff event list | Responsive event cards, role-aware links, event creation |
| Staff event tools | All announcement/import/content/roster/source/demo/audit panels retain existing handlers; shared form and card styling |
| Official assignments | Original private assignment workflow, styled with shared cards and typography |
| System states | Loading, errors, empty results, focus visibility, reduced motion, skip link and explicit status text |

Officials' `link_url` values are now surfaced as resource links in the guide; this fixes an existing display omission without inventing resource destinations.

## Setup and verification

No new backend deployment, database migration, secret or runtime variable is required. Continue using the existing API URL and Clerk variables. Font files are fetched at build time by Next, not from visitors' browsers. The branch does not change API contracts or guest storage keys.

UI verification uses representative intercepted API responses, not a live database or live Clerk session. Run:

```sh
cd _front
npm ci
npx playwright install chromium
npm run build
npm run test:ui
```

The browser suite exercises all attendee routes at 390/768/1440px, 320px reflow, follow persistence, URL filters, missing scores, calendar links, approved roster display, guide resources, every staff panel, reduced motion and automated WCAG A/AA checks. It also rejects browser runtime errors across all attendee routes. It does not establish full WCAG conformance; screen-reader and real assistive-device testing remain necessary for that claim.

See `verification.md` for final run results and limits.
