# ADR 0004 — Olley Catalyst visual system

Date: 2026-10-17. Status: accepted for the redesign branch.

## Context

The existing application has functional guest and staff workflows but uses a narrow mobile column on every screen. The redesign must feel premium and welcoming, use green, white and grey, and retain existing functionality. The seven supplied references inform rounded surfaces, legible scores, editorial hierarchy, simple volleyball motifs and restrained motion. They are inspiration, not licensed production artwork.

## Decision

- Use Manrope for headings and DM Sans for body text, self-hosted by Next's font loader. Preserve the exact supplied OVA logo.
- Establish forest green `#164C3B`, deeper green `#103A2D`, soft white-grey `#F3F5F1`, white cards, sage `#E8F0E3`, lime `#D5E8AF`, dark text `#1D332B` and muted text `#5D6C63` as shared tokens.
- Use responsive desktop navigation at 1100px and a five-destination phone/tablet dock below it. Event home, all events, staff and officials remain reachable.
- Keep competition data, source labels, pending scores, consent-filtered rosters and staff permissions governed by the existing API. Decorative artwork never implies a live score or invents event metrics.
- Use original inline SVG court/net/ball artwork and initials-based team avatars. Do not invent team crests or substitute a redrawn OVA logo.
- Use short entrance motion, subtle card lifts, surface gradients and translucent navigation. Disable decorative animations and transitions for reduced-motion preferences. No infinite decorative animation.
- Keep the API, database schema, storage keys and authentication flows unchanged. No new runtime service or environment variable is required.

## Consequences

This is a presentation-layer overhaul, not an implementation of unbuilt requirements. The current requirements document describes AES, delay notices, division following, demo time and other planned functionality that is not implemented on this base commit. This branch neither claims to supply those features nor removes their future integration points. Global tokens and reusable components allow those pages to adopt the same visual system later.

Figma is the editable concept reference; code is the source of truth for the implemented responsive behavior and actual feature availability. The Figma sample uses fictional demonstration teams. Canva supplied an additional illustration concept; its returned 199×112 thumbnail is retained as a reference only, not upscaled into production. Superdesign was blocked by automatic approval review because of an unapproved PostHog analytics transmission and was not used further.
