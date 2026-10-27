# 023. Reading comfort and layout stability

Status: Accepted (2026-10-26)

## Context

Lessons are long-form reading with live parts: a prompt composer whose
replies stream in, a terminal-mode log, scripted command output, and toys
that play on their own (decision 021). The owner asked for best-practice
fonts and reading, and for nothing to jump: a box that fills with data
should keep its size and scroll, and the same goes for larger content.

Measured before this change (Chrome, `PerformanceObserver` for
`layout-shift`, lesson loaded in an iframe, every toy scrolled into view
and left to play, then three prompt runs fired from script so no shift
counted as "recent input"):

| Page (1440px) | CLS |
|---|---|
| `say-hi-to-claude` (load + toys) | 0.008 |
| `say-hi-to-claude` + 3 runs | **0.108** |
| `a-very-good-next-word-guesser` | 0.046 |
| `where-it-learned-pretraining`, `attention-how-it-keeps-track`, `temperature`, terminal mode | 0 |

The shifts came from: runs and the reward toast inserted above the
composer (each streamed chunk pushed it down), the next-token toy swapping
its odds for a one-line note when it finished, the no-JS note under the
composer disappearing at hydration, and late font swaps re-wrapping text
(Geist 600 and Geist Mono aren't preloaded).

## Decision

### Fonts

- Still self-hosted woff2 from `@fontsource` (decision 007), latin and
  latin-ext subsets, one static file per weight.
- **`font-display: swap`, with metric-matched fallbacks**, not `optional`.
  `copy-fonts.ts` now also writes `<family> Fallback` faces: `local()`
  Arial / Arial Bold / Courier New (with the Liberation clones and
  Helvetica for Linux and macOS), scaled with `size-adjust` and given the
  web font's own `ascent-override` / `descent-override` /
  `line-gap-override: 0%`. Each token stack names the fallback second
  (`'Geist', 'Geist Fallback', …`). The swap is then a repaint, not a
  reflow, and first-time visitors still get the brand faces (`optional`
  would show Arial for the whole first visit on a slow connection).
  - `size-adjust` is the ratio of the canvas width of an English sample in
    the web font to the same sample in Liberation Sans/Mono (metric clones
    of Arial/Courier New), measured in Chrome: Geist 102.4% (regular) and
    99.6% (bold); Unbounded 127% / 130.2% / 132.4% (500 / 700 / 800, one
    face each); Geist Mono 99.7%.
  - Overrides are hhea ascent/descent (Geist and Geist Mono 1.005 / 0.295,
    Unbounded 0.995 / 0.245) divided by `size-adjust`, because the
    browser scales them by it.
  - Check: a 1,200-character lesson paragraph at 640px wraps to the same
    height in the web font and the matched fallback for Geist 400/600,
    Unbounded 700 and Geist Mono (0.0% difference). Unmatched fallbacks
    differ by 8–32%.
- **Every page preloads two faces**: Geist 400 latin (body copy on every
  page) and Unbounded 700 latin (the logo on every page, and the
  landing/catalogue headline, the usual LCP). A page adds the faces it
  shows above the fold with `Layout`'s `preloadFonts` (file names, looked up
  in `platform.assets.fonts`): lesson pages add Unbounded 500, the sub-bar
  title; the landing page adds Unbounded 800 itself. Everything else swaps
  in under its matched fallback. Keep a page at three or four preloads:
  each one competes with the CSS for early bandwidth.
- **Rendering knobs**: `-webkit-font-smoothing: antialiased` stays, since
  light text on near-black looks heavy with macOS subpixel AA. No
  `text-rendering: optimizeLegibility` (kerning and ligatures are on by
  default, and it is slow on long pages). No `font-optical-sizing`: none of
  the faces are variable.
- **Mono features**: Geist Mono's GSUB has `ccmp, dnom, frac, locl, numr`
  and no `liga`/`calt`, so code shows no ligatures. `code, kbd, samp, pre`
  also get `font-variant-ligatures: none` and `hyphens: manual`, so that
  stays true if a future version adds them. Numbers that tick (token
  estimate, odds, loss, type-mode stats) use `tabular-nums`.

### Reading

