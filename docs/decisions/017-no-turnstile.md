# 017. No Turnstile on email sign-in (for now)

Status: Accepted (2026-10-26). Supersedes the Turnstile part of 015.

## Context

Decision 015 put Cloudflare Turnstile on the two forms that send sign-in
email. The user doesn't want it: the site is small, and the widget adds
friction and a third-party script to the sign-in page.

## Decision

- Turnstile is removed: the widget island, the server-side siteverify, the
  `TURNSTILE_*` vars and secrets. The email form is a plain POST that also
  works without JavaScript.
- Abuse limits that remain on sending:
  - 3 emails per address per 10 minutes;
  - 20 per IP per hour.
- Code guessing is still capped at 5 tries per email.

## Consequences

- If sign-in email is abused (mail bombing, spending the sending quota),
  options are, in order:
  1. tighten the D1 limits;
  2. add the Workers rate-limiting binding;
  3. bring Turnstile back. The removed code is in git at 099ab87:
     `app/auth/turnstile.ts` and `login/public/turnstile-widget.tsx`.
