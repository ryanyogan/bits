# 016. Progress: D1 ledger, one "complete lesson" form, session-held anonymous progress

Status: Accepted (2026-10-26)

## Context

Milestone 3 is done when:
- a lesson finished while signed out is still there after sign-in;
- a forged `exercise_passed` earns no XP.

The handoff sketched these:
- a `POST /api/progress` JSON endpoint taking batched client events;
- a `localStorage` queue that the browser replays at sign-in.

The user asked for the Remix way, with no APIs unless they are clearly
needed, and for Cloudflare storage (D1 or Workflows) chosen with the
Cloudflare skills.

## Decision

- **D1, not Workflows or Durable Objects.** Saving a lesson is one small,
  synchronous, idempotent write. Workflows are for durable multi-step jobs
  that retry and resume; course builds in a later milestone are the right
  fit for them. No per-user coordination is needed either: UNIQUE
  constraints make writes safe to repeat, so a Durable Object adds nothing.
  Migration 0003 adds:
  - `lesson_progress`, keyed by `(user_id, course_id, lesson_slug)` with
    the course slug as `course_id`;
  - `exercise_attempts` (the prompt journal);
  - `xp_events`, a ledger with `UNIQUE(user_id, kind, ref)`;
  - `activity_days` (the heatmap);
  - `user_badges`;
  - three columns on `users`: `streak_days`, `streak_last_day` and
    `best_streak`.
- **One write per completed lesson, as one `db.batch`.** The batch writes:
  - the progress row;
  - the journal attempts;
  - `insert or ignore` awards;
  - the day's activity;
  - `xp_total`, recomputed from the ledger;
  - the streak, using a CASE: same day keeps it, the next day extends it,
    a gap restarts it.

  Replays and merges never double-count. The streak lives on the user row,
  so every page can show it without another query. Badges are code
  (`app/progress/badges.ts`), and a badge is awarded the first time its rule
  holds after a save. Levels are code too (`levels.ts`).
- **No progress API. Saving is the lesson's native form.**
  - `POST /courses/:course/:lesson/complete` is a `<form method="post">`
    rendered by the `LessonComplete` island.
  - The PromptComposer and the Terminal prompt add hidden fields to that
    form with the `form=` attribute: `prompt.<id>` and `ran.<id>` (× 100).
    Quiz answers already live in the URL; they ride along as `quiz.<id>`.
  - The server reads only the fields the lesson defines. It re-runs every
    check (the same `checkPasses` the browser runs) and grades quizzes
    itself, then awards XP. XP values in the form are never read.
  - Success returns 303 to the next lesson; the mode is kept. Failure
    returns 422 with the page again and the failed checks.
  - XP split: each exercise and each correct quiz earns its own xp, and
    completion earns the rest of the lesson's `xp`.
- **Signed out: progress lives in the session, not localStorage.** The
  session is already a D1 row (decision 015). Completing a lesson stores the
  submission under `progress`, capped at 60 lessons. That makes anonymous
  progress server-rendered too: the Continue banner, course rings and
  syllabus states all work signed out. At sign-in, `startUserSession`
  (email and OAuth alike) calls `mergeAnonymousProgress`. It re-checks each
  lesson against current content, records it on the day it was done, then
  removes the key. `completeAuth` keeps session data across the id
  rotation.
- **Fixtures carry content only.** `CourseInfo` and `LessonInfo` have no
  progress. `getCourse`, `listCourses`, `getLesson` and `getContinue`
  take the viewer's `Completed` map, from `loadCompleted(context)`. Lesson
  states are:
  - done: completed;
  - current: the first unfinished lesson of a started course;
  - next: everything else.

  pct is floored. Continue resumes at the current lesson of the most
  recently active course.
- `/me` and `/u/:handle` read D1. The landing page's "See a profile →"
  becomes "See your profile →" (`/me`), since the sample profile is gone.
  The settings export includes lessons, badges and every prompt.

## Consequences

- The `run` requirement ("ran at 0 and 1.0") is still the browser's claim,
  checked only against the offered temperatures. Once `/api/run`
  (milestone 4, a streaming endpoint that is a warranted API) logs real runs
  per exercise, the server should count those instead.
- Not stored yet: `lesson_started`, `mode_changed`, `draft_saved` and the
  watch position. Drafts and the resume position stay in localStorage.
- No toast yet for a badge earned on save. It shows on `/me`.
- Composer fix found in browser testing: picking a temperature mid-run no
  longer leaves the run stuck on "Running…", and a run credits the
  temperature it started with.
