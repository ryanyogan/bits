# Build-along courses: plan (2026-11-03, accepted)

Status: **accepted** (owner answers 2026-11-03). Decision record: `docs/decisions/071-build-along-courses.md`.
Phase 2 (§7) has not started.

The owner's ask: turn the code courses into full tutorials. Each one builds something real on your own
machine, starting from the first `npm` install and assuming no prior knowledge. Everything runs on
Cloudflare, with clean, checked code from popular packages that fit together. Together the courses build
one small app, a personal agent called **Klippy**, feature by feature. One course builds the front end by
directing a coding agent with skills and MCP. An MCP course is stubbed as "coming soon".

APIs and versions below were checked on 2026-11-03 against Cloudflare's docs (Firecrawl, `maxAge: 0`),
`npm view` and the installed Remix 3.1 docs. The reference-repo lane re-checks them on the day it pins
versions.

---

## 1. The app: Klippy

Klippy (lowercase `klippy` in code) is a personal agent that remembers you, saves what you send it
(notes, links, files), answers from it with sources, and nudges you on schedule. It's one agent per
person, a Durable Object, reached first from a terminal, then from a Remix web app, and later from Claude
through MCP.

| After course | Klippy can… |
|---|---|
| Your first Worker | answer one question with Claude, over HTTP, deployed |
| Give your model tools | check the weather, tell the time, save and list notes (D1), read a link |
| Your first agent loop | hold a conversation, remember facts about you, ask before it writes, nudge you at a set time |
| Build the front end with agents | do all of that in a Remix web app with GitHub sign-in, built by prompting Claude Code |
| Retrieval without tears | answer from your saved notes and links, with sources, and say when it doesn't know |
| Ship an agent to the edge | run as your private, rate-limited, logged, tested app on your own domain |
| MCP (coming soon) | be used from Claude (Klippy as a remote MCP server with OAuth) and use other MCP servers |

The weather tool stays as the first tool (Open-Meteo: free, no key), so today's weather lessons carry over.

Other concepts considered: a trip planner (needs third-party place APIs, and RAG feels forced) and a
kitchen agent (thin on tools). Klippy won because every Cloudflare product earns its place: DO for one
Klippy per person, D1 for notes, Vectorize for recall, Workflows for ingest, alarms for nudges, and service
bindings to lock the door.

### Where this leaves us against the field

From `docs/research/competitors/README.md` (complete, 2026-11-03):
- **The open lane** is a from-zero, Claude-first, graded Cloudflare path. Cloudflare's own guides are
  hands-on but aren't a course: there's no sequence from zero, no checks and no feedback, and they're
  Workers AI or OpenAI first. Nobody free goes from `npm create` to a deployed Claude agent and then
  **verifies** it. So the plan adds a checkpoint grader that calls the learner's deployed Worker (§5).
- **Churn is real.** On 2026-10-29 Cloudflare reshaped the Agents docs. The quick start was rewritten,
  and the runtime is now explained as a Lifecycle plus capabilities added with `.use()`. We pin every
  version, put a "verified on" date in each code lesson, and run the tutorial weekly in CI against the
  latest releases (§5). Lessons use the docs' current framing (Lifecycle, capabilities). The reference lane
  re-reads those pages on pin day.
- **MCP is our weakest topic in the most crowded category.** Our angle is remote, TypeScript, on
  Workers, with OAuth. It's graded by connecting to the learner's deployed server and calling a tool.
- **Coding-agent courses are crowded.** Course D doesn't teach skills theory, which Anthropic and Hugging
  Face cover and we link. It teaches good prompts and review while building a real, deployed UI.
- **Evals are a gap** that Kaggle, DLAI, OpenAI Academy and Maven all cover. An evals course is a
  **future candidate**, built on the coach and judge bits already runs (§3, H). It's not in this phase.

---

## 2. Stack

Rule: use the fewest, most popular packages that already fit together. Prefer Cloudflare's glue on the
agent side and Remix's own packages on the web side.

