# Audit lane C: signed-in surfaces

Scope: `/me` (empty and active accounts), `/settings` (every section), `/author`, `/author/:course` (+ preview), `/admin/authors`, `/admin/invite`.
Method: own server on :44203, browsed on `127.0.0.1:44203`, not `localhost`. Browsers share cookies across ports on one host, so `localhost` would have collided with other lanes' sessions. Breakpoints were checked with same-origin iframes at 360 / 768 / 1024 / 1440 / 1920. Dark and light were compared with `data-theme`. A contrast sweep (WCAG AA, computed fg/bg with alpha) ran on /me, /settings, /author, /author/:course and /admin/authors in both themes. Accounts: `audit-c-empty@bits.local` (new, empty; later accepted an author invite) and `demo@bits.local` (already `admin`, 1 lesson done, 1 prompt).

Overall: no horizontal overflow at any breakpoint on any page in scope (scrollWidth = viewport − scrollbar). The contrast sweep found **no AA failures** in either theme on any page in scope, open `<details>` included. The problems are structural: what the pages put first, fake or dead UI, and feedback that lands off screen.

---

### [P0] "Or sync a repo" is a stub showing a fake connected repo
- **Page:** `/author`, all breakpoints and themes.
- **What's wrong:** RepoSyncCard shows **`jamie-park/courses` on `main`, "● connected"**, to every author. It is hard-coded (`apps/web/app/actions/author/data.ts:80`, `export const repo = { name: 'jamie-park/courses', branch: 'main', connected: true }`). Its Save button posts to a stub that does nothing and redirects with `?repo=saved`. The card then says "Saved. The next push to main rebuilds your courses." (`apps/web/app/actions/author/controller.tsx:35-39`, comment: "Stub: saving sync settings lands with the GitHub webhook milestone"). The lead says "Push to GitHub or drop the folder here", which is also false.
- **Why it matters:** AGENTS.md says "Honest… never fake a live result." An author will believe their repo is wired up and wait for builds that never come. For real authors this is the most misleading thing in scope.
- **Fix:** remove the card (and "Push to GitHub" from the lead) until the webhook exists. Or render it as an explicit "Coming soon: GitHub sync" with no fields, no Save and no "connected" dot. Give the DropZone the full band.
- **Files:** `apps/web/app/actions/author/author-page.tsx:52-66`, `apps/web/app/actions/author/ui/repo-sync-card.tsx`, `apps/web/app/actions/author/data.ts:80`, `apps/web/app/actions/author/controller.tsx:35-39`.
- **Shared?** No (author area only).

### [P1] "My learning" is a profile page, so the next step is below the fold everywhere
- **Page:** `/me`, all breakpoints.
- **What's wrong:** The nav says "My learning" but the page is titled "Your profile". It opens with a giant display name (Unbounded 60px), a level box, then four stat tiles, then a 26-week heatmap. Only after that comes the course list. Measured top of the empty account's "Browse courses →" CTA: **1231px at 360, 1220px at 768, 1053px at 1024, 1059px at 1920**. It is never in the first viewport. For the active account, the one in-progress course ("What is an LLM, really? 11% · Resume →") is a thin row at about y=670 at 1440. It does not name the next lesson, and "Resume →" links to the course overview (`/courses/what-is-an-llm`), not the next lesson. So "continue" costs an extra click. There is no "Continue: Lesson 2 · Words become tokens · 6 min" card. The catalog has one (`ContinueBanner` with `catalog.getContinue`), but /me doesn't.
- **Why it matters:** Coursera ("My learning"), Khan ("Continue learning"), Frontend Masters, Scrimba and Brilliant all open the learner dashboard with one dominant "resume where you left off" card. Stats, streaks and badges sit below or beside it. Right now the page answers "who am I?" when it should answer "what do I do next?". For a brand-new learner, the whole first screen is zeros (0 neurons, 0 streak, 0 lessons, 0 prompts, an empty heatmap, 0/12 badges).
- **Fix:** (1) Put a "Continue" band directly under the AppBar, before identity: `ContinueBanner edge="flush"` from `catalog.getContinue(completed)`, with the next lesson title, minutes and pct, linking to the lesson itself. (2) Empty account: replace that band with a "Start here" card for the first course ("What is an LLM, really? · 8 lessons · 55 min · Start lesson 1 →"). Hide or collapse the zero stats and the empty heatmap until there is activity. (3) Shrink the identity band on /me (keep the 60px name for the public `/u/:handle`), or move it below the learning content. (4) Rename the page title to "My learning" so it matches the nav, or rename the nav. (5) Make `CourseRow` "Resume" link to the next lesson for `own`.
- **Files:** `apps/web/app/actions/profile/profile-page.tsx:72-195` (layout order), `:62` / `apps/web/app/actions/me/controller.tsx:32` (title), `apps/web/app/actions/profile/ui/course-row.tsx:29,58,69` (href), `apps/web/app/actions/profile/data.ts` (it needs the continue target; `getContinue` is in `apps/web/app/content/catalog.ts`).
- **Shared?** `ProfilePage` also renders the public `/u/:handle`, so gate the continue band and empty-state changes on `variant === 'own'`. `ContinueBanner` is `packages/ui/src/continue-banner.tsx` and is reused unchanged.

