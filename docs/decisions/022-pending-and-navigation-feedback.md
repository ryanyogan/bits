# 022. Pending forms and navigation feedback, app-wide

Status: Accepted (2026-10-26). Amends 020.

## Context

A sweep of inputs and states before the next milestone found the following:

- Only the sign-in keys (`PendingSubmit`) showed a pending state. Settings,
  authoring (publish, rollback), sign-out, the quiz Check and "Complete
  lesson" gave no feedback while their POST was in flight.
- Nothing stopped a second submit. With client navigation a second click
  aborts the first navigation in the browser, but the first POST has
  already reached the server. On a slow network a double click sent two
  sign-in emails (the e2e test reproduces this with the guard removed).
- A slow client navigation had no visible progress at all. The browser's
  own spinner doesn't run for intercepted navigations.
- Focus and announcements were inconsistent:
  - Enter in the catalog search dropped focus on `<body>`.
  - A quiz check did the same.
  - A wrong sign-in code left focus nowhere.
  - The quiz explanation and the code error were live regions inserted
    together with their text, which screen readers often skip.
- In `forced-colors` (high contrast) mode several things vanished:
  - selected chips, filter pills, tabs and switches, whose selection is a
    background tint;
  - raised keycaps, which have no border;
  - the focus of text fields and code boxes, which use `outline: none`
    plus a box-shadow.

## Decision

- **The browser entry owns navigation feedback**
  (`app/actions/public/navigation-feedback.ts`). It is driven by the top
  frame's `reloadStart` / `reloadComplete`, the events guide 09 uses for a
  pending button.
  - When a native form submits, the form gets `data-pending` and its
    submitter gets `aria-busy="true"`.
  - A second submit of a pending POST form is cancelled.
  - Both reset on `reloadComplete`, whatever the outcome (422 included),
    and on `pageshow`.
  - Forms with `data-rmx-document` (including the entry's
    resubmit-after-error fallback) are skipped.
  - A thin progress bar shows only for navigations longer than 150ms. It is
    a `role="progressbar"` element appended to `<html>` after `<body>`,
    because the top frame's reconcile would remove it from `<body>`. It
    animates with the Web Animations API (so no stylesheet is needed), and
    under reduced motion it is a static bar.
- **Keycap draws its busy caret from `[aria-busy="true"]` in CSS**, with
  `content: "▍" / ""` so the caret stays out of the accessible name. Any
  server-rendered Keycap submitter gets the pending look without an
  island. The `loading` prop just sets `aria-busy`.
- **`PendingSubmit` moves to `@bits/ui/pending-submit`.** Use it where the
  label itself should change ("Sending…") and the fields should go
  read-only. Everything else relies on the runtime.
- **Focus follows the form:**
  - Re-rendered forms keep using `autofocus` on the first invalid field.
    The Navigation API's focus reset lands on the autofocus element, and
    the e2e test checks this.
  - `CodeInput` takes `autoFocus` and puts it on the first box, including
    after hydration.
  - Search and quiz forms set `data-rmx-reset-focus="manual"`, so focus
    stays where it was. The quiz form also sets
    `data-rmx-reset-scroll="manual"`, because in Chrome scrolling to the
    action's `#fragment` blurs the focused key, and
    `data-rmx-history="replace"`.
- **Live regions are mounted before their text**: the quiz explanation
  slot and the code error.
- **Forced colours**: selected and pressed states repaint with
  `Highlight` / `HighlightText` (`forcedSelected` in `lib/states.ts`).
  Raised keycaps get a `ButtonText` border. Fields that hide their outline
  use a transparent one, which forced-colors mode paints.
- **Text fields pick sensible input hints.** `type="email"` / `url` /
  `password` and mono fields default to `autocapitalize="none"` and
  `spellcheck="false"`. `enterKeyHint` is a prop.

## Consequences

- New forms get pending UI and double-submit protection with no work. A
  form that should allow parallel POSTs would have to opt out (there is
  none today).
- A non-Keycap submit button should style `[aria-busy="true"]` itself, as
  `confirmButtonStyle` and the check page's "Send again" do.
- The forced-colors rules are CSS only and weren't checked visually, since
  the test browser doesn't emulate forced colours.
