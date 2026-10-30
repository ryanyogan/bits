# 058. The bits motif: one ornament, the bit cell

Status: Accepted (2026-10-29). Amends 010 (component library), 028 (link
previews) and 047 (squared grid: the `+` mark stays). Lane C of the
"ease up the UI" wave, with 056 (softer palette) and 057 (three.js scenes).

## Context

The owner: "the site is named bits, lets really dial in on that binary,
bit, graph play for the ui". The brand mark was a four-node graph from the
Main artboard, the favicon an unrelated Figma export, the cover patterns
generic (dots, stripes, rings, crosshatch), and the small marks a mix of
`∅`, `●`, `○` and `✓`. Nothing said "bits".

Constraints: the layout and components stay as they are (047, 050), the
accents stay signals (047), lesson prose stays clean, every mark holds up
in forced colours (025), and the header is lane D's.

## Decision

**One ornament, the bit cell.** A bit is a square: lit, it is filled in the
text colour (or an accent); unlit, it is a hairline frame. Cells are
`--bit-cell` (8px) with `--bit-gap` (2px) between them. A graph is a
lattice of bits with some lit. That one idea is drawn wherever a mark
already existed, and nowhere new.

1. **Brand mark** (`brand-mark.tsx`): a 3×3 lattice, four bits lit, the
   last one volt. The lit positions are the four nodes of the old graph
   mark (top-left, bottom-left, right-middle, bottom-right), so the brand
   keeps its shape. The five unlit cells stay as a faint lattice (text @
   16%), so it reads as bits in a field, not four loose squares. No edges:
   at 16px they turn to mud, and the lattice already says "graph". Sizes
   and `Logo` props are unchanged (lane D keeps using `Logo`).
2. **Favicons**: `favicon.svg` is the mark on an ink square (32px grid, no
   radius), `favicon.ico` holds 32 and 16px renders of it, and a new
   `apple-touch-icon.png` (180px) is linked from `Document`. The ink hex
   in these files is static; if 056 changes `--ink`, re-render them
   (`rsvg-convert` + `magick`, see the commit).
3. **`BitCells`** (`bit-cells.tsx`): a row of bits from a `0`/`1` string
   or a number in binary (`404` → `110010100`), in a tone, decorative
   unless labelled. `toBits()` is exported.
4. **Empty state**: the `∅` is a row of four unlit bits (`0000`).
5. **Status pages**: under the lead, the HTTP status as a row of ion bits
   with the mono caption "404 in bits". Decorative; the index strip still
   carries the number.
6. **Progress bars**: the track is a run of unlit bits (`--bit-off-fill`),
   the fill lights them from the left. Bit width per variant: card 8,
   row 10, banner and art 12, level 16px (about twice the bar's height).
   The fill's width is still the exact percentage (it may end inside a
   bit), and `SegmentedProgress` was already a bit row.
7. **Cover patterns**: all eight redrawn from bits, keeping their names so
   no `course.md` changes: `dots` a lattice with one in nine lit brighter,
   `stripes-115` a bit stream (rows of 2px dashes in two rhythms), `rules`
   ruled lines with a bit on each rule, `grid` graph paper with a node on
   every other crossing, `rings` rings cut into dashes by well-coloured
   wedges, `dots-offset` a faint checker with a bit in each cell, `rays`
   rays cut into dashes by well-coloured rings, `crosshatch` byte rows
   (3px bits in groups of eight). A `bits(size, color, tile, at)` helper
   draws a bit per tile with one conic gradient; a `--well` layer on top
   of a line layer makes the dashes. Thumbs (64px) scale the stream, rays
   and byte rows down.
8. **Tokens**: `--bit-cell`, `--bit-gap`, `--bit-on`, `--bit-off`,
   `--bit-off-fill`, in their own block at the end of `tokens.css`.
9. **Styleguide**: a "Bits motif" section (BitCells, the readout, the bit
   row bars, the empty state) and the brand specimen shows the favicon and
   touch icon.

## Rejected

- **Edges in the mark** (nodes joined by hairlines). Busy at 26–30px and
  gone at 16px; the favicon and the app bar must be the same glyph.
- **A lit-bit variant of `Crosshair`.** The `+` where a rule meets a rail
  is 047's one grid ornament; a square there competes with it and would
  need a meaning ("on") no page has.
- **Changing `LiveDot` (`●`), `CheckChip` (`✓`/`○`) and `HexBadge`.** Round
  means live (047 keeps `--radius-round` for that), a tick means passed,
  and the hex is already a shape with a meaning. Square bits there would
  trade a clear sign for a motif.
- **Bits in lesson prose** (list markers, rules, callouts). The reading
  column stays clean (047 §6: fun in motion, not in ornament).

## Consequences

- Course cover art changed for every course without a content change;
  `pnpm og` re-rendered the link-preview cards (the brand mark is on
  every card). New courses pick from the same eight names.
- A mark that shows an amount or a state (bars, cells) keeps a
  forced-colours rule: `BitCells` paints lit cells in `CanvasText` and
  unlit frames in `GrayText`; the bar track keeps its outline and the fill
  its inset paint (025).
- The three.js scenes (057) and the softer palette (056) are the other
  two lanes of this wave; the mark and the covers read their colours from
  tokens (`--text`, `--volt`, `--tone`), so they follow 056 with no change
  here except the static favicon hex.