- New tokens: `--type-prose-size` `clamp(16px, 15.2px + 0.25vw, 17px)`
  (16px on a 360px phone, the artboard's 17px from about 720px),
  `--type-prose-leading` 1.65, `--type-prose-measure` (`--measure`, 68ch),
  `--type-prose-gap` 0.85em between paragraphs, `--type-heading-leading`
  1.15, `--type-reply-size` 16–18px with `--type-reply-leading` 1.55, and
  the link underline offset/thickness.
- `TutorMessage` lesson text uses them, and each paragraph is capped at the
  measure.
- Base CSS: `text-wrap: balance` on `h1–h4`, `text-wrap: pretty` on
  `p, li, dd, blockquote, figcaption`, `overflow-wrap: break-word` on
  `body`, and `overflow-wrap: anywhere` for inline code in prose. Links get
  `text-underline-offset` / `text-decoration-thickness`.
- **Text that streams or grows wraps greedily** (`text-wrap: wrap`): the
  model reply and the next-token sentence. With `pretty` the browser
  re-breaks earlier lines as each token lands, which moves words the reader
  already read and counts as a layout shift.
- Model replies keep their line breaks (`white-space: pre-line`).

### Stability

Two helpers in `packages/ui/src/lib/stable.tsx`:

- **`createFollower()`** is a `ref` mixin for a fixed-height scroll window.
  A `MutationObserver` keeps it scrolled to the bottom while the reader is
  at the bottom (32px slack). Scrolling up to reread stops it, and
  `pin()` re-arms it when the learner acts. The jump is instant, so there
  is no motion to reduce. `scrollWindowStyle` adds
  `overscroll-behavior: contain` and `scrollbar-gutter: stable`.
- **`stackStyle` + `<Ghost>`** put states in one grid cell. Invisible
  copies (`visibility: hidden` and `aria-hidden`, so they are out of the
  a11y tree and tab order) of the larger states reserve their size up
  front.

Applied:

| Component | Change |
|---|---|
| `PromptComposer` | Runs and the reward toast live in a fixed window (`--run-log-height`, `clamp(220px, 42svh, 420px)`) above the composer. It is server-rendered, dashed and empty-stated until the first run, scrolls inside, and follows the newest reply. Runs stack from the top: anchoring them to the floor (chat-style) moved earlier runs up on every chunk. The no-JS note and the hydrated keyboard hint share one line. The token estimate and the Run key have fixed widths. |
| `ModelOutput` | Caret keyed per chunk (a new node isn't a shift, a moved one is). The example/error note sits under the reply, because it arrives when the stream ends. |
| `TerminalLog` | The panel is a fixed height (`--terminal-height`) and the log scrolls inside. It opens at the lesson's start and follows once the learner acts. The JS note becomes the hint line. The run note sits under the reply. |
| `OutputPanel` | A Ghost of the full output holds the panel's size during a replay. Over `--output-panel-height` it scrolls, and the replay keeps the newest line in view inside the panel. |
| `CodeEditor` | File panels share one grid cell (hidden ones are `visibility: hidden`), so switching tabs never resizes the editor. |
| `NextTokenPlayer` | Ghosts of the finished sentence, the tallest step's odds, the done note and the longest status line. The caret is keyed per step. |
| `OddsList` | Rows keyed by rank, not token, so a token changing rank repaints instead of moving. |
| `TrainingScrubber` | Ghosts of every snapshot's output. The loss readout has a fixed width. |
| `AttentionMap` | Ghosts of every token's summary. |
| `OddsBars` | Ghosts of all four temperature notes. |
| `RewardRegion` | A fixed overlay at the bottom of the viewport (`--z-toast`, `--toast-width`), not a block in the flow. |
| `VideoPlayer` | The transcript list gets `overscroll-behavior: contain`. |
| base | `img, video { height: auto }`, so width/height attributes reserve the aspect ratio. |

The toys' no-JS fallbacks (decision 021) are unchanged. Ghosts are never
inside `<noscript>`.

## Consequences

After the change (same method):

| Page | 1440px | 360px |
|---|---|---|
| `say-hi-to-claude` (load + toys) | 0 | 0.0001 |
| `say-hi-to-claude` + 3 runs | 0 | 0 |
| `a-very-good-next-word-guesser` | 0 | 0.0001 |
| `where-it-learned-pretraining` | 0 | 0 |
| `attention-how-it-keeps-track` | 0 | 0 |
| `temperature` | 0 | 0 |
| terminal mode | 0 | 0 |
| terminal mode + 3 runs | 0 | 0 |

No page scrolls sideways at 360px.

Follow-up (integrated review): once a run earned the reward, later runs
landed above the toast and pushed it down (0.014 at 1440px), and at 360px
the toast's nowrap "Next: … →" key widened the lesson column to 407px
(CLS 0.17). The toast now sits inside the run that earned it and its key
wraps; 3–5 runs measure ~0 at both widths.

- The composer always takes its window's height, even before a run. That
  is deliberate: the space the replies need is reserved, not taken from the
  page later.
- The terminal-mode lesson reads inside a scrolling panel, like a terminal,
  instead of growing the page.
- A new island that fills with data should use `createFollower` and a
  fixed-height window. A toy whose content changes should stack its larger
  states as Ghosts. Measure with the `layout-shift` observer before
  shipping.
- `size-adjust` values are hand-measured. Re-measure them (see
  `copy-fonts.ts`) when a `@fontsource` bump changes the fonts.
