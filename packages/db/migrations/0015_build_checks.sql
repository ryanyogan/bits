-- Migration number: 0015 	 Build checks: one row per check of a learner's deployed Worker (decision 072)
--
-- POST /api/verify calls one path on the learner's https://<name>.workers.dev
-- origin and runs the block's `- expect` checks on the reply. Every attempt
-- is reserved here before the fetch (the hourly caps live in the insert) and
-- finished with its outcome after it. "Complete lesson" reads which verify
-- blocks passed from this table, never from form fields, and a certificate
-- links the origin of the course's final passing check (public profiles only).
--
-- Checks are signed-in only (decision 072): a visitor id costs nothing to
-- mint, so signed-out rows could fill the shared per-origin budget. Only the
-- origin and the block's own path are stored, never a query string or the
-- reply body. The daily clean-up deletes failed rows after 30 days; passing
-- rows stay with the account (they back the certificate) until it is deleted.

create table build_checks (
  id text primary key not null,
  user_id text not null references users (id) on delete cascade,
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
  created_at integer not null
);

-- The save's "which verify blocks passed" read, the export and the per-user caps.
create index build_checks_user_lesson on build_checks (user_id, course_id, lesson_slug);
create index build_checks_user_created on build_checks (user_id, created_at desc);
-- The per-origin caps: bits is never a request cannon aimed at one Worker.
create index build_checks_origin_created on build_checks (origin, created_at desc);
-- The clean-up of old failed rows.
create index build_checks_failed_created on build_checks (created_at) where outcome != 'pass';
