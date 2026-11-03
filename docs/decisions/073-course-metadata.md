# 073. Course and lesson metadata: freshness, desk, coming soon, order, start from tag

Status: Accepted (2026-11-03)

Plans: `docs/plans/must-improve.md` (rows 2 and 5, lane B) and `docs/plans/build-along.md`
(§3–§5; the engine row X of §7 is split, and this lane takes its catalog parts).

## Context

The build-along courses (decision 071) teach code that runs against fast-moving packages. Cloudflare
reshaped its Agents docs on 2026-10-29, and a tutorial that names no versions breaks quietly. The
competitor research also asked for an MCP course now, before its lessons exist, and for a way to tell a
phone learner that a lesson needs a computer. The catalog needed the build-along sequence in order, and
every build lesson needed a way back onto the reference repo for a learner who fell behind.

## Decision

All of it is frontmatter, checked by the build and shown by the pages. Nothing new is stored in D1.

1. **Freshness.** A lesson takes `verified: YYYY-MM-DD` (the day its code was last run) and `versions:`, a
   map from npm package to an exact version (`agents: "0.33.1"`; no ranges, quoted so YAML keeps it a
   string). The lesson page shows a quiet mono line at the top of the lesson: "Verified 3 Nov 2026 ·
   agents 0.33.1 · wrangler 4.45.2". It shows the exact versions rather than `0.33.x`, so a learner can
   install what we ran. The course page's Source panel shows the newest lesson date ("Code verified …").
   - A lesson **with code** (a `:::code`, a `:::terminal` or a ``` sample) and no `verified:`, or one
     older than N days, gets a build **warning**. Warnings never block publishing. A `verified:` after
     today is an error.
   - The build stays pure: callers pass `freshness: { today, maxAgeDays, strict }` in `BuildOptions`
     (`todayIso()` gives today). N defaults to 120 (`DEFAULT_MAX_AGE_DAYS`). A build without the option
     doesn't check freshness, which keeps fixture tests stable. The CLI, both upload paths and the test
     platform always pass it.
   - `pnpm content validate --max-age <days>` sets `strict`, so the same problems become errors and the
     exit code is 1.
   - `.github/workflows/freshness.yml` runs `validate --all --max-age 120` weekly (Mondays 06:17 UTC) and
     on demand. It needs no secrets. A commented `klippy-latest` job will dispatch and watch the Klippy
     repo's `latest.yml` once that repo is public.
   - Today 41 code lessons have no date. The weekly job stays red until the content lanes add them,
     which is the point.
2. **Phone or desk.** `device: desk` (the default is `any`) marks build steps that need a computer. The
   course page's syllabus row and the lesson bar show a small "Desk" tag (`DeskTag`, `Tag variant="desk"`).
   Screen readers hear "Desk: best at a computer, with a terminal" (visible text first, then `sr-only`
   text, never an `aria-label` on a span). In the shell the bar shows it from 1024px, and `LessonRow`
   shows it below that, since the phone bar has no room.
3. **Coming soon.** Course `access: soon`, next to `free | pro`.
   - The catalog card shows "Coming soon" and no progress. It still opens the course page. It never links
     a lesson.
   - The course page shows the outline with no lesson links, no Start key and no "How you'll learn"
     panel when there are no lessons. A soon course may be its `course.md` alone. The syllabus then says
     "Lessons are on the way".
   - Lesson URLs answer 404 with `StatusPage`, linking back to the course page. The gate is the
     `Catalog`: `getLesson` and `lessonContent` return undefined for a soon course, so the lesson page,
     the save, `/api/run`, `/api/coach`, `/api/ask` and drafts all refuse it, with no per-route checks.
     The author's draft preview opens soon lessons (`loadVersionCatalog` builds its catalog with
     `openSoon`).
   - It's left out of the sitemap, the course badges (`Catalog.openCourses`), certificates, the "next
     course" offer, `getContinue` and the catalog's total time. A badge for a soon course with no lessons
     would otherwise be earned by everyone, since "every lesson done" holds over zero lessons.
4. **Catalog order.** `order:` already existed (D1 `courses.sort`, written on a trusted upload), so no new
   field was needed. It's now a whole number, spaced by tens so new courses slot in without renumbering:
   the concept courses take 10–40, then the build-along sequence your-first-worker 50 →
   give-your-model-tools 60 → first-agent-loop 70 → build-the-front-end-with-agents 80 →
   retrieval-without-tears 90 → ship-an-agent-to-the-edge 100 → mcp 110. `order` is now also in the
   manifest, so a changed order changes the build hash. Without that, the unchanged-build skip
   (decision 036) would never write the new sort to production. `pnpm content validate` warns when two
   folders share an order.
5. **Start from tag.** Course `repo:` must be an https GitHub repository URL (`https://github.com/owner/repo`,
   with no path, query, port, credentials or `.git`). Lesson `tag:` must be a plain git tag name, and a tag
   without the course's `repo:` is an error. The build writes `content.start`: the `<repo>/tree/<tag>` link
   and a highlighted `git clone … / cd … / git checkout <tag>` sample. The lesson page shows "Start from
   `a-03` ↗" (external: `data-rmx-document`, no prefetch, `rel="noopener"`) above that copyable sample.

The code is in `compile/frontmatter.ts` (schemas), `compile/lesson-meta.ts` (applies the metadata and checks
freshness; `compile/lesson.ts` is untouched) and `compile/course.ts` (soon, repo, order, manifest). The
pages use `lesson/ui/lesson-meta.tsx`, `@bits/ui/desk-tag` and the `soon`/`desk` tag variants.

## Consequences

- Writers date every code lesson and pin its packages. Reviewers check that `verified:` is the day the
  code really ran, never just today.
- The MCP course can be listed now with a `course.md` (and stub lessons if we want its outline shown).
  It opens by changing `access:`.
- Tests publish two fixtures, `content/fixtures/soon-course/` and `content/fixtures/build-along/`
  (`app/test/metadata-courses.ts`), next to `plain-course`.
- Rejected: storing freshness in D1 (it belongs to the source, reviewed in the same pull request); a
  separate `status:` field for soon (it's about who can take the course, so it sits with `access`);
  hiding soon courses from the catalog (the point is to show what's coming).
