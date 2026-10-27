# 030. Passkeys and email change

Status: Accepted (2026-10-27). Extends 015.

## Context

Milestone 6 adds passkeys (register in Settings, sign in from `/login`, list,
rename, remove) and changing the sign-in email. Both touch account takeover,
so a security review shaped most of the email-change design below.

## Decision

### Passkeys

- **Library:** `@simplewebauthn/server@14` (verification) and
  `@simplewebauthn/browser@14` (the island). The server package uses Web
  Crypto only. We bundled it with esbuild and found no `node:` imports, then
  ran registration and sign-in in workerd (`pnpm preview`) without
  `nodejs_compat`. It adds about 320 KB minified (88 KB gzipped) to the
  Worker, which is now 1855 KiB.
- **Options as JSON, verification as a form.**
  `GET /api/passkey/login-options` and `/register-options` return options
  (`no-store`). The browser response goes back in a native form POST
  (`/login/passkey`, or `/settings/methods` with `intent=add-passkey`).
  The server can then answer with a page: a 303 on success, a 4xx
  re-render on failure.
- **Challenges** live in D1 (`webauthn_challenges`, migration 0007) with
  a 10-minute expiry. They are bound to a purpose (`register` or
  `sign-in`) and, for registration, to the user. A challenge is used once:
  `DELETE … RETURNING` inside `expectedChallenge`. Each insert also sweeps
  expired rows.
- **Relying party:** in production the RP ID and origin come from
  `CANONICAL_ORIGIN`. Elsewhere they come from the request's `Origin`
  header, falling back to the URL. That gives `localhost` in dev and
  tests. WebAuthn rejects IP addresses, so the e2e test uses `localhost`,
  not `127.0.0.1`.
- **Credentials:** discoverable (`residentKey: required`) with
  `userVerification: required`. Algorithms are EdDSA, ES256 and RS256. The
  user handle is the UTF-8 bytes of `users.id`, and sign-in checks that it
  matches the stored passkey. `excludeCredentials` stops duplicates. An
  account can hold at most 20 passkeys.
- **Sign-in** goes through `startUserSession(…, 'passkey')`, which rotates
  the session id. Conditional UI (autofill) starts on `/login` when the
  browser supports it. An unknown credential gets a 404 page and the
  Signal API (`signalUnknownCredential`), so the browser can forget it.
- **No-JS:** the passkey button is hidden under `@media (scripting: none)`,
  disabled until support is detected, and removed when there is no
  support. Email sign-in still works without JS.
- **Limits:** options and sign-in use `RL_SIGNIN`. Settings writes use
  `RL_WRITES`. There are no new bindings.

### Recent authentication (step-up)

