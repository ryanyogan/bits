# 067. The lesson page before release: one save, real choices, room to read

Status: Accepted (2026-11-02). Amends 052 (how quick-check options are
answered), 055 (the lesson's layout breakpoint) and 022 (the outline sidebar).
Lane L2 of the release-prep plan (`docs/plans/release-prep.md`); findings in
`docs/plans/release-audit/B-lesson.md`.

## Context

The pre-release audit walked lessons in three courses at 360–1920 in both
themes and found two blockers and a set of things that made the lesson read
worse than an LMS lesson should:

- **Passing didn't save.** The exercise's reward carried a big "Next: …" link.
  It was a plain link, so a learner who passed and followed it left without
  saving; the course still said 0 of 8. It also sat mid-lesson, above text not
  yet read.
- **The composer dropped keystrokes** under fast typing: a controlled textarea
  re-rendered on every input event could trip the runtime's update-cascade
  guard, and the dropped render then wrote a stale value back over later
  keystrokes.
- A passed exercise looked untried on a revisit, and re-locked Complete.
- Quick checks showed option chips *and* a free-text box; a chip filled the
  box and needed a second click.
- Enter ran a prompt, so writing a multi-line checkpoint prompt spent
  rationed runs by accident.
- A tutor avatar on every paragraph cost 46px of a phone's width.
- Position showed three times; the sidebar slid under the header at the end
  of the page and starved the lesson at 768px.
- `:::terminal`'s "▶ Run" replayed recorded output with no label saying so.

## Decision

- **One save-and-continue action**, the lesson footer's key. Rewards
  celebrate and never navigate (`RewardToast` gets a `note` line instead of a
  `next` link in lessons). The key's label says what it does:
  *Complete and continue →* (an "Up next: …" line beside it), *Next: …* once
  saved, *Finish the course →* only when no other lesson is open, else
  *Complete lesson →* with "N lessons still open".
- **Uncontrolled composer.** The textarea keeps its own value; input renders
  are coalesced to one per task; the hidden `form=` field is kept current by
  the input handler. Enter adds a line and Ctrl/⌘+Enter runs (the hint says
  which). The box grows with the prompt (4–14 lines). With one temperature
  there's no radiogroup, only "runs at T=…".
- **A passed exercise reopens passed.** The temperatures run at and the last
  run are kept in this browser (`bits:ran:<id>`, `bits:last-run:<id>`); a
  saved lesson counts its run checks as met. A revisit that re-passes fires
  a *silent* `bits:reward` (opens the gate, no toast, no neurons). The server
  still re-checks its own journal on save, so none of this is trusted.
- **Quick-check options are real form controls**: a radio group, or
  checkboxes for `multiple`, as full-width ruled rows; select, then Check.
  `/api/ask` reads every ticked box without JS ("a, c"). A right answer folds
  the controls away ("Answer again" reopens them). Grading is unchanged
  (decision 052), so coached prompts (064) build on this.
- **Reading room.** One avatar per tutor turn (`TutorMessage continued`), none
  on phones. Under 1024px (`LESSON_NARROW`, exported by `lesson-bar.tsx`) the
  lesson uses the phone layout: no sidebar, the outline disclosure and depth
  tabs in the row under the bar. The sidebar has a max-height, not a height,
  so it never slides under the header; its hairline is now the lesson
  column's left edge.
- **Position once, length shown.** The outline drops "01 / 08", groups lessons
  under the course's modules and shows minutes per lesson; the bar's context
  line adds the lesson's minutes.
- **Honest replay.** The terminal strip says "recorded output" and the key
  says "Replay".

## Consequences

- e2e: `app/lesson-exercise.test.e2e.ts` (fast typing keeps every key; Enter
  is a newline; passing then the footer key saves). Navigation and a11y
  suites follow the new labels and controls.
- The styleguide specimens for AskPanel and the lesson bar still show their
  old captions (that file is another lane's); behaviour is the same component.
- Not done here: check chips at 360 still wrap one per line; the depth tabs
  still have no explanation; the run window still reserves its compact
  height under a short reply.
