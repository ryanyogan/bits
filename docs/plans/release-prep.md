# Release prep plan (2026-11-02)

## CURRENT STATE — read this first (saved 2026-11-02, before a context clear)

Production: https://bits.yogan.dev, Worker 359b9052, master `2716b4f` (all pushed). Prod D1 is migrated through
0014 (`coach_verdicts`). Deploys are manual (`pnpm deploy`); after a deploy also run
`pnpm content upload --all --publish --remote` (CI deploy job is skipped, no CF secrets in GitHub).

Done and live:
- Audit wave (reports in `release-audit/`).
- Fix wave 1: L4 `ab5d07a`, L3 `de965e7`, L1b `6d45c6d`, L2 `5e55de6`, L1a `53d3328`.
- QA of the merged site (`release-audit/qa/QA-wave1.md`), then W1-polish `059fe7b`. This added decision 070
  (one primary action) and made "bits" lowercase everywhere.
- Wave 2 engine `2716b4f`: coached prompts, decision 064. The `POST /api/coach` judge on Haiku 5.5, `- expect`
  reply checks, and the save reads journalled passes. Check patterns no longer reach the browser (verified on prod).
  Eval: 97% agreement and 0 of 20 injections passing. Only `content/fixtures/plain-course` lesson 3 is coached so far.

IN FLIGHT: wave 2 content conversion, two curriculum lanes (fork agents), brief `release-audit/CONTENT-BRIEF.md`:
| Lane | Worktree (`.claude/worktrees/agent-<id>`) | Courses | Port/host | State at save |
|---|---|---|---|---|
| C1 | affc09e8efd461e01 | what-is-an-llm, tokens-and-temperature, prompting-that-works, context-is-everything | 44308 c1.localhost | 4 commits, clean |
| C2 | a2225981e9311c557 | give-your-model-tools, retrieval-without-tears, first-agent-loop, ship-an-agent-to-the-edge | 44309 c2.localhost | 0 commits, 22 files WIP |

These agents may still be running, or may have been stopped by the context clear. To resume:
1. Check each worktree: `git -C <wt> log --oneline master..HEAD` and `git -C <wt> status`.
2. If a lane isn't finished, respawn a fork in that worktree with `release-audit/RESUME.md` and `CONTENT-BRIEF.md`,
   naming its courses.

To merge each lane:
1. Merge it. Both lanes append to `apps/web/scripts/coach-eval/cases.ts`, so expect a conflict there and keep both blocks.
2. Run typecheck, test and doctor.
3. Run `pnpm deploy`, then `pnpm content upload --all --publish --remote`.
4. Smoke-test a converted lesson, then push.
5. Then run a QA pass on the converted lessons, with live coaching, at 360 and 1440 in both themes.

Engine gaps (from the engine report and decision 064):
- `:::ask{coach}` isn't built (explain-it-back quizzes become coached `:::prompt`s instead).
- Over the coach cap, the deterministic checks alone give a labelled soft pass.
- The injection screen trips on lessons that teach injection by example (use expect without coach).
- An interrupted judge leaves a `pending` row, so that one run answers 409.

Open follow-ups: see "Follow-ups" below, plus:
- Check the Settings handle-prefix overlap at 320px on bits.yogan.dev.
- The account menu doesn't mark Settings as current on /settings.
- The certificate's Callout `<span>` workaround can go.
- A person should hand-type in the prompt composer once.

---

Goal (owner): before release, go page by page and flow by flow so that the UX/UI is usable and readable in
light and dark at 360 / 768 / 1024 / 1440 / 1920, and courses are presented like a good LMS. Remove
redundant UI, show the right actions for each state, follow Remix 3 best practices, and replace
"filled-in" quizzes with exercises where the learner prompts their way to success with coaching from Claude.

## Audit wave (done)

Reports in `docs/plans/release-audit/`:

