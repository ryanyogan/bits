# 074. "Try it now" on the landing: lesson 1's coached exercise, with its own live caps

Status: Accepted (2026-11-03). Lane F of `docs/plans/must-improve.md` (row 1).
Amends 065 (the landing has a prompt box again, below the hero) and 067 (a
reward may carry a link where no save is skipped).

## Context

The competitor research (`docs/research/competitors/README.md`, "Where bits
already wins" 1 and recommendation 8) found one thing no free rival does:
the learner's prompt runs on Claude and a Claude judge grades it, in the
browser, with no key and no sign-up. The landing only described that. A
visitor had to pick a course and open a lesson before seeing it.

Decision 065 removed the hero's prompt box because nothing typed there
reached a lesson. Any new box had to reach one.

## Decision

- **A "Try it now" section right under the hero**, for a visitor with no
  progress only. With progress (signed in, or signed out with lessons saved
  in the session), the landing still opens on the next lesson (070), and
  there is no try box.
- **It is lesson 1's real exercise**: `what-is-an-llm/say-hi-to-claude`,
  block `say-hi`. We chose it because:
  - it is the first thing the course asks;
  - it needs no background;
  - it is short: a good first prompt passes in one or two tries;
  - it is coached, so the visitor sees all three parts: their prompt,
    Claude's live reply, and the coach's verdict.

  Its anchor is deterministic: three prompt checks and `sentences<=2`. The
  judge reads two `must` rubric lines.
- **The real `PromptComposer`**, with the lesson's own composer id
  (`what-is-an-llm/say-hi-to-claude/say-hi`) and draft key. It posts to the
  real `/api/run` and `/api/coach`, so the journal, the limits, the canned
  fallback and its labels are unchanged. The draft, the last run and a pass
  are kept in the browser under the lesson's keys, and the journal is the
  same rows. When the visitor opens lesson 1, the exercise is already
  passed, and the lesson's save counts the pass. Signed in, progress
  carries over as before: `claimVisitorRuns` and `claimVisitorVerdicts` run
  at sign-in.
- **One next step after a pass** (070): the reward under the passing run has
  a single "Continue the course →" key to lesson 1. Here the link skips no
  save, so 067's rule (rewards never navigate) is about lessons: the lesson
  page is where the save happens.
- **Stable layout** (023, 025). On the landing, the run window opens at its
  full height, which is shorter than in a lesson
  (`--run-log-height: clamp(200px, 30svh, 300px)`, and
  `--run-log-empty-height` the same). The first run doesn't grow the
  section, and the e2e test checks that the section never grows and that
  layout shift stays under 0.1. The section is a framed plate over the
  field (047/050): the copy on the veil, the composer on the ink slab, two
  columns from 1024px, one below.
- **Lazy.** The landing's action `await import()`s `home/try-it.tsx` (which
  imports the composer) only for a visitor who gets the section. The
  composer stays out of the Worker's startup chunk (026, 052): 793 KiB
  before and after. The exercise comes from the catalog (the memo, else
  R2), never D1. A fresh visitor's `/` still has no `db` Server-Timing
  entry.

### Landing limits

Per visitor, a landing run costs what a lesson run costs. It is a lesson-1
run, under the same per-visitor and per-IP caps and on the same counters,
so the landing grants no extra allowance. What changes is volume: every
first-time visitor now sees a Run button. 1000 live calls a day (runs plus
judge calls) is about 200 curious visitors at 5 calls each. Without its
own limit, the front door could spend the day's budget before the lessons
got any. So runs that the landing's composer posts (`from=landing`) have
two tighter caps on going live (`tryLimits` in `app/runs/run.ts`):

- **3 runs an hour per owner** (counting all their runs, from anywhere),
  against 10 in lessons signed out;
- **half the daily live budget**: a landing run goes live only while the
  day's live calls (`liveTodaySql`: runs and judge calls) are under
  `floor(RUN_DAILY_LIVE_CAP × 0.5)`. The other half is kept for lessons.

Both caps are enforced inside the insert (`insertRunWithin`), like every
run limit (019). When only the landing's caps say no, `/api/run` answers
429 with `X-Run-Reason: try-limit`, and nothing is journalled. The
composer shows the example output, labelled "You've used the live runs on
this page … The lesson has more." When a lesson's own limits or the whole
budget say no, the landing gets the lessons' labelled fallback, as before.
The refusal isn't journalled, so the coach never has to tell a landing cap
from an outage. `whyNotLive()` rebuilds a canned row's reason from the
lesson caps, and a canned landing row would read as "Claude couldn't be
reached", which passes on patterns.

`from=landing` can be forged or left off, but that only removes the
landing's extra caps and leaves the lesson caps, which anyone gets by
opening lesson 1. It throttles honest traffic, not attackers, and the
per-visitor, per-IP and daily caps still bound attackers.

### A fix this needed

A passed exercise re-opens its lesson's gate on a revisit with a silent
`bits:reward` (067), sent on a `setTimeout(0)` after the composer sets up.
When the composer hydrates before `LessonComplete` (as after landing →
lesson 1), the event came before anyone listened, and "Complete lesson"
stayed locked. Now `whenPassed()` (`lesson-state.ts`) sends
`bits:reward-query` (`REWARD_QUERY_EVENT`) once it listens, and a composer
that passed earlier answers it with the same silent reward. The same race
could hit a lesson revisit, so this fixes that too.

## Consequences

- Tests:
  - `app/actions/home/try-it.test.ts`: the section and its wiring; no D1 on
    `/`; hidden with progress; a live, coached pass carried into lesson 1's
    save; the hourly cap, the daily share and the budget fallback.
  - `app/try-it.test.e2e.ts`: the enhanced flow with the gateway stubbed,
    the layout checks, then Continue, the gate opening and the save.
  - `app/a11y.test.e2e.ts`: the landing after a pass, with its reward.
- `home.test.ts` now ends the hero at `id="try"`: the try box is below the
  hero, and the hero still has no form.
- Known edges:
  - With 3 live runs an hour, a landing visitor never reaches "Stronger
    hint" (3rd miss) or "Show a strong prompt" (5th) there. Misses are
    counted per exercise, so both appear in lesson 1 on the same count.
  - In a lesson, the composer's first run still grows the window and the
    verdict folds the criteria (025). The landing avoids the growth with
    its token override. The fold still shortens the section once; the
    composer scrolls by the same amount, and it measures under 0.1 CLS.
- Rejected:
  - A separate demo exercise: a pass there wouldn't reach a lesson (065).
  - A canned reply past the landing caps: the coach would grade it as an
    outage.
  - A migration to mark landing rows: the request flag is enough for
    honest traffic, and lane A's migration is next in line.
