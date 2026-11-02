# Lane A — public and signed-out pages audit

Method: dev server on :44201 (shared local D1; another lane republished `what-is-an-llm` while I worked, so it went from 8 to 9 lessons). Pages: `/`, `/courses` (all, `?track=agents`, `?q=zzz`), `/courses/what-is-an-llm` (signed out, then signed in as demo with lesson 1 in progress and lesson 3 done), `/login`, `?mode=signup`, `/login/check`, the 6-digit code flow (completed), `/terms`, `/privacy`, `/nope` (404), `/u/demo`, AppBar and menu sheet, and the footer.
- Breakpoints: 360, 768, 1024, 1440 and 1920, using iframes.
- Overflow: no horizontal overflow on any page at any width (scrollWidth is the width minus the scrollbar).
- Contrast: a script computed the ratio for every text node in dark and light. Only the decorative outline sigils (LLM, T°…) fall below 4.5:1. So the readability problems below are about size and density, not contrast.

---

## Landing `/`

### [P1] Remove the neural-field legend ("01 · Bits / 02 · Tokens / 03 · Agents / 04 · You")
- **Where:** `/`, ≥1180px (hidden below that), both themes. It sits at the right rail at mid-height: 11px mono text in `--dim` with a 2px bar.
- **What's wrong:** it's barely visible and has no function: it isn't interactive, and it's `aria-hidden`. The owner asked for it to go.
- **Exact deletion, in `apps/web/app/actions/home/public/neural-field.tsx`:**
  - lines 8–14: the `stages` const and its comment;
  - line 34: `let stage = 0`;
  - lines 200–207: the `<div mix={hudStyle}>…</div>` block;
  - lines 259–296: `hudStyle`, `hudItem` and `hudBar`;
  - line 19: "+ StageHud" in the doc comment.
- **Keep `onStage`.** `createField` requires it (`field-scene.ts:44`, `:368`, `:568`), so pass a no-op `onStage() {}` instead of the `stage = next; handle.update()` body (lines 87–90). That also removes a re-render per stage change.
- **Check:** `home.test.ts` for HUD assertions (none matched "01 · Bits"). Docs/spec mentions of StageHud: `docs/design/spec` (Main.md §NeuralField).
- **Shared?** No.

### [P0] The hero "Ask" box throws away what the learner types
- **Where:** `/`, every width.
- **What's wrong:** the hero is a prompt bar ("› Ask your first question", "Ask ↵") with three suggestion chips. It GETs `/courses/what-is-an-llm/say-hi-to-claude?q=…`, but the lesson never reads `q`: I loaded `?q=zzqqxx` and the string appears only in the serialised `loginHref`, never in a field or a reply. The learner's first question just disappears. The chips promise "Explain tokens like I'm ten" and "Why do models make things up?", but both land on the same generic lesson 1. This breaks the "honest, never fake" bar, and it's the very first interaction.
- **Fix (pick one):**
  - (a) Prefill lesson 1's first `:::prompt` exercise with `q`: the draft value is already supported via `persist`/drafts. It could even auto-run if the lesson's first exercise is "ask anything".
  - (b) Make it honest: replace the input with a plain "Start lesson 1 →" CTA, and turn the chips into links to the lessons that actually answer them (tokens → `what-is-an-llm/words-become-tokens`, hallucination → `what-it-cant-do`, agent → `first-agent-loop/the-loop`).
  - Recommend (a) for lesson 1 plus per-chip deep links.
- **Files:**
  - `apps/web/app/actions/home/hero.tsx:19-23,52-63`
  - `apps/web/app/actions/home/links.ts`
  - the lesson controller and exercise draft wiring (`actions/courses/lesson/`, `lesson/ui/exercise.ts`)
- **Shared?** Touches the lesson lane (B).

