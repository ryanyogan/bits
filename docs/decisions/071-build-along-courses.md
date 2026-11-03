# 071. Build-along courses: one Cloudflare personal agent, built from zero

Status: Proposed (2026-11-03). Waiting for the owner on the open questions in the plan.

Plan, with the lesson-by-lesson outline: `docs/plans/build-along.md`.

## Context

The four code courses (give-your-model-tools, first-agent-loop, retrieval-without-tears,
ship-an-agent-to-the-edge) teach good ideas with code a learner reads but never builds. Each course
ends in its own weather-agent variant. Nothing ties them together, and nothing is checked
end to end. The owner wants full tutorials: built locally from the first install, no prior knowledge
assumed, Cloudflare for everything, clean and verified code from popular packages, and one useful app
growing across the courses. They also want a course on building a front end by directing a coding agent
(skills + MCP), and a coming-soon MCP course.

## Decision (proposed)

1. **One app, "Pip"**: a personal agent that remembers you, saves notes and links, answers from them
   with sources, and nudges you on schedule. A small pnpm monorepo: `apps/agent` (Agents SDK
   `AIChatAgent` Durable Object, D1, Vectorize, Workflows), `apps/web` (Remix 3 on Workers, service
   binding to the agent), later `apps/mcp`, and `packages/db` (Drizzle).
2. **Stack**: Agents SDK (`agents`, `@cloudflare/ai-chat`) + AI SDK (`ai` v7) + `zod`. Claude Haiku
   5.5 is reached through AI Gateway with `createAI` from `agents/models/ai-sdk` over the `AI` binding,
   so no provider key lives in the Worker. D1 with Drizzle, Vectorize with Workers AI embeddings and
   reranker, vitest-pool-workers. MCP later via `createMcpHandler` (`McpAgent` is deprecated).
3. **Front end: Remix 3, gated** on a spike that proves Remix on Workers with one small build script
   and a streaming chat island through `agents/client`. If the spike fails, it's React + Vite.
4. **Course arc**: a new "Your first Worker" → tools → agent loop → a new "Build the front end with
   agents" → retrieval → ship → MCP (coming soon). Each course starts from the previous course's git
   tag. The four conceptual courses are unchanged.
5. **Format rule for tutorial lessons** (owner, 2026-11-03). Writers follow it and reviewers enforce it:
   - A lesson runs 10–30 minutes, reading and building together. The hard cap is 30; split anything
     longer. Conceptual courses stay at 5–8 minutes.
   - Each lesson has 3–8 steps.
   - A step adds at most **15 new or changed lines**, highlighted in place. A whole file is shown only
     when it's ≤ 30 lines and fully explained.
   - The only "here's the whole thing" exception: one full stylesheet in the Remix front-end course.
   - No "copy all of this" blocks and no unexplained lines.
   - **Every step ends with something you can see or run**: a command with its output, a visible page
     change, or a passing test.
   - Output shown in a lesson is real, recorded from the reference repo, and dated.
   - The in-app sandbox runs Claude for the prompt-shaped parts only. It never pretends to run the
     learner's local code.
6. **Verification**:
   - A public reference repo with one tag and green CI per lesson.
   - A bits check that every `:::code` block matches its file at its tag.
   - A fresh-learner agent runs each course literally from a clean directory.
   - A steel-man reviewer checks each course against the best sources and the competitor research.

## Consequences

- About 48 tutorial lessons replace or rewrite the 36 code lessons. Retired lesson slugs stop counting,
  and lessons that map keep their slugs and progress.
- The engine gains a `tag=` attribute on `:::code`, a snippets check, a `minutes` cap with a highlight
  limit for tutorial courses, a coming-soon course state, and a "start from tag" course field.
- Learners need a Cloudflare account. Claude usage goes through their own gateway (cents per course),
  with a one-line switch to a free Workers AI model.
- A Remix-on-Workers front end puts a build step in front of beginners. The spike decides whether that
  cost is acceptable.
- We now maintain a second public repo, and the dependency pins in it age. Each course's sources
  comment carries the date it was checked.

## Alternatives considered

- **Keep the courses as reading + sandbox.** It's cheaper, but it fails the owner's ask, and Cloudflare's
  own tutorials already beat it on hands-on depth.
- **A separate small project per course.** Simpler to write, but it loses the "my agent grows" payoff
  and repeats setup in every course.
- **React + Vite front end.** Official hooks, so less code, but it misses the Remix skill ask. Kept as
  the fallback.
- **`@anthropic-ai/sdk` directly in the app.** Clear, but more code than the AI SDK + Agents glue. It
  appears once, in the hand-written loop lesson.
