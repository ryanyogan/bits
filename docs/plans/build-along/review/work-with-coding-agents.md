# Steel-man review: Work with coding agents (2026-11-03)

Reviewer: lane V (fork). This review read all 7 lessons and `course.md` twice: once as a senior engineer who uses Claude Code every day, and once as a newcomer on a phone. It checks them against AGENTS.md "Why bits exists".

Every Claude Code fact was re-checked today against code.claude.com, using Firecrawl with `maxAge: 0`. The `claude mcp add` syntax was also checked with the local CLI, `claude mcp add --help` on v2.1.317.

## Verdict

The course is strong: one clear arc, a coached exercise in every lesson, Claude first, sources credited in our own words, and illustrative toys labelled. It had two factual errors that a daily user would catch, plus some framing the current best-practices page now calls outdated. All are fixed below.

## Findings

| # | Severity | Lesson | Finding | Fix (status) |
|---|---|---|---|---|
| 1 | must-fix | 04 engineer | Said frontmatter can "restrict tools (`allowed-tools`)". The skills reference says `allowed-tools` lists tools Claude can use *without asking* during the turn that invokes the skill. It pre-approves tools; it doesn't restrict them. That's a security-relevant inversion. | Reworded: it grants, it doesn't restrict. Also corrected the turn-scoped `model`, and said `name` is optional (it defaults to the folder name). **Fixed.** |
| 2 | must-fix | 05 engineer | The stdio syntax `claude mcp add --env KEY=value <name> -- <command>` fails. `--env` is variadic, so it reads the name as another pair (docs: "the CLI reads the name as another pair and rejects it"). The CLI help shows `claude mcp add my-server -e API_KEY=xxx -- npx my-mcp-server`. | Changed to `claude mcp add <name> --env KEY=value -- <command> [args...]`, with one sentence on why the name goes first. **Fixed.** |
| 3 | should-fix | 06 | Pitched subagents as a way to save context ("without filling your main session", "context isolation"). Best practices' "What you can stop doing" now says that's rarely the reason (1M windows, automatic compaction). Subagents are for parallel work, noisy output and independent review. They cost extra tokens and don't improve the same answer. | Rewrote the newcomer list and the engineer paragraph to match, including the cost note. **Fixed.** |
| 4 | should-fix | 06, 07 | Hooks were taught as the only way to enforce a "never" rule. The docs pair them with **deny rules** (`permissions.deny`), the no-script option for "never run this command". | Added a deny-rule line with `"deny": ["Bash(npm *)"]` (syntax checked on the permissions page), plus a note in the quiz answer. Lesson 07 now says "a hook or a deny rule". **Fixed.** |
| 5 | should-fix | 02 | The closing aside said "delete the pnpm line and ask again", but `pnpm test` is on another line, so nothing changes. The experiment taught nothing. | Now: "delete the `pnpm test` line … What does Claude have to guess?" **Fixed.** |
| 6 | should-fix | 01, 04, 05, 06 | Code lessons had no `verified:` date (decision 073 warning). | Added `verified: 2026-11-03` and `versions: claude-code: "2.1.317"` after the commands were re-checked. Validate now reports 0 warnings. **Fixed.** |
| 7 | nice | 06 | Two ideas in one lesson (subagents and hooks), against "one idea per lesson". The title says so and it fits 8 minutes, but a split would be cleaner. | Left. A candidate split when the course grows: "Subagents" / "Rules that always run". |
| 8 | nice | 01, 06 | Some `expect` regexes are loose: lesson 1 matches `first`, and lesson 6 matches a bare `7`. The `must` rubrics carry the real grading, so no lazy pass gets through on the reply alone. | Left. Worth tightening once the coach eval runs on this course. |
| 9 | nice | 02 | The rubric "every line is something the agent couldn't see" judges the whole prompt, which includes the closing question. A strict judge could flag the question line. | Left. Watch it in the coach eval. |

## Verified today (2026-11-03, code.claude.com unless noted)

- Install: `curl -fsSL https://claude.ai/install.sh | bash` and `irm https://claude.ai/install.ps1 | iex`. It needs a Pro, Max, Ultra, Team, Enterprise or Console account; the free plan is excluded (setup).
- Default mode asks before most edits, shell commands and network access. Plan mode: `Shift+Tab`, `/plan` for a single prompt, or `claude --permission-mode plan`. Claude reads, explores and writes a plan, but doesn't edit source (permission-modes).
- CLAUDE.md locations: managed policy, `~/.claude/CLAUDE.md`, `./CLAUDE.md` or `./.claude/CLAUDE.md`, and `./CLAUDE.local.md`. AGENTS.md is read only when there's no CLAUDE.md or CLAUDE.local.md, from v2.1.277. Keep it under 200 lines; `/init` and `@path` imports exist (memory).
- Skills: the `name`, `description`, `when_to_use`, `allowed-tools`, `model` and `disable-model-invocation` rows; the 1,536-character listing cap; `/code-review` is a bundled skill (skills, commands).
- MCP: `--transport http`. Scopes are local (the default, in `~/.claude.json`), project (`.mcp.json`) and user (`~/.claude.json`). Rules for `--` and `--env` (mcp, CLI help).
- Context7: `https://mcp.context7.com/mcp`. Firecrawl: `https://mcp.firecrawl.dev/v2/mcp-oauth`, signed in through `/mcp` (each vendor's docs).
- Cloudflare: `/plugin marketplace add cloudflare/skills` then `/plugin install cloudflare@cloudflare` (developers.cloudflare.com/agent-setup/claude-code).
- Subagents: `.claude/agents/` and `~/.claude/agents/`. Only `name` and `description` are required. Each has its own context window and returns a summary; you can @-mention one (sub-agents).
- Hooks: the Prettier `PostToolUse` example matches verbatim. Exit 2 blocks the action, and on `Stop` keeps Claude working; exit 0 is success (hooks-guide, hooks).
- Claude Code 101 teaches Explore → Plan → Code → Commit (academy.claude.com, lesson 5).

## Checked and fine

- Every exercise can be passed by its reference, and the drafts fail the `check` lines.
- No rubric quotes material pasted into the prompt, so `grounded` flags aren't needed (the build gives no warning).
- Toys and compares are marked illustrative. Install access is stated honestly, and the exercises run free in the sandbox.
- The writing is our own; ideas from AI Hero and Anthropic are credited in source comments and rabbit holes.
- On a phone, every lesson works with no install needed, so `device: desk` isn't needed.
