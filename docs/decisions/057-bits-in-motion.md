# 057. Bits in motion: the three.js scenes draw bits, bytes and graphs

Status: Accepted (2026-10-29). Amends 012 (the landing field), 041 (the
catalog background, now a scene) and 044 (the sign-in brain). Keeps 034
(the landing pause control), 046 (slim three) and 048 (the field's
footprint). Part of the "ease up the UI" wave with 056 (palette) and 058
(the bits motif in components).

## Context

The owner asked for "some cooler and larger three.js animations" and to
"really dial in on that binary, bit, graph play for the UI", with the
layout left alone. The three decorative canvases were kin only by colour:
the landing had a round-sprite neural network that morphed into a token
ribbon, a torus knot and a galaxy; the catalog had a CSS rabbit hole of
square frames; the sign-in page had a breathing sphere of round points.
Each hard-coded its hex colours, so the palette pass (056) would have
missed them.

## Decision

### One vocabulary: the bit

Every scene draws **bits**: square cells that read as a 1 (a filled square)
or a 0 (a hairline outline; a cell under about 7px dims instead, since the
outline can't show). The sprite is `bitAlpha()` in
`app/actions/public/bits-gl.ts`, flat per 047: no core highlight, a
one-pixel soft edge, normal blending. Cells flip on their own slow clocks
(about a third on at any moment, a flip every few seconds), so a still
shape still reads as data. The old round sprites, additive glow and white
cores are gone.

### The landing field (`home/public/field-scene.ts`)

Four formations, as before morphed by scroll (the mapping, holds, easing,
HUD mechanics, the pause control and the reduced-motion rules of 034 are
unchanged):

| Stage | Was | Now |
|---|---|---|
| 01 Bits (was Neurons) | layered neural net with edge signals | four **bit-planes**: grids of cells stacked in depth, staggered half a cell, tilted like a deck seen from above, each plane outlined in ion. The deck clears the middle of the screen where the hero copy sits and frames it (`uClear`); on a phone it sits low, under the prompt bar. The quietest stage (alpha 0.65, 0.5 on phones). |
| 02 Tokens | a ribbon of 26 token blocks | four **tapes of bytes**: a column is a byte (eight cells), four columns a word, then a gap, winding through the view and off both sides. The pattern **streams**: a cell's bit is a hash of the column passing it (`uStream`), so the data flows while the cells stand. Points that don't fit a tape are dust (weight 0.22). |
| 03 Agents | a (2,3) torus knot and a core | a **graph**: 34 shell nodes on a squashed sphere, joined in a loop around it (the agent's cycle) and to their two nearest neighbours, with spokes to a five-node core. Each node is a **chip**, a small square grid of cells sized by its degree; the other half of the points sit along the edges; synapse hairline edges and 180 square signals run them, shown only around this stage. |
| 04 You | a three-armed galaxy | the galaxy, of bits, 12% wider. |

Per point the geometry now carries a size and a visibility weight per
formation (`aSz`, `aW`, vec4), so formations can differ in density and
cell size; the shader blends them with the positions. Counts: 1,600 under
760px, 3,600 under 1180px, 4,800 above (was 1,500 / 3,400). The cell
pitch is 0.5 units (about 30px at 1440×900) and a unit cell is `190 /
distance` pixels.

The stage HUD reads `01 · Bits`, `02 · Tokens`, `03 · Agents`, `04 · You`.
The vignette's stops are `color-mix()`es of `--ink`, so a palette change
carries into it; its centre is a little clearer than 048's (16% at 68%,
78% at the edge).

### The catalog (`courses/public/catalog-bg.tsx`): the course graph

041's CSS rabbit hole is replaced by a scene of the **courses as a graph**.
`CatalogPage` passes the page's courses (tone and lesson count, in path
order) to the island. Each course is a chip of bits in its track's colour,
sized by its lesson count, its lessons trailing up and out of it as a
string of cells; a trail of bits joins each chip to the next. The graph
assembles over 4.4 s (cells pop in to their own moments, the group turns
to rest) and then **stops**: the loop ends, the canvas is marked
`data-rest`, and a resize redraws the final frame once. So, as in 041, it
needs no pause control (WCAG 2.2.2). Picking a track remounts the layer
(`data-rmx-key`) and plays the new graph; a search keeps it. The art is
clipped to the ruled column; the graph paper runs full bleed.

