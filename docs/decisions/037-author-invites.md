# 037. Author invites and the admin authors page

Status: Accepted (2026-10-27). Extends 015 (auth), 018 (content ownership)
and 030 (owner-only links). Uses 039 (mail cap, housekeeping).

## Context

Writing courses is invite-only (handoff, Roles), but until now the `author`
role and `course_authors` rows were set by hand in D1. Admins need a page to
make someone an author, put authors on courses and take both away again.

## Decision

### `/admin/authors` (admin only)

- `requireUser()` then `requireAdmin()` (`app/auth/require-admin.tsx`) on
  the controller. The role comes from the users row read for this request,
  so a demotion takes effect on the next request. Anyone else gets the 403
  page. Every write's SQL also checks `exists (… role = 'admin')` for the
  acting user, so a form posted by someone demoted mid-flight writes
  nothing.
- One page lists authors and admins, open invites, and every course with
  its authors. It reads them in one `db.batch` after the session:
  5 queries, 2 round trips, pinned in the controller test. Responses are
  `no-store`.
- Writes are native form POSTs with `rateLimit('RL_WRITES')`: `invite`,
  `revoke`, `role` and `course` (add or remove). Invalid or stale input
  re-renders with a 4xx (422; 403 if not an admin; 429 at the mail cap)
  and a message in that section, never a 5xx (decision 020); success is a
  303 back with `?saved=`.
- **Roles step down one at a time**: admin → author, author → learner.
  An author who becomes a learner is taken off every course in the same
  batch. An admin can't change their own role, so the last admin can't
  lock everyone out. Making someone an admin stays a manual D1 change.
- Course authors: only authors and admins can be added. `courses.owner_id`
  is not touched; it still lets the original uploader build the course
  while they can author (decision 018).

### Invites

- **A new table, not `email_tokens`.** An invite lives for 7 days, carries
  a list of courses and an inviter, and has to be listed and withdrawn by
  admins. `email_tokens` is for 15-minute codes, its `purpose` check would
  need a table rebuild in SQLite, and keeping invites out of it means the
  sign-in queries never see them. `author_invites` (migration 0010) stores
  the SHA-256 of the link's token (`randomToken()`, 32 bytes), the email
  (`collate nocase`), the course slugs as JSON (only slugs that exist when
  the invite is sent), the inviter, `expires_at`, and
  `accepted_at`/`accepted_by`/`revoked_at`.
- **One open invite per address.** A new invite to the same address
  withdraws the older one in the same batch, so only the newest link works.
  If the mail fails to send, the invite is withdrawn at once.
- **Under the mail cap.** Each invite takes a slot with
  `reserveMail(db, 'author-invite')` (decision 039) before the row is
  stored, so it shares the daily cap with sign-in and email-change codes.
  At the cap the form answers 429 and nothing is stored. There is no
  per-address limit beyond that: only admins can send, and the
  `RL_WRITES` burst limit applies.
- **The link** is `/admin/invite?token=`. As with the other emailed links
  (decisions 015, 030), a GET only shows a page and only the POST acts,
  because mail scanners open links. The link **never starts a session**:
  - signed out → `/login?next=<the link>`, and back after sign-in;
  - signed in as another address → "this invite is for someone else", with
    the invited address masked (`n***@e***.com`), 403 on POST;
  - signed in as the invited address → "Accept the invite".
  Unknown, expired, used or withdrawn links all get the same 410 page.
- **Accepting** is one batch: spend the row only while it is open and its
  email equals the user's *current* email (checked in that `UPDATE`),
  then, only for the row that batch spent, set `role = 'author'` where the
  role is `learner` (an author or admin is never changed, so an admin is
  never downgraded), and `insert or ignore` the invite's courses that still
  exist into `course_authors`. Then 303 to `/author`.
- The token is looked up by its hash; there's no comparison of secrets in
  application code to make constant-time.
- **Known trade-off:** a signed-out invitee's sign-in carries the link in
  `next`, so for that sign-in's 15 minutes the raw token sits in
  `email_tokens.next_path`. It is useless without also being signed in as
  the invited address, so we accept it.
- **Retention:** `deleteExpiredRows` (the daily housekeeping batch,
  decision 039) deletes invites 30 days after they expire, accepted or
  not (`retention.authorInvitesMs`). Deleting an account sets the
  invite's `invited_by`/`accepted_by` to null and deletes every invite
  addressed to that email in the same batch (`deleteUserAndInvites`). The privacy page
  says this, and that admins see authors' and invitees' addresses.

## Consequences

- Admins reach the page from a link on `/author`.
- Deploying needs migration 0010 before the code (CI applies migrations
  first; it is additive). The migration was written as 0008 on an older
  master and renumbered when 0009 (mail quota) landed first.
- Removing someone's author role does not unpublish or delete their
  courses; it only stops them building and publishing.
