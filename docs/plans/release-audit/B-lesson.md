# Lane B — Lesson page audit (`/courses/:course/:lesson`)

Audited 2026-11-02 on a local dev server (port 44202) against freshly published `content/courses/*`
(see "Gotchas"), signed out and signed in (a fresh local test account), dark and light, at 360, 768, 1024,
1261 (the real window), 1440 and 1920 (scaled iframes). I walked these lessons:

- Tokens & temperature 1 (tokenizer + quiz), 6 (temperature exercise), and the 8 checkpoint, all the way to "Finish the course".
- What is an LLM 1 (prompt exercise, depth tabs, nexttoken player, rabbit hole), plus 2 (steps), 3 (both depths), 4 (training), 6 (compare) and 7 (attention + prompt).
- First agent loop 3 (code editor, two terminals, quiz).

I also took a read-only look at production (signed out, and the page as it renders there).

The legend: a ✓ marks what I saw happen. Anything not marked comes from reading the code.

---

## P0

### [P0] Exercise "Next / Back to the course" button leaves without saving the lesson ✓
- **Page/flow:** any lesson with a `:::prompt`. I checked it signed in on the T&T checkpoint, and it's the same on WIAL lesson 1, at every breakpoint.
- **What's wrong:** when the checks pass, the reward card inside the composer shows a big primary button: "Next: a very good next-word guesser →", or on the last lesson "Back to the course →".
  - It is a plain `<a href>`, not the save form.
  - I passed the checkpoint and clicked it. The course page then read **0 of 8 lessons, 0%, "Start lesson 1"**. The completion (and its 60 neurons) was never saved.
  - Only the footer button (`<button type=submit form=…/complete>`) saves.
  - When I came back to the lesson, the passed runs were gone too (see the next P1). So the learner has to redo the whole exercise.
- **Why it matters:** this is data loss on the main flow. The in-exercise button is the most prominent CTA on the page, so it is the one people will click.
- **Proposed fix:**
  - Make the reward card's CTA submit the lesson's complete form. `RewardNext` would become a `{ form, label }`, rendered as `<button type="submit" form={completeForm.id}>`.
  - Or drop the CTA and say "Scroll on, or finish below". Better still, put the lesson's single primary CTA in one place (see the P1 on duplicate CTAs).
  - On the last lesson it should never say "Back to the course" while the lesson isn't saved.
- **Files:**
  - `apps/web/app/actions/courses/lesson/ui/exercise.ts:70-87` (`next` → `reward.next`)
  - `packages/ui/src/prompt-composer.tsx:280-281`
  - `packages/ui/src/reward-toast.tsx` (`RewardNext`)
- **Shared?** Yes: `RewardToast` in packages/ui is also used for system toasts.

### [P0] Composer textarea drops typed characters ✓ (needs a manual confirm by a human typist)
- **Page/flow:** the PromptComposer, signed in (T&T checkpoint).
- **What's wrong:** I typed 213 characters with the browser tool. About 48 landed ("…Be warm and friendl") and the rest vanished; a second 56-character append lost its tail too.
  - As a control, an injected plain `<textarea>` on the same page received all 125 characters of the same kind of text. That's why I blame the composer and not the tool.
  - The textarea is controlled (`value={draft}`, `handle.update()` and `writeDraft` on every `input`). It also has a debounced `/api/drafts` sync when signed in.
  - An async re-render that writes back a stale `draft` is the likely cause. I did not prove it.
  - On WIAL lesson 1, signed out, a 24-character append survived.
- **Why it matters:** the composer is the product. Lost keystrokes (or lost pastes) on a long checkpoint prompt would read as "the app is broken".
- **Proposed fix:**
  - Make the textarea uncontrolled after hydration: set `defaultValue`, read `textarea.value` on input and submit, and never write `value` back while it has focus.
  - Or only write when `textarea.value !== draft`.
  - Add an e2e that types 300 characters quickly (`page.keyboard.type` with `delay: 0`) signed in, and asserts the value.
- **Files:** `packages/ui/src/prompt-composer.tsx:138-160, 302-318`; `packages/ui/src/lib/drafts.ts:101-142`.
- **Shared?** Yes. `TerminalLog` uses the same pattern; check it too.

