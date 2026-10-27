# 036. CI publishes content/courses/ to production, unchanged courses skipped

Status: Accepted (2026-10-27). Follows 018 (content pipeline), 029 (video
links) and 032 (CI deploys).

## Context

Courses reached production only when someone ran `pnpm content upload <dir>
--publish --remote` by hand. A merged lesson fix could sit on master,
unpublished, for days. Decision 032 already publishes `content/courses/` to
the shared preview database on every pull request
(`pnpm content upload --all --publish --preview`).

Doing the same for production on every master push has one problem: the
CLI saved a new version for every folder, every time. Eight courses times
every push would bury the real versions on `/author` under identical
copies, and each copy is a full set of JSON objects in R2.

## Decision

**The `deploy` job publishes the courses.** After the migrations and the
Worker deploy, `pnpm content upload --all --publish --remote` builds every
folder against production's D1 and R2 (wrangler remote bindings, the token
the job already has). It runs after the deploy so the code that serves the
new content is live first. The smoke test runs whenever the deploy step
succeeded, even if publishing failed: the site must answer either way.

**An unchanged course gets no version.** A clean build is hashed: SHA-256
over its output, the manifest and every lesson's JSON (lessons sorted by
key). `saveBuild` stores the hash as custom metadata (`build-sha256`) on
the version's `manifest.json` in R2, for every save, the author page's
folder uploads included. Before saving, the CLI compares the fresh build's
hash with the course's newest version:

- newest is `ready`, same hash, live: **unchanged**, nothing written.
- same hash, never published: no new version; with `--publish` it is
  published (someone uploaded it without publishing).
- same hash, published once but not live now: someone rolled back from it
  on `/author`. **Left alone**: the rollback stands until the course's
  build changes.
- anything else (different hash, no hash, newest `failed` or `building`,
  `--force`): a new version, published with `--publish`.

Hashing the output rather than the source files means:

- A video becoming ready changes the build (the lesson gains
  `video.src` with the upload's id), so the course is relinked on the next
  push, as decision 029 requires ("rebuild the course to link it").
- A compiler change that alters the output republishes the affected
  courses; one that doesn't, doesn't.
- Warnings alone don't make a version.

Video links come from production's `videos` table through the same
`loadVideoLinks(db)` the author page's upload uses, so CI and `/author`
link the same uploads. The CLI reads the video links and every course's
newest version once per run, in parallel (2 queries), then one R2 `head`
per course. A changed course costs what an upload always did.

No migration: the hash lives with the immutable manifest it describes. The
first CI run after this lands sees no hash on any existing version and
saves each course once more; from then on only changes do.

**Errors fail the job, after every course is handled.** A course with
build errors is recorded as a `failed` version (report only, as before, so
`/author` shows the errors) and the loop moves on; the CLI exits 1 at the
end. One broken course doesn't hold back fixes to the others. On GitHub
Actions, errors and warnings also print as `::error file=…,line=…::`
annotations. In practice the `check` job catches errors first: the test
platform publishes every folder in `content/courses/` and fails on a
broken one. A failed build is recorded on every run (not deduplicated);
that only happens if a broken course gets past `check`.

**CI publishes as no user.** The CLI is trusted (it holds the database),
and without `--as` its `userId` is null: `recordCourseBuild` creates a new
course with `owner_id` null and adds no author; on an existing course it
leaves `owner_id` and `course_authors` as they are. `created_by` is null
and the version's `source` reads `ci <sha> (remote)` (12 characters of
`GITHUB_SHA`), so `/author` shows which commit made it. No ownership check
is added around the claim; it stays atomic in `recordCourseBuild`.

The repo is the source for `content/courses/`: a folder uploaded on
`/author` under the same slug is superseded by the next push that changes
that course in the repo.

`--force` saves a new version even when nothing changed.

## Consequences

- Merging a lesson change to master publishes it within one deploy; the
  manual `--remote` upload is now a fallback.
- `/author` keeps one version per real change, each pointing at its
  commit.
- A rollback on `/author` survives deploys until the course changes in
  the repo.
- Deleting a folder from `content/courses/` doesn't unpublish the course;
  that stays a manual step.
- The production token needs D1 Edit and Workers R2 Storage Edit, which
  decision 032's token already has.