### [P1] Signed-in landing still talks to a stranger
- **Where:** `/` signed in.
- **What's wrong:** the hero, "Progress you can feel… Sign in once", the closing "Your first prompt is waiting. Start lesson 1" and the footer "Sign in" link are all unchanged for a signed-in learner. The only change is the small hero note. The header nav has no "My learning". LMSs (Coursera, Khan) turn the home page into "Continue where you left off".
- **Fix:**
  - When `viewer`, render a ContinueBanner (`@bits/ui/continue-banner`, `catalog.getContinue`) under the hero.
  - Swap the closing CTA to "Resume <lesson>".
  - Drop or replace the "Sign in once…" Progress section with a link to /me.
  - Footer: show "Sign in" only when signed out.
- **Files:** `actions/home-page.tsx:30-41,76-84`, `home/closing-cta.tsx`, `home/progress.tsx`.
- **Shared?** No.

### [P1] "The pro courses" don't exist
- **Where:** `/` "The path": "The foundations are free; go deeper with the pro courses when you're ready."
- **What's wrong:** every course is tagged Free and the catalog says "all free". The copy promises a paid tier that isn't there (honesty).
- **Fix:** cut the clause until paid courses ship.
- **Files:** `home/the-path.tsx` (lead paragraph near line 52).
- **Shared?** No.

### [P2] The sample progress showcase isn't labelled as an example
- **Where:** `/` Progress section. It shows "12 day streak · 1,240 neurons · 37 prompts written", a ring at 62% and five badges.
- **What's wrong:** these are made-up stats with nothing saying so. The sign-in left panel repeats them ("5 lessons · 12-day streak · 1,240 neurons, resuming 'Temperature & randomness'"), even for a returning user.
- **Fix:** add an `IllustrativeTag`/"example" strip label, or keep the numbers abstract.
- **Files:** `home/progress.tsx`, `actions/login/login-page.tsx` (left panel).
- **Shared?** No.

### [P2] A dead band under the hero
- **Where:** `/` at 1261–1920px. About 300px of empty field sits between the chips and the "Scroll · the bits rearrange themselves" cue. At 360px the gap is about 200px.
- **What's wrong:** first-time visitors see no content below the fold. The cue copy is cute but says nothing about the product.
- **Fix:** tighten the hero's min-height so "How it works" peeks above the fold, or replace the cue with a one-line proof (courses, lessons, free).
- **Files:** `home/hero.tsx` (`heroStyle`, `cueStyle`).
- **Shared?** No.

---

## App bar, nav, footer (every page)

### [P1] No footer outside the landing, so Terms and Privacy are unreachable
- **Where:** `/courses`, `/courses/:c`, `/u/:handle`, `/terms`, the 404 and others. `curl` shows `<footer>` only on `/` (and the lesson page).
- **What's wrong:** from the catalog or a syllabus there's no link to Terms or Privacy, and nowhere to switch theme, which is only in the landing footer (decision 062). Every LMS has a site footer on every page. It's also a legal-hygiene issue for release.
- **Fix:** render `Footer` from `Layout` on all non-lesson pages, with links that depend on sign-in state. The theme switch can stay landing-only, or go everywhere: an owner call, and it needs a decision-062 amendment.
- **Files:** `apps/web/app/ui/layout.tsx`, `actions/home-page.tsx:36-43` (move `footerLinks` into Layout).
- **Shared?** Yes: Layout is on every page.

### [P1] "Write a course" / "For authors" in the learner's primary nav
- **Where:** every page. Signed out it's a login wall (`/author` → 303 `/login?next=/author`). Signed in as a learner, the author tools open.
- **What's wrong:** the nav names differ by page ("For authors" on the landing, "Write a course" elsewhere). The catalog grid also ends with a "+ .md Write a course" card, and so does the empty search state. For a learning product at launch, authoring is secondary and costs a slot in a 3-item nav.
- **Fix:**
  - Primary nav: Courses · My learning (· Profile when signed in).
  - Move "Write a course" to the footer, and show it in the nav only for `role` author or admin.
  - Use one label everywhere.
  - Keep the catalog card, or drop it for learners.
- **Files:** `app/ui/layout.tsx:74-78`, `actions/home-page.tsx:30-34`, `actions/courses/catalog-page.tsx:186`.
- **Shared?** Layout.

