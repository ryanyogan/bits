# 047. Squared grid design language

Status: Accepted (2026-10-28). Amends 010 (component library), 040
(landing polish) and 042 (design-system consistency). Phase 1 of 2: the
design system and the landing. Phase 2 converts the other pages. Amended
by 050: each section is a framed plate of its own, with the ground showing
between plates, so the frame no longer draws continuous rails and a
section draws its bottom rule itself.

## Context

The owner asked for "a squared off design system, flatter, less bright,
perhaps more of a clean grid system that has light borders (the newer
modern look, like ai hero)". The three.js field, the toys, XP and the
playful copy stay. They are where the fun lives now, not the brightness.
The look then has to carry through the site, page by page, with reusable
components.

## Principles

1. **Squared.** Corners are 0. A circle stays only where roundness means
   something: live dots, avatars that are photos, progress rings, the
   filter dot (`--radius-round`).
2. **Flat.** Depth comes from a 1px hairline and a quiet fill change on
   hover or press. There are no drop edges, glows, float shadows or glass
   blur. A key still reads as a key. It has a mono label, a crisp border on
   the dark keys and a 2px underline drawn *inside* the box. When pressed,
   the key moves 1px and the underline thins.
3. **Calmer accents.** Volt, ion and synapse are less saturated. They are
   signals: a border, a dot, a mono label, a small fill. They are not large
   neon fields. The ink ground stays dark.
4. **A ruled grid.** The content sits in a centred column between two
   hairline rails. Sections are divided by rules that run the full width of
   the screen, and the rails cross each rule with a small `+`. Content is
   laid out in cells that share 1px borders: no gaps and no floating cards.
