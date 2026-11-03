# 072. Proof of build: `:::verify` checks the learner's deployed Worker

Status: Accepted (2026-11-03). Lane A of `docs/plans/must-improve.md` (row 4).
Builds on 064 (the `- expect` reply checks), 052 (the save reads a journal,
never form fields) and 028 (certificates).

## Context

The build-along courses (071) end each step with "deploy it". Nothing checked
that the learner's Worker exists or answers. A certificate said "finished the
lessons" and nothing about the thing built. Competitors either check nothing
or run code in their own sandbox, which proves less than a real deploy.

Checking a deploy means bits' server fetches a URL the learner typed. That is
a server-side request forgery surface, and a way to aim bits at someone else's
Worker. The design below is mostly about that.

## Decision

- **A `:::verify{id path xp gate}` block.** Text lines say what to paste.
  `- goal "…"` (required), 1–8 `- expect "label" <check>` lines (the prompt's
  reply checks from 064, minus `prompt-shorter-than` and `quotes`, which need
  a prompt or a document), and `- hint "…"` / `- hint for="label" "…"`. It is
  shared by both depths (never inside `:::new` / `:::engineer`), gates
  "Complete lesson" unless `gate=false`, and its xp follows the block limits.
  Labels reach the browser; patterns never do.
- **The path is authored; only the origin comes from the learner.** `path`
  is one leading `/` (never `//`), then unreserved characters and `/`, an
  optional `?a=b&c` query, at most 200 characters, no `..` segment, no `%`,
  `@`, `\` or `#` (`app/verify/path.ts`). The build checks it, and the
  endpoint checks it again before every fetch.
- **Only `https://<1–3 labels>.workers.dev`.** Cloudflare owns that zone's
  DNS, so a learner can't point a name at a private address: no SSRF into a
  network, no DNS rebinding. No other host, scheme, port or credentials. A
  pasted path, query or fragment is dropped. The final URL is re-parsed and
  must still be on that origin (`app/verify/target.ts`). Custom domains are
  out: we'd need our own resolver and address checks, which Workers can't do.
- **One GET, bounded.** A fixed User-Agent, no cookies or forwarded
  headers, `redirect: 'manual'` (a 3xx is a failed check, never followed),
  5 s for the whole exchange including the body, and at most 64 KiB read
  from the stream, then it is cancelled (`app/verify/fetch.ts`). The reply
  is graded on the server and dropped, never stored.
- **Signed in only.** A visitor id costs nothing to mint; an account costs a
  verified email under the daily mail cap (039). Signed out, the panel shows
  a sign-in link and the endpoint answers 401 before journalling or fetching.
- **Caps live in the insert.** `POST /api/verify` reserves a `pending`
  `build_checks` row in one `INSERT … SELECT … WHERE`, then fetches, then
  records the outcome. Per hour: 30 per user, 10 per user per origin, and
  per origin 120 (past which only users already checking it get in, so
  nobody can lock a Worker's owner out) and 240 for everyone, which bounds
  the calls any Worker gets from bits. On top, the `RL_VERIFY` burst tier:
  10 a minute (namespace 2012 in production, 3012 in previews; 2008 was
  already `RL_ACCOUNT`).
- **Previews never call out**, as they send no mail and run no model (032,
  038). Their journal is a separate database, so a check there would sit
  outside production's per-origin caps. The endpoint refuses with a 422.
- **The save reads the journal.** `completeLesson` reads which verify blocks
  have a `pass` row for the user (`listPassedBuildChecks`); form fields are
  never read. A pass is ledgered as an `exercise` award.
- **Without JS** the panel is a native form: the endpoint answers 303 back to
  `#verify-<id>` and flashes the verdict (or why the URL was refused) in the
  session, as quick checks do (052).
- **The certificate links the deploy.** When a course's last `:::verify` (in
  course order) passed, the certificate shows "Deployed: <host> · checked
  <date>", with `rel="nofollow ugc noopener noreferrer"`, and says plainly
  that a pass proves a Worker answered, not who wrote it. Public profiles
  only, like the certificate itself.
- **Retention.** Failed rows are deleted after 30 days by the daily
  housekeeping; passing rows stay with the account (they back the
  certificate) and go with it. They are in the export. `/privacy` says so.

## Consequences

- A lesson can now ask for something real, and a certificate can point at it.
- It proves "a Worker at this address answers like this", not authorship.
  Lessons that use `:::verify` should say so; the panel and certificate do.
- Only `workers.dev` deploys can be checked. A learner on a custom domain
  must also keep the `workers.dev` route on.
- A learner's Worker sees one GET per check from Cloudflare's network with
  the `bits-verify/1` User-Agent. It can't tell bits apart from a forgery of
  that header, and doesn't need to.