---

## P1

### [P1] Passed exercise state is forgotten on return, and the footer re-locks ✓
- **Page/flow:** a lesson with a prompt, signed in.
- **What's wrong:**
  - I passed the checkpoint, left, and came back. The log reads "Run your prompt and the replies land here", "Ran at 1.0" is unchecked, and the footer says "Pass every check to finish", with Complete disabled.
  - After saving the lesson, a revisit shows "✓ Lesson complete" in the footer, but the exercise again looks never attempted.
  - The draft persists; the runs don't. Yet the server already journals every run (`exercise_attempts`).
- **Why it matters:** LMSs (Execute Program, Scrimba) show your passing attempt when you revisit. Today the learner loses the proof and has to spend a rationed live run again.
- **Proposed fix:** have the server pass the newest passing run per exercise (prompt, output, ranAt) into `exerciseProps`. Seed the composer log with it, labelled "your last run · <date>", and start the gate open. A done lesson shows the exercise as passed.
- **Files:** `apps/web/app/actions/courses/lesson/ui/exercise.ts`, `apps/web/app/runs/run.ts` / `packages/db/src/queries/runs.ts`, `packages/ui/src/prompt-composer.tsx`.
- **Shared?** Yes (composer).

### [P1] Two primary "Next" CTAs, one mid-lesson ✓
- **Page/flow:** WIAL 1, T&T 8, and any prompt lesson.
- **What's wrong:**
  - The exercise's reward card offers "Next: <lesson> →" in the middle of the lesson. On WIAL 1 that sits above three more tutor turns, a next-token toy and a rabbit hole the learner hasn't read.
  - The footer then has a second "Next: … →".
  - Two primaries with the same label but different behaviour (one saves, one doesn't).
- **Why it matters:** LMS convention (Coursera, Khan, Frontend Masters) is one "Complete & continue" at the end of the unit. The mid-lesson CTA teaches people to skip content.
- **Proposed fix:** the reward card keeps the celebration (+xp and the message) but drops its CTA. The footer is the single place to continue. Optionally, the footer could become a sticky "Continue" once all gates pass.
- **Files:** as in the first P0.

### [P1] Quick check mixes a free-text box with option chips, and stays open after it's answered ✓
- **Page/flow:** every `:::quiz` / `:::ask` (83 quizzes in content), at all breakpoints.
- **What's wrong:**
  - A multiple-choice question shows option chips *and* a "› Type your answer…" input with a Check key. Tapping a chip copies its text into the input; you then press Check (two steps for one choice).
  - After a wrong answer, the chip you picked isn't marked. After a right one ("✓ answered"), the chips and an empty input with an active Check stay on screen. You can keep answering a solved question.
  - The verdict history (bubble, "Not quite", bubble, "Right") stacks above the input and pushes the page down each time.
  - At 360px the input is ~150px and its placeholder truncates to "Type your …".
- **Why it matters:** this is exactly the owner's "input boxes weirdly placed" complaint. A chip choice should be one tap, and a solved check should collapse to its result (Brilliant, Khan).
  - For pedagogy, lane D owns whether these stay as quizzes or become prompt-coached tasks. For the UI, these points hold either way.
- **Proposed fix:**
  - With options: the chips are the answer (a radio group; a tap submits, or tap then Check), with no text field.
  - Free-text asks: input only.
  - Once right: collapse to the question, the right answer marked ✓ and the explanation, plus a small "Try again" link. A wrong pick marks that chip ✗ in place, instead of appending a chat bubble.
- **Files:** `packages/ui/src/ask-panel.tsx`; `apps/web/app/actions/courses/lesson/ui/exercise.ts` (`askProps`); `apps/web/app/actions/courses/lesson/ui/read-mode.tsx:222-232`.
- **Shared?** Yes (AskPanel). Check QuizChoice consistency too.

### [P1] A tutor avatar on every paragraph block wastes width and adds noise ✓
- **Page/flow:** every lesson, worst on phones and tablets.
- **What's wrong:**
  - Each markdown block is a `TutorMessage` with a 32px "V" avatar plus a gap. A lesson shows 5–8 identical avatars down the left edge, often on back-to-back turns with no learner turn between them (WIAL 2 has three in a row).
  - At 360px the prose column is ~210px (25–30 characters a line). At 768px, with the outline, it's ~260px.
  - The chat metaphor only earns the avatar when a learner bubble (`ask`) precedes it.
- **Why it matters:** readability (a measure of 45–75 characters). LMS reading views use a plain article column. The repeated glyph reads as decoration, not information.
- **Proposed fix:** render prose as a plain article (no avatar, full column width). Keep the avatar only on a turn that answers a `LearnerBubble`, or drop it entirely on phones (<760px). This gains ~44px of measure everywhere.
- **Files:** `packages/ui/src/tutor.tsx:~55-75`; `apps/web/app/actions/courses/lesson/ui/read-mode.tsx:96-102`.
- **Shared?** Yes (tutor.tsx; also the author preview).

### [P1] The outline sidebar slides under the lesson bar near the end of the page ✓
- **Page/flow:** desktop and tablet (≥760px), any lesson, when scrolled to the footer, which is where Next lives.
- **What's wrong:**
  - The nav is `position: sticky; top: var(--shell-h)` (136px) with `height: calc(100dvh - var(--shell-h))`, inside the `bodyStyle` grid.
  - Near the bottom, the grid row ends before the nav can stay stuck, so it scrolls up. Measured: nav top went 136 → 55px at max scroll.
  - Its "In this course 01 / 09" strip and the first lesson row then hide under the sticky lesson bar.
- **Why it matters:** it looks broken, and the current lesson row is often the hidden one.
- **Proposed fix:**
  - Make the grid's row run through the footer: put `LessonFooter` inside the grid's second column, which it is already, but give the nav `align-self: stretch` and an inner sticky wrapper.
  - Or use `max-height` instead of `height`, so a short sticky box never outgrows its containing block.
  - Verify with `scrollTo(0, max)`: the nav's top should equal `--shell-h`.
- **Files:** `apps/web/app/actions/courses/lesson/ui/outline.tsx:121-134`; `apps/web/app/actions/courses/lesson/lesson-page.tsx` (`bodyStyle`).
- **Shared?** No.

### [P1] Tablet portrait (760–1023px): the sidebar starves the lesson, and the bar crams ✓
- **Page/flow:** 768px.
- **What's wrong:**
  - The outline takes 220px, and the read column (with avatar) is ~260px of text.
  - The lesson bar squeezes the context line ("What is an LLM, r…"), wraps the title to two lines ("A very good next-word…"), shrinks the progress strip to a ~45px stub, and still fits the depth tabs and XP.
- **Why it matters:** iPad portrait is a primary "on the go" device, and the phone layout would serve it better.
- **Proposed fix:** move the sidebar breakpoint from 760 to ~1024. Below it, use the phone pattern: the outline disclosure ("3 of 9 ▾") and the depth tabs in the row under the bar. At 760–1023, keep the bar's progress strip, drop the context line, and keep the title on one line with an ellipsis.
- **Files:** `lesson-page.tsx` (`MOBILE` and `bodyStyle`); `outline.tsx` (`MOBILE`); `packages/ui/src/lesson-bar.tsx`.
- **Shared?** The `lesson-bar.tsx` breakpoints are shared.

### [P1] Three progress indicators say the same thing ✓
- **Page/flow:** desktop.
- **What's wrong:** "Lesson 1 of 9" (bar context), the segmented strip (bar), and "01 / 09" (outline header) all show position. The sidebar also shows every lesson. Meanwhile, the lesson's own minutes and module aren't shown anywhere on the page.
- **Why it matters:** redundancy, and the bar's middle strip floats in an empty band.
- **Proposed fix:**
  - Keep the segmented strip, the one glanceable progress.
  - Drop "01 / 09" from the outline header, or the "· Lesson 1 of 9" from the context line.
  - Use the freed space for the module name and "~6 min" (Coursera and Frontend Masters both show a duration per lesson).
  - In the outline, group lessons under the course's module headings (the course page already has them, e.g. "How text becomes numbers") and show minutes per row.
- **Files:** `packages/ui/src/lesson-bar.tsx`; `apps/web/app/actions/courses/lesson/ui/outline.tsx:74-80`.
- **Shared?** LessonBar.

### [P1] The footer label "Finish the course →" is wrong when the course isn't finished ✓
- **Page/flow:** the last lesson of a course, opened out of order (signed in, 1/8 done).
- **What's wrong:**
  - The last lesson always says "Finish the course →", and a done one shows "✓ Lesson complete · Finish the course →".
  - Submitting lands on the course page with a toast ("Badge earned: First token") that covers the "Your progress" panel. There's no course-complete moment, and nothing points at the 7 open lessons.
  - Separately, the lesson copy says "Finish this checkpoint and the Temperature tamer badge is yours", but completing it gave a different badge (the course badge needs every lesson).
- **Why it matters:** the action must match the state (owner's ask). The end of a course is the biggest reward moment in an LMS.
- **Proposed fix:**
  - Label it "Complete lesson →" or "Back to the course →" unless every other lesson is done. In that case show "Finish the course →", leading to a real completion view (certificate link, next course).
  - Have the redirect go to the first incomplete lesson ("Next up: lesson 2") when the course isn't done.
- **Files:** `apps/web/app/actions/courses/lesson/lesson-page.tsx:130-131`; the complete action's redirect (`apps/web/app/actions/courses/lesson/controller.tsx`). The content copy in `content/courses/tokens-and-temperature/08-*.md` is lane D or content.
- **Shared?** No.

### [P1] The `:::terminal` "▶ Run" replays canned output, labelled only "OUTPUT" ✓
- **Page/flow:** First agent loop 3, and every `:::terminal` (23 of them).
- **What's wrong:**
  - The panel header is "OUTPUT", with a "▶ Run" key that types out scripted lines as if they were executing. Nothing says it's a recording.
  - In FAL 3, two terminals with the same command (`npx tsx agent.ts "Weather in Chicago?"`) sit back to back. The second follows a learner bubble, "run it", that the learner never typed.
- **Why it matters:** the AGENTS.md honesty bar: "label illustrative toys as illustrative, and never fake a live result".
- **Proposed fix:**
  - Header "recorded run" (or the IllustrativeTag), and a key labelled "▶ Replay".
  - Merge or drop the duplicate terminals (content).
  - Drop scripted learner `ask` bubbles, or render them as the tutor's prompt ("Try running it:").
- **Files:** `packages/ui/src/terminal.tsx:675-720`; `content/courses/first-agent-loop/03-the-loop.md:87-97`.
- **Shared?** Yes (terminal.tsx).

### [P1] The checkpoint prompt box is 3 rows and Enter runs ✓
- **Page/flow:** checkpoints and long prompts (T&T 8, and the others).
- **What's wrong:**
  - The learner is asked to write a full bot prompt (role, tone, limit, off-topic rule, menu and question) in a `rows={3}` textarea with an inner scrollbar.
  - Enter runs, and Shift+Enter adds a line. Natural multi-line writing fires rationed live runs by accident.
  - The run log also echoes the whole prompt as a learner bubble, so a long prompt fills the fixed log window and pushes the reply out of view.
- **Proposed fix:**
  - Auto-grow the textarea (min 3, max ~12 rows; `field-sizing: content` where supported).
  - For multi-line exercises (prompt length > ~120 or a `multiline` attribute), use ⌘/Ctrl+Enter to run.
  - In the log, collapse the echoed prompt to its first line, with "show prompt".
- **Files:** `packages/ui/src/prompt-composer.tsx:302-325`.
- **Shared?** Yes.

### [P1] Phone: an empty chrome row on lessons without depth tabs ✓
- **Page/flow:** 360px, any lesson without `:::new/:::engineer` (T&T, FAL).
- **What's wrong:** under the sticky bar, a full-width 48px row holds only "1 of 8 ▾" at the far right. That's ~50px of empty band on a 640px-tall viewport.
- **Proposed fix:** when there are no depths, fold the outline disclosure into the lesson bar (a "1/8 ▾" cell after the title), as the back cell is.
- **Files:** `packages/ui/src/lesson-bar.tsx:127-160` (`LessonRow`); `lesson-page.tsx:94`.
- **Shared?** LessonBar.

---

## P2

### [P2] The single-value temperature control is noise ✓
- **Where:** most prompt exercises.
- **What's wrong:** "run at [1.0]" renders as a one-option radio group.
- **Fix:** hide the control when `temperatures.length === 1`. Show "T=1.0" in the run meta, which already exists ("model · T=1.0 · 27 tokens").
- **File:** `prompt-composer.tsx:335-352`.

### [P2] Check chips stack one per line at 360 ✓
- **What's wrong:** the chips take ~200px of height on WIAL 1 at 360px.
- **Fix:** show a compact "2 of 4 checks" summary row that expands, or two columns.

### [P2] The depth tabs have no explanation ✓
- **What's wrong:** "New to this / Engineer" appears with no hint of what changes.
- **Fix:** add a `title`/`aria-describedby` hint: "Same lesson, written for newcomers or for engineers".
- **Also:** visiting `?depth=` saves the choice. That's by design (decision 053), but it means a shared link silently changes the reader's default.
- **File:** `lesson-view.ts:158-174`.

### [P2] No lesson header inside the column ✓
- **What's wrong:** the content starts straight into a tutor turn or a learner bubble ("why does the loop check stop_reason?", which the learner never asked). The `<h1>` lives only in the sticky bar.
- **Fix:** a small header in the column, with the module · ~6 min · "what you'll do" line (most LMSs open a unit this way). Drop opening learner bubbles.

### [P2] Large screens (1440/1920) ✓
- **What's wrong:**
  - The frame caps at 1280 with a 760px read column. At 1920 the page is ~1000px of content in a sea of ground.
  - Prose at 760 is right, but code editors, compare panels and the composer would benefit from a wider "wide" track (~960px) at ≥1440.
- **Fix:** a `--read-wide` token for `codeStyle`, `exerciseStyle` and the toy wrappers at ≥1440.

### [P2] The run log reserves empty space under a short reply ✓
- **What's wrong:** after the first run the log is a fixed `--run-log-height` with ~120px of blank under the reward card (WIAL 1, T&T 8).
- **Note:** this is intended by decision 023. Consider capping it at the content height until it overflows.

### [P2] Footer spacing ✓
- **What's wrong:** `space-16` under the footer, plus the empty outline column, leaves ~250px of blank at the end of every lesson on desktop.
- **Fix:** trim it. And once gates pass, an inline "✓ Checks passed" next to the key is enough. The signed-out "Sign in to keep these neurons →" link is good; keep it.

---

## Couldn't check

- **Video:** no lesson has a ready upload, locally or on production. Prod's HTML only carries the `[data-lesson-video]` CSS. The player, its transcript and its position at the top of the lesson are unverified.
- **`:::marbles` and `:::flow`:** no course uses marbles. Flow (WIAL 6) and attention were seen only static.
- **Contrast:** I didn't get a trustworthy computed-contrast sweep, because the token colours aren't plain `rgb()`, so my script misread them. Visual zoom shows no obviously failing body text in either theme. The faintest text is the 12px mono meta in the bar context and hints. `app/a11y.test.e2e.ts` (axe) covers contrast and should be the source of truth.
- **Reward toast at the end of a no-JS path, and the 422 "issues" path:** not exercised.
- **Real-device touch and iOS zoom:** not tested (iframes only).

## Gotchas for the lead and implementers

- **Local content was stale.** The local catalog served old versions: no depth blocks, 8 lessons in WIAL where content has 9. I ran `pnpm content upload --all --publish` (local only) to audit current content. Other lanes that audited before ~mid-run may have seen the old lessons.
- **Cookies are shared across ports.** All dev servers on `localhost:*` share one cookie jar, so one agent signing in signs in every agent's tabs. I used `laneb.localhost:44202` to isolate. Brief future agents to use `<lane>.localhost`.

## Top 5

1. **P0:** the exercise's "Next / Back to the course" link skips the save. Completion is lost.
2. **P0:** the composer drops keystrokes. Make the textarea uncontrolled while focused, and add an e2e.
3. **P1:** one CTA per lesson (the footer), and restore passed exercise state on revisit.
4. **P1:** quick checks: chips *or* an input, never both. Collapse once answered.
5. **P1:** reading layout: drop the per-paragraph avatar, fix the outline's sticky slide, and move the sidebar breakpoint to 1024.
