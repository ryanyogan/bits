# QA: merged wave 1 on production (2026-11-02)

Checked https://bits.yogan.dev (Worker 23dcea4b) in Claude in Chrome, which connected for this pass. Breakpoints were
checked with injected same-origin iframes at 320/360/768/1024/1440/1920, with the theme set on the iframe's `<html data-theme>`.
No preference was saved. I stayed signed out for the whole pass. That covered:

- landing → lesson 1;
- the lesson 1 prompt exercise, with one live run (it passed) → complete → lesson 2;
- lesson 3's quick check → complete → course page.

## Clean (verified)

- **Links:** all 28 same-origin links from `/`, `/courses` and `/courses/what-is-an-llm` return 200.
- **Overflow:** no horizontal page scroll on `/`, `/courses`, the course page, a lesson, `/login`, `/terms` or the 404 at 360 through 1920.
- **Layout parts:** each page has one `<h1>`, one app bar and at most one footer. The lesson page has no site footer, by design (L1a `bare`).
- **Keystrokes fixed:** I typed 50 characters into the prompt composer through real key events, and all 50 landed.
- **Prompt exercise:** a live run on Claude Haiku 5.5 returned a reply and the 4 checks ticked. "Complete and continue →" then saved and moved to lesson 2, with a reward toast. The course page showed 2 of 9 (22%) and "Continue lesson 2 →", with an "In this lesson" note naming lesson 2's exercise.
- **Quick check:** real radio buttons; Check then gave "Right · +20 neurons", and the check folded with "Answer again". The footer moved from a disabled "Complete lesson" to "Complete and continue →".
- **Footer** on the catalog and course pages: Courses, Sign in, Terms, Privacy.
- **Signed out:** no "Write a course" anywhere, and no legend on the home field.
- **Unknown POST:** returns the styled 404 (earlier smoke test).
- **Wide frame:** at 1920 the frame is about 1440 wide, and the lesson reading column is about 760px.

## Findings

### [P1] At 320px, "Start free" overlaps the logo
Page/flow: every page with the app bar, at 320 wide (iPhone SE, small Androids), both themes.
What's wrong: on /courses the logo link ends at x=121 and the "Start free" key starts at x=104. The wordmark is clipped ("bit"); a screenshot confirms it. At 360 it fits.
Why it matters: 320 is still a real phone width, and the brand is the first thing people see.
Proposed fix: under about 360px, drop the wordmark to the mark alone, or move Start free into the menu sheet as was done for Continue under 420px.
Files: apps/web/app/ui/layout.tsx:220 and :256; packages/ui/src/app-bar.tsx. Shared: every page.

### [P1] The lesson 1 page still shows "Start free" pointing at itself, and a signed-out learner with progress still sees "Start free"
Page/flow: `/courses/what-is-an-llm/say-hi-to-claude`, all widths. Its header key links to `/courses/what-is-an-llm/say-hi-to-claude`.
What's wrong: L1a hides Start free when `currentPath === startHref` (layout.tsx:256), but the lesson page still renders it. The lesson layout probably passes a different `currentPath` or `startHref`.
Separately, after finishing lessons 1 and 3 signed out, the header on the course page still offers "Start free" (→ lesson 1, already done). Meanwhile the hero says "Continue lesson 2 →" and the catalog banner says "Resume →". That's three different primary actions on screen.
Proposed fix:
- Pass the lesson's path as `currentPath` on lesson pages.
- When the session has progress, swap the signed-out key to "Continue" → `/continue`, which works off the session's completed lessons.
Files: apps/web/app/ui/layout.tsx:45, :74 and :256; apps/web/app/actions/courses/lesson/controller.tsx (Layout props); the `/continue` action in apps/web/app/actions/controller.tsx.

### [P1] Inconsistent continue labels across lanes: "Resume →" vs "Continue lesson N →"
Page/flow:
- The catalog continue banner (1024 and 360) says "Resume →".
- The course page hero says "Continue lesson 2 →".
- The app bar key (signed in) says "Continue", per L1a.
- `/me` course rows say "Resume →".
Why it matters: an LMS uses one verb for the same action. Here it reads as two different things.
Proposed fix: use "Continue" everywhere, with the lesson number where there's room.
Files: packages/ui/src/continue-banner.tsx; apps/web/app/actions/profile/ui/course-row.tsx:69.