| Need | Choice | Version (2026-11-03) | Why |
|---|---|---|---|
| Package manager, monorepo | pnpm workspaces | pnpm 10 (via `corepack`) | Same as bits; no extra monorepo tool. |
| Scaffold | `create-cloudflare` | 2.74.8 | `pnpm create cloudflare@latest` is the official first command. |
| Runtime, CLI | Workers, `wrangler` | 4.157.0 | |
| Agent, per-user state | `agents` (Agents SDK) | 0.33.0 | One agent = one Durable Object with SQLite, scheduling, WebSockets, routing. |
| Chat agent | `@cloudflare/ai-chat` | 0.12.2 | `AIChatAgent`: message persistence, resumable streams, tool approval (`needsApproval`). Peers: `ai` ^6 or ^7, `agents` <1. |
| Model calls | `ai` (AI SDK) | 7.0.162 | `streamText`, `tool()`, `stopWhen: stepCountIs(n)`; what the Agents docs use. |
| Claude through AI Gateway | `createAI` from `agents/models/ai-sdk` + the `AI` binding | (in `agents`) | `createAI({ binding: env.AI, id: "klippy" })` then `ai("anthropic/claude-haiku-5.5")`. **The learner's own Anthropic key is stored in their own gateway (BYOK)**, never in the Worker. One-line switch to a free Workers AI model. `ai-gateway-provider` is deprecated. |
| Tool schemas | `zod` | 4.6.7 | Peer of `agents`. |
| Ready-made tools | `agents/webfetch/ai-sdk`, `agents/websearch/ai-sdk` | (in `agents`) | Read a link as Markdown, or search the web, through the `AI` binding. |
| Database layer | **`remix/data-table`** on D1, in both Workers | `remix` 3.1.0 | One query layer from Remix (the owner's choice). D1 needs a driver: §2.2. |
| Vector store | Vectorize + Workers AI embeddings | `@cf/baai/bge-base-en-v1.5` (768 dims, cosine) | The model in Cloudflare's Vectorize tutorial; the lane re-checks for a newer default. |
| Reranker | Workers AI `@cf/baai/bge-reranker-base` | | No extra service. |
| Ingest | Cloudflare Workflows (`AgentWorkflow`) | (in `agents`) | Durable steps for fetch → chunk → contextualise → embed. |
| Front end | **Remix 3** on Workers | 3.1.0 | The owner's choice, no React fallback. Uses Remix's own `remix/auth` (GitHub), `remix/session` with cookie storage, `remix/data-schema`, `remix/data-table`, and `remix/component` islands. |
| Chat UI pieces | Small parts of **AI Elements** (Apache-2.0), converted into Remix components | ai-elements 1.9.1 (reference only) | Message, conversation, prompt input, tool card and sources, rebuilt as Remix components with plain CSS. Keep the Apache-2.0 notice and credit in the ported files. |
| Client connection | `agents/client` (`AgentClient`) | (in `agents`) | Framework-free WebSocket client, used by the terminal chat and the Remix chat island. |
| Tests | `vitest` + `@cloudflare/vitest-pool-workers` | **vitest 4.1.x** (pool 0.23.0 peers `^4.1`; vitest 5 is out but unsupported) | Agent tests run inside the real Workers runtime. **Front-end tests are skipped** (owner). |
| MCP (coming soon) | `createMcpHandler` from `agents/mcp/server` + `@modelcontextprotocol/server` v2 | 2.4.0 (pinned by `agents`) | `McpAgent` is deprecated. The handler is stateless, so no Durable Object is needed. |

Not used: React, Drizzle, Hono, LangChain, Cloudflare Access, and `@anthropic-ai/sdk` in the app. The SDK
appears once, in the "write the loop by hand" lesson, so learners see what `streamText` does for them.

### 2.1 Monorepo layout (end state)

Public repo: **github.com/ryanyogan/klippy**, MIT, one git tag per lesson.

```
klippy/
  package.json            scripts: dev, test, typecheck, deploy, chat
  pnpm-workspace.yaml
  apps/agent/             Worker: Klippy (AIChatAgent DO), ingest Workflow; D1, Vectorize, AI, rate limits.
                          No public route: reachable only through the web app's service binding (course F)
  apps/web/               Worker: Remix 3 front end, GitHub sign-in, notes pages, chat island;
                          service binding AGENT → apps/agent
  apps/mcp/               Worker (MCP course): createMcpHandler over the same D1
  packages/db/            data-table table() definitions + SQL migrations (wrangler d1 migrations), shared
  scripts/chat.ts         terminal chat client (agents/client), `pnpm chat`
  .github/workflows/      ci.yml (per push), latest.yml (weekly, against the latest releases)
```

Why two stores: **Durable Object SQLite** holds one person's conversation, memory and schedule (fast,
private, one writer). **D1** holds data that other parts read: notes, sources and usage, read by the web
app, the MCP server and the ingest Workflow. A lesson says this out loud, with the rule of thumb.

