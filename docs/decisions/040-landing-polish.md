# 040. Landing polish: header, prompt bar, scroll-tied motion

Status: Accepted (2026-10-27). Builds on 012, 022, 023, 034 and 042.

## Context

The owner said the landing header links "feel a bit unstyled", and the hero
prompt bar "is ugly, it feels off center, the text is a bit off, and
perhaps it should be somewhat transparent". The page also had to look as
good at 360–430px as at 1440px. This is a polish pass: the brand, the copy,
the neural field (012) and its pause control (034) stay.

## Decision

### Header (`home/landing-header.tsx`)

- The landing renders its own header instead of `AppBar variant="marketing"`.
  022 already made the landing's bar an exception, and the polish needed
  things AppBar doesn't do: a truly centred nav, section highlighting and a
  Sign in entry in the menu sheet.
- Logo left, actions right, nav in the middle of a `1fr auto 1fr` grid, so
  the nav is centred on the page, not just between two unequal neighbours.
  From 760 to 1023px the grid becomes `auto 1fr auto` with smaller links,
  so the three groups never overlap (measured at 760, 885 and 1024px).
- The nav is a glass capsule (`--ink-a60`, blur, `--line-glass` border).
  Its links, and the Sign in link, are 44px pills: `--text-lead`, then
  `--text` on a `--fill-ghost-hover` fill on hover, `--fill-btn` while
  pressed and the global focus outline. Forced colours underline on hover.
- The bar is `--appbar-h` tall at every width (72px, 64px under 760px).
  The spec's 22px padding made it 88px, but a fixed height matches the
  menu sheet, which drops from `--appbar-h`.
- **Sticky and frosted, only where the browser can do it without JS.**
  Under `@supports (animation-timeline: scroll())` the header is sticky and
  a scroll-driven animation (`landing-bar`) moves it from transparent to
  `--appbar-bg` with blur and a `--line-bar` hairline over the first 120px
  of scroll. The motion follows the reader's own scroll, so it isn't
  autonomous motion and needs no reduced-motion override. Elsewhere the
  header is static and transparent, as before.
- **Section links light up while their section is on screen.** `#how`
  and `#path` name view timelines (`--how`, `--path`), the page root scopes
  them (`timeline-scope`), and each section link runs `landing-here` on its
  timeline over `cover 25%`–`cover 75%` with no fill. The links carry no
  `aria-current`, because none of them is the current page. This is a
  visual cue only.
- Under 420px the visible Sign in link is hidden to make room. It is
  added to the menu sheet (`menuExtras`) for signed-out visitors, so it
  is always one tap away. Before, phones had no Sign in except the footer.

### Prompt bar (`home/hero.tsx`, `public/hero-prompt-input.tsx`)

What was off, measured with `getBoundingClientRect`:

- The input was 52px tall and the Ask key 48px, so the bar was 70px tall,
  with a 10px inset above and below the key and 8px to its right.
- The Keycap's 4px edge is a shadow outside the box, so the key's visible
  mass sat low: about 10px of room above it and 6px below.
- The chevron was 20px in a 30px line, and the text 17px in a 52px box, so
  their baselines didn't match.
- The bar was nearly opaque (`--glass`, 78%).

The fix:

- One row, and everything centres on it. The input is the key's height:
  48px on desktop and 44px (`--touch-target`) on phones.
- The Ask key is a plain `<button>`, styled as a compact volt keycap. Its
  edge is drawn inside the key (an inset 2px `--volt-edge` shadow), so the
  box is what you see. Insets are equal on three sides: 8px on desktop,
  6px on phones. Hover is `--volt-hover`, press moves it 1px, focus gets
  the volt outline, `[aria-busy]` gets the progress cursor (024), and
  forced colours get a `ButtonText` border. The ↵ tile stays on every
  width.
- Radii nest: the bar's radius is the key's (10px) plus the inset.
  That's 18px (`--radius-xl`) on desktop and 16px (`--radius-16`) on
  phones.
- The chevron takes the input's font, size and line box, so the glyph
  sits on the text's line.
- Glass: `--ink-a60` with `blur(--blur-prompt) saturate(1.4)`, a
  `--volt-a28` border (`--volt-a40` on hover), and an inset top
  highlight. On focus the border goes to `--volt-a60` and the box shadow
  adds `--focus-ring`. Without `backdrop-filter`, it falls back to the
  solid `--glass-82`. Forced colours get `Canvas` with a `CanvasText`
  border and a `Highlight` outline on focus.
- The input clips a long placeholder with an ellipsis, and the caret is
  volt.

### Hero, phones

- One load sequence, CSS only: the badge, sub, bar, chips, note and cue
  rise in 70ms apart (`bits-rise`, opacity and transform). The h1 never
  animates, because it is the LCP element. It's off under reduced motion.
- The badge drops to 11px with title tracking under 480px. At 13px it
  wrapped into a two-line pill on a 360px phone.
- The mono notes (the hero's and the closing CTA's) break at their " · "
  on phones (`dotBreak`) instead of mid-phrase. The dot stays in the text,
  so it is still read out.
- The chips get the badge's glass, and a 44px height.
- The hero is `min(820px, 100svh − --appbar-h)` tall, so the cue and the
  pause control stay above the fold on a laptop. Phone padding and gaps
  are tighter.

### Elsewhere

- The path's dashed trace draws itself left to right as the cards scroll
  in (`landing-trace` on `view()`; off under reduced motion). Track cards
  add `--shadow-card-hover` to their hover lift, and focus-visible gets
  the same lift.
- The StageHud bar grows with `transform: scaleX`, not `width`. Animating
  the width moved the label beside it, which was the page's only layout
  shift.
- Prefetch follows 042: shared components prefetch by default, and the
  landing's plain links use `prefetchFor(href)`. The `#how` and `#path`
  anchors never prefetch.

## Verification (Claude in Chrome, dev server on :44112)

- Same-origin iframes at 360, 430 and 1440: `scrollWidth` equals the
  viewport at each width. Also checked at 760, 885 and 1024 for the
  header.
- Prompt bar insets were 10/10/8 before. After: 6/6/6 on phones and
  8/8/8 on desktop. The chevron, input and Ask key share one centre `y`.
- `layout-shift` observer over load and a scroll to the bottom: CLS 0
  (it was 0.0005, from the HUD bar). The LCP element is the h1.
- The menu sheet at 360px lists the four links and Sign in, each 44px.
- The tokens are dark-only (`color-scheme: dark`), so the light scheme
  renders the same page.
- Not checked by hand, only reasoned from the CSS: forced colours,
  reduced motion and the no-`backdrop-filter` fallback. The extension
  can't emulate media features. The placeholder's contrast on the
  translucent bar was judged by eye over the moving field, not measured.

## Consequences

- Header changes for the landing go in `landing-header.tsx`, not `AppBar`.
- Firefox, which has no scroll-driven animations at the time of writing,
  gets the old static, transparent header and no section highlight.
- New page keyframes (`landing-bar`, `landing-here`, `landing-trace`) live
  in `pageCss` in `home-page.tsx`.
