# Pre-release fix wave — shared implementation brief (read fully)

Context: five audits of bits are in /tmp/claude-1000/-home-ryan-code-bits/1e716cff-434b-4bcd-b0a6-4eba20d5fe6a/scratchpad/audit/
(A-public.md, B-lesson.md, C-signed-in.md, D-coached-prompts.md, E-remix.md, and BRIEF.md with the owner's
goals). Your lane brief names the findings you own. Read those sections in full, then AGENTS.md (binding), the
relevant decisions, and `.agents/skills/remix/SKILL.md`. For visual work load the `frontend-design` skill.

Owner's bar: release-ready, premium (paid courses are coming), usable and readable in light AND dark at
360 / 768 / 1024 / 1440 / 1920. Squared-grid design system (decision 047) — tokens only, no shadows/radius.
Be honest in UI copy: nothing fake, nothing that promises what the code doesn't do.

## Rules
- You work in your own git worktree (you were started in one). Commit on your branch in small, clear commits
  ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push, never deploy, never merge.
- STAY IN YOUR LANE: edit only the files your lane owns. If a fix needs another lane's file, write it under
  "Cross-lane" in your report instead. Tiny import-only touches elsewhere are OK if unavoidable — list them.
- Local state is per worktree (apps/web/.wrangler). In your worktree run: `pnpm i`, `pnpm db:migrate:local`,
  `pnpm db:seed:local` (seeds demo@bits.local and publishes content). Server: `PORT=<port> pnpm dev:restart`
  in the background. Browse at `http://<lane>.localhost:<port>` (own cookie jar — localhost ports share cookies).
  Dev sign-in codes are logged as `[mail]` in the server output.
- Chrome: one ToolSearch for the claude-in-chrome tools; tabs_context_mcp; your OWN new tab; close it when done.
  Window can't resize: check breakpoints with injected iframes (see BRIEF.md). No alert/confirm dialogs.
- Tests: add/adjust tests for behaviour you change (controller tests, e2e for enhanced client-nav paths, a11y
  e2e entries for new states). Before finishing: `pnpm typecheck`, `pnpm test`, `pnpm remix:doctor` all green
  in your worktree. If a test fails for reasons outside your lane, say so with the output.
- Record any real decision as a new docs/decisions/NNN-*.md — use the number your lane brief gives you.
- Update AGENTS.md only for lines that your change makes false (component table rows, rules) — keep edits minimal.
- Hand off at ~250k tokens: commit, write a handoff note in the scratchpad audit dir, return its path.

## Report (return to lead)
Branch name + commits, findings fixed (by id/title), findings skipped and why, what you verified and how
(breakpoints, themes, tests), Cross-lane items, anything you couldn't do (incl. denied permissions).
