# 041. The catalog's rabbit-hole background

Status: Accepted (2026-10-27). Builds on 020, 025, 027, 031 and 034.

## Context

The owner asked for "one little cool animation with a neat bg" on
`/courses`. The page's headline is "Pick your next rabbit hole." The landing
already has a 3D neural field (012, three.js) and the login page a brain
canvas, so the catalog should be kin to them but not a third particle
field, and it must never compete with the course cards.

034 settled that decorative, `aria-hidden` motion still falls under WCAG
2.2.2 (Pause, Stop, Hide): motion that starts by itself and lasts more than
5 seconds needs a pause control.

## Decision

- **One idea: the rabbit hole, literally.** Eight elliptical hairline rings
  in volt, ion and synapse form a tilted funnel behind the title and search,
  its bottom glowing synapse. On load the rings drop into place, outermost
  first, and five neurons (track-coloured dots) spiral down into it. Then it
  rests as a still funnel over a faint dot grid. It's
  `CatalogBackground` in `app/actions/courses/public/catalog-bg.tsx`.
- **Under 5 seconds, then still.** The whole sequence ends by 4.9 s, so it
  needs no pause control (2.2.2) and costs nothing at rest
  (`document.getAnimations()` has nothing running once it lands). A looping
  version would need a 034-style toggle; we chose the one-shot.
- **Picking a track replays it.** The layer carries
  `data-rmx-key="catalog-bg:<track>"`, so the client navigation (020)
  remounts it when the track changes and keeps it (no replay) for searches
  and anything else. Leaving `/courses` removes it; coming back plays it
  once more. It never duplicates.
- **Pure CSS.** Server-rendered, no island, no script, so nothing to clean
  up and nothing for the strict CSP (027) to block. Keyframes live in the
  component's `css()` mixins (`@keyframes catalog-bg-*`). Only `transform`
  and `opacity` animate; a neuron's spiral is one transform list
  (`scaleY rotate translateX scale`) interpolated part by part, so one
  element orbits inward on the compositor. No `will-change`.
- **Behind content.** The page sits in a `position: relative; isolation:
  isolate` wrapper and the layer is `z-index: -1`, `pointer-events: none`,
  `overflow: clip` (no sideways scroll at 360 px) and masked to fade out
  before the course grid, so cards always sit on plain ink. Alphas are the
  existing tokens (`--volt-a30`, `--ion-a35`, `--syn-a50`, `--syn-a25`,
  `--dot-grid-field`); no new tokens.
- **Reduced motion** shows the resting frame (the same funnel, no drop, no
  neurons). **Forced colours** hide the layer (`display: none`).

## Consequences

- Colours come from tokens only, so a future light scheme recolours the
  rings with the tokens; the alphas may need a light-scheme pass then.
- The controller test pins the markup (aria-hidden layer, 8 rings, 5
  neurons, keyframes present).
