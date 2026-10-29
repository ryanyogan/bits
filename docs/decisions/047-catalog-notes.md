# 047 notes: catalog and course overview

Status: Accepted (2026-10-29). Phase 2 of decision 047, for `/courses`
and `/courses/:course`.

## Decisions

- **Lesson nodes are squares.** A node is a lesson's checkbox, not a dot,
  so it takes the grid's shape, like the landing's square track numerals.
  Done is a volt frame and tick on a faint volt tint (no large volt fill),
  current is an ion frame with a small square, and next is a dashed frame.
  This applies everywhere `LessonNode` is used, including the lesson
  outline. `--radius-round` stays for live dots, avatars and the progress
  ring. The ring's arc now has flat caps.
- **No `<Frame>` for the catalog results.** The search and the track pills
  are URL state, and one response changes the pill counts, the result
  label and the cells together. A frame would need its own route, would let
  the counts and the cells disagree for a moment, and would add a session
  read and a D1 round trip. The Remix guide says to start with plain
  composition and use a frame only for route-owned regions. Typing still
  re-renders the page in place (`LiveSearch`, `history: 'replace'`, focus
  kept by `data-rmx-reset-focus="manual"`), so the grid stays put.
- **Grid variants instead of new components.** `FilterPill variant="cell"`,
  `SearchField variant="cell"`, `CourseCard` / `WriteCourseCard`
  `variant="cell"` (built on `cellLinkStyle`), `ContinueBanner edge="flush"`
  and `EmptyState variant="bare"`. The defaults keep their boxed look for
  pages that are not on the grid yet.
- **Pages clip their own sideways overflow.** A `RuledSection` rule is
  `100vw` wide, and `100vw` counts a classic scrollbar. `body`'s
  `overflow-x: clip` propagates to the viewport, where it no longer stops a
  scroll, so a page with a scrollbar could scroll 7.5px sideways. The
  landing clips in its root, and these pages now do the same on a wrapper.
  A global fix belongs in `Layout` or `base.css` (see the follow-ups).
- **Course page headings stay real `<h2>`s.** `RuledSection`'s `label`
  renders in a `<p>`, so the course page draws its strip headings with
  `stripHeading` (`course/ui/strip.ts`), which looks the same.

## Follow-ups (done in phase 3, see 047 "Status")

- `RuledSection` takes `labelAs="h2"` with a `labelId`. The course page's
  `stripHeading` is gone: its strips are now `RuledSection` labels and
  `Panel`s.
- Every `Layout` `<main>` clips `overflow-x`.
- The `--radius-round` comment in `tokens.css` now says lesson nodes are
  squares.
