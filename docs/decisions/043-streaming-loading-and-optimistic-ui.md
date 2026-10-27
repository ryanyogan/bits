# 043. Streaming, loading states and optimistic UI: where they pay

Status: Accepted (2026-10-27). Follows 020, 023, 024, 026, 035 and 042.

## Context

Before more features land, the owner asked for a UX pass over the app's
pages: "streaming and frames where we need them, optimistic UI, proper
states, clean loading states", consistent spacing, and the design system
used everywhere. This record covers the app's pages (`apps/web/app/**`),
except the landing page, the catalogue and sign-in, which other passes own.
`packages/ui` is decision 042.

The guides we followed are the installed Remix ones: 05 (Interactivity:
"Pending and optimistic UI", prefetch) and 06 (Streaming UI with Frames).
Guide 06 says a region earns a `<Frame>` when it has its own route and
either arrives after the page, reloads on its own after a mutation, is
shared by several pages, or owns a separate request. It says "A component
does not need a frame merely because it is slow".

## Measured first

Measured on the Node dev server (`PORT=44115 pnpm dev:restart`), signed in as
the seeded demo user. D1 use comes from `Server-Timing`; times are curl's
`time_starttransfer`, three warm runs each.

| Page | D1 | TTFB (warm) |
|---|---|---|
| `/` | 1 query, 1 round trip | 14–15 ms |
| `/courses` | 2–3, 1 (2 on a cold catalogue memo) | 12–14 ms |
| `/courses/:course` | 2, 1 | 15–21 ms |
| lesson | 2–3, 1 | 23 ms (56 ms on the first, cold R2 read) |
| `/me` | 7, 1 | 24 ms |
| `/u/:handle` (signed in) | 8, 2 | 31–42 ms |
| `/settings` | 5, 2 | 34–40 ms |
| `/author`, `/author/:course` | 5, 2 | 23–34 ms |

Every page is one or two D1 round trips (decisions 026 and 035). No page
waits on a slow secondary read. The pages one might stream (activity and
badges on `/me`, the profile sections, settings sections) come out of the
same batch as the rest of the page.

## Decision

### No frames for now

A `<Frame src>` is a second request through the router. In this app that
means another session read and another D1 round trip, or another batch.
Each candidate would turn a page that is ready in 1 round trip into one
that needs 2, to stream a region that is already in the first batch:

- `/me`'s activity and badges are 2 of the 7 statements in the session's
  batch;
- `/u/:handle`'s sections are one `readPublicProfile` batch;
- `/settings` is the session read, then one parallel round.

None of these regions reloads on its own after a mutation either. Every
mutation answers with a 303 to a page, or a 422 re-render of one.

So no page gets a frame. Revisit when a region:

- reads something slow that isn't in the page's batch (a provider call, an
  external API, an R2 listing);
- or must reload alone after a mutation without navigating (a
  notifications list, for example).

Then give it a GET route, render it with `<Frame src fallback>` (the
fallback in `EmptyState`/`Card` style, the same size as the content, per
decision 023), and keep `Server-Timing` pinned in its controller test.

### Loading states: the runtime's, everywhere

Decision 024 already gives every native form `data-pending`, `aria-busy`
on its submitter, and the double-submit guard. It also shows the top
progress bar after 150 ms on any client navigation. This pass checked
that every submitter shows that state:

- Keycap submitters draw the caret from `aria-busy`.
- Two custom submit buttons drew nothing: the passkey rename "Save" in
  Settings and "Sign out" on `/me`. **`busyCaret`** (`app/ui/busy-caret.ts`)
  is the caret from decision 024 as a mixin. Those two buttons and the
  danger confirm button (`confirmButtonStyle`) now share it.

### Optimistic: saving a lesson

Guide 05 says to use optimistic state for changes that are reversible and
predictable, and to wait when the server chooses the value or the change
is destructive. We checked each mutation:

| Mutation | Optimistic? | Why |
|---|---|---|
| Complete lesson | **Yes** | The learner just passed the checks in the browser (or the lesson has none). The server re-runs them, and a refusal is a 422 re-render. |
| Neurons on passing checks | Already (`LessonXp`, 016) | — |
| Quiz check | No | Only the server knows the answer. |
| Settings: profile, email, methods, sessions, delete | No | The server validates the handle, sends mail, or the change is destructive. Each answers with a 303 and a notice. |
| Author publish / rollback | No | The server chooses which version goes live. |
| Drafts | Already (`persist`, 029) | — |

`LessonComplete` now marks itself saving on its form's `submit`, unless
another listener cancelled it. While the POST is in flight:

