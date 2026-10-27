# 044. Sign-in polish: tabs that stay put, one logo, a lazy brain

Status: Accepted (2026-10-27). Amends the Auth spec (form column centring,
logo placement) and builds on 020 (client navigation), 022 (the app bar,
of which sign-in is a deliberate exception) and 042 (prefetch).

## Context

The owner said switching between "Sign in" and "Create account" felt janky,
and asked for one logo position on the auth pages. We reproduced it in
Chrome at 1104×1092 with a `layout-shift` observer and a per-frame sampler.
The switch was already a client navigation (a `window` marker survived, and
the `<canvas>` and `<nav>` were the same nodes), so the canvas did not
restart and nothing reloaded. Three things were wrong:

1. **The whole column jumped.** The form pane centred its column vertically
   (`align-items: center`, from the artboard). Sign-up is ~240px taller
   than sign-in, so every switch moved the tabs, heading and buttons by half
   that: the tabs went from y=243 to y=124 in one frame (layout shift 0.025).
   The tab you had just clicked moved out from under the pointer.
2. **The typed email moved into the name field.** The runtime reconciles the
   new page into the old DOM by position. Sign-up inserts "What should we
   call you?" before Email, so the sign-in email `<input>` (live value
   kept) was reused as the name box. Typing `ada@example.com` and switching
   left it in "name" and an empty Email.
3. **Focus fell to `<body>`** after each switch (the default focus reset),
   so a keyboard user lost their place on the tabs.

Smaller issues: the selected tab blinked from one cell to the other; the
terms line appeared twice (form and footer), and the footer's links were
`#terms` / `#privacy` placeholders; the logo sat in three places (brain
pane top-left at ≥760px, above the tabs in the form column below 760px,
at different sizes than the app bar).

## Decision

- **The form column hangs from a fixed top** (`align-items: flex-start`,
  top padding `clamp(--space-12, 12vh, --space-30)` beside the brain pane,
  `--space-12` under it, `--appbar-h` on phones). The tabs and everything
  above the differing fields never move. What sits below sign-up's extra
  fields still moves, because the content itself changes; we did not ghost
  sign-up's height into sign-in (it would leave ~240px of blank form).
- **Keyed slots** in the login form (`data-rmx-key` on heading, providers,
  divider, form, name, email, goals, timezone, submit, note; `display:
  contents` wrappers for the fields). The email box keeps its node, so what
  was typed carries across tabs into Email.
- **`SegmentedTabs keepPlace`** sets `data-rmx-reset-focus="manual"` and
  `data-rmx-reset-scroll="manual"` on the links. The account tabs use it:
  focus stays on the tab you pressed. Still plain links with
  `aria-current="page"`; without JS they are ordinary page loads.
- **A sliding selection pill** for the `account` flavour: the track draws
  the selection as a `::before` that moves with `:has(> :last-child
  [aria-current="page"])`. The `<nav>` survives the navigation, so it
  transitions (`--duration-card`, `--ease-out`; none under reduced motion;
  forced colours keep the per-item `Highlight` rule and hide the pill).
- **One logo** for every breakpoint and every auth state: `AuthShell`
  renders `<header>` with `<Logo variant="app">` (the app bar's size) in an
  `--appbar-h` row at `--page-gutter`, top-left, absolutely positioned. It
  overlays the brain pane when that pane is beside or above the form and
  sits above the tabs on phones. The brain pane is now an `<aside>`, with
  its own top padding of `--appbar-h`. It is the only `href="/"` on the page.
- **The brain canvas starts late.** It waits for `load` plus an idle
  callback (2s timeout) before importing three.js and fades its first frame
  in. `data-ready` is preserved across reconciliation
  (`data-rmx-preserve-attrs`). It already paused when hidden, ran at ¼ speed
  for reduced motion and was skipped below 760px. LCP is text ("Your
  neurons, saved." at ~300ms locally), never the canvas.
- The terms line lives only in the shell footer, with real `/terms` and
  `/privacy` links, so the code step has it too.
- Prefetch (decision 042): the tab links and "Start lesson 1" carry
  `data-rmx-prefetch="intent"`. `/login` is `no-store`, so a prefetched
  login page can't be reused from cache; it only warms assets the page
  already has. That costs one extra small GET on hover; we kept it for
  consistency with 042 rather than special-casing these links.

## Consequences

- Any new field in the login form needs its own `data-rmx-key`, or it may
  steal another field's node (and value) on the next tab switch.
- `keepPlace` is for tabs that stay in the same spot on the next page.
  Lesson mode tabs don't use it (the lesson body resets per page).
- Verified in Chrome: tabs at y=120 on both tabs and on the code step, the
  same canvas node with `data-ready` after three switches, focus on the
  pressed tab, the email kept, the 422 path focusing `#auth-email`, and the
  POST → `/login/check` path staying a client navigation. Screens at 360,
  600, 900 and 1440px wide. The app is dark-only (decision 031), so light
  renders the same. GIFs: `login_tabs_before.gif`, `login_tabs_after.gif`
  (browser downloads, not committed).
