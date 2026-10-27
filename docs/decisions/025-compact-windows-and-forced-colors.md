# 025. Compact run window, phone terminal height, forced colours checked

Status: Accepted (2026-10-27). Amends 023 (the composer no longer reserves its
full window before the first run) and 024 (forced colours, now checked
visually).

## Context

Three leftovers from the polish pass (022–024):

- Before the first run, the composer's run window was a dashed, empty box as
  tall as `--run-log-height` (269px at 360×640, 378px at 1440×900). It read
  as dead space above the exercise.
- In terminal mode on a phone the log was only 115px tall at 360×640 (230px
  at 360×800). The panel was `72svh`, and the title row (wrapped to two
  lines), the check lines, the temperature row, the input and the hint used
  the rest.
- Decision 024's forced-colours rules were CSS only and had not been looked
  at.

## Decision

### Run window: compact until the learner runs

- Empty, the window is `--run-log-empty-height` (76px): the dashed frame
  and its hint, "Run your prompt and the replies land here."
- The first run grows it to `--run-log-height` in one step. The run is
  always the learner's own Run key or Enter. In the same task, after the
  update, the composer's `getBoundingClientRect().top` is compared with its
  value before the update, and the page scrolls by the difference
  (`behavior: 'instant'`). The window opens upwards, and the composer, the
  caret and the Run key stay where the learner is looking. After that the
  height never changes again, as before (023).
- Why not keep the full window: the reserved space looked broken. Why not
  fill it with a sample exchange: an example the learner hasn't run reads as
  a fake result.

### Terminal on phones: all the room under the header

- Under 760px, `--terminal-height` is
  `max(360px, calc(100svh - var(--shell-h) - var(--space-4)))`: the panel
  takes the whole viewport under the sticky shell, minus a 16px gap. It
  still fits under the header (capped by `--shell-h`). The 360px floor only
  applies to short landscape screens, where a usable log matters more than
  fitting.
- The title row never wraps (`nowrap`, the path truncates with an
  ellipsis, the progress keeps its width). At 480px and below the check lines
  are 12px with tighter gaps, so two short checks share a line.
- Result at 360×640: title 78 → 45px, checks and temperature 157 → 98px, log
  115 → 250px. At 360×800: log 230 → 410px. Desktop is unchanged (413px log
  at 1440×900).

### Forced colours, checked

Checked in Chromium with `page.emulateMedia({ forcedColors: 'active' })`
(Playwright, dark and light schemes, 1440 and 360). That is the same emulation
as DevTools' Rendering panel. Checked: the app shell, keycaps, chips, quiz,
progress bars, the composer, the terminal, toasts and lesson nodes (the
styleguide sections and real lesson pages). Fixes:

| What | Problem | Fix |
|---|---|---|
| NavLink | Transparent top/bottom borders were painted, so every link looked selected | Borders `Canvas`; the current page's bottom border `Highlight` |
| Lesson outline | The lesson you're on was only a tint | 2px `Highlight` outline, inset |
| LessonNode | "done" was a volt disc with a dark check, which disappeared; the current dot too | Done is a `CanvasText` disc with a `Canvas` check; dot `CanvasText` (`forcedFill`). The check icon now draws in `currentColor` |
| Composer and terminal temperature chips | The picked temperature looked like the others | `forcedSelected` on `:has(:checked)` |
| ToolButton (pressed) | `forcedSelected` sat in the base mixin and lost to the variant's pressed colours, so it showed olive, not `Highlight` | The forced rule moved into each variant, after its pressed rule |
| `<mark>` (terminal "line 10", read mode) | Chromium keeps the tint's alpha on the `Mark` colour, which left black `MarkText` on near-black | Solid `Mark` / `MarkText` (`forcedMark`) |
| ProgressBar | The fill is an inline `background` (dropped) | The track gets a hairline `CanvasText` frame (`forcedTrack`). The fill is painted with an inset `CanvasText` shadow (`forcedInlineFill`), because the inline style beats any rule |
| SegmentedProgress | Segments were tints | Framed segments: done filled, current half filled |
| OddsList bars | Fills were backgrounds | `CanvasText` bars in a framed track, the picked bar `Highlight` |
| ActivityGrid | The whole grid vanished | Framed cells filled in steps of `color-mix(CanvasText, Canvas)` |
| Icons and BrandMark | Token colours in SVG attributes aren't forced, so light glyphs vanished on a light canvas | `fill`/`stroke` → `currentColor` in forced colours (`forcedSvgPaint`; CSS beats presentation attributes) |
| TutorAvatar | The volt tile and its dark glyph vanished | `forced-color-adjust: none`: a decorative brand tile keeps its colours |

These were already fine and unchanged: keycaps (024's `ButtonText` border),
chips, filter pills, tabs, the switch, quiz choices (the ✓ and ! glyphs carry
the result), check chips (the ✓ and ○ glyphs), the reward toast, the dashed run
window and the terminal panel. Tags lose their tinted pill but keep readable
text, which is acceptable for a label.

The helpers (`forcedFill`, `forcedInlineFill`, `forcedTrack`, `forcedMark`,
`forcedSvgPaint`) live in `packages/ui/src/lib/states.ts` next to
`forcedSelected`. `lib/` isn't exported from `@bits/ui`, so app code
(`inline.tsx`, `outline.tsx`) writes the media query inline.

## Consequences

- Each `css()` mixin is its own cascade layer, so a forced-colours rule in a
  base mixin can lose to a variant mixin's state colours. Put the forced rule
  in the same mixin as the colours it overrides, after them.
- The first run moves the lesson text above the composer up by the window's
  growth (about 190–300px). Measured with a `layout-shift` observer and
  trusted input (Playwright click and Enter, 3 runs, 360×640, 360×800,
  1440×900): CLS 0 at 360 both before and after. At 1440 it was 0.0001
  before and 0.0004 after, a load-time text repaint that has nothing to do
  with the runs. Runs started from script (no user input) do record the
  growth: 0.27 at 360×640. Anything that starts a run without a user action
  would have to reserve the full window first.
- An e2e test (`navigation.test.e2e.ts`) checks that the window is compact,
  grows on the first run, and that the composer doesn't move.
- The tests still run in a browser without forced colours. Recheck with the
  emulation when adding a state that is drawn only with a background.
