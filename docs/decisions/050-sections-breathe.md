# 050. Sections breathe: framed plates with the ground between them

Status: Accepted (2026-10-29). Amends 047 (squared grid) and 048 (landing
premium pass).

## Context

The owner liked the grids on each page and asked for "some spacing between
each section so you can see more of the bg", on the home page, the
catalog, the course page and settings: "let's make the site breathe a bit
more".

Under 047 the ruled column was one unbroken block: `PageFrame` drew two
rails from the header to the footer, every `RuledSection` drew only the
rule above itself, and the next section's rule closed the one before. The
ground (the neural field on the landing, the rabbit-hole art on the
catalog, plain ink elsewhere) showed only through the cells' fills. On the
landing at 1440 the column ran 4,646px without a break.

## Decision

Each section is a **framed plate** with the page's ground showing between
plates.

- **`RuledSection` draws its own rails**, a full-bleed rule along its top
  and its bottom, and a `+` mark at each of its four corners. The plate is
  closed whatever follows it (a gap, another plate, the end of the page).
- **`--section-gap`** is the stripe of ground between two plates: 80px
  from 1024px, 56px between 481 and 1023px, 40px on phones. It is a
  margin above every plate, and the `PageFrame`'s bottom padding, so the
  last plate has ground under it too. 80 sits between the system's two
  largest paddings (`--section-pad-y` 96, the CTA's 120): wide enough for
  the field to read as a stripe across the whole screen, narrow enough
  that a six-section landing still reads as one page (+560px at 1440, +280
  at 360). On a phone 40 equals the big cell inset, so a gap never outsizes
  the spacing inside a plate.
- **`rule={false}` now means "continue the block above"**: no gap and no
  top rule, because the block above drew that line. It is what it was for
  (the first band under an app bar or a landing header), plus any section
  that must read as one unit with the one before: the catalog's course grid
  continues its "Find a course" toolbar, the login page's band continues
  its brand row. `marks={false}` still drops every mark.
- **`PageFrame` draws no rails by default.** `rails` is for a frame that
  holds one continuous workspace with no sections: the lesson page (read
  and terminal modes), whose rails still run from the lesson bar to the
  foot. The frame no longer needs a closing empty section; the tails on the
  catalog, course, course-404, profile and certificate pages are gone, and
  so are the profile's and certificate's bottom margins.
- The full-bleed rules stay 100vw (047's signature) and `html` still clips
  sideways overflow (049). Rails are borders, so nothing shifts layout;
  CLS stayed at 0 on every page measured.

What stays attached to what:

| Page | Blocks |
|---|---|
| Landing | header + hero (one block: the header's rails and rule, the hero's bottom rule) · how it works · the path · modes · progress · CTA · footer |
| Catalog | app bar + title band · continue banner · toolbar + course grid |
| Course | app bar + hero · outcomes · syllabus + progress aside |
| Settings, legal, author, admin, /me | app bar + `PageHead` · each body band |
| Login | brand row + the two-cell band (one block, as before) |
| Lesson | `PageFrame rails` (unchanged) |
| Status pages | app bar + `PageHead`, then ground |

The `LandingHeader` draws its own rails now, so the bar and the hero plate
share one pair of lines. The catalog's tunnel art sits a little higher
(`top: 21%`) and scales with the screen above 760px (`min(640px, 44vw)`),
so its rim never crosses the title band's bottom rule into the gap, where
nothing hides it any more.

## Measured (dev, Playwright, dark; before → after)

| Page | 1440×900 | 360×800 |
|---|---|---|
| `/` | 4,646 → 5,206px | 7,198 → 7,478px |
| `/courses` | 1,830 → 1,926px | 3,925 → 3,941px |
| `/courses/what-is-an-llm` | 1,700 → 1,876px | 3,249 → 3,305px |
| `/settings` | 2,246 → 2,468px | 2,747 → 2,925px |
| `/me` | 1,378 → 1,554px | 2,306 → 2,386px |

CLS 0 on all of them (0.0002 on the course page at 360, as before); no
sideways overflow. The landing's first fold is unchanged (the hero is the
header's block).

## Consequences

- AGENTS.md step 7: no closing section; `rule={false}` joins a section to
  the block above. The styleguide's Grid intro says the same.
- `components.test.tsx` expects four marks on a plate and two (the bottom
  pair) on a joined section. `scroll.test.e2e.ts` finds the rails on the
  first railed block taller than 100px (a plate, or a frame with rails)
  instead of a half-screen-tall frame.
- `/styleguide`'s Grid specimen clips the rules at its edge, as before;
  its sections now show the gap and the bottom marks.
- Tokens: `--section-gap` (`docs/design/spec/tokens.md` §7.2a).
