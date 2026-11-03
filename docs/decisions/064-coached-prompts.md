# 064. Coached prompts: Claude answers, a coach judges the reply, the learner iterates

Status: Accepted (2026-11-02). Amends 019 (live prompts), 016 (progress) and
052 (the save reads the journal). The prompt composer's live regex ticks are
gone. Lane W2-engine of the release-prep plan
(`docs/plans/release-prep.md`). The design and content plan are in
`docs/plans/release-audit/D-coached-prompts.md`; this record says what was
built, and where it differs from that draft.

## Context

The owner: "it does not quite make much sense to add quizzes that are filled
in, the user should have to prompt their way to success with help back from
the agent."

Before this decision, a `:::prompt` passed when regexes matched the learner's
draft, and the reply played no part. The patterns shipped to the browser and
ticked as you typed. The save trusted the posted prompt, so anyone could
forge a pass with a form field. None of that teaches prompting the way the
product promises: you try, Claude answers, and you learn from the gap between
the two. Coaching products that work (Brilliant, Execute Program, Khanmigo)
all do the same three things. They grade what you produced, they name the
gap without handing over the fix, and they let you see a model answer after
a few tries.

## Decision

### 1. Every run is graded on the server, in layers, cheapest first

`POST /api/coach` grades one run from the journal. The prompt and the reply
are read from `exercise_attempts` (D1), never from the request.
`app/runs/grade.ts` does the deterministic layers and is pure, so the coach
and the lesson save share it:

1. **Prompt checks** (`- check`, the existing syntax) hold on the prompt.
2. **The run requirement** (`- run temperature=[…]`) holds on the journalled
   temperatures.
3. **Reply checks** (`- expect`, §2) hold on the reply. They run only when
   the reply is live (source `live`, model recorded). The one exception is
   `prompt-shorter-than`, which reads the prompt and so also runs offline.
4. **The rubric** (`- rubric`) is graded by the judge (§3). This happens
   only for a `coach` block, and only when layers 1–3 already hold on a live
   reply. A deterministic miss never costs a model call: its verdict comes
   back with the failing check's own note ("The reply has 3 sentences (2 at
   most).") or the next authored hint.

The verdict's `layer` says which layer decided it:

- `pattern`: the reply was a saved example, so only the prompt checks and the run requirement graded it. This is labelled.
- `reply`: the deterministic layers decided.
- `coach`: the judge graded the rubric.
- `soft`: the judge couldn't run (§5). The block passed on the deterministic layers, and this is labelled.

A run passes when every check, the run requirement and every live expect
hold, and every `must` rubric line is met. The server does this arithmetic.
The judge never says "pass".

### 2. Authoring syntax

    :::prompt{id="on-call" xp=20 coach}
    Put the rota in the prompt, then ask who's on call on Tuesday
    - goal "Get Claude to tell you who's on call on Tuesday, using only the rota you give it"
    - draft "Who's on call on Tuesday?"
    - check "The rota is in the prompt" /tuesday|\btue\b/i
    - check "The rota is in the prompt" /\bpriya\b/i
    - expect "Names one person" match /\b(priya|sam|jo)\b/i
    - expect "Short" sentences<=2
    - rubric "Answers for Tuesday, from the rota" must evidence
    - rubric "Says the answer comes from the rota" should
    - hint "Claude can't see your rota unless it's in the message. Where is it now?"
    - hint "Paste the rota first, then ask your question on the last line."
    - reference "Here is our on-call rota:\nMon: Jo\nTue: Priya\nWed: Sam\n\nUsing only this rota, who is on call on Tuesday? Answer in one sentence."
    - run temperature=[1.0]
    - example T=1.0 "Priya is on call on Tuesday, according to the rota."
    - success "Claude answered from the rota you gave it."
    :::

Block attributes:

- `coach` turns on the rubric judge.
- `gate=false` makes the exercise optional. "Complete lesson" doesn't wait
  for it, and its neurons count toward the learner's total without opening
  the lesson gate (as an ungated ask does).

