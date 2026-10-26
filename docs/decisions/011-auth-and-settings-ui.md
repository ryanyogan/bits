# 011. Auth and Settings UI choices

Status: Accepted (2026-10-26), provisional until the auth milestone

## Decision

- **Provider order on /login**: passkey first, then GitHub and Google, then
  email (product direction). The Auth artboard draws the passkey last.
- **Auth pages own their frame** (`actions/login/ui/auth-shell.tsx`): the
  artboard is a full-bleed two-pane page with no AppBar, so it renders
  `Document` directly instead of `Layout`. The brain pane is a `<header>`
  first in the DOM (logo is the first tab stop on desktop); "Your neurons,
  saved." is a `<p>` so the form's `<h1>` is the only heading. Below 760px
  CSS moves the form first and shows a logo above the tabs; at 520px and
  narrower the pane is hidden (resolutions §8).
- **BrainCanvas** is an island that imports `three` dynamically only at
  ≥760px, pauses off screen or in a hidden tab, and runs at quarter speed
  for reduced motion.
- **Keycaps use the normalised sizes** (resolutions §3): the artboard's 54px
  "xl" submit and 52px "Verify & continue" are `lg` (56px).
- **Settings forms** each post to their own stub route under `/settings/*`
  and redirect 303 to `/settings?saved=<what>`. The confirmation Callout
  renders under the page header, not inside the section, because enhanced
  form navigation drops the `#section` fragment.
- **Inline confirmations without JS**: Remove/Disconnect and Delete account
  use `<details>`. Delete is checked on the server (typed handle); an island
  only disables the key until the handle matches and focuses the field.
- **Settings signed-in frame** is local (`actions/settings/ui/settings-shell.tsx`)
  until the shared `Layout` grows a signed-in variant; then switch to it.
- **New shared bits**: Keycap `danger` variant (+ `--danger-edge`,
  `--danger-a04`, `--danger-a35`, `--shadow-keycap-danger*` tokens) and a
  `TextField` `autoFocus` prop (first invalid field after a 422).
