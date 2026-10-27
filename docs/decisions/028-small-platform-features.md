# 028. Terms and Privacy, link-preview cards, badge toast, certificates

Status: Accepted (2026-10-27).

## Context

Four small features were missing before launch: policy pages, social cards
(`og:image`), a visible moment when a badge is earned, and the certificate
page the Profile design links to ("a simple shareable page per finished
course, no PDF", handoff). Constraints: no paid Cloudflare products, no
noticeable growth of the Worker bundle, the server decides every reward.

## Decisions

### Terms and Privacy (`/terms`, `/privacy`)

- Plain prose in components (`app/actions/legal/`), written from the code:
  the migrations, `app/runs/`, `app/auth/`, the daily clean-up in
  `worker.ts`, and Settings' export and delete. When any of those change,
  change the page and its `*_UPDATED` date in the same commit.
- Linked from the landing footer, the sign-in form ("By continuing you
  agree to…") and each other. Not legal advice: the owner reviews the text
  before launch (no contact address is published yet).

### Link-preview cards: screenshots made ahead of time

- `/cards/:card` renders a 1200×630 card (`home`, `course-<slug>`,
  `certificate-<slug>`) from the design system's own components (cover,
  hex badge, brand mark). Noindex.
- `pnpm og` (`scripts/og-images.ts`) starts the app on the test platform
  (every course in `content/courses/` published in memory), screenshots each
  card with Playwright's Chromium, and writes `public/og/<card>.png` plus
  `app/ui/og-cards.generated.ts` (card → hash, used as `?v=`). Both are
  committed; the build copies `public/` as static assets, so the Worker
  never renders an image. A test fails when a course folder has no card.
- Rejected: satori/resvg or another WASM renderer in the Worker (bundle
  size, CPU per request), Browser Rendering and Cloudflare Images (paid).
- Courses uploaded through `/author` since the last `pnpm og` fall back to
  the landing card. Certificate cards are per course, not per learner: the
  learner's name is in the page title and description.
- `Document` takes an `image` (`og:image` + type, size, alt) and switches
  `twitter:card` to `summary_large_image` when it has one. `Layout` uses
  the landing card unless a page passes `image={ogImage(...)}`.

### Badge toast: a session flash, shown through RewardRegion

- `completeLesson` already returns the badges it just awarded. The
  complete action turns them into a `RewardNotice` (`app/progress/reward.ts`)
  and `session.flash`es it; the page the 303 lands on (next lesson or the
  course page) calls `takeReward(context)` and passes it to `Layout`.
  The browser sends nothing that can raise a toast.
- `Layout` renders `BadgeNotice`: a `RewardRegion` with an `initial`
  reward, inside a wrapper keyed by the award's id (`data-rmx-key`), so
  client navigation mounts a fresh region per award. The toast is in the
  server HTML, so it shows without JS; hydrated, it dismisses after 8s.
- `RewardToast` gained `title` and `badge` (the hex replaces the check, on
  an ink tile because badge fills include volt).
- Only signed-in learners earn badges (decision 016), so only they see it.
- A course badge links to its certificate; others link to `/me`.
- Known gap: a live region inserted together with its text may not be
  announced by every screen reader (as noted in 024).

### Certificates (`/u/:handle/certificates/:course`)

- Derived, never stored: the page exists while the user has completed every
  lesson of the live course (`lesson_progress`); the date is the last
  completion. A course that gains lessons later hides it until they're done.
- Visibility follows the profile: public profile → public page; private
  profile → 404 for everyone but the owner, who sees it with a notice and
  `noindex`. Unknown handle, course or unfinished course: the same 404.
- Shows name, handle, course, date, lesson count and the course badge.
  Never the email or the prompt journal. States plainly that it is not an
  accredited qualification.
- Linked from the finished course row on `/me` and `/u/:handle`.

## Consequences

- Run `pnpm og` after adding a course or changing a course's title, cover or
  badge, and commit the PNGs and the generated file (~165 KB per card).
- The Worker grew ~24 KiB (mostly the policy text); the cards add nothing to it.
