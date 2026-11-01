# 063. Light mode depth: lifted surfaces on a deeper paper

Status: Accepted (2026-11-01). Amends 062 (the light values and the direction
of its surface ramp) and 048 (the cell fill and veil on paper). The dark theme
keeps every value.

## Context

The owner liked the light colours, but found the landing's cards and
translucent surfaces hard to read, and said dark looks right everywhere
because the cards stand off the background. Measured against dark, 062 had
three faults:

- **The ramp ran the wrong way.** Surfaces stepped darker than the ground, and
  only by ΔL\* 2.81 from ink to surface (dark: 4.40). A grey card on grey paper
  doesn't read as an object.
- **Cell fills were ground-coloured.** `--cell-fill` was paper at 90%, so a
  plate over the field had the same value as the ground around it, and the
  veil at 55% left the field running through the copy.
- **Copy sat on the open scene.** On ink a scene is dimmer than the text; on
  paper its cells are as dark as the lead text, so mono notes and the HUD broke
  up over them.

## Decision

Same hues, same layout. Depth stays a hairline plus a fill step (047), with no
shadows, glows or blur.

- **The ground sinks and surfaces lift.** `--ink #e9ecf1`, then terminal
  `#f3f5f8`, well `#f5f6f9`, surface `#fcfdfe`: dark's order, ink < well <
  surface. Ink to surface is ΔL\* 5.96. Raised `#dde1e8` and selected `#d0d5de`
  still step darker: on paper a key has nothing lighter to go to, and a darker
  key on a near-white card is the clearer signal.
- **Text and accents go one step deeper,** which holds them on the darker
  ground and lifts them on cards: text `#10151e` (15.45 on ink, 17.96 on
  surface), muted `#4b5567` (6.35 / 7.38), dim `#505a6c` (5.87 / 6.83; now 4.72
  on `--selected`), volt `#3a6315` (5.96 / 6.93), ion `#075a6a`, synapse
  `#5044b4`, warn `#764d08`, danger `#a72b25`. `--on-volt` on volt is 6.57. The
  alpha families take the new channels.
- **Hairlines about 1.75× dark's opacity** (062 used 1.25×): `--line` at 14% is
  ΔL\* 10.4 on ink and 11.1 on a card, where 10% was 7.7 and 7.5 (dark: 9.2).
- **Cells are plates over a scene.** `--cell-fill` is `rgb(246 247 250 / 0.97)`,
  and hover lifts to the surface. `--cell-fill-veil` is ground at 84%: the field
  stays a texture under the copy. `--glass*` goes near-white at 90 to 92%.
- **`--plate-fill` lifts sections off the ground.** A `RuledSection` paints it
  (`#f6f7fa` on paper, clear on ink), so the ground shows between sections, as
  ink depth does in dark. A section over a scene takes `open`: the landing, the
  catalog and sign-in.
- **`--copy-wash` lies under copy on an open scene** (ground at 88%, clear on
  ink): `centreWash` under the hero and closing copy, `leftWash` under band
  intros, solid on phones, and behind an open section's strip and the field's
  HUD labels. The scene keeps its full strength around the copy, so
  `--scene-strength` stays at 0.78.

## Rejected

- **Pure white cards.** 062's reason holds: `#ffffff` glares. `#fcfdfe` gets the
  same lift without it.
- **Darker surfaces with stronger lines.** Lines alone gave outlines, not
  objects; the cards still sat in the paper.
- **Lowering `--scene-strength`.** 062 tried 62%: the field read as a texture.
  The wash clears the copy and leaves the scene striking at the edges.
- **`text-shadow` halos on the copy.** A glow, which 047 rules out.
- **Filling the lesson column with a plate.** Prose reads well on the ground
  (15:1), and the toys and exercises stand out as cards there.

## Consequences

- A `RuledSection` over a scene must pass `open`, or the fill hides the scene.
- Dark's `--copy-wash` and `--plate-fill` are clear ink, so its pixels don't
  change.
- `theme-color` for light follows the ground (`#E9ECF1`, `packages/ui/src/theme.tsx`).