### [P1] "Write a course" is in every learner's nav and leads to a 403
- **Page:** AppBar on every page, signed in as a learner (and signed out).
- **What's wrong:** `appLinks` is static: Courses / My learning / Write a course (`apps/web/app/ui/layout.tsx:74-78`). As `audit-c-empty` (a learner), "Write a course" opens "403 / Not yours. You can't open this one. Writing courses is invite-only for now."
- **Why it matters:** A primary nav slot that dead-ends for almost every user. LMSs keep "Teach"/"Instructor" out of the learner's main nav, or send it to an "apply to teach" page, never to an error.
- **Fix:** Build `appLinks` from the viewer: show "Write a course" only when `canAuthor(viewer)`, and add "Admin" (→ `/admin/authors`) for admins. If you want learners to know authoring exists, link a public "Write for bits" explainer from the footer instead.
- **Files:** `apps/web/app/ui/layout.tsx:74-78` (and wherever `links` is passed to `AppBar`), `apps/web/app/auth/identity.ts` (`canAuthor`).
- **Shared?** Yes: Layout is used by every page; `AppBarMenu` (`#app-nav-sheet`) gets the same list.

### [P1] Save notices on Settings land off screen
- **Page:** `/settings`, every section, all breakpoints.
- **What's wrong:** Each form redirects to `/settings?saved=<x>#<section>` (`apps/web/app/actions/settings/controller.tsx:381-383`), so the page scrolls to the section. The success Callout, however, renders in the PageHead at the top. Measured after "Save theme" at 1104×1247: scrollY 1119, notice `top: -829px`. The user sees no feedback where they clicked. The same happens for profile, email-sent, email-cancelled and passkey.
- **Why it matters:** WCAG 3.3.1 / 4.1.3 intent, and a plain usability problem: feedback belongs next to the control. The live region announces it to screen readers, but sighted users get nothing.
- **Fix:** Render the notice inside the matching `Section` body, above its controls (`notice.section` is already known). Keep an always-rendered `role="status"` slot per section, or move the one slot. Alternatively drop the hash and keep the top notice. But in-section is better for a 3,500px-tall page on phones.
- **Files:** `apps/web/app/actions/settings/settings-page.tsx:94-101` (slot), `:402-417` (`Section`), `apps/web/app/actions/settings/controller.tsx:381-383`.
- **Shared?** No. `/admin/authors` has the same top-slot pattern (`apps/web/app/actions/admin/authors/authors-page.tsx` PageHead slot) and its redirects land on `#invites` etc. Fix both the same way.

### [P1] "Download my data" on /me links to an anchor that doesn't exist
- **Page:** `/me` Account panel.
- **What's wrong:** The link is `/settings#export`, but the section id is `data` (`outline` uses `'data'`). Verified: `document.getElementById('export')` is null. The link lands at the top of Settings, not at the download.
- **Fix:** `href={`${settingsHref}#data`}`. Or link straight to `routes.settings.export.href()` with `download` (it's a download; `Keycap download` / `download` attribute per AGENTS.md client navigation).
- **Files:** `apps/web/app/actions/profile/profile-page.tsx:216`; `apps/web/app/actions/settings/settings-page.tsx:59,316-318`.
- **Shared?** No.

