# 031. Accessibility pass: an axe suite at 360 and 1440, fixes at the source

Status: Accepted (2026-10-27). Milestone 6. Builds on 023, 024, 025, 027, 028.

## Context

The handoff's milestone 6 acceptance: "every page passes an automated
accessibility check at 360 px and at 1440 px". Nothing checked that. Pages
had been reviewed by hand (forced colours in 025, focus and announcements in
024), and 024 and 028 both noted that a live region inserted together with
its text may not be announced.

## Decision

### The suite: `apps/web/app/a11y.test.e2e.ts`

- Playwright via `remix test` against the real router (test platform, seeded
  courses and the test video), like the other e2e files.
- **axe-core 4.14** (`axe-core` dev dependency), injected with
  `page.evaluate(source)`. That goes over the DevTools protocol, which the
  strict nonce CSP (027) doesn't govern, so neither the markup nor the policy
  changes for tests. `@axe-core/playwright` was tried first. It needs a page
  from its own `browser.newContext()`, which `t.serve()` doesn't give, so it
  was dropped.
- Every audit runs at **360×800 and 1440×900**, in the **dark and light**
  colour schemes, with reduced motion emulated so animations don't catch
  contrast mid-fade. It runs all axe rules, and a **serious or critical**
  violation fails the test. Each failure lists the rule, the width, the
  scheme and the first selectors. The app is dark-only today
  (`color-scheme: dark`, one token set), so light renders the same. It stays
  in the matrix so a light theme can't ship unchecked.
- Pages: the landing page, `/courses` (plain, a search, a search with no
  results) and a course. Lessons: read mode with every toy (nexttoken +
  composer, training, attention, compare, rabbithole, odds, tokenizer +
  quiz, code), watch mode, and terminal mode (code + quiz, composer).
  `/login` (email, signup, the code step, a wrong code), `/terms`,
  `/privacy`, `/styleguide` and the 404 page. Signed in: the landing page,
  `/courses`, a lesson, `/me`, `/u/:handle`, `/settings` (fresh, an email
  error, a pending email change, the re-auth state), `/author`,
  `/author/:course` and a preview. Also a certificate.
- States after interaction: a quiz after answering, the composer after a run,
  the mobile menu sheet open (360 only), an attention chip picked, the
  transcript and captions toggled, the training scrubber at its end, a
  `bits:reward` event, and the badge toast after completing a lesson in the
  browser.
- 29 tests and about 50 s on this machine. It runs with `pnpm test`.

### Before and after

Counted with the final suite against master's components (`before`) and this
branch (`after`). The counts are serious or critical rules, with nodes in
brackets. Light matched dark exactly in every row.

| Page / state | 360 before | 1440 before | after (both) |
|---|---|---|---|
| landing (signed out) | contrast (1) | contrast (1) | 0 |
| landing (signed in) | contrast (1), name (1) | contrast (1), name (1) | 0 |
| courses / lesson / me / u / settings ×4 / author ×3 (signed in) | name (1) each | name (1) each | 0 |
| lesson read: attention, and after picking a chip | name (4 / 1) | name (4 / 1) | 0 |
| lesson watch, and with captions toggled | name (1) | name (1) | 0 |
| lesson read: code | scroll (1) | 0 | 0 |
| lesson terminal: code + quiz | scroll (2) | 0 | 0 |
| lesson terminal: composer | scroll (1) | 0 | 0 |
| badge toast (signed in) | name (1) | name (1) | 0 |
| styleguide | contrast (5), name (11), scroll (4) | contrast (6), name (11) | 0 |
| every other page and state listed above | 0 | 0 | 0 |

Key: contrast = `color-contrast`, name = `label-content-name-mismatch`
(WCAG 2.5.3 label in name), scroll = `scrollable-region-focusable`.

### Fixes, at the source

- **Label in name (2.5.3).** An accessible name must contain the text you
  can see, so voice-control users can say what they see.
  - `AvatarButton` is now named `Your profile, <initials>`. It was on every
    signed-in page.
  - The video player's CC button is now `CC: captions`.
  - Attention chips are now `<token> <weight> attention` (and `<token> from`
    for the selected chip), with a whitespace text node between the token
    and the weight spans. Flex layout drops it, but text extraction needs it
    for a word break.
- **Keyboard scrolling (2.1.1).** Containers that scroll sideways take
  focus with `tabIndex={0}`, plus an inset focus ring. These are
  `CodeEditor`'s code region (it already had `role="region"` and the file
  name) and `TerminalOutput` (now `role="region"`, "Command output").