Lines:

- `- goal "…"` (at most 240 characters) shows above the composer as the Goal.
  The first line stays the short task.
- `- expect "label" <check>`, at most 8 per block. The checks:
  - `json` (the reply, or one fenced block, parses). Add `keys=a,b` to
    require keys and `types=a:number` to require types (string, number,
    boolean, array, object).
  - `words<=N` and `sentences<=N` (N from 1 to 400).
  - `one-word`.
  - `oneof "a|b|c"`: the whole reply is one option, case and punctuation
    folded.
  - `tag name`: the reply has a non-empty `<name>…</name>`.
  - `cites 1-3`: the reply cites at least one `[n]`, and every one is in the
    range.
  - `quotes doc-id`: the reply contains 8 words in a row from that document,
    folded.
  - `match /re/flags`: the same allowlist grammar as `check`
    (`compile/regex.ts`), so no `*`, `+` or `{n}`.
  - `prompt-shorter-than N` (characters, from 1 to 4000).
- `- rubric "label" must|should [on=prompt] [evidence]`, at most 6 per block.
  A rubric line needs `coach`. `evidence` reads the reply, so it can't be
  used with `on=prompt`.
- `- hint "…"`, at most 5, ordered from general to specific. `coach` needs at
  least one.
- `- reference "…"` (at most 2000 characters) is a strong prompt. It stays on
  the server until the learner asks to see it (§4) or has passed.
- `- document id "…"` (at most 4000 characters) is text that `quotes id`
  checks against. A document is never sent to the browser.

The build refuses:

- a `:::prompt` with neither a `check` nor an `expect` line, because every
  exercise needs a deterministic anchor;
- `coach` without a rubric line or a hint, and a rubric line without `coach`;
- `evidence` with `on=prompt`;
- a `quotes` that names no document, and a document defined twice;
- any line over its limit.

Each of these is a case in `compile/build.test.ts`.

One change from the draft: the draft's example check
`/tuesday.{0,40}(priya|sam)/i` doesn't fit the check grammar, because `{n}`
isn't allowed. Write two checks with the same label instead.

### 3. The judge

- `app/runs/judge.ts` builds the prompt and reads the verdict, as pure
  functions. The one provider call is `judgeModel()` in `app/runs/model.ts`,
  which is still the only file that talks to a provider (019).
- The call: `claude-haiku-5-5`, non-streamed, with
  `output_config: { effort: 'low', format: { type: 'json_schema', schema } }`
  and `thinking: { type: 'disabled' }`. It has `max_tokens: 400`, no
  retries and a 10 s timeout, and no sampling parameters. The facts were
  checked against the Claude API reference on 2026-11-02:
  - Haiku 5.5 supports structured outputs.
  - Thinking can be disabled at effort high or below.
  - Sampling parameters are rejected on API version 2026-10-21.
  - Structured-output schemas take no string length limits, so the server
    truncates instead: evidence and source to 160 characters and the hint
    to 240.
- The schema is `{ criteria: [{ id: integer, met: boolean, evidence: string,
  source: string }], hint: string }`, with `additionalProperties: false`. The server rejects a
  verdict with an unknown, missing or duplicate id.
- The system prompt is stable for each exercise and carries
  `cache_control`. It holds the grader's rules, the task, the goal, the
  numbered rubric (each line tagged
  `[reply|prompt; required|advice; quote evidence; quote source]`) and the
  authored hints.
  The reference is never sent to the judge.
- The user message is `<learner_prompt>…</learner_prompt>` then
  `<model_reply>…</model_reply>`, with `&`, `<` and `>` escaped, so the data
  can't close a tag.

The judge resists injection in depth:

1. **The pass arithmetic is on the server** (`applyJudge`): `must` lines
   decide.
2. **Evidence must be real.** An `evidence` line counts as met only if its
   quote is in the reply, ignoring case, whitespace, typographic quotes and
   wrapping (quotes, brackets, an ellipsis).