### [P1] New profiles are public by default, and the default handle and name come from the email address
- **Page:** `/me`, `/settings` Profile, `/u/:handle`.
- **What's wrong:** A brand-new email sign-up (`audit-c-empty@bits.local`) gets name `audit_c_empty`, handle `@audit_c_empty`, Profile: **Public**. The handle is derived from the email local part (`apps/web/app/auth/users.ts:67`), and `is_public` defaults to 1 (`packages/db/migrations/0001_users_and_auth.sql:29`). Settings says "Your email is never shown", but for most people the public URL `/u/<local-part>` effectively reveals it. Privacy policy discloses public-by-default (`privacy-page.tsx:131`), so this is legal; it's a trust/UX issue.
- **Why it matters:** Coursera, Khan and Brilliant default learner profiles to private or show no public profile at all. Most people would not expect "I signed in to learn" to publish their activity under their email name.
- **Fix:** Default new accounts to private, or keep public but generate a neutral handle (e.g. `learner-7f3k`) and ask for a display name on first visit to /me ("What should we call you?"). If you change the default, update `/privacy` and its `*_UPDATED` date (AGENTS.md policies rule).
- **Files:** `apps/web/app/auth/users.ts:67`, `packages/db/src/queries/users.ts:73`, migration default (new migration needed), `apps/web/app/actions/legal/privacy-page.tsx:129-131`.
- **Shared?** Touches auth/user creation (all sign-in paths, OAuth too: `apps/web/app/auth/oauth.ts:82`). It's a product call for the owner.

### [P1] Sign out is only at the very bottom of /me
- **Page:** all signed-in pages.
- **What's wrong:** The only "Sign out" is the last row of the /me Account panel (`profile-page.tsx:222`), at about y=2350 on a 360px phone. The avatar ("AE") in the AppBar goes to /me. Settings has only "Sign out everywhere". The menu sheet doesn't offer sign out either (grep: no other `routes.logout` form in `app/ui` or `packages/ui`).
- **Why it matters:** Every LMS puts sign out in the avatar/account menu. On a shared machine this matters.
- **Fix:** Add a "Sign out" POST form to the AppBar account area (desktop: a small account popover on the avatar with My learning / Settings / Sign out; phone: the last item in `#app-nav-sheet`). Keep `busyCaret`. Also add a plain "Sign out of this device" next to "Sign out everywhere" in Settings → Sessions.
- **Files:** `packages/ui/src/app-bar.tsx`, `packages/ui/src/app-bar-menu.tsx` (sheet), `apps/web/app/ui/layout.tsx` (passes `actions`/`menuExtras`), `apps/web/app/actions/settings/settings-page.tsx:331-354`.
- **Shared?** Yes: AppBar / AppBarMenu are on every page (decision 059).

### [P1] Settings shows the same re-auth box twice, offers "Use a passkey" to accounts without one, and keeps "Connect" live while asking you to confirm first
- **Page:** `/settings` when the session is older than 10 minutes (I aged it with the `ageSessions` SQL). All breakpoints.
- **What's wrong:** (a) Two identical `ReauthBlock`s, under Email ("To change your email, confirm it's you first…") and under Sign-in methods ("To add a passkey or connect GitHub or Google, confirm it's you first…"). Each has its own "Email me a code" and "Use a passkey". (b) "Use a passkey" shows for an account with **0 passkeys** (the note right below says "You have 0 passkeys"). (c) The GitHub/Google "Connect" buttons stay active in the methods list right above the box that says connecting needs confirmation first. They fail later on the server instead.
- **Fix:** One step-up banner at the top of the security area ("Confirm it's you to change email, add passkeys or connect accounts: Email me a code / Use a passkey"). Show "Use a passkey" only when `passkeyCount > 0`. While not recently authenticated, render Connect as `aria-disabled` with "Confirm first" or hide it.
- **Files:** `apps/web/app/actions/settings/settings-page.tsx:265-312`, `apps/web/app/actions/settings/ui/reauth-block.tsx`, `apps/web/app/actions/settings/ui/method-row.tsx:41-52`.
- **Shared?** No.