- **Contrast (1.4.3).**
  - Type-mode text you still have to type was faded with opacity (0.28 on
    syntax colours, 0.5 on `--muted`), down to 1.7:1. It is now plain
    `--dim`, the lightest grey the tokens allow for text (5.1:1). The text
    you've typed stays `--text`, so the two still read apart.
  - The landing page's mock editor gutter used `--code-gutter-faint` (1.9:1),
    a token meant for a badge fill. It now uses `--dim`, which tokens.css
    already says real line numbers use (resolutions §6).
  - No token values changed.
- **Skip link target.** `<main id="main">` (`Layout`, both lesson layouts
  and the auth shell) gets `tabIndex={-1}` and no focus outline. Following
  the skip link now moves focus, and a screen reader's cursor, into main.
  Before, focus stayed on `<body>`. Only the next Tab started in main. The
  landing page already did this.
- **Reward toast announcements (the gap in 024 and 028).**
  - The `role="status"` region was `display: none` while empty, so it wasn't
    in the accessibility tree when a toast arrived. It now stays rendered
    while empty. It's fixed and zero-height with no pointer events, so
    nothing moves (023).
  - A server-decided reward (`initial`, the badge toast) is now rendered
    next to the live region, not inside it, so it still shows without JS.
  - 400 ms after hydration, the region takes the toast over. The same
    toast moves into the empty live region in one update, without its pop
    animation, so screen readers announce it and nothing visibly changes.
    The 8 s dismissal starts then.
  - A client navigation mounts a fresh region per award (028), so the same
    path covers that case.
- **Reduced motion, landing field.** The spec (Main §NeuralField, tokens
  §6.5) says ¼ time speed, and that stays. (Superseded in part by 034:
  reduced motion now starts paused; ¼ speed applies once the viewer plays it.) Cursor parallax is now off under
  reduced motion, because motion that follows the pointer is the main
  vestibular trigger the setting exists for. Toasts, the composer and the
  terminal already drop their animations (`bits-pop`/`bits-rise` → none).
  The Auth brain is at ¼ speed per its spec.

### Checked by hand (Chrome, dev server)

- **Keyboard through a lesson.**
  - The tab order is: skip link, app bar, back, the Read/Terminal mode
    links, the outline, the toys, the composer, the rabbit-hole links, then
    previous/next. Every stop showed the 2px ring or the composer's
    focus-within border.
  - In the composer, Shift+Enter adds a line and Enter runs. The run lands
    in the polite `Your runs` log, and focus stays in the textarea.
  - In a quiz, arrow keys pick an answer and Enter on Check re-renders in
    place. Focus stays on Check, and the explanation is in the form's
    `role="status"`.
  - The gated "Complete lesson" button is disabled, so it isn't a Tab stop.
    Its hint text says why.
- **Video player.**
  - Every control has a name: Play video, Seek (with `aria-valuetext`),
    Play/Pause, playback speed, CC: captions and Transcript.
  - Its shortcuts (Space/K, J/L, arrows, C, [ ]) only fire while focus is
    inside the player, which meets WCAG 2.1.4.
  - Captions are drawn from the transcript cues.

### Deferred, consciously

- **Pausing the landing field (2.2.2).** The 3D field moves on its own for
  more than 5 s and has no pause control. It is decorative and
  `aria-hidden`, it stops when hidden or off-screen, and under reduced
  motion it runs at ¼ speed with no parallax. A pause control is a design
  change for the owner.
  **Resolved by 034:** a "Pause animation" toggle in the hero cancels the
  render loop and remembers the choice per viewer. Reduced motion now
  starts paused, not at ¼ speed.
- Moderate and minor axe findings don't fail the suite (the acceptance bar
  is serious or critical), and this pass didn't review them.
- No screen-reader run with NVDA, VoiceOver or Orca on this pass. The
  live-region change follows the documented pattern (an empty region that
  exists before the text arrives), but a real-device check of the badge
  announcement is still worth doing.
- Forced colours (025) isn't part of the axe matrix. Nothing here changes
  a selection or fill state, and the forced-colour fixes are untouched.

## Consequences

- A page, toy or state that ships with a serious or critical axe violation
  fails `pnpm test`. A new page type gets an entry in `publicPages`, or in
  a signed-in `it`, in `a11y.test.e2e.ts`.
- `aria-label`s on controls with visible text must contain that text.
  Tests that matched the old names were updated (`Your profile, …`,
  `cat 70% attention`).
