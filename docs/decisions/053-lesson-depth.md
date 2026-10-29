# 053. Two reading depths in one lesson: `:::new` and `:::engineer`

Status: Accepted (2026-10-29). Amends 018 (content), 021 (lesson toys),
022 and 051 (lesson chrome).

## Context

The product brief asks for two explanations of each idea: "Explain it like
I'm brand new" and "I'm an engineer, get to the point". The newcomer needs
the analogy; the engineer wants the mechanism and would skim it. Writing two
courses would double the maintenance and split progress, so both
explanations live in one lesson file. The learner picks a depth once, and
every lesson follows it.

## Decision

**Grammar.** `:::new` … `:::` wraps markdown shown only at the "new" depth,
and `:::engineer` … `:::` only at the "engineer" depth. Everything outside
both is shared. A depth block may hold what the lesson body holds (prose,
`---`, `::ask[…]` lines, `:::code`, `:::terminal`, `:::odds`,
`:::tokenizer` and the display toys `:::nexttoken`, `:::training`,
`:::attention`, `:::compare`). Lists, headings and bare code fences are
still errors everywhere in a lesson (018); a depth block doesn't change that.
A depth block that holds another block needs a longer outer fence,
`::::engineer` … `::::`, because remark-directive closes a container at the
first fence as long as its opening one; with equal fences the inner `:::`
closes both, and the build reports that at the depth block's line.

The build reports, at the source line:

- `:::prompt`, `:::ask`, `:::quiz` or `:::rabbithole` inside a depth block
  (an error: see below);
- a depth block inside another (an error);
- an unclosed depth block, or one closed early by an inner block (an
  error);
- an empty depth block, or a lesson with only one depth (a warning: the
  missing depth just shows the shared text).

**Compiled shape.** There is no wrapper node. The depth block's children
compile as top-level blocks, each tagged `depth: 'new' | 'engineer'`
(`Block` in `lesson/content.ts`); untagged blocks are shared. Adjacent
`:::code` blocks join into one editor, and a `:::terminal` becomes its Run
output, only within one depth. `contentAtDepth(content, depth)` filters a
lesson; `depthsOf(blocks)` says which depths it has. Lessons without depth
blocks compile exactly as before. The manifest's `mins` stays the
frontmatter `minutes`, read as the longer depth, and a lesson with depth
blocks also carries `minsByDepth`, the shorter depth scaled by its share of
the words (a toy or exercise counts as 60 words).

**Why graded blocks stay shared.** Progress must not depend on the depth.
`Complete lesson` re-runs the prompts' checks and reads quick-check answers
from the journal (016, 052); draft keys, XP caps and ask ids are per
lesson. If an exercise lived in one depth, switching depth would hide a
gate the save still enforces, or open one it doesn't. Rabbit holes are the
lesson's shared ending. So both depths teach the same idea and are graded
the same way; only the explanation differs.

**Where the preference lives.** The depth comes from, in order: the URL's
`?depth=new|engineer`, the signed-in user's `users.lesson_depth`
(migration 0012, nullable, additive), the session's `depth` key, else
`new` (`lessonDepth()` in `app/progress/depth.ts`). Viewing a lesson with
`?depth=` remembers it, a preference write on GET like a theme toggle: for
a signed-in user one `UPDATE … where lesson_depth is not ?` and only when it
changes; signed out, the session. The data export lists `lessonDepth`, and
`/privacy` names it. A signed-out choice isn't copied to the account at sign
in; the session keeps it until the account has one of its own.

**The control.** "New to this" / "Engineer" are URL tabs
(`SegmentedTabs`, `aria-current` on the active one) that set `?depth=` and
keep the other params (`?mode=`). They render only when the lesson has depth
blocks (`depthTabs(view)`). They keep focus and scroll in place
(`keepPlace`). They **don't prefetch**: the brief asked for prefetch on
intent, but Remix's prefetch is an ordinary GET with the same headers as a
navigation, so hovering "Engineer" would have saved the preference
(decision 042: no side effects on speculative GETs). Placement follows the
room the chrome has:

- 1024px and up: a cell in the lesson sub-bar, before the mode tabs
  (`LessonBar` `depths`).
- 760–1023px: under it the bar has no room left for the title, so the tabs
  head the outline sidebar ("Explain it" row), or, in Terminal mode (no
  sidebar), the workspace.
- Under 760px: the open outline disclosure starts with the same row, so the
  phone chrome stays one row (051). Terminal mode gets the disclosure too
  when the lesson has depths.

Read mode keys a shared block by its place among the shared blocks, so a
depth switch keeps an exercise's island state; Terminal mode rebuilds its
session log per depth.

## Consequences

- Authors: `/author`'s block reference documents the blocks; fixtures are
  `content/fixtures/toys/03-depth.md` and `broken-toys/07-depth.md`, and
  `plain-course` lessons 1 and 2 carry depth blocks for the tests.
- `/settings` has no learning-preferences section today, so it has no depth
  option; the lesson control is the only way to change it.
- On phones the control is one tap away inside "Lesson n of N ▾"; if
  learners don't find it, a first-lesson prompt is the next step.
- The author draft preview reads `?depth=` but doesn't remember it, and its
  mode links drop it.
