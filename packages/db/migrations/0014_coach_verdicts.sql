-- Migration number: 0014 	 Coach verdicts: one row per graded prompt run (decision 064)
--
-- POST /api/coach grades a journalled run (exercise_attempts) on the server
-- and records the verdict here: which layer decided it, each criterion's
-- met flag, the one hint shown, and (when the judge model ran) its token
-- counts. "Complete lesson" reads which exercises passed from this table and
-- from the run journal, never from form fields.
--
-- A row with layer 'reveal' and no attempt records that the learner asked to
-- see the exercise's strong prompt; a pass after it earns half the xp.
--
-- A judged row (judged = 1) is a live model call, so it counts against the
-- daily live cap (RUN_DAILY_LIVE_CAP) with the live runs. Signed-out rows
-- carry the session's visitor id, move to the user at sign-in, and the daily
-- clean-up deletes them after 7 days (their runs go then too).

create table coach_verdicts (
  id text primary key not null,
  -- The graded run. Null only for a 'reveal' row.
  attempt_id text references exercise_attempts (id) on delete cascade,
  user_id text references users (id) on delete cascade,
  -- Session-held id of a signed-out visitor (also kept after sign-in).
  visitor text,
  -- sha256("ip:" + CF-Connecting-IP), for the per-IP limit on signed-out judging.
  ip_hash text,
  course_id text not null,
  lesson_slug text not null,
  exercise_id text not null,
  -- coach: the judge graded the rubric. reply: deterministic checks on a live
  -- reply (no rubric). pattern: no live reply, so prompt checks only. soft:
  -- a live reply whose rubric couldn't be judged (limit or outage), passed on
  -- its deterministic checks. pending: a judge call in flight. reveal: see above.
  layer text not null check (layer in ('coach', 'reply', 'pattern', 'soft', 'pending', 'reveal')),
  passed integer not null default 0 check (passed in (0, 1)),
  -- 1 when a judge call was made (or reserved): counts against the live cap.
  judged integer not null default 0 check (judged in (0, 1)),
  -- [{ "label", "kind", "met": true | false | null }] as JSON.
  criteria text not null default '[]' check (length(criteria) <= 4000),
  hint text not null default '' check (length(hint) <= 400),
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at integer not null,
  check (user_id is not null or visitor is not null),
  check ((attempt_id is null) = (layer = 'reveal'))
);

-- One verdict per run: a second /api/coach for the same run reads it back.
create unique index coach_verdicts_attempt on coach_verdicts (attempt_id) where attempt_id is not null;
-- The save's "which exercises passed" read, the misses count and the hourly cap.
create index coach_verdicts_user_exercise on coach_verdicts (user_id, course_id, lesson_slug, exercise_id, created_at)
  where user_id is not null;
create index coach_verdicts_visitor_exercise on coach_verdicts (visitor, course_id, lesson_slug, exercise_id, created_at)
  where visitor is not null;
-- The per-IP hourly cap on signed-out judging.
create index coach_verdicts_ip_created on coach_verdicts (ip_hash, created_at desc) where ip_hash is not null;
-- The global daily live cap.
create index coach_verdicts_judged_created on coach_verdicts (created_at) where judged = 1;