### [P1] Course build page: no way back, no "view live", rollback has no confirm while publish does
- **Page:** `/author/:course` (checked `tokens-and-temperature`, `what-is-an-llm`), 1440 and 360.
- **What's wrong:** The only link in `<main>` is "Preview draft". "Authors / tokens-and-temperature" is plain text, not a link back to `/author`, and there is no link to the live course `/courses/:slug`. The header's "Roll back to v2" is an instant POST with no confirmation. "Publish v3" opens a confirm popover. Rollback changes what every learner sees, so it deserves the same guard. The header's "Roll back to v2" also repeats the identical button in the Versions list right below it.
- **Fix:** Make the strip label a breadcrumb (`Authors` → `/author`). Add "View live →" (when `item.live` exists) next to Preview. Give rollback the same `popover` confirm as Publish ("Roll back to v2? Learners get v2 on their next page load."). Drop the header rollback button and keep it in Versions, or keep only the header one.
- **Files:** `apps/web/app/actions/author/course/course-build-page.tsx:194`, `apps/web/app/actions/author/course/ui/build-panels.tsx` (`ValidationReport` header actions, `VersionRow`).
- **Shared?** `PageHead` (`apps/web/app/ui/page-head.tsx`) if you add breadcrumb-link support there; `/admin/authors` would use it too.

### [P2] /author puts the author's own courses third, under marketing copy and the upload band
- **Page:** `/author`. "Your courses" heading at y=1243 on a 360 phone, about 600px down at 1440.
- **What's wrong:** A returning author lands on the hero "Courses are just markdown.", then the DropZone + repo card, then their courses. On a phone, "Drop a course folder" is the first control, though phones can't drag folders in.
- **Fix:** For authors with courses: a compact PageHead ("Your courses · 8"), the course list first, and upload as a smaller band below (or a "New version ↑" action). Keep the hero copy for the empty state only. On under 760px, label the DropZone "Choose a .zip" and drop the drag copy.
- **Files:** `apps/web/app/actions/author/author-page.tsx:36-93`, `apps/web/app/actions/author/public/drop-zone.tsx`.
- **Shared?** No.

### [P2] Validation report and video uploads read poorly
- **Page:** `/author/:course`, 1440.
- **What's wrong:** (a) The validation items are a 4-column cell grid. Long warnings ("! 01-what-is-a-token.md → video not uploaded yet: assets/01-what-is-a-token.mp4 (the lesson publishes as text-only until it is ready)") wrap into five lines in a narrow cell, next to one-line passes. Sorting is by position, not severity. (b) "✓ 0 of 2 videos uploaded and ready" is shown as a pass while two warnings say the videos are missing. (c) The video rows use the unstyled native `<input type=file>` ("Choose File / No file chosen"), the only unstyled control in scope, next to a disabled "Upload".
- **Fix:** Render the report as a one-column list, errors then warnings then passes, with passes collapsible ("6 checks passed"). Make the video-count line a warning when fewer than all are ready. Style the file input as a `Keycap`-looking label (visually hidden input plus `<label for>`; the label text "Choose assets/01-…mp4" already exists) and show the chosen filename.
- **Files:** `apps/web/app/actions/author/course/ui/build-panels.tsx` (`itemsGrid`, `ValidationRow`), `apps/web/app/actions/author/public/video-upload.tsx`, the video-count check in `apps/web/app/content/compile/`.
- **Shared?** The video-count check is in the content compiler (shared with the CLI report).

### [P2] /admin/authors: 2×2 grid leaves a large dead area; no route back to authoring
- **Page:** `/admin/authors`, 1440 (page 2,695px tall).
- **What's wrong:** "Courses" (bottom-right) lists 8 cards, each with its own select + Add, so it runs about 1,500px. "Authors and admins" (bottom-left) holds one row, which leaves a tall empty cell. The AppBar marks nothing as current, and there's no link back to `/author`. The invite email field has no placeholder or hint, unlike other email fields (`you@somewhere.dev`).
- **Fix:** Stack Courses full-width under the 2-up row, or make it a compact table (course | authors | add select). Add a breadcrumb/aside "← Authoring". Mark nav current via `currentPath` once there is an Admin link (see the nav finding).
- **Files:** `apps/web/app/actions/admin/authors/authors-page.tsx` (CellGrid at the top of the body, `CourseAuthors`).
- **Shared?** No.