### 2.2 data-table on D1

`remix/data-table` ships SQLite, Postgres and MySQL drivers, but none for D1 (decision 003). bits has a
tested D1 driver of its own (`packages/db/src/d1/`, about 700 lines, with a vendored compiler), and two
small community drivers exist on npm (`@sdxc/data-table-d1`, `@pitlane/data-table-d1`). A course can't
vendor 700 lines. Spike S0 picks one:
- **Preferred:** publish bits' driver as its own small MIT package from this repo (lane P), so the lesson
  is one `pnpm add`. The owner runs `npm publish`.
- Otherwise: a community driver that passes our driver's test suite against Miniflare.

---

## 3. Course arc

Catalog order (conceptual courses unchanged and first): what-is-an-llm → tokens-and-temperature →
prompting-that-works → context-is-everything → **A** your-first-worker (new, its own beginner course) →
**B** give-your-model-tools → **C** first-agent-loop → **D** build-the-front-end-with-agents (new) →
**E** retrieval-without-tears → **F** ship-an-agent-to-the-edge → **G** mcp (coming soon).

The four existing code courses are **replaced in place**, keeping slugs where a lesson maps. Each course
starts from the previous course's final tag, and its first lesson says how to get it
(`git clone https://github.com/ryanyogan/klippy && git checkout b-09`).

Columns: **Builds** = what exists at the end; **Touches** = commands and files; **Concept**; **Source** =
the "Down the rabbit hole" link to lead with.

### A. Your first Worker (new, beginner, 5 lessons)

| # | Title | Builds | Touches | Concept | Source |
|---|---|---|---|---|---|
| A1 | Your workbench | Node 22 LTS, pnpm, an editor, a terminal you're not scared of | `node -v`, `corepack enable`, `pnpm -v` | What a runtime, a package manager and a terminal are | nodejs.org download; pnpm.io installation |
| A2 | Make the monorepo | `klippy/` with a workspace and an empty `apps/agent` Worker | `git init`, `pnpm-workspace.yaml`, `pnpm create cloudflare@latest apps/agent --type=hello-world --lang=ts` | Workspaces; what c3 generated, file by file | Workers get started |
| A3 | Hello, Worker | A Worker on localhost, and its first test | `pnpm dev`, `src/index.ts`, `wrangler types`, `test/index.spec.ts`, `pnpm test` | Request in, Response out; tests run in the real runtime | How Workers works; vitest-pool-workers |
| A4 | Your first call to Claude | `POST /ask` answers with Claude Haiku 5.5 through your AI Gateway | Dashboard: create gateway `klippy`, store your Anthropic key (BYOK); `ai` binding; `pnpm add agents ai @ai-sdk/provider`; `createAI`, `generateText`; `curl` | Bindings; why no key lives in the Worker; **the one-line switch to a free Workers AI model** | AI Gateway: Vercel AI SDK, BYOK; Claude models overview |
| A5 | Checkpoint: ship it | Klippy v0 live on `*.workers.dev`, logs and traces on; **graded**: bits calls your Worker | `wrangler login`, `pnpm deploy`, `observability`, `wrangler tail`, `/klippy/check` | Deploys, versions, rollback; compatibility date | Workers best practices |

### B. Give your model tools (replaced in place, 10 → 9 lessons)