### [P2] "Start free" duplicates "Courses"
- **Where:** every non-landing page, signed out. `startHref` defaults to `/courses`, so on `/courses` the volt CTA and the active "Courses" tab both point at the page you're on.
- **Fix:** default `startHref` to lesson 1, or to `/login?mode=signup`, and hide it on `/courses`. "My learning" signed out is also a login wall: label it "Sign in" or hide it.
- **Files:** `app/ui/layout.tsx:113-117`.
- **Shared?** Layout.

### [P2] The menu sheet (<760px) lacks account links
- **What's wrong:** the sheet lists only the nav links. Signed in, Settings, Profile and Sign out are reachable only via the avatar.
- **Fix:** add the account links to `menuExtras`.
- **Files:** `app/ui/layout.tsx`, `@bits/ui/app-bar-menu`.
- **Shared?** packages/ui (no API change; `menuExtras` already exists).

---

## Catalog `/courses`

### [P1] On phones the active track filter scrolls out of view
- **Where:** `/courses?track=agents` at 360px. The pill row starts at "All 8 · Foundations 2 · Prom…", so the selected "Agents" pill is off-screen. You can't see which filter is on.
- **Fix:** scroll the selected pill into view on load (a small island, or a `scroll-margin` plus an anchor). Or wrap the pills onto two rows below 480px, or use a `<select>` on phones.
- **Files:** `actions/courses/catalog-page.tsx`, `@bits/ui/filter-pill`.
- **Shared?** FilterPill.

### [P2] The catalog hero wastes the top of the page
- **Where:** `/courses` signed out, ≥768px. It's "ALL COURSES · FREE / Pick your next rabbit hole." with no lead, on a band about 300px tall whose right half is empty. Signed in, a ContinueBanner follows, with a 150px cover on phones before the text. At 360px the first course card starts about 650px down.
- **Fix:**
  - Give the hero one line of value: how many courses, how long, free.
  - Shrink its height.
  - On phones, drop the banner's cover art (use the `thumb` variant) so the list starts within the first screen.
  - When a track or search filter is active, consider hiding the Continue banner.
- **Files:** `actions/courses/catalog-page.tsx`, `@bits/ui/continue-banner`.
- **Shared?** ContinueBanner.

### [P2] Empty search says "0 courses · all free"
- **Where:** `/courses?q=zzz`.
- **What's wrong:**
  - "all free" next to zero is odd.
  - The filter pills all read 0 and still look tappable.
  - The empty state offers "Write a course" as the alternative.
- **Fix:** "No matches". Suggest 2–3 real course titles instead of the authoring card.
- **Files:** `actions/courses/catalog-page.tsx`.
- **Shared?** No.

### [P2] 1920px+ leaves 640px of ground
- **What's wrong:** `--page-max: 1280px` keeps the catalog at 3 columns on a 1920 or 2560 screen.
- **Fix:** let the catalog grid go to 4 columns with a wider frame (e.g. `--frame-max: 1440px` at ≥1680px), or accept it.
- **Shared?** Yes, a token: `packages/ui/src/styles/tokens.css:343`.

---

## Course syllabus `/courses/:course`

### [P1] The syllabus starts below the fold on desktop
- **Where:** 1261×1247. The hero (title, lead, meta chips, CTA, plus a ~400px cover-art cell) is followed by a full band of outcomes. Then "Syllabus" begins at about y=1050.
- **What's wrong:** Coursera, Frontend Masters and egghead show the outline (or a "Course content" panel) in the first screen. At 360px the 280px cover art sits between the CTA and everything else.
- **Fix:**
  - Hide the cover art below 760px, or shrink it to the `thumb` variant beside the title.
  - On desktop, fold the outcomes into a compact list in the hero's right cell in place of the art, or put them beside the syllabus. The art is decorative and repeated from the catalog card.
- **Files:** `actions/courses/course/ui/course-hero.tsx`, `course-page.tsx`.
- **Shared?** CourseCover (variant only).

