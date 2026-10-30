# 056. Softer palette: a slate ground, a moss volt

Status: Accepted (2026-10-29). Amends 047 (squared grid: the token values
in its table) and `docs/design/spec/tokens.md` §1 (see the 056 addendum
there). Nothing structural changes: the names, the components and the
layout are as they were.

## Context

The owner asked to "ease up the UI a bit": "the UI is perfect for now but
let's make the colours a tad bit easier on the eyes, a little bit softer,
less sharp black with bright yellow". Measured on master `130a54d`:

- **The ground was a near-black.** `--ink #07080d` has a relative
  luminance of 0.0026, which is where the eye reads "off". White text on it
  (`--text #eceef5`, 17.3:1) is the harshest pairing in the system, and
  every hairline and every accent sits on it.
- **Volt read as yellow.** `#b8e05a` is hue 78° at 60% chroma. On the
  ground it was 13.2:1, which is brighter than any text needs, and it
  tipped towards yellow next to the ion and synapse cools.
- The rest of the ramp (surfaces, text, alphas) was built around those two
  values, so neither could move alone.

## Decision

Values move, names stay (as in 047), so the whole site shifted in one
commit. Every text colour's AA ratio is written next to it in
`tokens.css`.

1. **Ground: a deep, slightly cool slate.** `--ink #0f131a` (luminance
   0.0066). The surfaces step up from it in the same order as before:
   terminal `#11151d`, well `#12161f`, surface `#171c26`, raised
   `#1f2531`, bubble `#242b39`, selected `#272e3d`. The glass and app-bar
   alphas, the landing cell fills and the ink alphas use the new channels
   (`15 19 26`). The white-alpha hairlines are unchanged: on the lifted
   ground they read a step softer by themselves, and the rails, rules and
   cell borders are still there at 360 and 1440.
2. **Text: one step off white.** `--text #e3e6ed` (14.9:1 on ink, 13.7 on
   surface, 10.9 on selected), body `#cdd1db`, quiet `#bec3cf`, lead
   `#acb2c2`, muted `#949bae` (6.7 / 6.1 / 4.9), dim `#838a9f` (5.4 on
   ink, 5.0 on surface, still never on `--selected`: 3.9). The ramp keeps
   its spacing, so hierarchy reads the same.
3. **Volt: a moss lime.** `--volt #a7cf66` (hue 83°, chroma 50%): 10.4:1
   on ink, 9.6 on surface, 7.6 on selected; `--on-volt #0c1008` on it
   10.8:1. Hover `#b5d97c`, link hover `#c3e194`, soft `#d0e6ac`, edge
   `#66833a`. All 21 `--volt-a*` alphas take the new channels
   (`167 207 102`). It is still the one primary action, focus and success
   colour, and still clearly lime, not green.
4. **Ion and synapse lose a little chroma** to sit with it, same hue
   family: `--ion #66c4d5` (9.2:1 on ink), `--synapse #9d93de` (6.8:1),
   `--synapse-soft #b3abe6`, edges `#2f8292` / `#66833a`. Warn
   `#f5cf95` (12.6:1) and danger `#f58477` (7.5:1) are toned to match,
   with their alphas.
5. **Code greys and skeletons lift with the ground** (`--code-gutter
   #525871`, `--skeleton #2d3344`) so their relation to the surfaces is
   unchanged.
6. **The same values everywhere a token can't reach.** `theme-color`
   in `Document` is `#0F131A`. The styleguide's swatch labels show the
   new hex. The OG cards are regenerated (`pnpm og`). The three.js scenes
   are lane B's (decision 057): they read their colours from the tokens at
   runtime from now on, so this palette flows into them. The transactional
   emails are on their own light palette (`#f4f4f1` / `#16161a`) and
   don't mirror ink or volt, so they are untouched.

## Rejected

Three candidates were rendered side by side on a mock of the app chrome
(header, course head, two cells, a field, pills, keys) over the same
lifted ground:

- **B, mint lime `#9fd58c`.** Softest of the three, but at hue 110° it
  reads as a generic "success green"; the lime identity that volt carries
  through the brand mark, the XP pill and the "your turn" frame is gone.
- **C, soft chartreuse `#b3d47a`.** Closest to the old volt, and for that
  reason still yellow next to the cools; it answered "a tad" without
  answering "less yellow".
- **A, moss lime `#a7cf66`.** Chosen: lime, not yellow, and not green.
- **A greyer ground** (`#141821` and up) was tried on the mock and
  dropped: it starts to read as grey rather than dark, and the hairline
  grid loses its depth against it. `#0f131a` is the "tad".

## Consequences

- Contrast is lower everywhere, by design, and still AA everywhere:
  the lowest text pairing in use is muted on selected (4.9:1); the lowest
  overall is dim on surface (5.0:1).
- The one visible side effect of a lighter ground is that the white-alpha
  hairlines contrast slightly less with it. If a future page needs a
  firmer rule, use `--line-strong` rather than raising the family.
- `docs/design/spec/tokens.md` §1 tables still show the 047 values; the
  056 addendum at the end of §1 lists the new ones. The artboards
  (`docs/design/artboards/`) are not updated: they are the 2026-10 source
  and are read with 047 + 056 applied on top.
- Anything that hard-codes a token's hex instead of reading the token
  drifts from now on. The three.js palettes were the last; lane B removes
  them.
