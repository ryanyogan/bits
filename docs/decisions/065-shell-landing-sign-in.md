# 065. Release shell: the bar, the footer, an honest landing, one sign-in

Status: Accepted (2026-11-02). Amends 059 (what the bar holds), 062 (the
footer is on every page, but the theme switch stays on the landing and in
Settings) and the Auth spec (no sign-up tab). From the release audit
(`docs/plans/release-audit/A-public.md`, lane L1a).

## Context

The pre-release audit found the shell and the way in talking to a stranger
and promising things the code doesn't do:

- The hero was a prompt box that GETs lesson 1 with `?q=`, which the lesson
  never reads, so the learner's first question disappeared (P0).
- Terms and Privacy were reachable only from the landing footer.
- "Write a course" (or "For authors") took a slot in every learner's nav,
  and "My learning" was a sign-in wall for visitors.
- Signed in, the bar held only an avatar link and the landing still said
  "Start lesson 1" and "Sign in once".
- Copy promised "pro courses" and "we'll suggest a first course", and the
  progress showcase showed made-up stats as if they were real.
- Sign-in had Sign in / Create account tabs for one passwordless flow, a
  passkey button on sign-up, OAuth buttons for unconfigured providers, and
  the address in the check page's URL.

## Decision

**The bar (amends 059).**

- Nav: Courses for everyone, My learning once signed in, Write a course only
  for authors and admins (`appLinksFor`, `authorLinkFor` in
  `app/ui/layout.tsx`). One label everywhere.
- Signed out: Sign in and "Start free", which goes to lesson 1 and is left
  out on the page it points at.
- Signed in: a "Continue" key and the account menu. Continue links to
  `GET /continue`, which 303s to the next lesson (the catalog's
  `getContinue`, else lesson 1, else the course list) with
  `Cache-Control: private, no-store`. It is never prefetched. One link
  means no page loads progress just to draw the bar; the landing, which
  already knows the next lesson, passes it directly.
- The account menu (`@bits/ui/account-menu`, an island) is the avatar as a
  `popovertarget` button. Its native `popover` sheet holds who is signed in,
  My learning, the public profile (if public), Settings, Admin (admins) and
  Sign out as a POST form. The phone menu sheet also lists the account pages.
  The button keeps the name "Your profile, RY".

**The footer (amends 062).** `Layout` renders the site footer under every
page except `bare` ones (the lesson workspace and sign-in; the landing
draws its own). It is the frame's last plate, with Courses, My learning and
Settings or Sign in, Write a course (authors), Terms and Privacy. A short
page's frame grows so the footer sits at the foot of the screen. The theme
switch stays on the landing footer and in Settings, as 062 says.

**The landing.**

- No prompt box. The hero has "Start lesson 1 →" (signed in: "Continue
  lesson N", or only "Browse courses" when every started course is done)
  and three questions, each a link to the lesson that answers it
  (`heroQuestions` in `home/links.ts`; the test checks each lesson exists).
- The neural field's formation legend is gone. `onStage` is a no-op.
- Signed in, a Continue band (`ContinueBanner`) sits under the hero, the
  progress section points at My learning, the closing CTA resumes the next
  lesson, and the footer drops Sign in.
- The progress showcase says "Example · what your progress looks like", and
  "pro courses" is cut. The sign-in pane's session panel has no made-up
  numbers.

**Sign-in.**

- One flow, "Sign in or sign up": the passkey button, the configured OAuth
  providers (`oauthCredentials()`), then the email. The same code signs a
  returning learner in or creates the account. No tabs, no name or goals
  step: a name is set in Settings. `?mode=signup` still opens the page.
  `POST /login` still accepts `displayName` and `goals` for a new account,
  and ignores `mode`.
- The address goes to `/login/check` in the session (`signInEmail`,
  `login/pending-email.ts`), never the URL. Without one, the check page
  redirects to `/login`.

**Frame width.** From 1680px, `--frame-max` is `--page-max-wide` (1440px),
so a 1920 or 2560 screen isn't a 1280 column in a sea of ground. Reading
measures keep their own caps.

**Sign out** takes the `RL_LOGOUT` burst tier (10 a minute; 2010 and 3010).

## Consequences

- A new account created by email has no display name until Settings, so
  its handle comes from the email local-part. The owner wants handles that
  don't expose it (release-prep owner decisions), and that is lane L3's
  follow-up.
- Pages that pass their own `links` to `Layout` must add the author link
  themselves (`authorLinkFor`).
- The design spec's prompt bar (Main.md §2, components §7.4) is superseded
  for the landing.