5. **Mono for structure.** An optional index strip heads each section
   (`02 / How it works`), in mono, sentence case. Use an index only for a
   real sequence (the landing's path). Otherwise use a plain label, or no
   strip.
6. **Fun in motion, not in brightness.** The field, the stage HUD, the
   scroll-drawn path trace, the typewriter and the toys carry the
   personality.

## Token changes (`packages/ui/src/styles/tokens.css`)

The values change and the names stay, so every component and page shifted
in one commit.

| Token | Was | Now | Notes |
|---|---|---|---|
| `--volt` | `#c6ff3d` | `#b8e05a` | 13.19:1 on ink, 12.52 on surface, 10.66 on selected; `--on-volt` text on it 12.97 |
| `--ion` | `#3de3ff` | `#5ec8dc` | 10.26 on ink, 9.74 on surface, 8.29 on selected |
| `--synapse` | `#9d85ff` | `#9b8ce6` | 6.94 on ink, 6.59 on surface, 5.61 on selected |
| `--volt-hover` / `--volt-link-hover` / `--volt-soft` | | `#c6ea70` / `#d3f08e` / `#d9eeaa` | 14.68 / 15.84 / 15.97 on ink |
| `--volt-edge` / `--ion-edge` / `--synapse-soft` | | `#6f8a2e` / `#2e8595` / `#b3a8ec` | |
| every `--volt-a*`, `--ion-a*`, `--syn-a*` | old channels | new channels | same alphas |
| `--radius-*` (all steps), `--radius-pill`, `--radius-keycap`, `--radius-bubble` | 2–28px, 999px | `0` | |
| `--radius-round` (new) | | `999px` | dots, rings, avatars |
| `--radius-tiny` (new) | | `2px` | an inline highlight, at most |
| `--shadow-keycap-*` | 4px drop edge (+ glow on hover/CTA) | `inset 0 -2px 0 <edge>`; pressed `-1px` | `--keycap-edge` 2px, `--keycap-travel` 1px |
| `--shadow-float`, `-editor`, `-card-hover`, `-play`, `-prompt-bar`, `--glow-*` | big soft shadows | `none` | |
| `--ring-sigil` | 6px ink ring | empty shadow | |
| `--focus-ring` | 4px volt glow | empty shadow | the 2px volt outline is the ring |
| `--focus-ring-soft` / `--focus-ring-danger` | 4px glows | `0 0 0 1px` focus border / danger | fields go to a 2px border on focus |
| `--appbar-bg` | ink @ 82% + blur | ink @ 94%, no blur | |

All accents pass AA for text (4.5:1) and UI (3:1) on every ground they are
used on. The script that checked them is the usual WCAG 2.x relative
luminance formula, and the numbers are in the token comments.

New grid tokens:

- `--line-rail`, `--line-section` (both white @ 8%) and `--line-cell`
  (@ 7%). Use them for the rails, the full-bleed rules and the shared cell
  borders.
- `--mark-cross` (@ 32%) and `--mark-size` (11px, odd, so a 1px arm sits on
  the centre pixel). These draw the `+` marks.
- `--frame-max` (= `--page-max`, 1280) and `--frame-inset` (=
  `--page-gutter`; 12px on phones). These set the column and the room
  outside each rail.
- `--section-pad-y` (96, phones 64) and `--section-pad-x` (40, mid 32,
  phones 20). These set a section body's padding.
- `--cell-pad`, which equals `--section-pad-x`, so every left edge lines
  up.
- `--cell-fill` (ink @ 90%) and `--cell-fill-hover`. A cell over a canvas
  gets a flat, nearly opaque ink fill, with no blur.
- `--field-grid` and `--field-grid-step`. These draw the faint graph paper
  under the landing field, which replaced its dot grid.

## Primitives (`packages/ui/src`, all static)

- **`PageFrame`** (`page-frame.tsx`) is the ruled column. It is
  `min(100% − 2·--frame-inset, --frame-max)` wide and centred. Its inline
  borders are the rails, so the rails need no extra element and never shift
  layout. Props: `as` (`div` | `main`, which gets `tabIndex=-1`), `id`,
  `rails`, `mix`.
- **`RuledSection`** (`ruled-section.tsx`) is one band of the frame. It
  has:
  - a full-bleed rule above it (`::before`, 100vw; `body` clips the
    overflow);
  - a `Crosshair` on each rail;
  - an optional header strip of `index` (in `tone`) / `label` … `aside`,
    with a hairline under it;
  - a body padded with `pad` (`default` | `tight` | `none`).

  Sections never draw a bottom border, because the next rule closes them.
  Use `rule={false}` for a first band under a ruled header. Props: `as`
  (`section` | `div` | `header` | `footer`), `id`, `aria-labelledby`,
  `aria-label`, `index`, `label`, `aside`, `tone`, `pad`, `rule`, `marks`,
  `mix`.
- **`CellGrid`** (`cell-grid.tsx`) lays out cells with shared borders.
  Every direct child is a cell. Each cell draws its top border, and its
  right border unless it ends a row (`nth-child(Nn)` per breakpoint), so no
  hairline is ever drawn twice. Translucent lines would darken where they
  doubled. Props:
  - `cols` (from 1024px), `colsMid` (760–1023px; the default is 2, or 3
    for a 3-column grid) and `colsPhone` (the default is 1);
  - `edge`: `flush` fills the frame rail to rail, and the rails and the
    next rule close it; `boxed` adds the outside edges for a grid inside
    padding;
  - `fill` (`ink` = `--cell-fill`), `pad` (`--cell-pad`), and `as`
    (`ul` | `ol` | `div`).

  `cellLinkStyle` makes an `<a>` fill its cell. It cancels the cell's
  padding and takes it on itself. Hover gives `--cell-fill-hover`, and the
  focus outline is inset.
- **`Crosshair`** (`crosshair.tsx`) is the `+` mark, aria-hidden, at
  `top-start | top-end | bottom-start | bottom-end` of a positioned parent
  that sits just inside the rails. It is hidden in forced colours.

They are in `/styleguide` under "Grid", in `components.test.tsx` and in the
AGENTS.md catalogue.

## Components restyled in place

Their APIs are unchanged.

- **Keycap**: no hover lift. The dark key fills `--selected` on hover. Ghost
  keys lost their 10px radius. Primary, ion and danger keys use the inside
  underline.
- **Course card**: no lift or tilt. The border turns volt and the ground
  steps to `--raised`. The sigil still scales.
- **ContinueBanner**: the key no longer lifts.
- **CourseCover** `art`: no glow.
- **Card** `glass`: flat `--cell-fill`, no blur.
- **AppBar**: flat, `--line-section` rule, no blur.
- **AppBarMenu**: the sheet is a column of 50px rows with hairlines
  between them, and has no float shadow.
- **TextField**: focus uses `--focus-ring-soft`.
- **FilterPill**: the dot is round.

Everything else in the list (chip, tag, search field, tabs, tool and
provider buttons, callout, footer, pills, avatar, progress bar, states)
reaches the new look through the tokens alone.

## The landing

`home-page.tsx` puts the field behind one `PageFrame`. The header, every
section and the footer are bands of that frame:

- **Header**: inside the frame, so the rails run through it. The nav is a
  row of full-height cells between hairlines. Over the first 120px of
  scroll, the bar's full-bleed ground fades from transparent to ink. It is
  a registered `--landing-bar-bg` on a scroll timeline, with no blur. A
  section link in view gets the text colour and a 2px volt underline.
  `+` marks sit on its bottom rule.
- **Hero**: has no rule of its own. The badge, prompt bar, chips and pause
  toggle sit on flat `--cell-fill` with hairlines. The Ask key uses the
  flat-key recipe. On phones the badge breaks at its " · ".
- **02 / How it works**: two cells (pitch | lesson preview), then the
  three verbs as a row of three cells.
- **03 / The path**: the intro, then four linked track cells
  (`cellLinkStyle`). Each has a square numeral in its track colour and
  lights its top edge in that colour on hover or focus. The scroll-drawn
  trace now runs along the row's top border.
- **Modes**: the heading row, then three cells.
- **04 / You**: two cells (copy | showcase), with the stats as a boxed
  3-up `CellGrid`.
- **Closing CTA**: one band. The CTA key has no glow.
- **Footer**: a band with `--cell-fill`.
- **Field**: the palette uses the toned accents, at 85% point alpha, with
  0.12 line opacity and a softer signal colour. The dot grid is now graph
  paper. The stage HUD sits inside the right rail.

## How to convert a page (phase 2 checklist)

1. Wrap the page body in `PageFrame`. For an app page, inside `Layout`'s
   `<main>`, use `<PageFrame>`. A page that renders its own shell can use
   `as="main"`.
2. Split the page into `RuledSection`s, top to bottom. Give each one an
   `aria-labelledby` pointing at its heading. Use `label` for a short mono
   name, `index` only for a true sequence, and `aside` for counts or
   secondary links. Use `pad="none"` when the section's content is a flush
   `CellGrid`.
3. Replace card grids and gap-separated lists with `CellGrid`: `cols`,
   `colsMid`, and `colsPhone` only for small cells. If the old cards were
   links, make each cell's `<a>` use `cellLinkStyle`. Delete the page's own
   card radius, shadow and gap CSS.
4. Over a canvas (the catalog background, the sign-in brain), give cells
   `fill="ink"`. Never use `backdrop-filter`.
5. Use `--section-pad-x` / `--cell-pad` for horizontal insets, so left
   edges line up down the page. Don't hand-roll gutters.
6. Remove literal radii, shadows, blurs and hover lifts
   (`translateY(-n)`). Hover is a fill step (`--fill-hover`,
   `--cell-fill-hover`, `--selected`) or a border colour. Keep accents to
   borders, dots, labels and small fills.
7. Check at 360 and 1440 (iframe trick) for `scrollWidth === clientWidth`.
   Check that headings don't break mid-word inside the rails: a phone
   column is about 280px, so drop a display size a step under 480px.
   Then run the a11y suite.
8. Frames: when a region of the page loads or refreshes on its own (a
   search result list, a progress panel), make it a `<Frame>` inside its
   `RuledSection` or cell, so the grid stays put while the region updates.
   The landing has no such region.


## Status

- **Phase 1** (design system and landing) and **phase 2** (every other
  page: catalog, course, lesson, me, profile, certificates, settings,
  sign-in, legal, author, admin, status pages) are done. The phase-2 lane
  decisions are in `047-catalog-notes.md`. The old geometry left in
  components (tutor bubble, play button, catalog and sign-in canvases) is
  gone too. The `Layout` main clips the `100vw` rules, so pages no longer
  clip their own overflow.
- **Phase 3** (consolidation, 2026-10-29):
  - **One strip.** `RuledSection` and the new `Panel` share one header
    strip (`packages/ui/src/lib/strip.ts`). `RuledSection labelAs="h2"`
    (with `labelId`) makes the strip label the section's heading. `Panel`
    is a block inside a cell, such as the profile's columns or the course
    aside. It has the strip with a real heading, then a padded or `flush`
    body. These replace the profile's local `Panel` and the course page's
    `stripHeading`.
  - **The strip draws the hairline under itself.** Content under a strip
    never draws a top border. A `CellGrid` right under a strip takes
    `top={false}`, and `panelListStyle` rows draw only the lines between
    rows. Before this change, a grid under a strip drew a second hairline
    beside the strip's (landing "How it works" and "You", course outcomes,
    author list), and the two translucent lines read as one thick line.
  - **One phone inset.** At 480px and below, every page keeps
    `--frame-inset` (12px) and its rails, the lesson page included. The
    lesson page used to drop its gutter and rails there. We checked both
    at 360px. With the inset, the lesson's rails and `+` marks line up
    with the AppBar's, as they do on every other page. The prose column
    goes from about 320px to about 296px, which still holds 30–40
    characters a line at 17px. The toys still fit without scrolling
    sideways. Consistent rails matter more than 24px on one page.
  - **EmptyState** is a flat hairline box on `--well`. It has a mono `∅`
    and is left-aligned to the cell edge. The `bare` variant stays for a
    state that fills a cell or band by itself.
- **Kept on purpose:** the transactional emails (`app/auth/*-mail.ts`)
  keep their rounded inline styles. They render in mail clients, not on
  the grid. The live-dot pulse rings in `base.css` are motion on round
  dots, not depth.
