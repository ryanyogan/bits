# 076. Build-along snippets: `tag=` on `:::code`, the snippet check, and the format limits

Status: Accepted (2026-11-03)

Plans: `docs/plans/build-along.md` (§4 format, §5 "Snippets match the repo" and "Format check", lane X
of §7) and `docs/plans/must-improve.md` ("Overlap with build-along lane X": X keeps only these three).

## Context

The build-along courses (decision 071) show code from the Klippy reference repo, one tag per lesson. A
snippet that drifts from the repo fails silently: the learner types it, and it doesn't match what the tag
they check out holds. The format rule (§4) also caps how much code a step shows, so a lesson is never one
large copy-all block. Reviewers check §4 line by line, but the parts a machine can count belong in the
build.

## Decision

A course with `repo:` (decision 073) is a build-along course. Nothing new is stored in D1.

1. **`tag=` on `:::code`.** `:::code{file="apps/agent/src/notes.ts" lang="ts" tag="b-05"}`. `file=`
   already names the file in the editor's tab, so in a tagged snippet it is the path in the repo; a
   second `path=` attribute would only be one more thing to keep in step. `tag=` must be a plain git tag
   name (the rule lesson `tag:` uses) and needs the course's `repo:`, else it's an error. The tag is kept
   on the file (`CodeBlockFile.tag`), and the editor's status bar shows "at b-05". ``` samples take no
   tag: the plan names only `:::code`, and samples are for commands and short asides.
2. **The snippet check.** `pnpm content snippets <dir…> --repo <checkout>` (or `KLIPPY_DIR`) builds each
   folder, takes the tagged snippets from the build (`CourseBuild.snippets`, lesson file and line
   included) and compares each with `git show refs/tags/<tag>:<file>` in a local checkout. The build stays
   pure and never runs git; the check lives in `scripts/lib/snippets.ts`.
   - Match rule: the snippet's lines must appear in the file consecutively and in order, compared with
     trailing whitespace trimmed and indentation kept. A line that is only `...` or `…` (bare or as a
     `//`, `#`, `/* */` or `<!-- -->` comment) stands for skipped code and splits the snippet into runs
     that must appear in order. Without one, a skipped line is a mismatch, so a snippet can't quietly
     drop code.
   - A problem prints as `lesson.md:line: error: this line isn't in <file> at <tag>: “…”`, pointing at
     the first line that couldn't be placed, or at the snippet when the file or tag is missing. The exit
     code is 1.
   - CI runs it in the `check` job once the repo variable `KLIPPY_REF` names a pinned Klippy commit (the
     plan's "against a pinned commit"). Until the repo exists the step is skipped.
3. **Format limits**, as build errors in build-along courses only (`TUTORIAL_LIMITS` in
   `compile/lesson.ts`):
   - `minutes` ≤ 30 (§4's hard cap). The "over 15" warning concept lessons get doesn't apply.
   - A `:::code` shows at most 30 lines and highlights at most 15 (`highlight=`, the new or changed
     lines). A whole file without `highlight=` is allowed up to 30 lines, as §4 allows.
   - A ``` sample is at most 30 lines (elsewhere the old 40-line warning stands).
   - `stylesheet` on a `:::code` lifts its code limits, for course D's one full stylesheet (the owner's
     exception). Outside a build-along course it's a warning. Holding it to one per course is the
     reviewer's job.

## Consequences

- Writers put the repo path in `file=` and the tag in `tag=` on every snippet taken from Klippy, and run
  `pnpm content snippets` against their checkout before handing a course over.
- Concept courses are untouched: no limits, and `tag=` is an error there.
- Steps per lesson (3–8), "every line explained" and "every step ends with something you can run" stay
  with the reviewer; the build can't count them honestly.
- Rejected: running git inside the build (it runs in the Worker and tests, and must stay pure); fetching
  from GitHub instead of a local checkout (network in CI and rate limits for no gain); a `path=`
  attribute separate from `file=`; checking ``` samples (no tag to check against).