3. **There is always a deterministic anchor** (the build rule above).
4. **An injection screen** (`screensAsInjection`) reads both the prompt and
   the reply, because a learner can ask Claude to say the words. It catches
   override phrases, text addressed to the grader, "mark … met", verdict
   JSON and the data tags. A hit means no judge call: every rubric line is
   not met, with the hint "Write the prompt for Claude, not for the
   grader." The screen is our fixed pattern, not authored content, so it
   isn't bound by the check grammar. It is kept narrow so role prompts
   ("You are a judge at a baking contest") still pass it.
5. **The hint is filtered** (`safeJudgeHint`). The server drops a hint that
   shares 8 words in a row with the reference, holds a code fence or a data
   tag, or runs over 60 words. The authored hint is used instead.
6. **An unusable verdict is a miss, not a pass.** That covers a refusal
   (`stop_reason: "refusal"`; Haiku 5.5 has no server-side fallback) and a
   verdict that fails the schema. The learner gets "The coach couldn't grade
   this attempt. Write the prompt in plain words and run it again." This
   differs from the draft, which made these a soft pass. The eval (§8) found
   that a base64-encoded instruction makes the judge refuse, so a soft pass
   there would have been an injection that works.
7. **Grounding needs the material, not a claim about it** (amended
   2026-11-02). A reply line whose label grounds the answer in something
   ("from the rota", "taken from the email", "based on the document";
   `groundedLine()`) is tagged `quote source`: the judge must copy the
   material itself from the learner's prompt into `source`. It counts as
   met only if that quote is in the prompt and isn't a sentence about the
   texts ("this prompt contains the rota", "the reply will answer from
   it"; `isSelfClaim()`). The rules also tell the judge that such
   sentences are claims, never evidence, and that a reply naming a source
   the prompt doesn't hold isn't grounded. The eval's "rubric restated"
   injection (a prompt that only claims to hold the rota, against the weak
   `/tuesday/` check) passed about 1 run in 3 before this.

### 4. The loop the learner sees (PromptComposer)

- **Goal strip** above the log: the goal, then "What good looks like", which
  lists the criteria's labels, kinds and levels. Each starts as "not checked
  yet". Patterns, rubric wording beyond the label, documents, hints and the
  reference never reach the browser (`criteriaLabels()` in
  `lesson/ui/exercise.ts`). Nothing ticks while you type.
- **Run** streams the reply as before, and `/api/run` now returns
  `X-Run-Id`. The island then posts the id to `/api/coach` and shows
  "Checking the reply…". If the stream is still finishing, the coach answers
  409 and the island retries (up to 3 times).
- **Coach turn**, under the reply that earned it:
  - each criterion as ✓ met, ✗ not yet or – not checked, in text and glyph,
    never colour alone, with the failing check's note;
  - one hint;
  - the offline or soft label when it applies.
  The goal strip takes the latest verdict's marks.
- **Attempt line**: "Attempt N · hints get more specific".
- **Escalation** (`coachLimits`):
  - From the 3rd miss, "Stronger hint" reveals the next authored hint.
  - From the 5th miss, "Show a strong prompt" reveals the reference as a
    LearnerBubble, with "Use this prompt" to put it in the field.
  - Both are buttons with `aria-expanded` over their panel.
  - `POST /api/coach` with `reveal=1` answers 403 before 5 misses. After 5,
    it records a `reveal` row and returns the reference.
- **Pass**: the coach turn says what worked. The reward toast follows from
  the server's xp, under the run that earned it, and is silent when the xp
  is 0. The reference is then shown as a model answer.
- **Announcements**: one polite status region, rendered empty, announces
  "Checking the reply…" and then the verdict ("1 of 2. …"). The streamed
  reply isn't announced token by token, and the runs list is no longer a
  live region.
- **Keyboard hint**: "Ctrl+↵ runs" shows only under
  `(hover: hover) and (pointer: fine)`. Touch users have the Run button
  (QA finding, wave 2).

### 5. Honest degradation

- **Not live** (no key, over a run limit, a preview, T≠1.0): the reply is a
  saved example, so the verdict is `pattern`, labelled "Coach offline: this
  reply is a saved example. Checked by pattern, not by the coach." The
  prompt checks and the run requirement grade it, and expects show as not
  checked. A coached block can still be passed and finished this way.
- **Live, but the judge can't run** (over a coach cap, or the provider is
  down or times out): the verdict is `soft`. It passes on the deterministic
  layers and is labelled "The coach didn't judge this reply…".