### [P1] A finished course points nowhere
- **Where:** completed state. `course-data.ts:74-79` gives "Review the course →" to lesson 1. Certificates are linked only from the profile course row and the reward toast (`grep certificates.show`).
- **What's wrong:** LMS convention for a completed course is "Course complete ✓ · View certificate · Next course: X".
- **Fix:**
  - When `done === total`: CTA = "View certificate", ghost = "Review lessons".
  - Add a "Next up" card for the next course in the track.
  - The certificate needs the viewer's handle, and only applies when the profile is public. Otherwise link `/me`.
- **Files:** `course/course-data.ts`, `course/ui/course-hero.tsx`, `course/ui/course-aside.tsx`.
- **Shared?** No.

### [P1] "Source → courses/what-is-an-llm/" sends learners to the author tools
- **Where:** the syllabus aside: "This course is 10 markdown files. Spot a typo? Fix it in one pull request. courses/what-is-an-llm/ →" links to `/author/what-is-an-llm`. Signed out that's a 303 to login; for a learner it's an author page they can't use.
- **Fix:** link to the GitHub folder (`https://github.com/ryanyogan/bits/tree/master/content/courses/<slug>`), or drop the panel for non-authors. The copy promises a PR, so GitHub is the honest target.
- **Files:** `course/ui/course-aside.tsx`.
- **Shared?** No.

### [P2] Progress is shown twice, and signed out it doesn't say it won't save
- **What's wrong:**
  - Signed in, the hero cover shows "1/9 · 11% complete" and the aside shows a ring with "11% · 1 of 9 lessons". Pick one: keep the aside ring and drop the overlay on the art.
  - Signed out, the aside shows "0% · 0 of 9 lessons" with no "Sign in to save your progress" link (LMS convention). Progress actually does save to the session, but it's lost across devices.
- **Files:** `course/ui/course-hero.tsx`, `course/ui/course-aside.tsx`.
- **Shared?** No.

### [P2] Cryptic lesson-row glyphs and "neurons"
- **What's wrong:**
  - Rows read "▸ chat › type ◆ project · 5 min · +30 neurons". The glyph tags (`course-data.ts:12-17`) aren't explained anywhere on the page.
  - "Neurons" (XP) is never defined for a newcomer.
  - There are no prerequisites: LMSs say "No prior knowledge" or "Before this: X". The what-is-an-llm lead says it, but the other courses don't.
- **Fix:**
  - Rename the tags to plain words ("Reading", "Prompt exercise", "Project"), or add a key in "How you'll learn".
  - Add a tooltip or one line, "neurons = points for finished lessons".
  - Add a `prerequisites` frontmatter line for intermediate courses.
- **Files:** `course/course-data.ts`, `course/ui/syllabus.tsx`, course frontmatter (content lane).
- **Shared?** No.

### [P2] Small rounding mismatch
- **What's wrong:** "~55 min" in the hero vs "about 50 min to go" at 0%. The hero sums the minutes; the aside floors to 5.
- **Fix:** use one formula.
- **Files:** `course/course-data.ts:70-72`.

---

## Sign-in `/login`, `/login/check`

### [P1] Signup promises "we'll suggest a first course"; nothing does
- **Where:** `/login?mode=signup`: "What brings you here? — we'll suggest a first course".
- **What's wrong:** the `goals` are stored, and used only as a phrase on the profile (`actions/profile/data.ts:128`). No suggestion happens.
- **Fix:** drop the promise, or after signup redirect to the matching course (curious → what-is-an-llm, work → prompting-that-works, code → first-agent-loop).
- **Files:** `actions/login/login-page.tsx`, `actions/login/controller.tsx`.
- **Shared?** No.

### [P1] Separate Sign in / Create account tabs for one passwordless flow
- **What's wrong:**
  - Both modes email a one-time code. Signup only adds a display name and goals.
  - The tabs stay on `/login/check`, where they mean nothing.
  - The signup tab shows "Use a passkey", which can't create an account.
- **Fix:**
  - One form: "Email me a code".
  - Ask for the name and goals after first sign-in (or on /settings), as Brilliant and Execute Program do.
  - At minimum, hide the tabs and the passkey on the check step, and hide the passkey in signup mode.
