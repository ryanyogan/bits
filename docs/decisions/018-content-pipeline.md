# 018. Content pipeline: markdown folders, versions in R2, a live pointer in D1

Status: Accepted (2026-10-26)

## Context

Milestone 2 replaces the hard-coded fixtures (`app/data/fixtures.ts`,
`lesson/fixtures.ts`) with real content. The handoff sketches it this way:
- authors write markdown course folders;
- a build validates them and reports errors with file and line;
- each upload becomes a version;
- publish and rollback flip which version is live;
- the course pages read whatever is live.

Constraints:
- the `LessonContent` shape and `exercisesOf()` stay as they are, because
  the lesson UI, checks and `/api/run` already depend on them;
- tests and `pnpm dev` must not need remote resources;
- a fresh clone must still show courses.

## Decision

- **Source is markdown in `content/courses/<slug>/`.**
  - `course.md` has frontmatter only: title, track, level, summary,
    outcomes, cover, badge, authors, intro and exercise.
  - Each `NN-*.md` file is one lesson, with frontmatter for title, order,
    minutes, xp, module, video and chapters.
  - Lesson bodies are plain paragraphs, which become tutor turns. `---`
    splits turns.
  - Remark directives add the interactive blocks: `::ask[…]`,
    `:::prompt`, `:::code`, `:::terminal`, `:::quiz`, `:::odds` and
    `:::tokenizer`. Inside `:::prompt`, `:::quiz`, `:::odds` and
    `:::terminal`, the body is read as plain lines (`- check "label" /re/i`,
    `- [x] answer`), not as markdown.
  - Adjacent `:::code` blocks form one tabbed editor. A `:::terminal` right
    after them is its Run output.
  - Captions are `assets/<lesson>.vtt`.
  - The source line numbers come straight from the file, so errors point
    at the right line.