### [P2] The outline ticks a lesson "done" before it's saved
Page/flow: lesson sidebar at ≥1024. After passing lesson 1's exercise, and again after answering lesson 3's quick check, the outline item turned into a ✓ while the footer still said "Complete and continue →". The prose also says "Saved when you complete the lesson".
Why it matters: the learner may think the lesson is done and leave without saving. That was the old P0 in a softer form.
Proposed fix: show a distinct "passed, not saved" state (an outlined ✓ or a dot), and keep the filled ✓ for saved lessons only.
Files: apps/web/app/actions/courses/lesson/ui/* (the outline); packages/ui/src/lesson-node.tsx.

### [P2] The home "jump to a question" chips scroll sideways on phones with no cue, and the scroller has no name
Page/flow: `/` at 360 and 320. The `<ul>` is `overflow-x:auto`, 703px of content in 319px, with `tabindex="0"` but no role or `aria-label`. The third question is fully hidden and the second is cut mid-word.
Why it matters: AGENTS.md says a sideways scroller takes a role and a name. Also, three short links fit fine stacked.
Proposed fix: stack or wrap the chips under 760px, which also lets you drop the scroller. If it stays a scroller, give it `role="region"` and `aria-label="Questions"`.
Files: apps/web/app/actions/home/hero.tsx:71 and the chip list after it.

### [P2] The composer hint says "Ctrl+↵ runs · Enter adds a line" on touch phones
Page/flow: the lesson exercise at 360. Phones have no Ctrl key.
Proposed fix: on `(pointer: coarse)`, show "Tap Run to send", or hide the shortcut hint.
Files: packages/ui/src/prompt-composer.tsx:368.

### [P2] The catalog shows the course count twice
Page/flow: /courses, all widths. The lead says "8 courses · about 8 hours in all", and the search strip's aside says "8 courses".
Proposed fix: keep one. The strip count is the useful one once you filter.
Files: apps/web/app/actions/courses/ (catalog page).

### [P2] At 1440+ the 3-column catalog leaves an empty ninth cell
Page/flow: /courses at 1440 and 1920, both themes. There are 8 courses in 3 columns, so the last row ends with an empty plate. L1b flagged this already: with the frame now 1440 at ≥1680, 4 columns fill two rows exactly.
Files: the catalog grid (L1b); `--page-max-wide` (L1a).

### [P2] Brand casing is mixed: "bits" vs "Bits"
Page/flow: the wordmark and copy say "bits". The `<title>` ("… · Bits"), the footer "© 2026 Bits" and the og:image alt say "Bits". `APP_TITLE = 'Bits'` (apps/web/app/config.ts:8).
Proposed fix: choose one casing (decision 005 names it "bits"), and change `APP_TITLE` or the wordmark to match.

### [P2] The sign-in page leaves a large empty pane under the form at tablet widths
Page/flow: /login at 700–768, light. Under the form, the "Your neurons, saved." pane stacks with about 250px of empty grid below the headline.
Proposed fix: hide the decorative pane under 1024, or give it real content. Known from L1a: the headline overlaps the sphere at desktop.
Files: apps/web/app/actions/login/ (auth shell).

### [P2] The next-token toy reserves empty space after it finishes
Page/flow: lesson 2 at 1261 and 768. Once the "Done: 8 tokens" state shows, about 120px of empty box sits under the sentence (the larger state's Ghost). L2 noted this.
Files: packages/ui/src/next-token.tsx.

## Couldn't check

- **Code page in the sign-in flow:** I didn't submit an email, because I had no test inbox and the only real address is the owner's. A GET to `/login/check` without a pending email returns 303 to `/login`, as designed.
- **Signed-in pages and the account menu:** not checked, since I didn't sign in. That includes /me, Settings, the account menu popover and the signed-in landing band. These need a session; the L3 and L1a Playwright shots cover them.
- **768/1024 sweep:** checked the catalog at 1024, the lesson at 768 and the login at 700. I didn't screenshot every page at 768/1024, but the overflow sweep covered all of them.
- **Measured contrast:** not run. Visually, light and dark text read well. Disabled "Complete lesson" is low contrast in light, which WCAG exempts for disabled controls.

## Top 5

1. 320px header overlap (P1).
2. "Start free" on lesson 1 and alongside progress, and three competing primary actions (P1).
3. "Resume" vs "Continue" (P1).
4. Outline ✓ before the save (P2).
5. The hero chip scroller on phones (P2).
