# 055. One lesson view: Read, with the video at the top

Status: Accepted (2026-10-29). Amends 029 (video), 022 and 051 (lesson
chrome) and 053 (where the depth control sits). Retires the Watch and
Terminal modes.

## Context

A lesson had three views behind a Read / Watch / Terminal picker. The
owner's call (2026-10-29): "In the lessons, remove the terminal view picker
and those views, we do not need them, the default read view is great,
videos we should just show at top." Read is the lesson. Watch repeated it
as a player and a side card, and Terminal re-told the same blocks as a CLI
session, at the cost of a second layout for every block, a mode param on
every link, form and redirect, and a picker in the chrome.

## Decision

- **One view.** `/courses/:course/:lesson` renders the lesson as Read
  always did. There is no `LessonMode`, no `?mode=` and no mode picker. An
  old `?mode=…` link still answers 200 with the lesson (the param is
  ignored, no redirect), the depth tabs drop it from their links, and the
  save, the ask redirect and the course page no longer carry it.
- **Video is a block at the top.** A lesson with a linked video (029)
  opens with the `VideoPlayer` above its first block, at the read
  column's width, with the transcript under the player as one ruled box.
  Chapters, captions, the transcript and the resume position (the `video`
  draft key) work as before. "Watch the intro" on the course page links
  to the lesson itself.
- **The depth tabs take the picker's place** (053): a cell in the lesson
  sub-bar from 760px, and the first cell of the page's one chrome row
  under 760px (`LessonRow`, with the "Lesson n of N" outline disclosure at
  its end; 051). They render only when the lesson has depth blocks. The
  "Explain it" rows in the outline sidebar and the phone disclosure are
  gone: there is one control. On phones the sticky bar keeps back and the
  two-line title, with the 3px progress strip; the depth tabs go in the
  chrome row, not the sticky bar, so the title keeps its width.
- **`:::terminal` stays.** The block is a lesson toy (a scripted run in the
  `OutputPanel`), rendered inline as before. `TerminalLog` stays in
  `@bits/ui` and the styleguide; no lesson page uses it today.

## Consequences

- The Worker's lesson chunk loses the Terminal and Watch layouts.
- The landing copy and the `/author` block reference stop promising a
  terminal mode or a Watch tab.
- The lesson frontmatter's `replies` (canned Terminal-mode replies) is
  still accepted by the build but no longer shown; dropping it is a
  content-schema change for later. `--watch-width` has no user left.
