# Resuming a paused lane

You are resuming a fix lane that a previous agent started and that was stopped mid-work (no commits; uncommitted
WIP in the worktree). Plan: /home/ryan/code/bits/docs/plans/release-prep.md (find your lane's brief + file ownership
there). Shared rules: /home/ryan/code/bits/docs/plans/release-audit/IMPL-BRIEF.md (binding). Audit reports are in
the same folder.

- Work ONLY inside your worktree path (given in your prompt): `cd` there for every command; edit files under it with
  absolute paths inside it. Never edit /home/ryan/code/bits itself.
- First `git status` and `git diff` to see what the previous agent did. Keep what's good, fix what's half-done.
- Your branch is based on an older master; run `git merge master` first (it only adds docs/plans).
- Then finish your lane's list, commit in small commits, run typecheck/test/remix:doctor, and report per IMPL-BRIEF.
- Local state is per worktree; `pnpm i`, `pnpm db:migrate:local`, `pnpm db:seed:local` if not already done.