- it shows "✓ Lesson complete";
- it renders the `[data-lesson-passed]` marker, which turns the outline
  node and the lesson's progress segment volt (CSS `:has()`, no DOM
  surgery);
- it sets `loading` on the key, which gives the busy caret;
- it puts "Saving your progress" in a polite live region. The region is
  mounted empty (decision 031).

On success, the 303 goes on to the next lesson, whose keyed `<main>`
(`data-rmx-key`) replaces the island. If the server refuses, the 422
re-renders this lesson with `issues`. `handle.frame`'s `reloadComplete`
then clears the saving state, so the page shows what the server said. The
same happens on `pageshow`. Without JS the form posts as before.

### Prefetch

Links that app code renders directly now carry
`data-rmx-prefetch={prefetchFor(href)}` (decision 042's helper), placed
after `aria-current`. That covers:

- the syllabus, outline and breadcrumbs;
- the course source link and the draft link;
- the "sign in to keep these neurons" nudge;
- the legal cross-links;
- the profile, `/me` and course-row links, and the certificate links;
- the author course rows, the settings profile link, and the app bar's
  "Sign in".

Left out:

- `#fragment` links (the settings outline, the skip link);
- external links;
- logout, which is a form;
- `data-rmx-document` links.

The pages are `private, no-cache` (or `no-store`), so a prefetch can't be
reused from the HTTP cache. What it buys is the destination's JS, CSS and
font preloads (component README, "Prefetching"). That is why it stays on
`intent`, not `viewport`. *Checked:* hovering "Privacy" on `/terms` fetched
`/privacy` (a `fetch` resource entry).

### One page column

Most pages hand-rolled the same container, but not quite the same one:

- `Layout`'s default `<main>` used 48 px above and 120 px below at every
  width;
- the bleed pages (course, settings, author, both 404s) used 56/96 px, and
  32/64 px on phones;
- settings and author hard-coded 16 px phone gutters instead of
  `--page-gutter`.

**`pageShell`** (`app/ui/page-shell.ts`) is that one column: `--page-max`,
centred, `--space-14` / `--page-gutter` / `--space-24`, and `--space-8` /
`--space-16` at ≤480 px. Layout's `<main>` and those pages now compose it,
and their own mixins keep only layout (flex, gap).

*Checked* in Chrome with same-origin iframes:

- at 360 px, `/terms`, `/settings`, `/author` and `/author/:course` all
  have 32/16/64 px padding;
- at 1440 px they have 56/32/96 px.

Before, `/terms` was 48/16/120 px on a phone. The profile band, the course
hero and the lesson shell keep their own designed bands.

Other literals in the app's styles became tokens:

- alignment offsets: the syllabus 56 px → `calc(40px + var(--space-4))`
  (node slot plus gap); similar calcs in `method-row` and `source-preview`;
- hairlines: `1px solid`/`dashed` → `var(--border-w)`, and `2px` →
  `var(--border-w-strong)`;
- focus outlines: `2px solid var(--focus-ring-color)` →
  `var(--focus-outline)` (decision 042's tokens).

### States

- **Errors.** No user error answers with a 5xx: user errors are 4xx
  re-renders. The only 5xx answers are the JSON `501`s for unimplemented
  API and webhook endpoints.
- **Empty states.** They already exist and use `EmptyState`: courses and
  the journal on profiles, author courses, unknown courses, certificates.
- **Pending.** Covered above.
- **Success.** Settings and author answer with a 303 and a notice
  (`role="status"` slot). A completed lesson moves on to the next one,
  with the reward toast.

## Consequences

- No D1 counts changed. After the pass (signed in, `Server-Timing`):
  - `/me` is 7 queries, 1 round trip;
  - `/u/demo` is 8, 2;
  - `/settings` and `/author` are 5, 2;
  - a lesson is 3, 1;
  - the course page is 2, 1.
- New e2e case in `app/navigation.test.e2e.ts`: the lesson shows as
  complete while its save is held, then rolls back on the 422. It passes,
  along with the file's other 7 cases. The full e2e suite (`a11y` included)
  wasn't run in this pass.
- `author/controller.test.ts` checked the race page with `/v2/`, which a
  generated class name (`rmxc-…cvv2e`) can match. It now matches whole
  words (`\bv2\b`).
- A new submit button that isn't a Keycap adds `busyCaret`. A new page puts
  its column in `pageShell`, unless it's a designed band.
- Frames stay the tool for the cases listed under "No frames for now",
  never a default.
