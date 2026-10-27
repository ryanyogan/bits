# 038. Sign-in on Workers Previews: the code on the page

Status: Accepted (2026-10-27). Builds on 015 (auth), 030 (passkeys, email
change), 032 (CI deploys and previews).

## Context

Decision 032 gave every same-repo pull request a Workers Preview at
`https://pr-<n>-bits.ryanyogan.workers.dev`. It runs on the shared
`bits-preview-db` and `bits-preview-content`, never production data. A
Preview has no `send_email` binding, so the mailer kept sign-in mail in
memory and nobody could sign in. Reviewers couldn't check any signed-in
page.

## Decision

### On a Preview, sign-in shows its code on the page

- **What counts as a Preview.** `isPreview()` (`app/auth/config.ts`; the
  rule is `previewMode()` in `app/auth/preview-mode.ts`) is true only when
  all three hold:
  - `APP_ENV` is `preview`. Only the `previews` block of `wrangler.jsonc`
    sets that.
  - There's no `CANONICAL_ORIGIN`.
  - There's no `EMAIL` (send_email) binding.

  Production has `APP_ENV=production`, its origin and its mail binding, so
  one wrong var can't turn it into a Preview. The flag is read per call,
  not at import, so tests can switch it.
- **Config guard.** `checkPreviewMode()` in
  `scripts/lib/preview-resources.ts` refuses a `wrangler.jsonc` unless:
  - top-level vars say `APP_ENV=production` and set `CANONICAL_ORIGIN`;
  - the top level binds `send_email`;
  - the `previews` vars say `APP_ENV=preview` and don't set
    `CANONICAL_ORIGIN`;
  - `previews` binds no `send_email`.

  `scripts/preview.ts check` runs it, so a bad config fails the CI
  preview job before anything deploys. It runs even before the preview
  database exists. A unit test runs it over the real `wrangler.jsonc`.
  The same test runs `previewMode()` over the production vars (false) and
  the preview vars (true). That test is in the `check` job, which every
  production deploy waits on, so a config that could put production in
  this mode never deploys. `app/actions/login/preview.test.ts` also signs
  in with `APP_ENV=preview` but production's origin or mail binding, and
  checks the code is mailed, never shown.
- **The flow.** `requestEmailSignIn` runs every check as usual: the burst
  limiter, the per-address and per-IP limits from `email_tokens`, the
  daily mail cap (decision 039: `reserveMail` still takes a slot, so
  `SIGNIN_MAIL_DAILY_CAP` in the `previews` vars bounds preview sign-ins
  per day too), then the hashed token row.
  - On a Preview it then returns `shownCode` instead of mailing.
  - `POST /login` flashes `{ email, code }` into that browser's session
    (`app/actions/login/preview-code.ts`).
  - `/login/check` shows the code once, fills it into the code boxes, and
    says mail is off on this preview.
  - We used the session rather than the URL, so the code never lands in
    history, logs or a `Referer`. A reload or another browser sees no code
    ("Send again" asks for a new one).
  - The magic link isn't shown, because the code is enough. Codes still
    expire in 15 minutes, work once and allow 5 tries.
- **Other mail on a Preview is dropped.** `sendMail` logs "Mail is off on
  previews; not sent". It logs no subject or body, since those carry codes
  and links. It keeps nothing in `outbox`, and its signature is unchanged.
  This covers email change, the "email changed" notice and author invites.
- **OAuth is hidden on Previews.** The GitHub and Google apps call back to
  production, and Previews get no client secrets. A direct
  `/auth/oauth/<provider>` still answers "isn't switched on yet".
- **Passkeys stay.** Outside production the relying party is the request's
  own origin. So a passkey works on the Preview host it was made on
  (`pr-<n>-bits…`), and not on another PR's preview. That's enough to
  review the passkey flows. A fresh sign-in counts as recent (decision
  030), so adding one needs no re-auth code.

### Threat model

- **Assets on a Preview.** These are the shared preview database and
  bucket: throwaway accounts, progress and content that CI republishes on
  every push. There's no production row, secret or mail binding. Each
  deploy gets its own random `SESSION_SECRET` (decision 032).