Changing the email and adding a passkey need a sign-in from the last 10
minutes (`RECENT_AUTH_MS`, read from the session's `at`). An older session
sees a "confirm it's you" block. It can ask for a code to the **current**
address (`POST /settings/reauth`, then `/login/check?next=/settings`) or
use a passkey (`/login/passkey`, `next=/settings`). Both start a fresh
session. `register-options` returns 403 `reauth_required` without one.

### Email change

1. **Request** (`POST /settings/email`, needs recent auth). We send a code
   and link to the new address. A purpose-tagged `email_tokens` row
   (`purpose = 'email-change'`, `user_id`) holds them. The email
   sign-in limits apply. A new request withdraws an older pending one. If
   the address already belongs to another account, the new address gets
   an "already in use" mail instead of a code. The requester sees the same
   screen either way, so the form doesn't leak which addresses have
   accounts.
2. **Confirm** with the code in Settings, or with the link
   (`/auth/email?token=`). A GET only shows a page, and only the POST acts,
   because mail scanners open links. **A link never starts a session.** It
   completes the change only when the requesting user's own session opens
   it. Any other browser sees "sign in first", with the account's address
   **masked** (`r***@g***.com`).
3. **Swap** in one `db.batch`. It spends the token, writes a revert row
   and updates `users.email`. The `users.email` unique index decides
   races, and a loser gets `taken`.
4. **Notice to the old address** with a **revert link valid for 7 days**
   (`/auth/email/revert`). The revert row stores both addresses: `email`
   is the old one and `changed_to` is the new one.

### The revert window

- **While any revert link is open** (an unused, unexpired `email-revert`
  row), further email changes are refused with "an email change is
  waiting for confirmation from your previous address; try again after
  <date>". The refusal is a 409 that shows the date in the user's
  timezone. The completing statement checks it too, in case a change
  races the window open.
- **A completed change never cancels a revert link.** This blocks an
  attacker with a stolen session from changing A→B→C so that A's undo
  link dies. An earlier version did withdraw older revert links, and
  review rejected it for exactly that reason.
- **Reverting** (POST only) is one batch. It spends the token only while
  `users.email = changed_to`; the check sits in the `WHERE`, so it is
  atomic. It then restores the old address, withdraws pending changes and
  other revert links, **deletes every session** of the user, and
  **deletes passkeys and OAuth identities created since the day before the
  change** (identities since 2026-10-27, see below). Then the
  user signs in again. A revert link whose `changed_to` no longer matches
  shows as expired.

### Sessions on change

~~A completed change keeps the user's other sessions.~~ Superseded on
2026-10-27: a completed change signs out the user's other sessions. See
"Security review follow-up" below.

## Security review follow-up (2026-10-27)

A review of the live code found three gaps. All are fixed.

1. **Linking GitHub or Google needed no step-up (high).** A signed-in
   session that goes through OAuth links the identity to the account. That
   adds a way in, as a passkey does, but it had no recent-auth check. An
   attacker with a stale stolen session could link their own GitHub, sign
   in through it, get a fresh `at` and pass step-up for everything else.
   Now `/auth/oauth/:provider` (start) and the callback both refuse a
   signed-in session that isn't recent. They redirect to
   `/settings?saved=reauth&for=connect#sign-in`, which shows the
   "confirm it's you" block. The callback checks before it finishes the
   OAuth exchange and before anything is linked. The session may have gone
   stale since the start, or the start may have been skipped. Signed-out
   OAuth is a sign-in, and step-up doesn't apply to it.

   We don't treat a sign-in through a recently linked identity as weaker.
   With the gate, every identity is linked either by a session that has
   just proved it owns the account (an email code or a passkey), or while
   signed out to the account with the same provider-verified email, which
   is the same proof as an email code. So a sign-in through it proves as
   much as any other sign-in. Identities linked before the fix are covered
   by the revert (item 2) and are listed with their date in Settings.
2. **The revert left new identities behind (medium).** `revertEmailChange`
   now also deletes `identities` rows created since the same cutoff as
   passkeys (the day before the change), in the same batch, behind the
   same `spent` guard. `identities.created_at` already existed (0001),
   so no migration was needed. The old-address notice and the undo page
   say so.
3. **A completed change kept other sessions (medium).** Settings said
   "your other devices are signed out", but they weren't. The earlier
   reasoning was that ending sessions only helps an attacker push the
   owner out. But an owner who changes the email because they suspect a
   problem expects other devices to be signed out, and the revert link
   still ends every session if the change was hostile. `completeEmailChange`
   now deletes the user's other sessions in the same batch, behind the
   `spent` guard, and keeps the confirming session (`keepSessionIdHash`,
   the SHA-256 of `context.session.id`). This applies to confirmation by
   code in Settings and by link. The revert link works as before.

Tests: `auth.test.ts` ("connecting to a signed-in account needs a recent
sign-in, at start and at the callback") and `email-change.test.ts`
("signs out other sessions", the link test, "new passkeys and identities
gone").

## Consequences

- An honest user must wait up to 7 days before changing the email again.
  We accept that, because the alternative lets an attacker cancel the
  undo.
- A revert removes passkeys from 24 hours before the change onward. If an
  attacker added a passkey earlier, without changing the email, the owner
  must remove it in Settings. Settings lists every passkey with its date.
- `wrangler dev` with the custom-domain route rewrites both the URL and
  the `Origin` header to `http://bits.yogan.dev`. A real browser on
  `pnpm preview` therefore fails the RP check. We verified preview with a
  scripted soft authenticator that uses that origin. Dev (`pnpm dev`) and
  the e2e test, which uses a CDP virtual authenticator, work normally.
- Migration 0007 must be applied remotely (`pnpm db:migrate:remote`)
  before this code is deployed.