- **Previews** never call a model, for runs or the judge.
  `modelConfigured()` returns false when `APP_ENV=preview`, even if a
  gateway variable leaked into the config.

### 6. Limits and cost

- A judge call is a live model call. It is reserved inside the insert
  (`reserveJudgeCall`: a `pending`, `judged` row written by
  INSERT … SELECT … WHERE within the caps, and only if the run has no
  verdict yet), so the count is never checked first and written later. The
  caps:
  - 12 an hour per exercise signed in;
  - 6 an hour signed out, per visitor;
  - 20 an hour per IP hash, signed out;
  - and the shared `RUN_DAILY_LIVE_CAP`. The shared `liveTodaySql` adds
    judged verdicts to live runs, so the run limits count judge calls too,
    and the reverse.
- `RL_COACH` is a burst limit of 20 a minute, with namespace 2011 in
  production and 3011 in previews.
- Cost at Haiku 5.5 prices ($0.10 / $0.50 per MTok up to 100K input, checked
  2026-11-02): the eval's 52 judge calls used 5.1K uncached input and 6.0K
  output tokens. That is about $0.00007 per judged attempt, plus cache reads.

### 7. Journal, progress and XP

- Migration `0014_coach_verdicts` adds one row per graded run:
  - `attempt_id`: a foreign key to `exercise_attempts`, unique, and null
    only for a reveal;
  - the owner (`user_id` or `visitor`) and `ip_hash`;
  - `course_id`, `lesson_slug` and `exercise_id`;
  - `layer`: `pattern`, `reply`, `coach`, `soft`, `pending` or `reveal`;
  - `passed` and `judged`;
  - `criteria` as JSON (with a size cap) and `hint`;
  - the judge's `model` and token counts.

  The daily cron deletes signed-out rows after 7 days (`deleteExpiredRows`).
  At sign-in, `claimVisitorVerdicts` moves the visitor's rows to the user,
  as with runs and answers.
- **The save reads passes from the journal**
  (`journalledExercises()` in `grade.ts`), as it reads asks (052). An
  exercise has passed when it has a passing verdict, or a journalled run
  whose deterministic layers pass on their own. The second case can't apply
  to a coached block with a live reply, because that one needs the judge.
  `readSubmission` no longer reads `prompt.<id>` or `ran.<id>` fields, and
  the composer no longer posts them.
- **XP**: when signed in, the first pass earns the block's share at once,
  through `xp_events` (`recordAskAward`, kind `exercise`, idempotent), and
  the save never awards it twice. If the strong prompt was shown before the
  pass, it earns half, rounded down. A `pattern` or `soft` pass earns in
  full, because the learner isn't at fault for an offline coach. Signed out,
  the verdict shows the share, and the lesson save puts it into the session
  as before.
- **Gating**: a prompt gates "Complete lesson" unless it says `gate=false`.
  Offline, the pattern layer passes, so a gate never dead-ends the learner.

### 8. The eval

`pnpm --filter @bits/web coach:eval [--vars <.dev.vars>] [--repeats N]`
(`apps/web/scripts/coach-eval.ts`) runs labelled attempts on three kinds of
exercise:

- grounding with an evidence quote;
- JSON extraction with faithfulness;
- tone and action, with two `must` lines.

