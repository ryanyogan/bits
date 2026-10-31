# 062. Light mode: where the theme lives and how it's saved

Status: Accepted (2026-10-31). The plumbing half of decision 062; the lead
merges it with the design half (tokens and visuals). Amends 007 and 031,
which say dark only, and copies the storage of 053.

## Context

bits draws in a dark or a light theme, and follows the device unless the
learner pins one. The first paint has to be right, and the strict CSP
(027) rules out an early inline script, so the server has to know the
choice and put it in the HTML.

## Decision

**Where it lives.** `users.theme` (migration 0013, nullable, additive) for
a signed-in learner, where null means "follow the system", and the
session's `theme` key signed out. `themeFor()` reads the column, then the
session, then falls back to `system`. The column comes with the session
read (`readSessionWithUser` selects `u.*`, with or without its profile
rows), so a pinned theme adds no D1 read: a signed-in landing stays one
query in one round trip, and the test pins it.

**Rendering.** The `theme()` middleware wraps `context.render` in
`<ThemeScope>`, the way `cspNonce()` wraps it in `<CspNonce>`. `Document`
reads the preference and sets `<html data-theme>`, `color-scheme` and
`theme-color`. No attribute means follow the system. No client script picks
the theme. Everything that goes through `context.render` is themed: pages,
the 404, and the 403, 422 and 429 `StatusPage`s. Three answers aren't,
because they are plain text outside the render: the 500s from
`logServerErrors()` and `worker.ts`, the 413 from `scopedFormData()`, and
`cop()`'s 403. They have no styles to flash.

**Sign-in doesn't merge.** As with `lesson_depth` (053), a signed-out pick
isn't copied to the account. `startUserSession` moves progress, which is
earned, and leaves preferences alone: a pick made on a borrowed laptop
shouldn't overwrite what the account uses everywhere. The session keeps it,
so nothing changes on screen at sign-in, until the account has one of its
own. Because the session is the fallback, saving signed in also drops the
session's copy. Otherwise picking System would fall back to the old pick.

**Saving is a POST.** `POST /theme` (form field `theme`) calls
`rememberTheme()` and answers 303 to `/`; `POST /settings/appearance` saves
the same way for Settings. `/theme` takes `RL_WRITES`, `cop()` covers it,
and an invalid value is a 422 `StatusPage` (4xx, so client navigation
renders it). The target is fixed and never read from the request.

The first version was a `?theme=` link that saved on GET and redirected to
the same URL without the parameter. A security review found two problems:

- An open redirect. Rebuilding the target from `pathname + search` turned
  `GET //evil.com/?theme=dark` into `Location: //evil.com/`.
- A state change on GET, which skips `cop()` and the rate limit, and let
  each anonymous hit write a D1 session row.

**Why this differs from `?depth=`.** `?depth=` stays a GET on purpose. It is
a read with a side effect: the URL names what the page shows, it is
meaningful to link to and it answers with the page itself, on lesson routes
only, with no redirect to build. `?theme=` showed nothing of its own. It
ran on every route only to write and redirect, so it was a write in a GET's
clothes, and a form says so honestly.

**Client navigation.** Both forms stay on the enhanced path, with no
`data-rmx-document`. The runtime reconciles the attributes on `<html>` and
the keyed metas: `app/theme.test.e2e.ts` clicks through System, Dark and
Light, and saves in Settings, and asserts the attribute, the metas and the
computed `background-color` on `body`, with a `window` marker proving no
document load happened.

**The control.** The footer switch is three submit buttons in one native
form, with `aria-pressed` for the current value. Buttons don't prefetch, so
speculative GETs (042) can't save anything. Settings has an Appearance row
with the `Switch` radios, which shows the saved value without JS. The data
export lists `theme`, `/privacy` names it, and deleting the account removes
it with the row.

## Consequences

- **The switch is only on the landing.** `Footer` renders on `/` and
  nowhere else. A signed-in learner also has Settings. A signed-out
  learner on any other page has no control: they follow their device, and
  have to go to `/` to pin a theme. A header control would fix that; it's
  an owner design call, so this doesn't add one.
- `POST /theme` always lands on `/`. That's right while the footer is the
  only caller. A control on other pages will need a way back that isn't
  taken from the request, such as a route-checked allowlist.
- The `/styleguide` footer specimen is the real form, so pressing it saves
  and leaves the page.
- An anonymous visitor who picks System with no earlier pick writes
  nothing. Other anonymous visitors gain no session from this code.
- A signed-out pick isn't in the data export, as there's no account to
  export; it goes with the session.
- The a11y audit waits for colour transitions to finish after flipping the
  scheme, chains included. Without that it read one theme's ground under
  the other's text.
