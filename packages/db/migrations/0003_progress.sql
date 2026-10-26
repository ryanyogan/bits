-- Migration number: 0003 	 Progress, neurons (XP), streaks, badges, prompt journal
--
-- Progress is keyed by (course_id, lesson_slug), not a versioned lesson id,
-- so republishing a course never wipes anyone's progress. course_id is the
-- course slug until a courses table exists.
--
-- XP is a ledger: each award is an xp_events row, once-only per
-- (user_id, kind, ref), and users.xp_total is recomputed from the ledger in
-- the same batch. Replaying a lesson (or an anonymous merge) is therefore
-- safe. See decision 016.

create table lesson_progress (
  user_id text not null references users (id) on delete cascade,
  course_id text not null,
  lesson_slug text not null,
  started_at integer not null,
  completed_at integer,
  updated_at integer not null,
  primary key (user_id, course_id, lesson_slug)
);

-- Every saved prompt: the prompt journal on /me and in the export.
create table exercise_attempts (
  id text primary key not null,
  user_id text not null references users (id) on delete cascade,
  course_id text not null,
  lesson_slug text not null,
  exercise_id text not null,
  prompt text not null check (length(prompt) <= 4000),
  -- Every check passed on the server.
  passed integer not null check (passed in (0, 1)),
  -- Temperatures run at, JSON array of numbers.
  temperatures text not null default '[]' check (json_valid(temperatures) and json_type(temperatures) = 'array'),
  created_at integer not null
);

create index exercise_attempts_user_created on exercise_attempts (user_id, created_at desc);

create table xp_events (
  id text primary key not null,
  user_id text not null references users (id) on delete cascade,
  kind text not null check (kind in ('exercise', 'quiz', 'lesson')),
  -- course/lesson[/exercise]
  ref text not null,
  xp integer not null check (xp >= 0),
  -- Local day (YYYY-MM-DD) in the user's timezone when it was earned.
  day text not null,
  created_at integer not null
);

-- Once-only awards; also serves lookups by user_id.
create unique index xp_events_once on xp_events (user_id, kind, ref);

-- One row per local day with any activity: the profile heatmap.
create table activity_days (
  user_id text not null references users (id) on delete cascade,
  day text not null,
  xp integer not null default 0 check (xp >= 0),
  actions integer not null default 0 check (actions >= 0),
  primary key (user_id, day)
);

-- Badges are defined in code (app/progress/badges.ts); this records when
-- each one's rule first became true.
create table user_badges (
  user_id text not null references users (id) on delete cascade,
  badge_id text not null,
  awarded_at integer not null,
  primary key (user_id, badge_id)
);

-- The streak is kept on the user row so every page can show it without
-- reading activity_days: streak_days counts the run of consecutive local
-- days ending on streak_last_day.
alter table users add column streak_days integer not null default 0 check (streak_days >= 0);
alter table users add column streak_last_day text;
alter table users add column best_streak integer not null default 0 check (best_streak >= 0);