- `BRIEF.md`: the audit brief (owner's goals and how pages were checked).
- `A-public.md`: landing, catalog, syllabus, sign-in, legal, 404, profile.
- `B-lesson.md`: the lesson page.
- `C-signed-in.md`: /me, settings, author, admin.
- `D-coached-prompts.md`: an inventory of all 126 graded blocks, plus the draft decision 064 (coached prompts).
- `E-remix.md`: the Remix best-practice review (doctor and typecheck pass; 1 P1, 12 P2).
- `IMPL-BRIEF.md`: the shared brief for the fix lanes (worktrees, ports, `<lane>.localhost` hosts,
  per-worktree local D1, tests, reporting).

### Release blockers found

1. Passing an exercise doesn't save: the in-exercise "Next" is a plain link (B, P0).
2. The prompt composer may drop keystrokes (B, P0; needs a human repro).
3. The home Ask box throws away its input (A, P0).
4. A fake repo-sync card on /author shows a hard-coded repo and a "Saved" message for a save that does nothing (C, P0; E, P1).
5. `:::prompt` checks only regex-match the learner's draft. The patterns ship to the browser, and the save
   trusts form fields rather than journalled runs (D).

## Owner decisions (2026-11-02)

- **Coached prompts: build it all now.** Build the full decision-064 design: an engine, `POST /api/coach` and
  `coach_verdicts` (migration 0014), then convert all 8 courses. Gate it on an eval: 30 attempts per exercise
  type, at least 90% agreement with hand labels, and 0 of 20 injection prompts passing. Run it after lane L2 merges.
- **Profiles are private by default.** New accounts start private and opt in under Settings. The handle
  should not expose the email local-part. Not yet assigned; give it to L3 or a follow-up lane, and update
  /privacy (`*_UPDATED`).
- Home Ask box: the lead chose an honest CTA, with suggestion chips linking to the lessons that answer them.

## Fix wave 1: DONE, deployed 2026-11-02

Merged and deployed in this order: L4 `ab5d07a`, L3 `de965e7`, L1b `6d45c6d`, L2 `5e55de6`, L1a `53d3328`
(Worker 23dcea4b). Decisions 065–068 recorded. Lanes checked with Playwright, not Chrome, so a QA pass of the
merged site follows. Leftovers from the lane reports are listed under Follow-ups.

### Original wave-1 notes

These five lanes were launched in their own worktrees (`.claude/worktrees/agent-<id>`, branch
`worktree-agent-<id>`) and stopped mid-work when the owner paused. Check each branch for commits and
uncommitted work before respawning. Each lane brief is below.

**State when stopped:** no lane had committed. Uncommitted work-in-progress files remain in each worktree:
L1a 9, L1b 6, L2 5, L3 19, L4 17. When resuming:

- Respawn each lane in its existing worktree.
- Tell the agent to review its `git diff` first, then finish, test and commit.
- Or discard a lane's diff with `git -C <worktree> checkout .` and start it fresh.

| Lane | Worktree id | Port / host | Decision | Owns |
|---|---|---|---|---|
| L1a: shell, home, sign-in | af040407d0ef24efe | 44301 shell.localhost | 065 | home/**, login/**, legal/**, logout/**, ui/layout.tsx, not-found-page, ui app-bar/app-bar-menu/footer/avatar-button/logo/nav-link, `--frame-max` token |
| L1b: catalog, syllabus, profile, certificates | a837af467ef7ef074 | 44302 courses.localhost | 066 | courses/controller + catalog, courses/course/**, profile/**, certificates/**, CatalogBackground, ui course-card/cover/continue-banner/progress-*/lesson-node/filter-pill/key-value-list/stat-tile |
| L2: lesson page | abc8b4079129ca494 | 44303 lesson.localhost | 067 | courses/lesson/**, progress/check.ts (save fix), ui prompt-composer/ask-panel/quiz-choice/lesson-bar/tutor/terminal/code-editor/code-sample/copy-button/chip/reward-toast/toy-panel, lib/run-stream.ts |
| L3: signed-in, settings, author, admin | ae91dc6ae7de23268 | 44304 account.localhost | 068 | me/settings/author/admin/**, auth/**, passkey islands, ui activity-grid/hex-badge/empty-state/callout/text-field/switch/segmented-tabs, wrangler ratelimits, rate-limit.tsx, author-repo/webhook lines in routes/router |
| L4: Remix infra | af540e33af0fc0459 | 44305 infra.localhost | 069 | router.ts, routes.ts catch-all, middleware headers/site-files/media/database/form-data, progress.ts + db queries, root controller, styleguide, placeholder-page, config.ts, AGENTS.md |

### L1a: shell, landing and sign-in

1. Remove the bits/tokens/agents legend from the home neural field (`home/public/neural-field.tsx`; A has the lines).
2. Replace the Ask box with an honest CTA, with chips linking to lessons.
3. Put the footer (Terms, Privacy) on every page via Layout. The theme switch stays in the landing footer and Settings only.
4. Nav: show "Write a course" only to authors and admins, under one label. "Start free" never links to the
   current page. Signed in, the primary action is Continue (the next lesson). Add an avatar menu with
   Profile, Settings and Sign out (a POST form).
5. A signed-in visitor on `/` gets a Continue band and no footer "Sign in" link.
6. Copy: no "pro courses"; label or remove the fake progress stats; make the signup goal suggestion real or drop it.
7. Sign-in: one passwordless flow if that's clean; no passkey button on signup; no email address in the check-page URL.
8. Judge `--frame-max` at 1920+.
9. Rate-limit logout (left over from L3).

### L1b: course presentation

1. Syllabus page: lesson list above the fold on desktop; a smaller cover on phones; outline with durations, outcomes
   and prerequisites; one progress indicator; plain glyphs and XP instead of "neurons"; the right CTA per state
   (Start / Continue <lesson> / Review + certificate + next course).
2. The "Source" panel links to GitHub.
3. The "You stopped at…" note names the current lesson's exercise.
4. Catalog: bring the selected track filter into view on phones; fix stale `courses` props in CatalogBackground.
5. Profile and certificates: test with a finished course; Share only on public profiles; no "All 0 →".
6. Use the width at 1440 and 1920.

### L2: lesson page

1. P0: passing an exercise saves (one save-and-continue action).
2. P0: fix the composer keystroke drop and add a test.
3. A passed exercise restores its passed state on revisit.
4. One Next action, at the end of the lesson; "Finish the course" only when the course is really finished.
5. Quick checks become real radio/checkbox questions with no chips + text box, collapsing after a right answer.
6. One tutor avatar per turn; prose at least 300px wide at 360.
7. Outline: no sliding under the lesson bar; a disclosure below about 1024px.
8. Show the lesson position once.
9. The recorded terminal output is labelled honestly ("Replay").
10. Multi-line composer: Enter adds a newline and Cmd/Ctrl+Enter runs; the checkpoint box is taller.
11. Use the width at 1440 and 1920; check every toy at 360.

### L3: signed-in surfaces

1. P0: remove the fake repo sync (card, `POST /author/repo`, copy). The webhook is never logged at `error`.
2. /me as "My learning": a Continue card at the top (the next lesson by name) or "Start here"; profile below;
   Share only on public profiles; no "All 0 →".
3. Settings: show save notices where the user is; fix the `#data` anchor; one step-up box; no passkey
   option with 0 passkeys; Connect disabled until confirmed; a jump menu below 900px; the real origin in the handle prefix.
4. Validation re-renders a 422 with the issues; success notices use session flash.
5. Rate limits on settings.profile, sessions, deleteAccount, author publish and rollback (new tiers in both lists).
6. /author/:course: back link, View live, confirm before rollback, one rollback button; your courses first;
   a readable validation report; a styled file input; tidy the admin pages.
7. `context.db` in the author controllers.
8. (New) Profiles private by default; see Owner decisions.

### L4: Remix infra

1. The catch-all matches any method, so an unknown POST gets the styled 404 rather than a bare 405.
2. Route-derived matchers in `router.ts` and `headers.ts`, with tests pinning behaviour.
3. Dev: assets are served before `loadSession` (this fixes the random unstyled pages under D1 locks).
4. Move the `progress.ts:206` raw SQL into a queries helper.
5. Remove PlaceholderPage; fix AGENTS.md step 6.
6. Styleguide action and robots DISALLOW built from routes.
7. Run `pnpm preview` to smoke-test.

## Wave 2 (after L2 merges): coached prompts, decision 064

The order follows `D-coached-prompts.md`:

1. Quiz radios (L2 does this).
2. Stop sending check patterns to the browser.
3. The lesson save reads passes from the journal/verdicts.
4. Reply checks (`- expect`).
5. The coach (`POST /api/coach`, Haiku 5.5 judge, `coach_verdicts`).
6. Content conversion of all 8 courses (curriculum work, done by a fork). Includes re-checking 9
   version-dependent facts and adding 2 new coached exercises in ship-an-agent 03/05.
7. The eval gate before going wide.

## Follow-ups (not assigned)

- `me/next-lesson.tsx` duplicates `nextStep()` in `home/continue.ts`; fold /me onto the shared one.
- Logout should accept `next=` (the wrong-account invite page needs it).
- `AuthShell`'s ignored `mode` prop is still passed by `actions/auth/{email,verify}`.
- Styleguide: an AccountMenu specimen; the quick check and lesson bar captions still describe chips.
- Callout lays out its children as blocks, so inline text breaks; Tag's `done` variant is shorter than the tags beside it.
- Lesson: on phones the check labels stack one per line; the depth tabs have no explanation; the reply area reserves empty space.
- Sign-in pane: the headline overlaps the sphere; the hero dead band.
- Course frontmatter needs a `prerequisites` field (content lane).
- New email accounts: check the handle is neutral (L3's createUser) now that L1a dropped the name field.
- A person should hand-type in the prompt composer once to confirm the keystroke fix.

- Move `readText`/`issueField` out of `login/schema.ts` into a shared module, after wave 1 merges.
- Island `fetch()` calls without an abort signal outside L3's islands.
- Hard-coded "Bits" strings outside `config.ts` that L4 lists for other lanes.
- Video and the marbles animation weren't checked: no ready video exists, and no course uses marbles.

## Lead's merge checklist (per lane)

1. Review the diff.
2. Merge into master.
3. Run `pnpm typecheck && pnpm test && pnpm remix:doctor && pnpm build`.
4. Run `pnpm preview` if the change is Worker-specific.
5. Run `pnpm db:migrate:remote` if needed.
6. Run `pnpm deploy`, then curl-check https://bits.yogan.dev (`/health`, `/`, `/courses`, `/login`).
7. Push master.
