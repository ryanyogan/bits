# 062. Light mode: a paper theme from the same tokens

Status: Accepted (2026-10-31). Amends 056 (softer palette: the dark values
are untouched and gain a light twin), 057 (the scenes read their strength
from a token and follow a theme flip), 031 (the axe suite's light column
now audits a real theme) and 025 (the reduced-motion rule). Two lanes: this
record is the visual side; the preference (where the choice is stored, the
`data-theme` attribute, the footer and Settings controls) is in
`062-light-mode-plumbing.md`.

## Context

The owner asked for "a well thought out, clean, amazing looking light
mode", and bits is going paid soon, so the bar is premium. Until now the
app was dark only (`color-scheme: dark`, one token set), and 031's axe
suite ran its light column against the same colours, so a light theme
could not ship unchecked. The constraints: the dark theme stays exactly as
056 left it, nothing in the layout moves, link-preview cards and the
favicons stay dark, and every page, toy and state has to hold up at 360 and
1440 in forced colours as well.

## Decision

### One system, two value sets

`packages/ui/src/styles/theme-light.css` re-declares every colour token of
`tokens.css` for a paper ground, and nothing else: names, spacing, type,
radii and motion are shared, so no component or page changes for the
theme. The sheet has one hand-edited block, `:root[data-theme="light"]`
(the viewer pinned light), and a generated twin under
`@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) }`
(no choice stored, the system is light). CSS cannot share one declaration
block between a plain selector and one inside a media query, so
`pnpm --filter @bits/ui theme:sync` copies the first into the second, and
`theme.test.ts` fails when they differ, when a colour token in `tokens.css`
has no light value (a dark colour would leak through), or when the light
block invents a token the dark theme lacks.

A few effects are not colours but still depend on the ground, so they are
tokens too, with a value in each theme: `--key-hover-filter` (an ion or
danger key lifts on ink, `brightness(1.06)`, and darkens on paper,
`0.94`), `--key-hover-filter-strong` (the inverse key's `--on-volt` face:
`1.3` on its near-black, `0.96` on paper, where brightening clipped to
white), `--search-cancel-filter` (the native search `×` is drawn in the
scheme's colour; the dark theme lifts it with `invert(0.6)`, paper keeps
it), `--font-smoothing` / `--font-smoothing-moz` (grayscale AA for light
text on a near-black ground; the platform default on paper, where
grayscale thins dark text) and `--scene-strength` (below).

### The palette, and why

Measured with the WCAG 2.x relative-luminance formula; "ink / surface /
selected" are the grounds, as in 056.

- **Ground: a cool paper, never white.** `--ink #f5f6f8`. The surfaces
  step *towards* the text, in the same order as the dark ramp: terminal
  `#f0f2f5`, well `#eff1f4`, surface `#eceef2`, raised `#e4e7ec`, bubble
  `#e0e4ea`, selected `#dbdfe6`. Depth is still "a hairline plus a fill
  step" (047), only the step goes darker. The glass, app-bar, cell-fill
  and `--ink-a*` alphas take the paper channels (`245 246 248`), so a
  scrim over a scene, the video's control bar and the menu backdrop are
  paper, not ink.
- **Text: a deep slate, never black.** `--text #141a24` (16.1:1 on ink,
  15.0 on surface, 13.1 on selected), body `#2a3240` (11.9), quiet
  `#3a4352` (9.2), lead `#4a5365` (7.2), muted `#586274` (5.7 / 5.3 /
  4.6), dim `#5f697b` (5.1 on ink, 4.8 on surface, 4.7 on a highlighted
  code line; never on `--selected`, 4.1). The ramp keeps its spacing, so
  the hierarchy reads the same.
- **Accents re-derived, not reused.** The dark accents are tints: volt
  `#a7cf66` is 1.6:1 on paper. Each hue is kept and taken deep enough to be
  text: volt `#426e19` (5.6 / 5.2 / 4.5; 4.7 as the focus line's number on
  its own tint), ion `#086678` (6.1 / 5.7 / 4.9; 4.5 on a chip fill),
  synapse `#5a4ec0` (5.9 / 5.5 / 4.8), synapse-soft `#4e43ae` (7.1, the
  syntax keyword), warn `#85570a` (5.8 / 5.4), danger `#b3302a` (5.8 /
  5.4). Hover goes darker, as a deep key should: volt-hover `#41691a`
  (6.0), link hover `#3a5e17` (7.0), volt-soft `#375a15` (7.4, the text
  on volt tints). The 21 volt alphas, 16 ion alphas and 6 synapse alphas
  take the new channels, so tints, borders and the heatmap follow.
- **The volt key.** Its face is the deep moss and its label is
  `--on-volt #f5f8ee` (5.6:1 on volt, 6.0 on volt-hover, 6.1 on ion, 5.8
  on danger). The other way round, a light volt face with dark text, would
  have needed two volt tokens, one for text and one for fills; one token
  is the system, and a dark key on paper is the stronger call to action.
- **Lines.** The white alphas become slate alphas (`20 26 36`) at about
  1.25× the opacity: black at 10% on paper is 1.25:1, white at 8% on ink
  1.22:1, so the rails, rules and cell borders keep their weight at 360
  and 1440. The `+` marks go to 40% (32% on ink), the graph paper under
  the field to 4.5%.

### Code surfaces

