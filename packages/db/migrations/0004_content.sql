-- Migration number: 0004 	 Course content: courses, built versions, authors
--
-- A course is a folder of markdown. Each build is an immutable version:
-- the compiled JSON lives in R2 under courses/{slug}/v{n}/ (written before
-- the row), and this table indexes it with the validation report. A build
-- with errors is recorded too (so the author page can show the report) but
-- has nothing in R2 and can never go live. Publishing and rolling back set
-- courses.current_version_id: a single pointer flip. See decision 018.
--
-- courses.slug is the course id everywhere else (lesson_progress.course_id,
-- xp_events.ref), so republishing never touches anyone's progress.

create table courses (
  slug text primary key not null check (slug glob '[a-z0-9]*' and slug not glob '*[^a-z0-9-]*'),
  title text not null,
  track text,
  -- Catalog order (course.md `order`), then slug.
  sort integer not null default 0,
  -- The live version; null until the first publish. No FK: the two tables
  -- reference each other, and publishing checks the version belongs here.
  current_version_id text,
  -- Who created the course: set by the first build's insert and never
  -- updated, so two first uploads of one slug can't both claim it.
  owner_id text references users (id) on delete set null,
  created_at integer not null,
  updated_at integer not null
);

create index courses_live_sort on courses (current_version_id, sort, slug);

create table course_versions (
  id text primary key not null,
  course_slug text not null references courses (slug) on delete cascade,
  -- v1, v2, … per course, in build order.
  n integer not null check (n >= 1),
  -- building: row written, R2 upload in progress. ready: in R2, may go live.
  -- failed: the report has errors; nothing in R2.
  status text not null check (status in ('building', 'ready', 'failed')),
  errors integer not null default 0 check (errors >= 0),
  warnings integer not null default 0 check (warnings >= 0),
  -- The validation report: JSON array of {level, text, file?, line?}.
  report text not null default '[]' check (json_valid(report) and json_type(report) = 'array'),
  -- Files in the upload.
  files integer not null default 0 check (files >= 0),
  -- Where it came from: "cli", "folder upload", later "push <sha>".
  source text not null,
  created_by text references users (id) on delete set null,
  created_at integer not null,
  -- First time it went live; null for drafts.
  published_at integer
);

create unique index course_versions_course_n on course_versions (course_slug, n);

-- Who may build, publish and roll back a course (admins always may).
create table course_authors (
  course_slug text not null references courses (slug) on delete cascade,
  user_id text not null references users (id) on delete cascade,
  created_at integer not null,
  primary key (course_slug, user_id)
);

create index course_authors_user on course_authors (user_id);
