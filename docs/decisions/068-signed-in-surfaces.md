# 068. Signed-in surfaces: private by default, honest authoring, notices where you are

Status: Accepted (2026-11-02). Release-prep lane L3 (`docs/plans/release-prep.md`,
audit `docs/plans/release-audit/C-signed-in.md`). Amends 028 (profiles were
public by default) and 030 (where the step-up box and its notices go).

## Context

The signed-in audit found fake UI on `/author` (a hard-coded "connected" repo
and a Save that did nothing), feedback that landed off screen on a 3,500px
Settings page, two step-up boxes offering a passkey to accounts without one,
a "My learning" page that put the next lesson below the fold, and new
accounts published at `/u/<email local-part>` without being asked. The owner
decided on 2026-11-02 that profiles are private by default and that a new
handle must not expose the email.

## Decision

**Private by default, neutral handles.** `createUser()` sets `is_public`
false and, unless a handle is given, a generated one: `learner_` plus six
characters from `a–z2–9` without `0 o 1 l` (32⁶ values; `neutralHandle()`
retries on the rare collision). Sign-up and OAuth no longer derive the
handle from the email local-part, the display name or the provider login
(`OAuthProfile.username` is gone). The display name is still kept: it is
shown only to the learner until they publish.

- **No migration.** The SQL default of `users.is_public` stays 1. SQLite
  can't change a column default without rebuilding the table, and rebuilding
  `users` on D1 would cascade-delete every child row (sessions, progress,
  identities). Every insert goes through `createUser()`, so the code default
  is the one that applies; `tables.ts` says so.
- **Existing accounts keep what they have.** No backfill: a profile someone
  already shares stays up. `/privacy` (updated 2 November 2026) says accounts
  made before that date started public.

**No fake authoring.** The repo-sync card, `POST /author/repo` and the
"Push to GitHub" copy are gone until a webhook exists. `POST /webhooks/github`
answers 404, not 501: `logServerErrors()` logs every 5xx at `error`, which
opens a Workers Issue (039), and a stray delivery isn't one. A returning
author sees their courses first, then the upload band. The build page has a
breadcrumb back to `/author`, View live once a version is live, Preview only
for an unpublished build, one rollback key per version behind a `popover`
confirm (like Publish), and a validation report sorted errors, warnings,
passes, with "fewer videos ready than linked" as a warning.

**Outcomes are flashed, not put in the URL.** Settings, `/admin/authors` and
the course build page redirect 303 to the page (Settings and admin with the
section's `#id`) and keep the outcome in the session flash (`settings:saved`,
`admin:saved`, `author:done`, `author:welcome`). The page shows it once; a
reload, a bookmark or a shared link doesn't. `?saved=` and `?done=` are no
longer read. A bad form re-renders 422 with its issues (theme, passkey name,
method, rollback version) instead of redirecting with an error code.

**Notices sit in their section.** Each Settings and admin section renders an
always-present `role="status"` slot (031) at the top of its body, and the
notice for that section goes there, next to the controls it is about.

**One step-up box.** A stale session (030) gets one `ReauthBlock`, at the top
of Email, covering the email change, new passkeys and connecting a provider.
It offers "Use a passkey" only when the account has one. Connect renders
disabled (`aria-disabled`, no href) with a note linking to the box; the
server still refuses at start and callback. Step-up refusals land on
`#email`.

**/me is "My learning".** The page opens with the next lesson: a Continue
band (the current lesson of the most recent course in progress, linking to
the lesson) or Start here at lesson 1 for an account with nothing done. It
comes from the profile rows already read with the session, so /me stays one
round trip. A private profile shows "Make public to share" instead of a
Share link to its own 404.

**Burst limits.** `RL_ACCOUNT` (10/min: Settings profile, sign out
everywhere, delete account) and `RL_PUBLISH` (10/min: publish and rollback,
each of which rewrites `catalog/live.json`), namespaces 2008/2009 and
3008/3009.

## Consequences

- Tests that need a public profile or a known handle ask for one:
  `signIn(email, { handle, isPublic })`. `settingsNotice(cookie, response)`
  follows a Settings 303 and returns the page with its notice.
- A learner who wants a public profile picks it, and a handle, in Settings.
  The handle prefix there shows the real host.
- OAuth and the email-change link flash their Settings outcome too, so every
  way into Settings shows notices the same way.
