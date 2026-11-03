# 070. One primary action, one verb

Status: Accepted (2026-11-02)

## Context

The wave-1 QA pass on production found the header, the page and the banners
offering different next steps at once. A signed-out learner with two lessons
done saw "Start free" (to lesson 1, already done) in the bar, "Continue
lesson 2 →" in the course hero and "Resume →" on the catalog banner. Lesson 1
showed "Start free" pointing at itself, because the lesson page marks
`/courses` as its current nav path. At 320px the key also overlapped the
wordmark.

## Decision

- **The bar has one primary key**, chosen by `Layout`:
  - **Continue** (to `GET /continue`, or the next lesson where the page knows
    it) when there is progress: signed in, or signed out with lessons done in
    the session (`progress` key, decision 016).
  - Otherwise **Start free**, except on a lesson page (`Layout start={false}`)
    and on the page it points at. A lesson page with no progress shows only
    Sign in.
- Signed-out progress reaches the header through `LearnerScope`
  (`app/ui/learner-scope.tsx`), which the `learner()` middleware wraps around
  every render like `ThemeScope` (decision 062). It reads the session already
  loaded, with no D1 read, so no page passes it.
- The landing treats a signed-out visitor with progress like a signed-in one.
  The hero, the continue band and the closing CTA all open on `nextStep()`,
  and never offer "Start lesson 1" once lessons are done.
- **One verb: "Continue".** The catalog and landing banners, the `/me`
  course rows, the course page ("Continue lesson N →") and the header all use
  it. "Resume" is gone from learner copy.
- Under 360px the bar tightens its edges (the logo inset, the action gap, and
  the signed-out key's padding), so the wordmark, one key and the menu button
  fit at 320.

## Consequences

- A new page needs nothing to get this right. A page that is itself a
  lesson passes `start={false}`.
- The rule is covered by `app/ui/header-actions.test.ts`: a new visitor,
  lesson 1, signed out with progress, and signed in.