### [P2] Invite flow edges
- **Page:** `/admin/invite`.
- **What's wrong:** (a) Opening `/admin/invite` with no or a malformed token says "This invite has expired. It was already used, withdrawn, or is more than 7 days old." That's misleading for a broken link. (b) Wrong account: the only action is "Sign out", and the copy then asks the user to find the email and open the link again. (c) Accepting redirects silently to `/author` with no welcome or confirmation, and the page shows the generic hero plus the fake repo card (see P0). (d) No "Decline" option.
- **Fix:** (a) A separate "This link isn't complete" state when no token. (b) Sign out with `next=` back to this invite URL (the token page is already `no-store` + `no-referrer`). (c) Redirect to `/author?welcome=1` and show "You're an author. Here's your course: …". (d) Optional "Not now" link home.
- **Files:** `apps/web/app/actions/admin/invite/controller.tsx`, `apps/web/app/actions/admin/invite/invite-page.tsx`.
- **Shared?** No.

### [P2] Settings layout: an extra column of headings, and a 3,500px phone page with no jump nav
- **Page:** `/settings`. 360: 3,572px tall. 768: 3,182px. 1440: about 2,600px.
- **What's wrong:** From 1100px there are three columns: the outline, a "title + description" column, and the controls column (max 640px). The section titles are tiny 13px mono. Above 1100 the controls start at about x=465 of a 900px frame, so the inputs float right of centre, which is what the owner described as "weirdly placed". Below 900px the outline disappears and there is no other way to jump between the seven sections. The Profile section repeats the avatar + name + handle directly above the Display name and Handle inputs that hold the same values.
- **Fix:** With the outline present, drop the description column: put the section title (as a real heading, larger) and the description above the controls in one column. At under 900px, turn the outline into a horizontal scrolling chip row or a `<select>` jump menu under the PageHead. Remove the duplicate identity row (keep the avatar, next to the Display name field).
- **Files:** `apps/web/app/actions/settings/settings-page.tsx:104-121` (panes/aside), `:402-417` and `sectionStyle` `:504-516`, `:125-133` (identity).
- **Shared?** No.

### [P2] Smaller Settings items
- Handle prefix reads `bits.dev/u/`, but production is `bits.yogan.dev` (`settings-page.tsx:149`). Derive it from `CANONICAL_ORIGIN` / the request host.
- Pending email change: "Confirm new email", "Cancel the change" and "Use a different address" stack as three full-width buttons of different widths (`settings-page.tsx:233-289`). Put Confirm and Cancel in one row and make "Use a different address" a text link.
- "You have 0 passkeys." (`:310`): say "No passkeys yet." for zero.
- Delete confirm: the input's placeholder is the handle itself, so the field looks pre-filled (`public/delete-confirm.tsx`). Use an empty field with the handle in the label ("Type audit_c_empty to confirm").
- Profile 422 with two bad fields says "Check the highlighted field." (singular) (`:72-77`).
- Appearance needs a separate "Save theme" click. That's fine without JS, but with JS the radios could submit on change (progressive enhancement); low priority.
- **Shared?** No.

### [P2] /me details
- "Share ↗" shows even when the profile is private, which would share a 404 link (`profile-page.tsx:111`). Hide it, or change it to "Make public to share", when `!profile.isPublic`.
- Empty journal still shows "All 0 →" (`:185`). Hide the link at 0.
- Activity heatmap cells cap at 24px, so at 1440 the grid stops about 160px short of the panel's right edge (dark and light). Either let it fill the width or right-align the legend under the grid.
- About 55–75px of bare ground (`--section-gap`) between identity, stats and activity at 1440 makes the dashboard look sparse. Consider `rule={false}` joins for the stats band on /me.
- In light mode, the empty heatmap cells (`rgba(20,26,36,0.06)` on paper) and the empty level-bar track are barely visible. They're decorative, so not a WCAG failure, but the empty state reads as blank.
- **Files:** `apps/web/app/actions/profile/profile-page.tsx`, `packages/ui/src/activity-grid.tsx` (shared: the styleguide uses it).