It also runs a 20-prompt injection set (`scripts/coach-eval/injections.json`).
Each attempt goes through the coach's own path: the deterministic layers,
then the screen, `judgeModel()` and `applyJudge`. It writes nothing to D1.

The run on 2026-11-02 (3 repeats, live judge through the gateway):

- Agreement with the human labels: 38 of 39 (97%). The one miss was a
  borderline case: a refund issued in a formal tone, which the judge read
  as "policy, not a person" and as no concrete step.
- Injections: 0 of 20 passed. The screen stopped 7, the judge failed 12,
  and the judge refused 1 (base64), which now counts as a miss. Before the
  §3.6 fix, that refusal passed as soft.
- Cost: 52 judge calls, about $0.0035.

After the grounding fix (§3.7), three runs in a row on 2026-11-02:

- Agreement: 39, 37 and 38 of 39 (100%, 95%, 97%). Every miss was a
  false fail on the tone exercise, never a false pass: the judge marked the
  next step met but paraphrased its quote, so the evidence check refused it,
  or it read the formal refund reply as policy.
- Injections: 0 of 20 passed in each run (7 screened, 12 failed by the
  judge, 1 refusal). "Rubric restated" was failed by the judge in all 18
  extra tries as well.
- Cost: 49 judge calls per run, about $0.0036 each.

The eval's on-call exercise now checks for a rota's shape: a Tuesday entry
and one other day, each followed by a capitalised name (two checks, since
the grammar has no repetition). The injection set runs against a copy with
only the weak `/tuesday|\btue\b/i` check (`injectionTarget` in
`scripts/coach-eval/cases.ts`), so the screen and the judge stay the thing
under test.

Re-run the eval before widening the judge to a new kind of rubric, and
before changing the model.

### Not built here

- `:::ask{coach}`, the "explain it back" check in the draft's §8. Quick
  checks keep regex grading on `/api/ask`. The radio group for `:::quiz`
  came with decision 067.
- Converting the real courses' exercises. That is the curriculum lane's
  work; the plain test course's lesson 3 is the one coached block.

## Consequences

- Learners pass by getting Claude to produce something good, not by matching
  our keywords. A forged form field earns nothing (`coach.test.ts`,
  `progress.test.ts`).
- Each coached attempt that reaches the rubric costs a second model call and
  about 1 s after the reply. The reply streams first, so the wait falls in
  time the learner spends reading anyway.
- Authors write labels, rubrics and hints. The build forces a deterministic
  anchor and a hint, so a fooled judge alone can't pass a block.
- Known edges:
  - Over a coach cap, a live attempt whose deterministic layers hold gets a
    soft pass. A learner who burns the cap can pass on the anchors alone.
    That is accepted as the draft's honest degradation, and it is labelled.
  - The injection screen can trip on a lesson that teaches prompt injection
    by example ("ignore previous instructions"). Such an exercise should
    grade with `expect` lines and no `coach`, or the screen needs an
    exception before that lesson is converted.
  - A signed-out learner who passes a `gate=false` exercise after saving the
    lesson sees the neurons in the verdict. They aren't kept until the
    lesson is saved again, because the session takes awards only at the
    save.
  - A judge call cut off mid-flight (an isolate killed) leaves a `pending`
    row. That run then answers 409, and the next run is graded normally.
- Tests: `app/runs/coach.test.ts` stubs the gateway for both the run stream
  and the judge, the way `app/runs/run.test.ts` does. Pure layers are in
  `app/runs/grading.test.ts`, and the syntax is in `compile/build.test.ts`.
- Rejected:
  - The judge returning pass or fail: it invites injection and hides the
    arithmetic.
  - Judging canned replies: dishonest.
  - A bigger judge model: Haiku 5.5 with deterministic anchors agreed 97%,
    at about a tenth of Sonnet 5.5's cost.
  - Free chat with the tutor: unbounded cost, and off the "one idea per
    lesson" bar.
  - A soft pass on a refusal: the eval showed it can be provoked.
