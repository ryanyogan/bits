# 022. App shell: one sticky header, a lesson sub-bar, a sticky outline

Status: Accepted (2026-10-26). Amends 014 (lesson pages drop their own bar) and
resolutions §5 ("the lesson pages use their own compact lesson header").

## Context

App pages had the sticky AppBar. Lesson pages swapped it for `LessonBar`, so
the brand, the nav and the account controls disappeared inside a course, and
the header looked different there from everywhere else. The lesson outline
was a normal flex column, so it scrolled away with the lesson, and a long
outline couldn't be reached without scrolling the whole page back up.

## Decision

- **One header on every app page.** `Layout` (`app/ui/layout.tsx`) renders the
  skip link and the same sticky glass `AppBar` everywhere: brand, Courses /
  My learning / Write a course, then XP, streak and avatar (signed in) or
  Sign in + Start free (signed out). The nav links no longer depend on
  whether a page passed `viewer`; only the actions do. Lesson pages now
  render through `Layout` too (`bare`: they bring their own `<main>`).
- **The lesson context is the header's second row.** `AppBar` takes a `sub`
  slot rendered inside the same `<header>` (one banner landmark, one sticky
  element). Lesson pages pass `<LessonBar position="shell">`: back, "Course ·
  Lesson n of N", the title as the page's `<h1>`, segmented progress and the
  Read / Watch / Terminal tabs, in the AppBar's 1280px column. The neurons
  live in the AppBar's XP slot: `Layout`'s `xp` prop takes the `LessonXp`
  reward island, still wrapped in `data-rmx-key={view.key}` so each lesson
  starts fresh (020).
- **Under 760px** the sub-bar keeps back + title only (56px), so the sticky
  stack is 120px on a phone instead of ~185px. `LessonModes` (tabs +
  progress) sits at the top of the lesson and scrolls with it; it is hidden
  at 760px and up. The menu sheet still drops from under the AppBar row and
  covers the sub-bar.
- **Fixed heights, from tokens.** `--appbar-h` (72px, 64px <760px),
  `--lessonbar-h` (64px, 56px <760px) and `--shell-h` (the whole sticky
  stack). The bars set their row heights from these tokens (including their
  1px borders) and don't wrap, so every offset agrees. A header with a
  sub-bar is `data-shell="sub"`, and `:root:has(header[data-shell="sub"])`
  sets `--shell-h` to the sum. `Layout` ships that rule and
  `html { scroll-padding-top: calc(var(--shell-h) + var(--space-2)) }` in a
  small `@layer app` style, so anchors and focused elements land clear of the
  header.
- **The outline stays put.** `OutlineNav` is `position: sticky` at
  `top: var(--shell-h)`, `height: calc(100dvh - var(--shell-h))`, with
  `overflow-y: auto` and `overscroll-behavior: contain`: a long outline
  scrolls inside itself, and the page scrolls under it. The outline and the
  lesson share the AppBar's `--page-max` column. Terminal mode keeps its
  full-width workspace (no outline). Under 760px the outline stays the
  closed `<details>` disclosure.
- **Current lesson in view: a tiny island.** CSS can't set a scroll
  container's starting position (`scroll-snap` would fight the user), so
  `OutlineScroll` (`lesson/public/outline-scroll.tsx`) centres the open
  lesson in the outline when it is out of view, scrolling the outline only,
  never the page. It is keyed per lesson, so it re-runs after client
  navigation. Without JS the outline starts at the top.
- **Exceptions, by design:** the landing page keeps its transparent marketing
  bar over the 3D field, and sign-in keeps the Auth artboard's split frame.

## Consequences

- Pages should pass `viewer` to `Layout`; without it the bar shows the
  signed-out actions. The styleguide, placeholder pages and the lesson
  not-found page don't pass it yet.
- Anything that adds a row to the sticky header must give it a fixed height
  and fold it into `--shell-h`.
- The progress "passed" marker now targets `[data-lesson-progress]`, which
  both the sub-bar and `LessonModes` wrap their progress in.
- `base.css` still sets `scroll-padding-top: 72px`; `Layout`'s rule wins in
  the `app` layer. It can move to `var(--shell-h)` there.
