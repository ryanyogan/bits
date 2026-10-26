-- Migration number: 0005 	 Prompt journal: one row per run (live prompts, decision 019)
--
-- exercise_attempts now records every POST /api/run as well as the prompt a
-- learner submits with "Complete lesson". Runs are what the server counts
-- for an exercise's `- run temperature=[...]` requirement and for the run
-- limits, so they are written for signed-out visitors too: `visitor` is a
-- random id kept in the session, and sign-in moves those rows to the user.
--
-- SQLite cannot relax NOT NULL on user_id in place, so the table is rebuilt.
-- Existing rows are lesson submissions (source 'submit').

create table exercise_attempts_v2 (
  id text primary key not null,
  user_id text references users (id) on delete cascade,
  -- Session-held id of a signed-out visitor (also kept after sign-in).
  visitor text,
  -- sha256("ip:" + CF-Connecting-IP), for the per-IP anonymous limit.
  ip_hash text,
  course_id text not null,
  lesson_slug text not null,
  exercise_id text not null,
  prompt text not null check (length(prompt) <= 4000),
  -- submit: saved with "Complete lesson". live: the model ran.
  -- example: a canned output for a temperature the model doesn't run at.
  -- fallback: canned output because of a limit, the budget or an outage.
  source text not null check (source in ('submit', 'live', 'example', 'fallback')),
  -- T x 100 of a run, null for a submission.
  temperature integer check (temperature between 0 and 100),
  -- What the learner saw, truncated.
  output text not null default '' check (length(output) <= 2000),
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  -- Submissions: every check passed on the server. Null for runs.
  passed integer check (passed in (0, 1)),
  created_at integer not null,
  check (user_id is not null or visitor is not null)
);

insert into exercise_attempts_v2
  (id, user_id, course_id, lesson_slug, exercise_id, prompt, source, passed, created_at)
select id, user_id, course_id, lesson_slug, exercise_id, prompt, 'submit', passed, created_at
from exercise_attempts;

drop table exercise_attempts;

alter table exercise_attempts_v2 rename to exercise_attempts;

-- The journal, and the signed-in hourly and daily counts.
create index exercise_attempts_user_created on exercise_attempts (user_id, created_at desc);
-- A visitor's hourly count, the run check and the sign-in merge.
create index exercise_attempts_visitor_created on exercise_attempts (visitor, created_at desc) where visitor is not null;
-- The per-IP hourly count for signed-out runs.
create index exercise_attempts_ip_created on exercise_attempts (ip_hash, created_at desc) where ip_hash is not null;
-- The global daily cap on live runs.
create index exercise_attempts_live_created on exercise_attempts (created_at) where source = 'live';