Trade-off: the catalog now loads three (about 110 KB brotli, shared with
the landing and usually cached) after load and idle, for a scene that
rests after four seconds. The owner asked for three.js scenes and the
graph *is* the catalog, so the page's art means something. Without WebGL
the graph paper stays, as on the landing.

### Sign-in (`login/public/brain-canvas.tsx`): a sphere being written

2,600 cells on a Fibonacci sphere (radius 3.4, filling the pane's width)
turn from 0 to 1 in a sweep from the top, jittered, while a tilted ring of
40 bytes (8 cells each, synapse) orbits once and locks. Ion at the base
to volt at the crown; cells on the far side fade so it reads as a solid.
The write is done at 4.6 s and the scene rests (`data-rest`), so 2.2.2
needs no control here either. The old breathing sphere ran for ever with
no control, which 034's reading of 2.2.2 did not allow.

### Shared rules (`app/actions/public/bits-gl.ts`)

- **Colours come from the tokens at run time.** `readTokenColors(el,
  sceneTokens)` reads `--volt`, `--volt-soft`, `--ion`, `--synapse` and
  `--text` off the canvas's computed style and resolves any syntax (hex,
  `rgb()`, `oklch()`) on a 2D canvas, with 047's values as the fallback.
  No scene holds a hex. ShaderMaterial uniforms take the sRGB floats as
  they are (`LinearSRGBColorSpace`, so three does no conversion and the
  cells match the CSS exactly); the one built-in `LineBasicMaterial` takes
  them as sRGB, since three converts those on output.
- **Load and draw rules** are shared too: `afterLoadAndIdle()` (never
  race first paint), `canDrawScene()` (WebGL 2, and never under forced
  colours: the canvases are `display: none` there and the scene doesn't
  boot, extending 041's rule to all three), DPR capped at 2, the loop
  stopped when the tab is hidden or the canvas off screen.
- **Reduced motion:** the landing starts paused (034); the catalog and
  sign-in draw their finished frame once.
- **No flashing.** Cells flip asynchronously, each every few seconds; the
  only synchronous changes are the one-shot writes, which turn cells on
  and leave them on.
- three stays out of the Worker and the startup bundle (046): the scenes
  import it only through `public/three.ts`, which gained the two colour
  space constants.

### Tests

- `scenes.test.e2e.ts`: the catalog graph and the sign-in sphere reach
  `data-rest` within five seconds of their first frame, and under reduced
  motion start at rest.
- `courses/controller.test.ts` pins the layer (aria-hidden, keyed, a bare
  canvas, no CSS keyframes) and that the island's courses match the
  catalog.
- `field-motion.test.e2e.ts` (034) and the axe suite are unchanged and
  green: the pause control, the frame counter and the aria-hidden layers
  are as they were.

## Rejected

- **Keeping the catalog in CSS.** A bit lattice that flips once could be
  done in CSS, but not a graph of the real courses, and the owner asked
  for three.js scenes. The cost is one deferred script the landing already
  pays for.
- **A looping catalog or sign-in scene with a pause control.** Neither
  page has a natural home for the control (the catalog's toolbar is URL
  state; the sign-in pane is decorative). A one-shot under five seconds
  is simpler and what 041 chose.
- **Additive blending.** It made the old glow; squares in normal blending
  stay flat and read as cells, per 047.
- **Spelling "bits" with the points.** On-brand, but the fourth stage sits
  under "Progress" and the closing CTA, where a galaxy of bits (the
  learner's growing field) says more than a wordmark.

## Consequences

- The hero cue still reads "Scroll · the network rewires itself"
  (`home/hero.tsx`, outside this change). With bit-planes first, "the
  bits rearrange themselves" would fit better; the owner's call.
- A palette change (056) recolours every scene with no code change; the
  fallbacks in `sceneTokens` should follow the tokens when 056 lands.
- `docs/design/spec/pages/Main.md` §NeuralField describes the artboard's
  port; this record is now the field's source of truth (addendum there).
