# 049. Scroll restoration and the scrollbar gutter

Status: Accepted (2026-10-29). Follows 020, 023 and 047.

## Context

The owner asked that we use Remix's own scroll restoration properly and
that the page stop jumping sideways when the scrollbar comes and goes.

What we read (installed `remix@3.1.0`): guide 05 "Interactivity" (the
`data-rmx-*` navigation attributes), guide 06 "Streaming UI with Frames"
(forms and links targeting frames; "These `"manual"` values disable
automatic scroll restoration and focus reset"), the `remix/component`
README (scroll and focus controls), and the runtime itself,
`@remix-run/component` `dist/runtime/navigation.js`.

What the runtime does once `run()` starts:

- It intercepts same-origin link and form navigations with the Navigation
  API (`event.intercept({ handler, scroll, focusReset })`). `scroll` and
  `focusReset` default to `"after-transition"`; after the new HTML is
  committed it calls `event.scroll()`.
- **Push / replace** (a link, a GET form, a POST form; a POST to the
  current URL replaces the entry): `event.scroll()` goes to the URL's
  `#fragment` if it has one, else to the top. Chromium and WebKit
  workarounds (scroll anchoring off during reconciliation, iOS restoration
  undo) are built in.
- **Back / forward** (`traverse`): always `"after-transition"`, so the
  browser restores the entry's saved position. The runtime holds the old
  page's scroll height while it reconciles, so the restore isn't clamped.
- **Same-page hash link** (`event.hashChange`): not intercepted; the
  browser scrolls natively (our `scroll-padding-top` keeps the target
  below the sticky bar).
- **Opting out**: `data-rmx-reset-scroll="manual"` and
  `data-rmx-reset-focus="manual"` on a link or form (`resetScroll` /
  `resetFocus` for `navigate()` and `link()`) keep the position and focus.
- A 422 re-render is just a POST navigation: default top, unless the form
  says `manual`.

What we found in the app: nothing touches `history.scrollRestoration`,
`entry.ts` and the pending UI (`navigation-feedback.ts`) never scroll, and
islands only scroll their own boxes (the terminal, the run log, the lesson
outline). The quiz (`QuizChoice`), the account tabs (`SegmentedTabs
keepPlace`) and the live search (`navigate(..., { resetScroll: 'manual' })`)
already opt out. Two in-place re-renders did not:

- the catalog search on Enter (`SearchField`) jumped to the top;
- the catalog's track filters (`FilterPill`) jumped to the top.

The sideways jump: the html box had no reserved gutter, so with a classic
scrollbar a short page (no scrollbar) centred the `PageFrame` 7.5 px right
of a long one (rails at 80 / 1360 vs 72.5 / 1352.5 at 1440 px). Nothing in
the app locks scrolling: the mobile menu and the publish confirm are
native popovers, which don't set `overflow: hidden`, and there are no
dialogs. Separately, the full-bleed rules are `100vw`, and on pages without
a clipped `<main>` (sign-in) they overflowed the viewport: body's
`overflow-x: clip` propagated to the viewport, where it becomes a
scrollable `hidden`, so a script or focus could shift the page sideways.

## Decision

- **Rely on the runtime's scroll handling; never write our own.** New
  pages start at the top (or their `#fragment`), back/forward restores,
  hash links are native. Don't set `history.scrollRestoration`, and don't
  scroll the window from `reloadComplete`, islands or pending UI.
- **Anything that re-renders the same page in place opts out** with
  `data-rmx-reset-scroll="manual"` (and `data-rmx-reset-focus="manual"`
  when the control survives the update). `SearchField` now always does;
  `FilterPill` takes `keepPlace`, like `SegmentedTabs`, and the catalog
  passes it.
- **The gutter rule** (`packages/ui/src/styles/base.css`): `html` has
  `scrollbar-gutter: stable` (one edge: the frame is centred in the
  content box, so both-edges would only waste space on the left) and
  `overflow-x: clip`. The latter stops body's clip from propagating, so
  body clips the `100vw` rules itself and the viewport can't scroll
  sideways. Anything that ever locks scrolling must keep the gutter (don't
  set `overflow: hidden` on html; `scrollbar-gutter: stable` keeps the
  space even then).
- `app/scroll.test.e2e.ts` guards it: catalog → course starts at the top,
  back restores the catalog, `#how` and `/#path` land on their targets, a
  quiz check, a search and a track filter keep their place, and html keeps
  the gutter and the clip, with the rails at one x on short and long
  pages. Playwright hides headless scrollbars, but Chromium still reserves
  a stable gutter's 15 px, so that comparison works headless. The table
  below was measured with `--hide-scrollbars` dropped (classic 15 px
  scrollbar, Chromium).
- **Measure page overflow on body**, not the root: html now clips and
  reserves the gutter, so `documentElement.scrollWidth - clientWidth` is
  never positive (headless it is -15). `body.scrollWidth - body.clientWidth`
  is 0 on a clean page and catches a block that widens it (the 360 px
  check in `a11y.test.e2e.ts`).
- **The OG cards opt out** (`html { scrollbar-gutter: auto }` in the card
  page's head): the card is exactly 1200 px wide, and a gutter would clip
  its right edge. `pnpm og` output is byte-identical.

Measured (rails x, left / right):

| width | page | before | after |
|---|---|---|---|
| 1440 | /login, 404 (short) | 80 / 1360 | 72.5 / 1352.5 |
| 1440 | /courses, /, /terms (long) | 72.5 / 1352.5 | 72.5 / 1352.5 |
| 900 | 404 (short) | 32 / 868 | 32 / 853 |
| 900 | /courses (long) | 32 / 853 | 32 / 853 |
| 700 | /login, 404 (short) | 32 / 668 | 32 / 653 |
| 700 | /courses, menu open | 32 / 653 | 32 / 653 |

Chromium still reports `documentElement.clientWidth` as the full width on
a short page (1440), but body is 1425 wide on every page: the layout
reserves the gutter. `/login` at 900 px could be scrolled sideways
(`scrollTo(200, 0)` moved it) before, and can't after.

## Consequences

- On a short page with a classic scrollbar there is an empty 15 px strip
  on the right (html's `--ink` ground). Overlay scrollbars (macOS default,
  phones) reserve nothing, so nothing changes there.
- The `overflow-x: clip` on `<main>` and the catalog stage (020, 047) is
  now belt and braces; it stays.