- **The build is pure** (`app/content/compile/`, unified + remark + yaml).
  - It takes `{path, text?, size}[]` and returns:
    - a report (error, warning or ok, with file and line);
    - a manifest (the course and its modules);
    - the compiled `LessonContent` for each lesson.
  - The same code runs in the CLI, in tests and in the Worker (the folder
    upload).
  - Prompt checks run on the server against learner input, so check
    regexes must fit a small **allowlist grammar** that can't backtrack
    badly by construction (`compile/regex.ts`; revised in 020 after a
    security review found bypasses of the earlier denylist analyzer):
    - allowed: literal characters and `.`; the escapes `\b \B \w \W \d
      \D \s \S` and escaped symbols (`\.`, `\(`, …); character classes
      `[...]` with literals, those escapes and simple ranges (`a-z`), not
      empty and not nested; `|`; plain `(...)` and non-capturing `(?:...)`
      groups; `^` and `$`; and the quantifier `?`, at most 4 per pattern;
    - rejected: all repetition (`*`, `+`, any `{`), lookarounds, named
      groups, backreferences, other escapes, a `]` or `}` outside a class,
      and anything else the tokenizer doesn't recognise;
    - with no repetition, the work per start position is bounded by the
      number of paths through the pattern (each `|` adds one, each `?`
      doubles its atom). That is capped at 64, so `(?:a|a)(?:a|a)…` can't
      sneak an exponential back in;
    - kept: flags `imsu` only, 200 characters at most, and the pattern
      must compile.

    The tokenizer walks the source once and rejects by default. Errors are
    ordinary build errors with file and line, and say what to write
    instead ("repetition (*, + or {n}) isn't allowed in checks; list the
    alternatives instead"). `progress/check.ts` re-validates every stored
    pattern before running it and fails the check if it is outside the
    grammar, as defence in depth for content already in R2. Learner input
    is capped at 4,000 characters as well.
  - XP is capped (`app/content/limits.ts`): at most 100 per `:::prompt` or
    `:::quiz` block and 500 per lesson, as whole numbers. The build reports
    values outside that range. `progress/check.ts` clamps the awards again,
    so stored content can never award more than a lesson's capped xp.
- **Versions are immutable.**
  - D1 (migration 0004) has three tables:
    - `courses`: the slug, the catalog fields and `current_version_id`, the
      live pointer;
    - `course_versions`: n, status `building | ready | failed`, the report
      and counts, the source and the uploader;
    - `course_authors`: who may publish.
  - JSON goes to R2 (`CONTENT`, bucket `bits-content`) under
    `courses/{slug}/v{n}/`: `manifest.json` and `lessons/{lesson}.json`.
  - Saving a build works like this:
    1. Record the version in one batch, assigning n in SQL.
    2. Put the lessons, then the manifest.
    3. Mark the version ready.

    If an R2 write fails, the version row is deleted.
  - A build with errors is still recorded as a `failed` version that has a
    report and no JSON. The author page then shows the same errors as the
    CLI, and failed versions can't be published.
- **Publish and rollback are one UPDATE** of `courses.current_version_id`,
  allowed only to a `ready` version of that course. The author page posts
  `version=n` to `/author/:course/publish` or `rollback`. Admins manage
  every course; authors manage only courses they are listed on in
  `course_authors`. The first upload of a new slug makes the uploader its
  owner (`courses.owner_id`, set only by the insert that creates the row)
  and author. An upload that targets someone else's slug gets a 403.
  The claim is atomic: `recordCourseBuild` writes the course, the author
  and the version in one D1 batch, and every statement is conditioned on
  the uploader being trusted (an admin or the CLI), the owner or a listed
  author. When two first uploads race, the loser writes nothing and gets
  a 403. The check before saving only keeps a multi-course upload from
  half-saving.
- **Reading is one D1 query plus a per-isolate memo.**
  - `getCatalog(context)` reads the live pointers once per request.
  - Manifests and lesson JSON are memoised by `versionId:key`, LRU-bounded
    at 500 entries. Because versions never change, the memo never needs
    invalidating: publishing just changes which id gets read. So R2 is
    read only the first time an isolate sees a version.
  - Only resolved values are memoised, never promises shared between
    requests.
  - `Catalog` (`app/content/catalog.ts`) provides the old fixture API
    (`getCourse`, `listCourses`, `getLesson`, `getContinue`) plus an async
    `lessonContent()`.
- **Two ways in.**
  - `pnpm content validate|upload <dir…> [--all] [--publish] [--as email]
    [--remote]`. Problems print as `path:line: level: text`, and the exit
    code is 1 when a folder has errors.
  - The `/author` folder drop: `POST /api/author/upload`, a multipart
    upload of the text files plus the asset names.
- **Locally the courses are seeded, not hard-coded.**
  - `pnpm db:seed:local` uploads and publishes `content/courses/*` into
    Miniflare's local D1 and R2, the same state `pnpm dev` and
    `pnpm preview` use.
  - The test platform does the same into in-memory bindings at startup,
    so tests use the real pipeline.

## Consequences

- Course text changes are content uploads, not code deploys. A deploy no
  longer changes what learners see.
- A fresh database shows no courses until something is uploaded. Locally
  that's `pnpm db:seed:local`. Remotely, a `pnpm content upload --all
  --publish --remote` (or an admin folder drop) is needed once after the
  R2 bucket exists.
- Every upload creates a version, even an unchanged one. Running the seed
  twice gives v2. That's harmless, and deduplicating by hash can come
  later.
- Progress rows key on the course and lesson slugs, so a version that
  renames a lesson orphans its progress. Authors should keep slugs stable
  (the filename sets it unless `slug:` is given).
- Deferred to later milestones:
  - zip unpacking (zips get a 422 for now);
  - GitHub repo sync;
  - real video upload and Stream. Videos found in the folder show as
    "ready", otherwise "missing";
  - the source preview pane;
  - Queue or Workflow builds. Builds are synchronous and capped at 10
    courses per upload and 8 MB per request;
  - lesson rows in D1 for querying.
