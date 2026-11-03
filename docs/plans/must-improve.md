# Must improve: answers to the competitor research (2026-11-03)

Source: `docs/research/competitors/` (`mustImprove` in `data.json`). For each gap: what we ship, who builds it, and how we know it's done.
The Klippy build-along (decision 071, `docs/plans/build-along.md`) is the main answer. This plan covers the platform work around it.

| # | Gap | Our answer | Lane |
|---|---|---|---|
| 1 | Breadth and brand: Anthropic gives away 20+ h of official courses | Win on format. A signed-out visitor sees a live, graded prompt on the landing page within 30 seconds, with no key or sign-up. Certificates link to proof of work (#4). Link Claude Academy as the long-form follow-up. | F (landing), A (certificates) |
| 2 | MCP: we only teach using a server | MCP course: a remote TypeScript server on Workers (`createMcpHandler`, Streamable HTTP, OAuth). It's built by the build-along lanes and listed now as "coming soon", so the catalog needs an `access: soon` state. | B (soon state), build-along (content) |
| 3 | Evals: no course | New conceptual course on evals, using the coach and judge we already run: write test cases, write a rubric, and watch an LLM judge agree or disagree. | C |
| 4 | Proof of build: nothing checks the learner's own Worker | A `:::verify` block. The learner pastes their deployed `*.workers.dev` URL, and bits calls one path on it and checks the reply with the same `- expect` checks prompts use. The result is journalled, the save reads the journal, and a certificate links the passing deploy. Decision 072. | A |
| 5 | Freshness: Cloudflare's Agents docs churn | Lesson frontmatter gets `verified:` (a date) and `versions:` (pinned packages), shown on the lesson page. The build warns when a code lesson has no date or one older than 120 days. A weekly CI job fails on stale lessons and, once the repo exists, runs the Klippy tutorial against the latest packages. | B |
| 6 | Coding-agent workflow is taught free elsewhere | A short course, "Work with coding agents": AGENTS.md, skills, plan→build→review, subagents, hooks, MCPs. It leads into the front-end build-along course, which ships a real UI that `:::verify` checks on the deployed page. | E (course), build-along |
| 7 | Video and community | Owner decisions, below. Until then, "Down the rabbit hole" links the best free video (3Blue1Brown, Karpathy, Claude Academy). | owner |

Also from the recommendations, folded into lane B: a `device: desk` lesson flag. Build steps say "at a desk", so a phone learner knows to save them for later.

## Overlap with build-along lane X

Lane X in `docs/plans/build-along.md` is split here. A takes the checkpoint grader. B takes the coming-soon state, phone/desk marking, catalog order and a "start from tag" banner. X keeps only the `tag=` attribute on `:::code`, the snippet check and the format limits, and starts after A and B merge, because all three edit `compile/lesson.ts`.

## Lanes (worktrees, one branch each; the lead merges in order B → A → F → C → E)

| Lane | Model | Port | Owns |
|---|---|---|---|
| A proof of build (decision 072) | Opus | 44320 | new `app/verify/`, the `:::verify` block in `compile/lesson.ts` + `build.test.ts` cases, migration `0015_build_checks.sql` + `tables.ts` + a housekeeping entry, a lesson-page island in `packages/ui/src/verify-panel.tsx`, `progress/check.ts` (journal read), certificate proof link, `RL_VERIFY` (2008/3008), privacy text |
| B freshness, desk, soon, catalog order, start-from-tag (decision 073) | Opus | 44321 | `compile/frontmatter.ts`, `compile/course.ts`, lesson frontmatter handling in `compile/lesson.ts`, the lesson and course page meta strip, catalog/course card "Coming soon", sitemap, `.github/workflows/freshness.yml`, `scripts/content.ts` (`--max-age`) |
| C evals course | fork | 44322 | `content/courses/evals-that-matter/` only |
| E coding-agent course | fork | 44323 | `content/courses/work-with-coding-agents/` only |
| F landing try-it | Opus | 44324 | `app/actions/home/**` and the landing's composer wiring |

Each lane follows `AGENTS.md`, adds tests, runs `pnpm test`, `pnpm typecheck` and `pnpm remix:doctor`, commits on its branch, and reports what it verified.

## Owner decisions still open

- **Community.** Recommended: turn on GitHub Discussions for `ryanyogan/bits` and link it in the footer and in each lesson's "Stuck?". It's free, needs no moderation tooling, and is searchable. Discord needs moderators.
- **Video.** Recommended: no recorded video for now; link the best free video instead. If the owner records short screencasts of the Klippy build steps, the player and R2 upload are already built (decision 029).
