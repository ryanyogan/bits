# 052. Quick checks in the prompt window: the `:::ask` block

Status: Accepted (2026-10-29). Amends 016 (progress), 018 (content) and
021 (lesson toys). Supersedes the quiz form of 016 and the Terminal
quiz entries.

## Context

The owner wants "prompt windows for everything, even quizzes": people
want more interactivity, and paid courses are coming. The courses audit
found three bugs in how quizzes worked:

- **B1.** Terminal mode answered any typed line with a canned "Good
  thinking" reply. That faked a result.
- **B2.** In Terminal mode a picked quiz option lived only in the browser.
  The save never saw it, so the quiz's neurons were lost.
- **B3.** An unanswered quiz didn't gate "Complete lesson", and a quiz
  answered after the lesson was saved earned nothing.

Quiz answers were also form fields on the save. The server re-graded
them, but a learner could post the right letter without ever answering.

## Decision

A quick check is a **prompt window graded on the server**.

**Grammar.** `:::ask{id xp gate? multiple?}` takes the question, then
lines:

- `- accept "label" /pattern/flags`: every accept must match.
- `- reject "label" /pattern/flags "feedback"`: any match is wrong, and
  the learner sees the feedback.
- `- choice "text" correct? "why"?`: options. They render as chips that
  fill the field, and a typed letter or option text counts too.
- `- hint`, `- explain` and `- placeholder`.

Patterns must fit the check grammar (`compile/regex.ts`). The build needs
an accept line or a correct choice. It needs `multiple` for more than one
right choice, and allows at most 10 choices. `:::quiz` keeps its syntax
and builds into a choice-only ask (`quizAsAsk`). Stored quiz blocks are
upgraded on read (`upgradeLessonContent`), so published versions need no
rebuild. A leaf `::ask[…]` is still the learner's line in chat.

**Grading.** `POST /api/ask` (`RL_ASKS`, 30 per minute) grades the answer
with `gradeAsk` (`app/progress/ask.ts`). That function re-checks every
stored pattern against the grammar before it runs. Each answer is a row
in `ask_attempts` (migration 0011). Hourly caps live in the insert itself
(`insertAskWithin`): 240 per user, 60 per signed-out visitor and 240 per
IP hash. The patterns, the right choices and the explanations never
reach the browser. The islands get a verdict: right or not, the check
results, the named options, the feedback, and the neurons earned now.

**Neurons.** A right answer earns its share at once, signed in, through
the idempotent `xp_events` ledger (`recordAskAward`). A late answer on a
finished lesson still counts, and answering again earns nothing.
Signed-out answers carry the session's visitor id. They move to the
account at sign-in (`claimVisitorAsks`), next to the runs. The lesson
save no longer reads quiz fields. It asks the journal which asks have a
right answer (`listRightAsks`). An open ask with `gate` (the default)
refuses the save with "Not saved: answer the quick check first."

**One round trip.** The lesson GET doesn't query `ask_attempts`. The
session remembers which asks this browser answered right (`asks`), and
the page uses that to show "answered" and to open the footer. The
journal stays the truth for saving.

**UI.** `AskPanel` (`@bits/ui/ask-panel`) has the composer look: a
"quick check" strip, the question as a tutor turn, a log of answers with
✓ or ✗ verdict bubbles, option chips, a field that grows, and a Check
keycap. A wrong answer stays in the field for editing. In Terminal mode
an ask is a log entry with `[a]` options, and the input line answers it.
The canned replies are gone. A line typed with no exercise or ask
waiting gets an honest note: the tutor can't reply to free questions yet,
and "hint" gives the lesson's hint. On a right answer the
island sends `bits:gate` (`GATE_EVENT`) with the ask's id. When it earned
neurons it also sends `bits:reward` with `source: 'ask'`. `LessonComplete`
opens once the prompts have passed (a non-ask reward) and every open ask
has sent its gate. The footer hint says what's left: "Answer the quick
check to finish".

**Without JS.** The panel is a native form posting to `/api/ask`. The
server flashes the verdict and redirects 303 back to `#ask-<id>`, with
the mode kept. The chips are submit buttons carrying their letter.

**Completion feedback.** A save flashes a notice to the page it lands on.
That is "+N neurons · saved" signed in, or "+N neurons · sign in to keep
them" signed out (`savedNotice`). A new badge replaces it. A verdict shows
the neurons it earned the same way.

**Startup size (026).** The quick check code (AskPanel, the Terminal
asks, the grader, the journal queries) took the Worker's startup from
780 to 802 KiB, because the lesson page and its islands loaded at isolate
startup. The lesson controller and the author preview now
`await import('./lesson-page.tsx')`, as the styleguide does. The lesson
page, the terminal, the editor, the video player and AskPanel load on an
isolate's first lesson request. Startup is now 709 KiB, in 23 modules
instead of 16. The grader stays static: lazy-loading only `/api/ask`
saved under 2 KiB and added chunks.

## Consequences

- Phase 1 is regex and choices only. Grading free text with Claude is
  phase 2. It would go through `app/runs/model.ts` and its limits.
- `/privacy`, `/terms` and the data export list quick-check answers.
  Signed-out answers expire after 7 days (`deleteExpiredRows`).
- Tests: `app/progress/ask.test.ts` (the grader),
  `app/progress/answers.test.ts` (endpoint, journal, limits, sign-in
  claim, late answers, no-JS), the gating case in `progress.test.ts`,
  the e2e flows in `navigation.test.e2e.ts` and `scroll.test.e2e.ts`,
  and the a11y states (wrong and right, Read and Terminal).