| # | Title | Builds | Touches | Concept | Source | From today |
|---|---|---|---|---|---|---|
| B1 | Why models need tools | (sandbox) | prompt + compare | Claude asks, your code acts | Anthropic tool use overview | keeps 01 |
| B2 | Your first tool: the weather | `getWeather` (Open-Meteo) on `/ask` | `src/tools/weather.ts`, `tool({ description, inputSchema, execute })`, `stopWhen: stepCountIs(2)` | name + description + schema | AI SDK tool calling; Anthropic define tools | merges 02 + 03 |
| B3 | Watch one round trip | A log of each step | `onStepFinish`, `wrangler dev` output | tool_use → tool_result, run for you | Anthropic how tool use works | 03's idea in real logs |
| B4 | Descriptions Claude follows | Better descriptions, plus a test that "what's 2+2?" calls no tool | in-app prompt; `test/tools.spec.ts`, stubbed gateway | Descriptions are prompts | Anthropic, Writing effective tools for agents | keeps 04 |
| B5 | Klippy keeps notes | `saveNote` / `listNotes` over D1 with data-table | `wrangler d1 create klippy-db`, `packages/db` (`table()`), `migrations/0001_notes.sql`, `wrangler d1 migrations apply --local` | Your first database; migrations; tools that write | D1 get started; Remix data-table README | new |
| B6 | Choosing when Claude calls | `toolChoice` per route | `toolChoice` | auto / any / tool / none | Anthropic tool_choice | keeps 05 |
| B7 | Strict inputs, honest failures | Zod refinements; a failed fetch is an error result | tool errors, `strict` | Schemas guard inputs; errors are results | Anthropic strict tool use; tool errors | merges 06 + 07 |
| B8 | Read a link | `readLink` via `webFetchTool({ binding: env.AI })` | one import | Reuse a ready tool; fetched pages are untrusted | Agents webfetch docs | replaces 08 |
| B9 | Checkpoint: Klippy with tools | Weather, time, notes, links over `curl`; tests green; deployed; graded | `pnpm test`, `pnpm deploy`, `d1 migrations apply --remote` | — | — | replaces 10 |
| — | *MCP: tools you can share* | | | | | **moves** to G |

### C. Your first agent loop (replaced in place, 9 lessons)

| # | Title | Builds | Touches | Concept | Source | From today |
|---|---|---|---|---|---|---|
| C1 | Agents are loops | (sandbox) | prompt + compare | plan → act → observe | Anthropic, Building effective agents | keeps 01 |
| C2 | Write the loop by hand, once | A 30-line loop in `scripts/loop.ts` with `@anthropic-ai/sdk`, then deleted | `pnpm add -D @anthropic-ai/sdk tsx` | What `stopWhen` does for you; `stop_reason` | Anthropic Messages API | merges 02–04 |
| C3 | One Klippy per person | `Klippy extends AIChatAgent` | `durable_objects` + `migrations` (`new_sqlite_classes`), `routeAgentRequest`, `onChatMessage` | Durable Objects, in the docs' Lifecycle framing; why a global array is a bug | Agents chat agents; Lifecycle; DO overview | moves from ship 03 |
| C4 | Talk to Klippy from your terminal | `pnpm chat`: a streaming REPL | `scripts/chat.ts`, `agents/client` | WebSockets; resumable streams | Agents client SDK | new |
| C5 | Klippy remembers you | `remember` / `forget`; facts in agent SQL, in the system prompt | `this.sql`, `system:` per turn | Short vs long-term memory | Anthropic, Effective context engineering | rewrites 07 |
| C6 | Ask before you write | `saveNote` needs approval (y/n in the terminal) | `needsApproval` | Human in the loop | Agents human-in-the-loop | new |
| C7 | When loops go wrong | Step cap, repeat-call guard, a stuck-loop test | `stepCountIs(8)`, `prepareStep` | Runaway loops, cost | Anthropic agents post | keeps 06 |
| C8 | Klippy nudges you | "Remind me at 6pm to call Sam" → `schedule()`, then a server-driven turn | `schedule()`, `saveMessages` | Agents that act unasked | Agents schedule tasks; server-driven messages | new |
| C9 | Checkpoint: Klippy, the agent | Memory, approvals, nudges; deployed; graded | — | — | — | replaces 09 |
| — | *Limits and logs* | | | | | **moves** to F |

### D. Build the front end with agents (new, 11 lessons)

**What it teaches:** the prompts a learner gives Claude Code to build a Remix front end, what to expect
back, and how to review and steer the result. Claude Code runs with the `remix`, `cloudflare` and
`frontend-design` skills plus the Firecrawl and Context7 MCPs (and Cloudflare's docs MCP,
`https://agents.cloudflare.com/mcp`). Code appears only where understanding needs it: the service
binding, the session-to-agent naming, and the island's stream loop.

**Lesson shape (D only):** goal → **the prompt** (copyable, with why each line is there) → what to expect
(files it should touch, our recorded run, dated) → **review checklist** (what to read in the diff, what
to reject) → **steer prompts** for the two or three usual misses → see it running. Prompt-writing parts
can be coached `:::prompt` exercises in the sandbox, which grade the brief, not the build.

