# 051. One field spec, one row of phone lesson chrome

Status: Accepted (2026-10-29). Builds on 047 (squared grid, flat focus),
022 (lesson shell) and 023 (layout stability).

## Context

The courses UX audit (2026-10-29) found the boxes learners type into were
not uniform: four font sizes (14, 15, 16, 17), three backgrounds, five
resting borders and five focus treatments across the hero bar, the
PromptComposer, the TerminalLog, the tokenizer toy, TextField and search.
Three were under 16px (the terminal 14px, the login email and the
settings handle 15px), which makes iOS Safari zoom the page on focus. The
owner asked for "the input boxes uniform to type in" and "prompt windows
for everything", at the bar paid courses will need.

The same audit found phones spent about 230px of an 800px screen on
chrome before the first sentence of a lesson (app bar 64, lesson bar 56,
mode tabs + progress 63, "Lesson n of 8 · In this course" 45), lesson
titles truncated in the sticky bar, an early layout shift on some lessons,
an invisible "Type it" focus, duplicate landmark names on a code lesson,
and a catalog that ran nearly five phone screens.

## Decision

### The shared field

`packages/ui/src/lib/field.ts` holds one spec, on `--field-*` tokens
(`docs/design/spec/tokens.md` §9), and every input host uses it:

- **Mono 16px** (`--field-font`, `--field-size`) for anything sent to
  Claude or answered. Plain fields (a name, a search) are sans 16px.
  Nothing a learner types into is under 16px, including the hidden "Type
  it" textarea.
- **The frame** (`fieldFrameStyle`) is `--field-bg` with the neutral
  hairline `--field-border` at rest, `--field-h` (50px) tall, or
  `--field-h-keyed` (56px) with an md Keycap inside. Only the active
  "Your turn" frame is volt (`fieldActiveStyle`).
- **Focus is on the frame**: `--focus-border` + `--focus-ring-soft`; the
  input inside draws no outline. A ruled cell (the catalog search) draws
  the same 2px edge inset. Forced colours paint a `Highlight` outline.
- **Prompt windows** lead with a volt `›` and submit with the md Keycap
  inside the frame: the terminal gained a Run/Send key, and the hero's own
  Ask button became the Keycap. The composer keeps its Run key in its
  footer, beside the temperature picker.
- Placeholders are `--dim`; the caret is volt everywhere.

Hosts: PromptComposer (the prompt now sits in a field frame), TerminalLog
(14px → 16px, keyed), the hero bar (17px → 16px, keyed), the tokenizer toy,
TextField (mono and compact → 16px), SearchField (field and cell), and the
settings handle field (15px → 16px). The styleguide's "Field" specimen
shows every host at rest and focused.

The composer and terminal start their "run at" picker on 0.7 when they
offer it (`DEFAULT_TEMPERATURE` in `odds-bars.tsx`, also the odds toy's
default), so the temperature lesson's toy and prompt agree before anyone
touches them.

### Phone lesson chrome

Under 760px the page has **one row of chrome under the sticky header**:
`LessonModes` (the mode tabs) with the outline disclosure as its end cell
("Lesson 6 of 8 ▾"; "6 of 8" under 400px). The open outline hangs over
the lesson instead of pushing it down. The segmented progress moved into
the sticky bar as a 3px strip along its bottom edge, so it stays in view
and takes no row. At 360×800 the lesson starts at 203px instead of 255px
(chrome rows under the header: 108px → 56px). `--appbar-h`,
`--lessonbar-h` and the sticky header are unchanged.

The lesson title clamps at **two lines** instead of truncating on one, at
every width. At ≤480px the course context hides, so the title has the
bar; the chrome row says which lesson it is.

### Smaller fixes

- **Layout shift (B5).** The cause was the bold weight: lesson prose
  `**bold**` is Geist 600, which wasn't preloaded, so its late swap
  rewrapped lines and moved everything under them by a line (CLS 0.0434
  on the checkpoint lesson at 1440, 0.0154 on top-p at 360, warm cache).
  Lesson pages now preload `geist-latin-600-normal.woff2`; every lesson
  measured reads 0. The temperature lesson's 0.0956 at 360 no longer
  reproduced on this master before the change (0.0032, the same font
  swap); the audit ran on an older commit, before the uniform header
  (048).
- **"Type it" (B6).** The hidden textarea stays. While it has focus the
  code area draws the focus ring inside its edges and the caret blinks
  (still under reduced motion); unfocused, the caret dims.
- **Landmarks (B7).** `OutputPanel` and the terminal's command output are
  named, focusable `group`s, not `region`s: the-loop runs one command
  twice, and two regions with one name fail axe `landmark-unique`.
- **Catalog.** Under 760px a course cell is a compact row with a 64px
  thumbnail cover, a two-line description and no track or format tags
  (cells 382–427px → 158–182px; the page 3941px → 2092px at 360). The
  track filter row fades at its end while there is more to scroll
  (`scrollRowFade`, a scroll-driven mask: no fade when the row doesn't
  scroll or the browser has no scroll timelines). The rabbit-hole art is
  clipped to the ruled column, so it never draws past the right rail.

## Consequences

- A new input uses the field mixins, never its own border, focus or font
  size. A host that needs a different frame adds a mixin after them.
- Hiding or resizing something a child component styles: put the rule in
  a wrapper you own or in the same mixin as the display it overrides.
  Mixins layer in the order they are first used while rendering, so a
  descendant rule in a parent's mixin can lose to the child's own mixin
  (seen with the course cover's sigil and tags). The course card renders
  a thumbnail cover beside the card cover for that reason.
- `-webkit-line-clamp` takes a string in `css()` (`'2'`); a number gets
  `px` and is dropped.
- `--control-search-input` (52px) is now unused; the search input fills
  its frame like every other field.
