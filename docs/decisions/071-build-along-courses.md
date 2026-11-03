# 071. Build-along courses: Klippy, one Cloudflare personal agent built from zero

Status: Accepted (2026-11-03)

Plan, with the lesson-by-lesson outline and phase 2 lanes: `docs/plans/build-along.md`.

## Context

The four code courses (give-your-model-tools, first-agent-loop, retrieval-without-tears,
ship-an-agent-to-the-edge) teach good ideas with code a learner reads but never builds. Each course ends
in its own weather-agent variant, nothing ties them together, and nothing is checked end to end. The owner
wants full tutorials: built locally from the first install, no prior knowledge assumed, Cloudflare for
everything, clean and verified code from popular packages, and one useful app growing across the courses.
They also want a course on building the front end by directing a coding agent with skills and MCP, and a
coming-soon MCP course.

The competitor research (`docs/research/competitors/README.md`) found that the open lane is a from-zero,
Claude-first, graded Cloudflare path. Cloudflare's own guides are hands-on but aren't a course and aren't
Claude-first. It also found that Cloudflare reshaped its Agents docs on 2026-10-29 (Lifecycle plus `.use()`
capabilities), so unpinned tutorials will break quietly.

## Decision

1. **One app, Klippy** (`klippy` in code): a personal agent that remembers you, saves notes and links,
   answers from them with sources, and nudges you on schedule. It's built in a public pnpm monorepo,
   **github.com/ryanyogan/klippy** (MIT, one git tag per lesson):
   - `apps/agent`: an Agents SDK `AIChatAgent` Durable Object, plus D1, Vectorize and Workflows.
   - `apps/web`: Remix 3 on Workers, with a service binding to the agent.
   - `apps/mcp`: later, for the MCP course.
   - `packages/db`: data-table tables and SQL migrations.
2. **Agent stack**:
   - Agents SDK (`agents`, `@cloudflare/ai-chat`), AI SDK (`ai` v7) and `zod`.
   - Claude Haiku 5.5 through **the learner's own AI Gateway, with their own Anthropic key stored there
     (BYOK)**, reached with `createAI` from `agents/models/ai-sdk`. No key ever lives in the Worker. One line
     switches to a free Workers AI model.
   - Vectorize with Workers AI embeddings and a reranker. Agent tests use vitest-pool-workers.
   - MCP later via `createMcpHandler` (`McpAgent` is deprecated).
3. **Front end: Remix 3, with no React fallback.**
   - Remix's own packages: `remix/auth` (GitHub), `remix/session`, `remix/data-table`, `remix/data-schema`
     and `clientEntry` islands.
   - Small pieces of AI Elements (Apache-2.0, notices kept) converted into Remix components.
   - Code follows the installed Remix guides and the `remix` skill. It's clean and isolated.
   - Front-end tests are skipped.
   - The course mostly teaches the prompts a learner gives Claude Code (remix, cloudflare and
     frontend-design skills; Firecrawl, Context7 and the Cloudflare docs MCPs), what to expect back, and
     how to review and steer.
   - A spike checks that an island can stream from `agents/client`. It doesn't gate the framework.
4. **One query layer**: `remix/data-table` on D1 in both Workers, through a D1 driver. The preferred
   driver is bits' own, published as a small MIT package; the fallback is a community driver that passes
   our tests.
5. **Course arc**:
   - "Your first Worker" (new, its own beginner course)
   - tools
   - agent loop
   - "Build the front end with agents" (new)
   - retrieval
   - ship
   - MCP (coming soon: remote, TypeScript, on Workers, with OAuth, graded by connecting to the learner's
     server)

   The four code courses are replaced in place, keeping slugs where a lesson maps. Retired slugs stop
   counting toward certificates. The conceptual courses are unchanged. An evals course is a future
   candidate.
6. **Format rule for tutorial lessons** (owner). Writers follow it and reviewers enforce it:
   - A lesson runs 10–30 minutes, reading and building together. The hard cap is 30; split anything
     longer. Conceptual courses stay at 5–8 minutes.
   - Each lesson has 3–8 steps.
   - A step adds at most **15 new or changed lines**, highlighted in place. A whole file is shown only
     when it's ≤ 30 lines and fully explained.
   - The only exception: one full stylesheet in the Remix front-end course.
   - No "copy all of this" blocks and no unexplained lines.
   - **Every step ends with something you can see or run.**
   - Output shown in a lesson is real, recorded from the reference repo, and dated, with pinned versions
     and a "verified on" date.
   - The in-app sandbox runs Claude for the prompt-shaped parts only. It never pretends to run the
     learner's local code.
7. **Verification**:
   - One tag and a green CI run per lesson, plus a weekly CI run of every tag against the latest
     `agents`, `@cloudflare/ai-chat`, `ai`, `wrangler` and `remix`.
   - A bits check that each `:::code` block matches its file at its tag.
   - A **checkpoint grader**: bits calls the learner's deployed Worker with a nonce. Guards: https only,
     `*.workers.dev`, no redirects, a timeout, a size cap and a rate limit. It proves a deploy and isn't
     anti-cheat.
   - A fresh-learner agent runs each course literally.
   - A steel-man reviewer checks each course against the best sources and the competitors.

## Consequences

- About 50 tutorial lessons replace or rewrite the 36 code lessons.
- The engine gains:
  - `tag=` on `:::code` and the snippets check;
  - tutorial format limits;
  - a coming-soon course state and a "start from tag" field;
  - phone/desk marking;
  - the checkpoint grader. It fetches learner-supplied URLs, so it needs a security review before it
    ships.
- bits extracts its D1 driver into a package, if S0 chooses that. The owner publishes it to npm.
- Learners need a Cloudflare account and an Anthropic key (cents per course). The free Workers AI switch
  covers anyone without one.
- Remix 3 on Workers puts an asset build step in front of beginners. Course D has Claude Code do it and
  teaches the learner to review it.
- We maintain a second public repo. The weekly latest run is how we notice Cloudflare churn.

## Alternatives considered

- **Keep the courses as reading + sandbox.** It's cheaper, but it fails the owner's ask, and Cloudflare's
  own tutorials beat it on hands-on depth.
- **A separate small project per course.** It loses the "my agent grows" payoff and repeats setup in every
  course.
- **React + Vite front end** (official chat hooks, less code). The owner chose Remix 3: it's our stack, it
  has a skill, and its packages show an agent-first framework.
- **Drizzle on D1.** Popular and D1-native, but it would be a second query layer next to Remix's
  data-table.
- **Cloudflare Access for auth.** Zero code, but `remix/auth` with GitHub teaches more, and the service
  binding closes the agent off without it.
- **`@anthropic-ai/sdk` directly in the app.** Clear, but more code than the AI SDK + Agents glue. It
  appears once, in the hand-written loop lesson.
