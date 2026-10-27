-- Migration number: 0006 	 Lesson drafts and the watch position; lesson videos in R2 (decision 029)
--
-- lesson_drafts: one row per draft a signed-in learner keeps in a lesson:
-- `prompt:<exercise>` (the composer and Terminal prompt share it),
-- `code:<file>` (what was retyped in type mode) and `video` (the watch
-- position in seconds). Keyed by course and lesson slug, like
-- lesson_progress, so a republished course keeps them. Signed-out drafts stay
-- in localStorage; the browser uploads the newer copy after sign-in.

create table lesson_drafts (
  user_id text not null references users (id) on delete cascade,
  course_id text not null,
  lesson_slug text not null,
  key text not null check (length(key) between 1 and 120),
  value text not null check (length(value) <= 4000),
  updated_at integer not null,
  primary key (user_id, course_id, lesson_slug, key)
);

-- videos: an MP4 an author uploaded for `video: <path>` in a lesson. The
-- bytes go to R2 (CONTENT, under videos/<id>.mp4) as a multipart upload
-- through the Worker; the row tracks it until the Worker completes it and
-- marks it ready. The next course build links lessons to the newest ready
-- video for their path. A key is never reused, so the file is immutable.

create table videos (
  id text primary key not null,
  course_id text not null,
  -- The lesson's `video:` path, e.g. assets/06-temperature.mp4.
  path text not null check (length(path) <= 200),
  status text not null check (status in ('uploading', 'ready', 'failed')),
  r2_key text not null unique,
  -- R2 multipart upload id while uploading; null once complete.
  upload_id text,
  size integer not null check (size > 0),
  part_size integer not null check (part_size > 0),
  -- Uploaded parts, [{"partNumber": n, "etag": "…"}], so a broken upload resumes.
  parts text not null default '[]' check (json_valid(parts) and json_type(parts) = 'array'),
  -- Seconds, read by the author's browser from the file.
  duration_s integer check (duration_s > 0),
  uploaded_by text references users (id) on delete set null,
  created_at integer not null,
  updated_at integer not null
);

-- The build's lookup (ready videos of a course) and the upload's resume lookup.
create index videos_course_path on videos (course_id, path, status, updated_at desc);