**Code bar:** clean, isolated code that follows the installed Remix guides (`node_modules/remix/INDEX.md`
→ guides → package READMEs) and the `remix` skill: routes in `routes.ts`, controllers per area, native
forms, `data-schema` validation, middleware for session and auth. **No front-end tests** (owner).

| # | Title | The learner prompts for… / builds | Concept | Source |
|---|---|---|---|---|
| D1 | Your coding agent | Install Claude Code; write `klippy/AGENTS.md` together with it | Context files: what the agent reads first | Claude Code docs: memory, best practices |
| D2 | Skills: teach it your stack | Install the remix, cloudflare and frontend-design skills; ask it to explain what each changes | Skills over memory; read installed docs first | Anthropic Agent Skills; `cloudflare/skills`; `anthropics/skills` |
| D3 | Tools for your agent: MCP | Connect Firecrawl, Context7 and the Cloudflare docs MCP | MCP from the user's side; keep tool access small | Claude Code MCP docs; Firecrawl MCP |
| D4 | Write the brief | `docs/ui-brief.md`: screens, states, tokens, accessibility bar, Firecrawl-gathered references; plan mode | Briefs beat vibes; plan before code | Anthropic, Claude Code best practices |
| D5 | The Remix shell on Workers | `apps/web`: `remix new`, then onto Workers with static assets; service binding `AGENT`; layout and **the one full stylesheet** | Server-first pages; service bindings | Remix guides 01, 03, 11; service bindings docs |
| D6 | Sign in with GitHub | `remix/auth` GitHub provider, `remix/session` cookie storage, `remix/middleware/auth`; the session names the agent instance | Auth from the framework, not hand-rolled; choose the agent instance on the server | Remix guide 10; `remix/auth` README |
| D7 | Your notes, as pages | List, search and delete notes from D1 with `remix/data-table`; native forms with `data-schema` | One query layer shared with the agent | Remix guides 08–09; data-table README |
| D8 | Borrow from AI Elements | Convert message, conversation, prompt input, tool card and sources into Remix components + CSS, keeping the Apache-2.0 notice | Reuse popular pieces, adapted to your framework | AI Elements docs; Remix guide 04 |
| D9 | The chat island | A `clientEntry` island streaming from the agent via `agents/client` (the S0 pattern); approve/deny buttons | Islands; what streams, what renders on the server | Remix guide 05; Agents client SDK |
| D10 | Review and steer | Read the diff with the agent; `pnpm typecheck`, `remix doctor`; ask for a refactor where code isn't isolated | Never merge unread code | Anthropic, Claude Code best practices |
| D11 | Checkpoint: Klippy on the web | Both Workers deployed; graded (bits calls your web app's check route) | — | — |

Honesty rule for D: the agent's output differs from run to run. Lessons show **our** recorded run
(dated), give the reference result at the tag, and teach the learner to judge theirs. They never promise
identical output.

### E. Retrieval without tears (replaced in place, 9 lessons)

| # | Title | Builds | Touches | Concept | Source | From today |
|---|---|---|---|---|---|---|
| E1 | Paste it or search it? | (sandbox) | prompt | Long context vs retrieval; caching first | Anthropic long-context tips | keeps 01 |
| E2 | Ingest with a Workflow | Saving a link starts `IngestWorkflow`: fetch → Markdown → store | `AgentWorkflow`, `step.do`, `workflows` binding; `env.AI.toMarkdown` | Durable steps; retries | Workflows docs; Agents run workflows | new |
| E3 | Chunking | Chunks in D1 with source id and position | `chunk.ts` (~20 lines) | Size, overlap, structure | Anthropic, Contextual retrieval | keeps 02 |
| E4 | Embeddings into Vectorize | Chunks embedded and upserted with per-user metadata | `wrangler vectorize create klippy-notes --dimensions=768 --metric=cosine`, metadata index, remote binding in dev | Vectors, cosine, filters; when **AI Search** (managed) is the better call | Vectorize get started; 3Blue1Brown | keeps 03 |
| E5 | Keywords too: hybrid | D1 FTS5 + Vectorize, merged by reciprocal rank fusion | FTS5 migration, `rrf.ts` | Why hybrid wins | Anthropic, Contextual retrieval | keeps 04 |
| E6 | Contextual retrieval | Haiku adds one line of context per chunk at ingest, with prompt caching | Workflow step | Chunks that carry context | Anthropic, Contextual retrieval | keeps 05 |
| E7 | Rerank, then answer with sources | `searchNotes`: hybrid → rerank → top 5; Klippy cites; the UI shows sources | reranker; search-result blocks / citations | Precision at the top; citations | Anthropic citations docs | merges 06 + 07 |
| E8 | Measure it | `pnpm eval:retrieval`: recall@5 on 12 of your questions | a vitest file | Measure before tuning | Anthropic, Demystifying evals | keeps 08 |
| E9 | Checkpoint: ask my notes | Answers from notes and links; "not in your notes" when they don't cover it; graded | — | — | replaces 09 |

### F. Ship an agent to the edge (replaced in place, 8 lessons)

| # | Title | Builds | Touches | Concept | Source | From today |
|---|---|---|---|---|---|---|
| F1 | Close the side door | `apps/agent` has no public route; only the web app's service binding reaches it, with the signed-in user's id | `workers_dev: false`, service binding, `getAgentByName` from the session | The instance comes from the server, never the client | Service bindings; Agents routing | new |
| F2 | The gateway earns its keep | Caching, logs, a fallback model, spend alerts | `createAI({ cacheTtl, metadata })`, `fallback` | Cost control at the gateway | AI Gateway docs | rewrites 04 |
| F3 | Limits that hold | A rate-limit binding per user, plus a daily token budget in agent state | `ratelimits`, `onFinish` usage | Limits on the server, before the call | Workers Rate Limiting | rewrites 05 |
| F4 | Logs you can query | Structured JSON per turn; traces; a saved query | Workers Logs query builder | Log the shape, never the secrets | Workers Logs; traces | rewrites 06 |
| F5 | Safety at the edge | Saved links are untrusted (wrapped, never obeyed); writes need approval; an injection test | webfetch wrapper, a poisoned-page test | Prompt injection through retrieval | Anthropic prompt-injection guidance; OWASP LLM top 10 | rewrites 07 |
| F6 | Tests and CI | GitHub Actions: typecheck, test, deploy on main | `ci.yml`, `cloudflare/wrangler-action`, secrets | Deploys you trust | wrangler-action; vitest-pool-workers | new |
| F7 | Your own domain, previews | A custom domain; preview URLs per PR | custom domain; Workers previews | Environments | Workers custom domains; previews | new |
| F8 | Checkpoint: Klippy in production | Everything live; graded | — | — | replaces 08 |
| — | *Stream the reply* | | | | | **goes** (AIChatAgent streams; C4) |
| — | *One agent per user* | | | | | **moves** to C3 |

### G. MCP (coming soon, outline only)

`course.md` only, marked coming soon (engine, §7). The angle: **remote, TypeScript, on Workers, with
OAuth, graded by connecting to the learner's deployed server.** Planned lessons:
1. What MCP is.
2. Klippy as a remote MCP server: `apps/mcp`, `createMcpHandler`, Streamable HTTP, tools over the D1 notes.
3. Test with MCP Inspector and Claude.
4. Lock it with OAuth (`@cloudflare/workers-oauth-provider`, scoped tokens).
5. MCP security: tool poisoning, confused deputy.
6. Klippy as an MCP client (`addMcpServer`).
7. Checkpoint: bits connects to your deployed server, lists its tools and calls one.

It links Anthropic's and DLAI's Python MCP courses for anyone who wants the long version.

### H. Evals (future candidate, not planned in this phase)

A short course built on the coach and judge bits already runs. Learners write cases and a rubric for
Klippy, then see where their judge agrees or disagrees with ours. It links the Maven AI Evals cohort and
Kaggle's *Agent Quality* for the deep end.

### What happens to today's lessons

| Course | Stay (reframed) | Change | Go / move |
|---|---|---|---|
| give-your-model-tools | 01, 04, 05 | 02+03, 06+07 merge; 08 → "read a link"; 10 → B9 | 09 MCP → G |
| first-agent-loop | 01, 06 | 02–04 → C2, 07 → C5, 09 → C9 | 08 → F |
| retrieval-without-tears | 01–05, 08 | 06+07 merge, 09 → E9 | — |
| ship-an-agent-to-the-edge | — | 04–07 rewritten, 08 → F8 | 01–02 go; 03 → C3 |

Lessons whose slug survives keep their progress. Retired slugs drop from their course and stop counting
toward certificates.

---

## 4. Format: the rule for tutorial lessons

From the owner (2026-11-03): build-along lessons don't have to be 5–8 minutes. Learners code while they
read, with the snippets in front of them. Code arrives in small steps, each shown and explained. The four
conceptual courses keep the short format.

**Writers follow this, and reviewers fail a lesson that breaks it.**

| Rule | Limit |
|---|---|
| Lesson length (courses A–G) | 10–30 minutes, read and build together. Hard cap: 30. Over that, split the lesson. Frontmatter `minutes` is the honest total. |
| Lesson length (conceptual courses) | 5–8 minutes, unchanged. |
| Steps per lesson | 3–8. |
| Largest new snippet per step | **15 new or changed lines**, highlighted (`highlight=`) inside the file. Unchanged context lines around them don't count, up to 30 lines shown. |
| A whole file in one step | Only when it's ≤ 30 lines and every line is explained in that step, or it's generated config the lesson walks through. |
| The one exception | Course D (D5) may give one full stylesheet in one go, labelled as such. Nothing else. |
| Course D | Mostly prompts. A prompt block is the step's "snippet": it states the goal and constraints and names the skill or MCP to use, with why each line is there. The code bar above still applies to any code shown. |
| Never | A "copy all of this" block; an unexplained line; a step that changes two files without saying why both. |
| Every step ends with something you can see or run | A command and its output, a page that visibly changed, or a test that turns green. |
| Recorded output | Shown in `OutputPanel` (recorded output, a Replay key, never "Run"). It's real output from the reference repo, dated in the lesson's sources comment. Never invented. |
| Versions | Each code lesson states the pinned versions it was verified with and the date ("verified on"). |
| Step shape | Why (1–3 sentences) → snippet or prompt → what the important lines do → run it → what you should see → if it didn't work (the 1–2 likely mistakes). |
| Lesson ends | With the tag (`git checkout c-05`) and a link to the diff, so a stuck learner catches up. |
| Checkpoint lesson per course | Joins the parts, deploys, is graded by bits calling the deployment (§5), and ends with a quick check of the course's ideas. |
| Phone or desk | Build lessons are marked "at a desk". Conceptual and sandbox lessons work on a phone. |

**What the in-app sandbox does in these courses** (honest split):
- It **does** run Claude for the prompt-shaped parts: tool descriptions, system prompts, the course D
  brief and prompts, judging retrieval answers. These stay coached `:::prompt` exercises.
- It **does not** run the learner's local code. The learner runs it on their own machine. Lessons show our
  recorded output and say plainly that it's ours.
- Quick checks (`:::ask`) test what the step taught, never "paste your terminal output". Proof of the build
  comes from the checkpoint grader instead.

---

## 5. Verification

| Layer | How |
|---|---|
| Reference repo | Public **github.com/ryanyogan/klippy** (MIT). Built forward, one commit and one tag per lesson (`a-01` … `f-08`). Each tag has a green CI run. |
| CI per push | `pnpm i --frozen-lockfile`, `pnpm typecheck`, `pnpm test` (agent tests in vitest-pool-workers, model calls stubbed; no front-end tests), `wrangler deploy --dry-run` for each app. |
| Weekly against latest | `latest.yml`, a scheduled job, bumps `agents`, `@cloudflare/ai-chat`, `ai`, `wrangler` and `remix` to their latest versions, then replays every tag's checks. It opens an issue on failure, so we hear about Cloudflare churn before learners do. |
| Live proof | The reference agent runs each step against real Cloudflare and Claude (owner's gateway, BYOK) and saves the output the lessons show, dated. |
| Snippets match the repo | A bits check, `pnpm content snippets <course> --repo ../klippy`: every `:::code` with `file=` and `tag=` must match that file at that tag. It runs in bits CI against a pinned commit. |
| Checkpoint grader | Each course's checkpoint asks for the learner's deployed URL. bits calls `GET /klippy/check?nonce=…`, which returns the nonce, the tag the app is at, and a probe answer. The MCP course instead connects as an MCP client, lists tools and calls one. Guards: `https` only; hosts on `*.workers.dev` (custom domains later); no redirects; 5 s timeout; 16 KiB cap; rate limited; journalled like the coach. It proves a deploy, and it isn't anti-cheat, so the lesson says so. |
| Fresh-learner run | Per course, an Opus agent with no repo context follows the lessons literally in a clean directory. It logs every place it got stuck, guessed, or needed knowledge the lesson hadn't given. A course doesn't ship with an unresolved "stuck". |
| Steel-man review | Per course, a fork reviewer argues the strongest case against the course. It compares with the best sources and with `docs/research/competitors/README.md`: what's wrong or outdated, what competitors teach that we skip, and which line could be cut. Findings get fixed or answered in writing. |
| Format check | The reviewer checks §4 line by line. The build enforces `minutes ≤ 30` and ≤ 15 highlighted lines per `:::code` (unless `stylesheet`) in tutorial courses. |
| Dates | Every lesson's sources comment carries "checked YYYY-MM-DD", with model names and prices checked against Claude docs that day. |

---

## 6. Owner answers (2026-11-03)

1. Front end: Remix 3 with skills, no React fallback. Use popular libraries and convert small AI Elements
   pieces into Remix components. Use Remix's own packages (auth, data-table, session). Clean, isolated
   code. Front-end tests skipped. The course is mostly prompts, expectations and review. S0 checks
   streaming feasibility only; it doesn't gate the framework.
2. Name: **Klippy** (`klippy` in code).
3. Repo: public **github.com/ryanyogan/klippy**, MIT, a tag per lesson.
4. Model cost: the learner's own Anthropic key in their own AI Gateway, with a one-line switch to a free
   Workers AI model.
5. Replace the four courses in place, keeping slugs where a lesson maps (our recommendation; the owner
   deferred).
6. "Your first Worker" is its own beginner course (our recommendation; the owner deferred).

---

## 7. Sub-agent plan (phase 2, not started)

At most about 8 running at once. Model split per the owner: Opus for code, research and testing; a fork for
curriculum and review. Ports: bits dev servers 44200–44209; Klippy `wrangler dev` 8800–8809.

| Lane | Model | Owns | Port | Starts after | Done when |
|---|---|---|---|---|---|
| S0 spike: streaming + D1 driver | Opus | throwaway dir in scratchpad; report in `docs/plans/build-along/s0.md` | 8800 | go-ahead | A Remix 3 island streams an `AIChatAgent` reply through `agents/client` via a service binding (`WebSocketChatTransport`, else a streaming `@callable`); the smallest Remix-on-Workers asset setup is written down; a D1 driver for data-table is chosen (§2.2) |
| P package the D1 driver | Opus | `packages/data-table-d1/` in bits (extracted from `packages/db/src/d1`, bits switched to it), README, MIT | 44200 | S0 picks "publish ours" | Tests green in bits; tarball ready; **the owner runs `npm publish`** |
| R reference repo (spine) | Opus | the `klippy` repo: tags `a-01`… in order, `ci.yml`, `latest.yml`, recorded outputs; hands off at about 250k tokens | 8801 | go-ahead (B5 waits for the driver; D waits for S0) | Every tag green; outputs saved per lesson |
| X engine | Opus | bits: `tag=` on `:::code`, the snippets check, the tutorial format limits, a coming-soon course state, a "start from tag" course field, phone/desk marking, the **checkpoint grader** (`/klippy/check`, then an MCP probe), catalog order | 44201 | go-ahead | Build tests per rule; grader tests with a stubbed learner Worker; a security review of the grader |
| W1 writer A + B | fork | `content/courses/your-first-worker/`, `give-your-model-tools/` | 44202 | R reaches `b-09`; X merged | Validates clean; T and V resolved |
| W2 writer C + D | fork | `first-agent-loop/`, `build-the-front-end-with-agents/` (D: prompts, expectations, review checklists) | 44203 | R reaches `d-11` | Same |
| W3 writer E + F + G stub | fork | `retrieval-without-tears/`, `ship-an-agent-to-the-edge/`, `mcp/course.md` | 44204 | R reaches `f-08` | Same |
| T fresh learner (one per course, reused) | Opus | `docs/plans/build-along/qa/<course>.md` | 8802–8805 | each writer's course | No unresolved "stuck" |
| V steel-man reviewer (one per course) | fork | `docs/plans/build-along/review/<course>.md` | — | each writer's course | Every finding fixed or answered |

Merge order: S0 report → P (if chosen) → X → A+B → C+D → E+F+G. Each course merges after its T and V
reports are resolved, then deploys and publishes (per the deploy-frequently rule). Writers follow §4 and
edit only their course folders. Anything outside goes into their report.
