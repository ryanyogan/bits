-- Migration number: 0015 	 Build checks: one row per check of a learner's deployed Worker (decision 072)
--
-- POST /api/verify calls one path on the learner's https://<name>.workers.dev
-- origin and runs the block's `- expect` checks on the reply. Every attempt
-- is reserved here before the fetch (the hourly caps live in the insert) and
-- finished with its outcome after it. "Complete lesson" reads which verify
-- blocks passed from this table, never from form fields, and a certificate
-- links the origin of the course's final passing check (public profiles only).
--
-- Only the origin and the block's own path are stored, never a query string
-- or the reply body. Signed-out rows carry the session's visitor id and move
-- to the user at sign-in. The daily clean-up deletes signed-out rows after
-- 7 days and an account's failed rows after 30; passing rows stay with the
-- account (they back the certificate) until it is deleted.

create table build_checks (
  id text primary key not null,
  user_id text references users (id) on delete cascade,
  -- Session-held id of a signed-out visitor (also kept after sign-in).
  visitor text,
  -- sha256("ip:" + CF-Connecting-IP), for the per-IP limit on signed-out checks.
  ip_hash text,
  course_id text not null,
  lesson_slug text not null,
  verify_id text not null,
  -- https://<name>.workers.dev: scheme and host only.
  origin text not null check (length(origin) <= 260),
  -- The block's path at the time of the check (authored, not learner input).
  path text not null check (length(path) <= 200),
  -- pending: reserved, fetch in flight. pass: every check held. Otherwise why it failed.
  outcome text not null check (outcome in ('pending', 'pass', 'checks', 'status', 'redirect', 'timeout', 'too-large', 'network')),
  -- The HTTP status the learner's Worker answered with, when it answered.
  status integer,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  created_at integer not null,
  check (user_id is not null or visitor is not null)
);

-- The save's "which verify blocks passed" read and the hourly cap.
create index build_checks_user_lesson on build_checks (user_id, course_id, lesson_slug) where user_id is not null;
create index build_checks_user_created on build_checks (user_id, created_at desc) where user_id is not null;
create index build_checks_visitor_created on build_checks (visitor, created_at desc) where visitor is not null;
-- The per-IP hourly cap on signed-out checks.
create index build_checks_ip_created on build_checks (ip_hash, created_at desc) where ip_hash is not null;
-- The per-target hourly cap: no one turns bits into a request cannon aimed at one Worker.
create index build_checks_origin_created on build_checks (origin, created_at desc);
