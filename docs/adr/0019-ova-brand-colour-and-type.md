# ADR 0019: OVA brand colour and type

Date: 2026-10-18. Status: accepted. Supersedes the colour and font choices in ADR 0005.

## Context

OVA's Brand Guidelines v2.0 (October 2026 design refresh) set OVA Green `#81BD41`, Charcoal `#24272A` and White as the core palette, with Charcoal replacing Cool Grey 11. Swiss 721 is the brand typeface for titles and content: Bold for titles, Roman or Light for body text. Charcoal carries primary text and structure, OVA Green is for accents and larger display elements, and small text on white should be charcoal. Other colours may be used selectively for events. The app had to follow these rules.

## Decision

- The tokens in `_front/app/globals.css` now hold the OVA palette. `--brand` is Charcoal, `--brand-lime` is OVA Green, and `--ova-green` and `--charcoal` name the two brand colours directly.
- Dark greens became Charcoal. Pale green surfaces became tints of OVA Green at the same lightness, and near-grey tints became neutral greys.
- The primary call to action is OVA Green with Charcoal text (about 7:1 contrast). White on OVA Green is only about 2.3:1, so the app never puts white or small green text on green or white.
- The focus ring is Charcoal, because OVA Green on white falls short of the 3:1 needed for focus indicators.
- Status colours (warning, danger, info) and the per-event calendar colours stay as they were. These are the "other colours, used selectively" that the guide allows.
- Fonts use the stack `"Swiss 721", "Swiss721 BT", "Helvetica Neue", Helvetica, Arial, sans-serif`. Swiss 721 is a licensed Bitstream face we can't redistribute, so devices with it installed use it and others fall back to Helvetica, which Swiss 721 was drawn from. Titles use Bold (700) in place of the old 800 weight. The Google-hosted Manrope and DM Sans fonts are removed.

## Consequences

If OVA provides Swiss 721 web font files, add an `@font-face` rule in `globals.css` and every screen picks it up through `--font-brand`. On Android, which ships without Helvetica, text renders in Arial until then. Logo and tagline artwork were not changed.
