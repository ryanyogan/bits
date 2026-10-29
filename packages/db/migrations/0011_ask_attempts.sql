-- Migration number: 0011 	 Ask journal: one row per answer to a quick check (decision 052)
--
-- Every POST /api/ask is graded on the server and recorded here, right or
-- wrong. "Complete lesson" reads which asks were answered right from this
-- table, never from the form. Signed-out answers carry the session's
-- `visitor` id (as prompt runs do) and move to the user at sign-in; the
-- daily clean-up deletes signed-out rows after 7 days.
--
-- A new table rather than another exercise_attempts source: that table's
-- CHECK on `source` can't change without a rebuild, and answers must not
-- count against the run limits.

create table ask_attempts (
  id text primary key not null,
  user_id text references users (id) on delete cascade,
  -- Session-held id of a signed-out visitor (also kept after sign-in).
  visitor text,
  -- sha256("ip:" + CF-Connecting-IP), for the per-IP limit on signed-out answers.
  ip_hash text,
  course_id text not null,
  lesson_slug text not null,
  ask_id text not null,
  answer text not null check (length(answer) <= 500),
  correct integer not null check (correct in (0, 1)),
  created_at integer not null,
  check (user_id is not null or visitor is not null)
);

-- The save's "which asks are answered" read, the hourly limit and the export.
create index ask_attempts_user_lesson on ask_attempts (user_id, course_id, lesson_slug) where user_id is not null;
create index ask_attempts_user_created on ask_attempts (user_id, created_at desc) where user_id is not null;
-- A visitor's answers: the same reads signed out, and the sign-in merge.
create index ask_attempts_visitor_created on ask_attempts (visitor, created_at desc) where visitor is not null;
-- The per-IP hourly limit for signed-out answers.
create index ask_attempts_ip_created on ask_attempts (ip_hash, created_at desc) where ip_hash is not null;