- **Files:** `actions/login/login-page.tsx`, `actions/login/check/`.
- **Shared?** No.

### [P2] The sign-in left panel: dead space, and the headline over the animation
- **Where:**
  - ≥1024px: the left half is about 500px of empty graph paper above "Your neurons, saved."
  - On `/login/check` the sphere animation draws right through the headline text, which hurts legibility.
- **Fix:** anchor the headline at the top of the panel or centre it, and keep the scene behind a `--copy-wash`, or offset it from the text.
- **Files:** `actions/login/login-page.tsx`, its scene island under `actions/login/public/`.
- **Shared?** No.

### [P2] The email address sits in the URL of the check page
- **Where:** `/login/check?email=demo%40bits.local`.
- **What's wrong:** AGENTS.md already notes that query strings carry email addresses (that's why logs avoid URLs). The address still lands in history, Referer and analytics.
- **Fix:** keep the address in the session (flash) and show a masked "d***@bits.local".
- **Files:** `actions/login/controller.tsx`, `actions/login/check/`.
- **Shared?** No.

### [P2] OAuth buttons render when the provider isn't configured
- **Where:** dev. "Continue with GitHub" leads to `/login?error=github-unavailable`.
- **Fix:** if production is configured, this only affects dev and previews. Still, only render providers whose client ID is set.
- **Files:** `actions/login/login-page.tsx:77`.

---

## Public profile `/u/:handle`, 404, legal

### [P2] The public profile shows zeros and a self-link-style "Share"
- **What's wrong:**
  - Stat tiles show "0 day streak · best 1" and "0 prompts written" to visitors. Hide zero-value tiles on the public view, or show "best streak 1".
  - The Share island is correct, but a visitor gets the same big "Share ↗" button as the owner. For a visitor, "Copy link" or nothing fits better.
  - All 12 badge slots render, mostly locked. For visitors, show earned badges only ("1 of 12").
- **Files:** `actions/profile/profile-page.tsx:111`, `actions/profile/data.ts`.
- **Shared?** No.

### [P2] Legal pages: a wide measure, an empty right column
- **What's wrong:** `/terms` body paragraphs are 759px at 17px (about 85–90 characters per line) beside an empty right third at ≥1440px.
- **Fix:** cap `max-width: 68ch` and let the TOC rail sit left, as it does.
- **Files:** `actions/legal/`.

### [OK]
- The 404 is clear and has the right two actions.
- Sign-in by code works and lands on `/courses`, with a Continue banner and the correct "Resume lesson 1" logic (lesson 1 in progress, lesson 3 done).
- The code input auto-advances.

---

## Top 5
1. **P0:** the hero Ask box drops the learner's question. Prefill lesson 1 or make it an honest CTA (`home/hero.tsx`, lesson draft wiring).
2. Remove the neural-field legend (exact lines above, `neural-field.tsx`). Keep a no-op `onStage`.
3. Put a footer on every page (Terms and Privacy are unreachable outside the landing), and move "Write a course" out of the learner's primary nav (`ui/layout.tsx`).
4. Course page:
   - Bring the syllabus into the first screen (drop or shrink the cover art, fold in the outcomes).
   - Give a finished course a certificate and next-course CTA.
   - Point the "Source" panel at GitHub, not `/author`.
5. Make the signed-in landing a "continue" page, and cut the false promises ("pro courses", "we'll suggest a first course").

## Couldn't check
- **Certificate page:** demo has no completed course, and I didn't fake progress in the shared DB. Not seen rendered.
- **Light-mode screenshots:** checked only at 1440 for `/` and the course page. Contrast was checked numerically for all six pages in both themes.
- **Real WebGL motion:** I didn't evaluate the scene's motion or reduced-motion behaviour beyond the pause toggle being present.
- **Shared DB:** concurrent dev servers on the shared local D1 caused one startup `SQLITE_BUSY` and one `D1_ERROR … session commit token` 500 on an asset request. That's environmental (several lanes on one DB), not a product bug.
- **Production OAuth:** whether GitHub and Google are configured in production is unknown.