Code goes light with the page: terminal `#f0f2f5`, well `#eff1f4`, gutter
greys `#9aa2b4` / `#b6bcc9`, skeletons `#d9dde5`. A dark island on a paper
page would break the one-system feel, and the editor reads as a proper
light IDE. The syntax palette is the accents (keyword synapse-soft 7.1:1
on the well, string volt 5.3, type and number ion 5.8, comment dim 4.9,
plain text-quiet 8.8). The highlighted range (`--volt-a035`) and the
focus line (`--volt-tint`) keep their alphas; they are what made volt and
dim one step deeper (above).

### Scenes

The three.js scenes (057) already read `--volt`, `--volt-soft`, `--ion`,
`--synapse` and `--text` off the canvas at run time, so the field, the
course graph and the sign-in sphere draw the paper accents with no code
change. Two additions:

- `--scene-strength` is the canvas's opacity: 1 on ink, 0.78 on paper.
  Ink-dark cells at full strength read as spatter on paper; at 62% the
  field read as a texture. 78% keeps the deck, the graph and the sphere
  striking and the hero copy clear.
- `onThemeChange()` in `bits-gl.ts` watches `data-theme` on `<html>` and
  the `prefers-color-scheme` query. Each scene re-reads its tokens and
  redraws (the field at once; the catalog and sign-in at rest draw their
  final frame once), so a long-lived scene never keeps the other theme's
  accents. Checked by flipping the scheme on a loaded page and comparing
  the canvas region's mean colour with a fresh load in the other scheme:
  identical for all three.

### What stays dark

The link-preview cards (`/cards/*`, rendered by `scripts/og-images.ts`
with `colorScheme: 'dark'`, since Playwright's default is light), the
favicons and the touch icon (static ink, 058) and the transactional emails
(their own light palette, 056). The dark theme itself is byte-for-byte
056: the diff of `tokens.css` is five effect tokens and `--scene-strength`,
each carrying the value that was hard-coded before.

### Accessibility

`a11y.test.e2e.ts` (031) audits both schemes, and the light column now
means something. It found three pairs under 4.5:1, all tinted grounds:
ion on a fell-out chip (4.0) and on the pressed CC button (4.2), dim on a
highlighted code range (4.48), and volt as the focus line's number on its
tint (4.35). Fixed in the tokens, not the components (above). Forced
colours were checked in light at 360 and 1440 (keycaps, chips, the
outline's current lesson, the quiz, the tutor tile, progress bars): the
025 rules hold on either ground, since they draw with system colours.

The suite also exposed a Chromium quirk. The reduced-motion rule set
`transition-duration: 0.01ms` on `*` (with the default
`transition-property: all`), so a theme flip started a near-zero
transition on every background, and `getComputedStyle` then reported the
*previous* theme's background while paint was already right; axe read
dark-theme text on light-theme ground. The rule now sets
`transition-property: none` instead (nothing listened for
`transitionend`), and the suite also waits for every running
`CSSTransition` to finish after a flip (`colourTransitionsDone`), so a
future transition that survives reduced motion can't be read mid-way
either. The suite audits the pinned themes too: the footer keys on the
landing, and Settings after a save.

### Preference

The choice lives in `users.theme` (migration 0013, nullable: null is
"follow the system") for a signed-in learner and in the session's `theme`
key signed out; `themeFor()` reads the column, then the session, then
`system`, and the column rides along with the session read, so a pinned
theme costs no D1 round trip. The `theme()` middleware wraps
`context.render` in `<ThemeScope>` and `Document` sets `<html
data-theme>`, `color-scheme` and `theme-color` from it, so the first paint
is right without a client script (the strict CSP rules one out). Saving is
a `POST /theme` from the footer's three keys (and `POST
/settings/appearance` from Settings), under `cop()` and `RL_WRITES`, with
a fixed redirect; the first draft's `?theme=` GET was dropped after a
security review (an open redirect and a write on GET). A signed-out pick
is not merged into the account at sign-in, as with `lesson_depth` (053).
The full record is `062-light-mode-plumbing.md`.

## Rejected

- **Reusing the dark accents on paper.** Volt `#a7cf66` is 1.6:1 and ion
  `#66c4d5` 1.9:1 on `#f5f6f8`; neither can be text or a focus ring there.
- **A light volt face with dark text on it.** Keeps the dark key's look but
  needs a second volt for text; and a tinted button on paper reads as
  secondary, where the primary action should be the darkest thing in the
  row.
- **Dark code islands on a paper page.** Familiar from editors, but every
  lesson would carry a dark slab inside a light column, and the tutor
  avatar, the "Your turn" frame and the terminal's field would have to
  switch palette at the slab's edge.
- **Pure white and pure black.** `#ffffff` glares next to a 16:1 text and
  flattens the hairline grid (there is no lighter step to put a surface
  on); the cool paper leaves room for surfaces to step towards the text.
- **Scenes at full strength on paper.** Spatter, see above.

## Consequences

- Every colour token now has two values, and a new one must get both
  (`theme.test.ts` fails otherwise). A `css()` mixin that assumes "up" is
  "lighter" (a `brightness()` filter, an `invert()`, a smoothing mode)
  belongs behind a token with a value per theme, as the five above are.
- The styleguide's swatch labels name both values (`dark #0F131A · light
  #F5F6F8`); the chip shows the theme you are in.
- `prefers-reduced-motion` now removes transitions outright. A component
  that needs a transition to end under reduced motion (none does today)
  would have to opt back in.
- Screenshots of this pass are in the session scratchpad, not the repo.
  Chromium's stale computed background under a 0.01ms transition is worth
  remembering if a contrast audit ever reports a mixed pair again.