### [P2] Draft preview banner says "DRAFT" when the draft is the live version
- **Page:** `/author/:course/preview/:lesson` for `tokens-and-temperature` (v3 is both latest build and live).
- **What's wrong:** The strip reads "DRAFT · v3 preview · not visible to learners", but v3 is live and visible. The quick check in the preview offers a "Check" button while the footnote says "Answers are checked on the published lesson."
- **Fix:** When `build === live`, show "v3 · live" (or hide "Preview draft" on the build page when nothing is unpublished). In preview, disable Check with that footnote as its description.
- **Files:** `apps/web/app/actions/author/course/controller.tsx` (preview action), the preview banner in the lesson UI (lane B's area: lesson page).
- **Shared?** Yes, the lesson page renders the preview.

### [P2] Dev only: asset requests read the session from D1, so pages randomly render unstyled
- **What's wrong:** In `pnpm dev:restart`, requests for `/assets/ui/styles/*.css`, `/assets/ui/*.tsx` and `/assets/npm/...` go through `loadSession` → `readSessionWithUser`. With several dev servers on the shared local D1 they hit `D1_ERROR: Failed to get session commit token` or `SQLITE_BUSY` and return 500 (27 such errors in my log). The browser then drops `tokens.css`/`base.css` and the page falls back to Times New Roman with no tokens. This explains some "unstyled page" sightings during the audit. Production is unaffected (Workers static assets never reach the Worker).
- **Fix:** In Node dev, serve `platform.assets` before `loadDatabase`/`loadSession` (the same reasoning as `serveMedia()`, decision 035). Example: an asset-serving middleware placed next to `serveMedia()` in `apps/web/app/router.ts:57-63`, or inside `platform.middleware` in `platform.node.ts`.
- **Files:** `apps/web/app/router.ts:50-97`, `apps/web/app/platform/platform.node.ts`.
- **Shared?** Router: affects every request in dev.

---

## Top 5
1. **P0:** Remove the fake "sync a repo" card (`jamie-park/courses · connected`, stub Save that claims success) from `/author`.
2. **P1:** Make `/me` a real "My learning" page. Put a Continue card to the next lesson at the top (or "Start here" for new learners), with the profile and stats below. Today the next step is below the fold at every breakpoint.
3. **P1:** Build nav links per role. Learners shouldn't get "Write a course" → 403. Add Sign out (and Admin, for admins) to the avatar/menu.
4. **P1:** Settings feedback and step-up. Show save notices in the section that saved. Merge the two re-auth boxes, hide "Use a passkey" at 0 passkeys, and disable Connect until step-up.
5. **P1:** Authoring safety and wayfinding. Add a confirm on rollback, a breadcrumb back to `/author` and a "View live" link. Fix `/me` → `/settings#export` (should be `#data`).

## Couldn't check / caveats
- **Local D1 was missing migration `0013_theme`.** `POST /settings/appearance` 500'd with "no such column: theme" until I ran `pnpm db:migrate:local` (local state only). Other lanes on the shared D1 may have seen theme 500s before that.
- **Not submitted, by design:** account delete (opened the disclosure only), Publish and Rollback (they would change live local content for other lanes), "Sign out everywhere", passkey add/rename/remove (needs a virtual authenticator; covered by `app/passkeys.test.e2e.ts`), OAuth Connect (no local OAuth apps), course folder upload and the real video upload (no MP4/zip fixture uploaded).
- **Email change:** I submitted a change to `audit-c-new@bits.local` (local outbox only), saw the pending state, then cancelled it. I didn't test the confirm-code or revert link.
- **Active account is thin:** demo has 1 lesson and 1 prompt, so I didn't see a finished course row (certificate link) or a full badge grid in the browser. I read them in code only (`course-row.tsx:31-53`).
- **Local state left behind:** `demo@bits.local` was already `admin` (no change needed). `audit-c-empty@bits.local` was created and is now an `author` on "What is an LLM, really?" (accepted invite). It has `theme = dark` saved.
- The 1920 check was layout and overflow only (frame caps at 1280; fine). No screenshots at 1920.
- No forced-colours or keyboard-only pass in this lane.
