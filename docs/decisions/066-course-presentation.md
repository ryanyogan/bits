# 066. Course presentation: the syllabus first, one action per state

Status: Accepted (2026-11-02). Amends the Course and Catalog page specs
(`docs/design/spec/pages/Course.md`, `Catalog.md`) and the Profile spec for
visitors. It comes from the pre-release audit (`docs/plans/release-audit/A-public.md`).

## Context

The audit compared the catalog, the course page, profiles and certificates
with how good LMSs present a course (Coursera, Frontend Masters, egghead,
Khan Academy). It found:

- **The syllabus started a screen down.** On desktop a tall hero and a full
  band of outcomes came first. On a phone a 280px cover sat between the CTA
  and everything else.
- **Every state got the same actions.** A finished course offered only
  "Review the course" (no certificate, no next course). A started course had
  two "resume" buttons. Progress showed twice, on the art and in the aside.
- **Unexplained vocabulary and links.** The lesson rows used glyph tags
  (`▸ › ◆`) with no key, and "neurons" was never defined. "Source" sent
  learners to `/author`, a sign-in wall, while promising a pull request.
- **Catalog dead ends.** "0 courses · all free" appeared when nothing matched,
  and the authoring card was the only alternative. On phones the selected track
  pill could scroll out of view. The write-a-course cell showed to every
  learner.
- **Profiles talked to the wrong person.** A visitor saw zero stats, twelve
  mostly locked badges and the owner's Share button. A private profile (the
  new default) said nothing about being private.

## Decision

**Course page.**
- The hero is compact. Its cover shows from 1024px only, as decoration beside
  the text; below that it's dropped.
- The syllabus sits under the hero in the same plate. The side column holds,
  in order: progress, what you'll learn (the outcomes, moved from their own
  band), how you'll learn, and source. Below 1024px the syllabus comes first
  and the panels follow.
- There is one CTA per state, and it names what it opens:
  - **New:** "Start the course", with "Lesson 1 · title · min" under it.
  - **Started:** "Continue lesson N", with the title under it.
  - **Finished:** "View your certificate", with the next unfinished course
    (in path order) as the second action. Signed out, it's "Sign in to claim
    your certificate".
- The aside ring is the one progress indicator. Before a start, the panel is
  "On finishing" (badge, neurons, certificate), not an empty ring. It defines
  neurons in one line. Signed out, it says progress stays in this browser and
  links to sign-in.
- The resume note under the current lesson names that lesson's own first
  exercise, not the course's.
- Lesson tags are plain words ("Prompt exercise", "Code exercise", "Video",
  "Project"). "Chat" is left out when every lesson is a chat.
- Source links to the course folder on GitHub (`COURSE_SOURCE_TREE`).
- The hero total and "min left" use the same sum.

**Catalog.**
- The hero carries one line of facts ("8 courses · about 8 hours in all").
- The result label is "N courses" or "No matches". "Free" lives in the
  eyebrow, not next to a count.
- Under 760px the track pills are a grid ("All", then 2 × 2) instead of a
  sideways scroller.
- A track or search filter hides the continue banner.
- A search with no matches offers three real courses and "Clear the search".
- The write-a-course cell shows only to authors and admins.
- `CatalogBackground` reads its props in render (component README: setup
  reads initial values only). A track change now draws the new page's graph,
  and the graph sits at 40% strength behind phone copy.

**Shared pieces.**
- `ContinueBanner` drops its cover when stacked (under 760px).
- `ProgressRing` sizes "100%" to fit.

**Profiles and certificates.**
- **/me, private profile:** says so and links to `Settings#profile`.
- **Share:** only for the owner of a public page.
- **A visitor sees:**
  - earned badges only ("N earned"), or "No badges yet";
  - non-zero stats only.
- **An empty journal:** an empty state, not "All 0 →".
- **"Download my data":** links to `#data`.
- **A private certificate:**
  - its callout is one sentence;
  - its owner's name links to `/me`, since `/u/:handle` is a 404 while
    private.
- **`ProfilePage` takes a `lead` band.** /me can use it to open on what to
  do next.

## Consequences

- Course page tests pin the CTA for each state, the single ring, the exercise
  note and the GitHub link. `a11y.test.e2e.ts` covers the course page started
  and finished. Catalog tests pin the labels, the suggestions and the
  author-only cell.
- Prerequisites per course need a frontmatter field. That belongs to the
  content lane; until then the lead says it where it matters.
- The catalog stays at three columns. Whether the frame grows at 1920+
  (`--frame-max`) is the shell lane's call; the grid can go to four columns
  once it does.