- **What this mode gives away.** Anyone who can reach a Preview URL can
  sign in as any address there. Every preview account is open to everyone
  who knows or guesses its address, including accounts other reviewers
  made. That's acceptable only because the data is throwaway, so:
  - Never store anything real in a preview account. The PR comment says
    to use a made-up address.
  - A role granted on a Preview is granted to everyone who knows the
    address (see below).
- **No new way into production.** The mode depends on three facts that
  production can't have all at once. CI refuses a config where it could.
  The code path only skips mail: every limit, hash, expiry and attempt
  count is the same as in production. If production were somehow misread
  as a Preview, it would still have `EMAIL` and `CANONICAL_ORIGIN`, and
  `isPreview()` would be false.
- **Abuse.** The burst limiter (`RL_SIGNIN`, the preview's own 3xxx
  namespace) and the D1 limits (3 per address per 10 minutes, 20 per IP
  per hour) still apply, and no mail leaves, so nobody can use a Preview
  to send spam. Previews carry `X-Robots-Tag: noindex`.

### Roles: none are granted; author pages need an unguessable address

A preview sign-in creates a **learner**, like everywhere else. Roles come
only from existing rows, and nothing seeds an author or admin on the
preview database. To review author or admin pages, the owner grants a
role by hand to a **made-up, unguessable address**, because anyone can
sign in as that address:

```sh
# Sign in on the preview first as e.g. review-7f3k2q9x@example.com, then:
pnpm --filter @bits/web exec wrangler d1 execute bits-preview-db --remote \
  --command "update users set role = 'author' where email = 'review-7f3k2q9x@example.com'"
# ...and take it back when done:
pnpm --filter @bits/web exec wrangler d1 execute bits-preview-db --remote \
  --command "update users set role = 'learner' where email = 'review-7f3k2q9x@example.com'"
```

`wrangler d1 execute` with `--remote` and the database name works without
a config of its own (from memory, not checked against the docs). Only
someone with Cloudflare access to the account can run it.

We rejected two options:

- A preview-only seeded demo author would be the same thing with a
  well-known address, so anyone could upload videos or publish courses on
  our preview host.
- Capping every preview session at learner would make author pages
  impossible to review.

### PR comment

The `preview` job's comment says how to sign in. Mail is off, the code
shows on the page, and the reviewer should use a made-up address like
`you+pr<n>@example.com`. OAuth is hidden, and author pages follow this
decision. The preview smoke test now checks `/login` too.

## Consequences

- Re-auth on a Preview (Settings → "confirm it's you" by email code)
  calls `requestEmailSignIn`. The Settings page doesn't show `shownCode`
  yet, so the code goes nowhere. Workaround: sign out and in again,
  because a fresh sign-in counts as recent for 10 minutes. Passkey re-auth
  works.
- Email change on a Preview: the confirmation mail is dropped, so a change
  can't be confirmed there. Settings could show a "mail is off on
  previews" note, or the code the same way. That's a follow-up in
  `app/actions/settings/`.
- When the daily cap refuses a preview sign-in, the `rate-global` notice
  still offers GitHub and Google, which previews hide. It's rare (300 a
  day) and harmless; passkeys work.
- Author invites (admin page) on a Preview send nothing. The inviting
  page should say so. Follow-up for that page.
- **Owner option: Cloudflare Access.** Cloudflare can require sign-in for
  all Previews on an account, for one Worker's Previews, or for specific
  hostnames (Workers Previews docs, "Access control"; checked through
  Context7 on 2026-10-27). In the dashboard it's Workers & Pages → bits →
  Settings → Domains, or through the API it's an Access app with a
  `preview_worker` destination. With an email-domain or one-time-PIN
  policy, only invited reviewers reach a Preview, and the "anyone can sign
  in as anyone" exposure shrinks to that group. Access is free for small
  teams on the Zero Trust Free plan (from memory, not checked). We haven't
  turned it on.
- Local check: run the built Worker with a config shaped like a Preview
  (no `send_email`, no `CANONICAL_ORIGIN`, `APP_ENV=preview`) under
  `wrangler dev`. `pnpm dev` always runs as `development`.
