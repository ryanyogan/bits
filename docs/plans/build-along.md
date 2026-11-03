# Build-along courses: plan (2026-11-03, proposed)

Status: **proposed**, waiting for the owner. Decision record: `docs/decisions/071-build-along-courses.md`.
Nothing here is written as lessons or code yet.

The owner's ask: turn the code courses into full tutorials. Each one builds something real on your own
machine, starting from the first `npm` install and assuming no prior knowledge. Everything runs on
Cloudflare, with clean, checked code from popular packages that fit together. Together the courses build
one small app, a personal agent, feature by feature. Add a course on building the front end with a coding
agent and skills, and stub an MCP course as "coming soon".

APIs and versions below were checked on 2026-11-03 against Cloudflare's docs (Firecrawl, `maxAge: 0`) and
`npm view`. The reference-repo lane re-checks them on the day it pins versions.

---

## 1. The app

### Concepts considered

| Concept | Pitch | For | Against |
|---|---|---|---|
| **Pip, your pocket agent** (recommended) | A personal assistant that remembers you, saves what you send it (notes, links, PDFs), answers from it with sources, and nudges you on schedule. | Feels like the popular "second brain" apps; useful on day one; every Cloudflare product earns its place (DO = one Pip per person, D1 = notes, Vectorize = recall, Workflows = ingest, Cron/alarms = nudges, Access = lock); grows naturally into MCP ("use Pip from Claude"). | "Personal assistant" is a crowded idea, so the fun has to come from personality and the nudges. |
| Trip buddy | Plans a weekend: weather, places, packing list, reminders. | Continues today's weather-agent thread; very demo-able. | Needs third-party APIs for places; RAG over "your docs" is forced. |
| Kitchen agent | Recipes from what's in your fridge, a shopping list, meal plans. | Fun and visual. | Thin on tools beyond the list; Vectorize over recipes is less "yours". |

### Recommendation: **Pip**

Pip is one agent per person (a Durable Object), reached from a terminal, then a web app, and later from
Claude through MCP. What it can do, by course:

| After course | Pip can… |
|---|---|
| Your first Worker | answer one question with Claude, over HTTP, deployed |
| Give your model tools | check the weather, tell the time, save and list notes (D1), read a link |
| Your first agent loop | hold a conversation, remember facts about you, ask before it writes, nudge you at a set time |
| Build the front end with agents | do all of that in a web app you prompted into being with Claude Code |
| Retrieval without tears | answer from your saved notes and links, with sources, and say when it doesn't know |
| Ship an agent to the edge | run as your private, rate-limited, logged, tested app on your own domain |
| MCP (coming soon) | be used from Claude (Pip as an MCP server) and use other MCP servers |

The weather tool stays as the first tool (Open-Meteo: free, no key), so today's weather lessons carry over.

### Where this leaves us against the field

From the first pass of `docs/research/competitors/data.json` (2026-11-03; the competitor lane is still
writing it):
- Only Cloudflare's own tutorials (hands-on 3) and paid Maven cohorts take a learner all the way to
  "build and deploy a real project". Cloudflare's tutorials are separate apps that assume Workers knowledge.
  freeCodeCamp's Workers RAG handbook is one standalone build.
- Nobody free builds **one app across six courses from zero**. Nobody pairs that with a Claude sandbox that
  grades your prompts, or teaches directing a coding agent (skills + MCP) as its own course. AI Hero does
  the coding-agent build in a paid workshop.
- Gaps to watch, for the steel-man pass: evals as a first-class topic (Kaggle, LangChain, Maven), and MCP in
  depth (Hugging Face, Microsoft). That's why course G and E8 matter.

---

## 2. Stack

Rule: use the fewest, most popular packages that already fit together, and prefer Cloudflare's own glue.

| Need | Choice | Version (2026-11-03) | Why |
|---|---|---|---|
| Package manager, monorepo | pnpm workspaces | pnpm 10 (via `corepack`) | Same as bits; no extra monorepo tool. |
| Scaffold | `create-cloudflare` | 2.74.8 | `pnpm create cloudflare@latest` is the official first command. |
| Runtime, CLI | Workers, `wrangler` | 4.157.0 | |
| Agent, per-user state | `agents` (Agents SDK) | 0.33.0 | One `Agent`/`AIChatAgent` = one Durable Object with SQLite, scheduling, WebSockets, routing. |
| Chat agent | `@cloudflare/ai-chat` | 0.12.2 | `AIChatAgent`: message persistence, resumable streams, tool approval (`needsApproval`). Peers: `ai` ^6 or ^7, `agents` <1. |
| Model calls | `ai` (AI SDK) | 7.0.162 | `streamText`, `tool()`, `stopWhen: stepCountIs(n)`; what the Agents docs use. |
| Claude through AI Gateway | `createAI` from `agents/models/ai-sdk` + the `AI` binding | (in `agents`) | `createAI({ binding: env.AI, id: "pip" })` then `ai("anthropic/claude-haiku-5.5")`. **No provider key in the Worker**: Unified Billing or a key stored on the gateway (BYOK). `ai-gateway-provider` is now deprecated. |
| Tool schemas | `zod` | 4.6.7 | Peer of `agents`. |
| Ready-made tools | `agents/webfetch/ai-sdk`, `agents/websearch/ai-sdk` | (in `agents`) | Read a link as Markdown, or search the web, through the `AI` binding: no code of our own. |
| App database | D1 + `drizzle-orm` / `drizzle-kit` | 0.45.4 / 0.31.11 | Typed schema and SQL migrations that `wrangler d1 migrations apply` runs. |
| Vector store | Vectorize + Workers AI embeddings | `@cf/baai/bge-base-en-v1.5` (768 dims, cosine) | The model in Cloudflare's own Vectorize tutorial. The lane re-checks for a newer default (e.g. `qwen3-embedding-0.6b`). |
| Reranker | Workers AI `@cf/baai/bge-reranker-base` | | No extra service. |
| Ingest | Cloudflare Workflows (`AgentWorkflow`) | (in `agents`) | Durable steps for fetch → chunk → contextualise → embed. |
| Front end | **Remix 3** (`remix`) on Workers, see §2.1 | 3.1.0 | The owner's ask; our own stack, with the `remix` skill. |
| Client connection | `agents/client` (`AgentClient`) | (in `agents`) | Framework-free WebSocket client, used by the terminal chat and the Remix island. |
| Tests | `vitest` + `@cloudflare/vitest-pool-workers` | **vitest 4.1.x** (pool 0.23.0 peers `^4.1`; vitest 5 is out but unsupported) | Tests run inside the real Workers runtime. |
| MCP (coming soon) | `createMcpHandler` from `agents/mcp/server` + `@modelcontextprotocol/server` v2 | 2.4.0 (pinned by `agents`) | `McpAgent` is deprecated. The handler is stateless, so no Durable Object is needed. |
| Auth (ship course) | Cloudflare Access in front of the app | n/a | It's a personal app, so lock it with zero auth code and verify the Access JWT. |

Not used: Hono, a React UI kit, LangChain, `@anthropic-ai/sdk` in the app. (The SDK appears once, in the
"write the loop by hand" lesson, so learners see what `streamText` does for them. See §4.)

### 2.1 Front end: Remix 3, with a gate

| Option | Beginner simplicity | Fit with the owner's ask | Risk |
|---|---|---|---|
| React + Vite (`@cloudflare/vite-plugin`, `useAgentChat`) | Best: official hooks and examples, the least code | Misses "remix skills" | Low |
| **Remix 3 on Workers** | Good once set up; server-first, few concepts | Exact: the remix skill, our own stack, we dogfood it | Remix's starter is Node-based. On Workers we must bundle browser modules ourselves (bits does it in `scripts/build.ts`), and Remix has no `useAgentChat` |
| Static Vite SPA, no framework | Medium | Misses the skills story | Low |

**Recommendation: Remix 3**, gated on spike S0 (§6), which must show:
1. a Remix 3 app on Workers with one small build script (≤ 60 lines) or a documented Remix option; and
2. a chat island streaming from `AIChatAgent` through `agents/client`, using `WebSocketChatTransport`
   (`agents/chat/transport`). Fallback: a `@callable({ streaming: true })` method.

If S0 fails either check, fall back to React + Vite and tell the owner before writing course D.

### 2.2 Monorepo layout (end state)

```
pip/
  package.json            scripts: dev, test, typecheck, deploy, chat
  pnpm-workspace.yaml
  apps/agent/             Worker: Pip (AIChatAgent DO), ingest Workflow, cron; D1, Vectorize, AI, rate limits
  apps/web/               Worker: Remix 3 front end; service binding AGENT → apps/agent (same origin, no CORS)
  apps/mcp/               Worker (MCP course): createMcpHandler over the same D1
  packages/db/            Drizzle schema + migrations, shared by agent and mcp
  scripts/chat.ts         terminal chat client (agents/client), `pnpm chat`
```

Why two stores: **Durable Object SQLite** holds one person's conversation, memory and schedule (fast,
private, one writer). **D1** holds data that other parts read: notes, sources and usage, read by the web
app, the MCP server and the ingest Workflow. A lesson says this out loud, with the rule of thumb.

---

## 3. Course arc

Order on the catalog (conceptual courses unchanged and first): what-is-an-llm → tokens-and-temperature →
prompting-that-works → context-is-everything → **A** your-first-worker (new) → **B** give-your-model-tools
→ **C** first-agent-loop → **D** build-the-front-end-with-agents (new) → **E** retrieval-without-tears →
**F** ship-an-agent-to-the-edge → **G** mcp (coming soon).

Each course starts from the previous course's final tag, and its first lesson says how to get it
(`git clone … && git checkout b-10`). So a learner can start at any course.

Columns: **Builds** = what exists at the end; **Touches** = commands and files; **Concept**; **Source** =
the "Down the rabbit hole" link to lead with. Lesson numbers are the planned order; slugs get set when writing.

### A. Your first Worker (new, beginner, 5 lessons)

| # | Title | Builds | Touches | Concept | Source |
|---|---|---|---|---|---|
| A1 | Your workbench | Node 22 LTS, pnpm, an editor, a terminal you're not scared of | `node -v`, `corepack enable`, `pnpm -v` | What a runtime, a package manager and a terminal are | nodejs.org download; pnpm.io installation |
| A2 | Make the monorepo | `pip/` with a workspace and an empty `apps/agent` Worker | `mkdir pip`, `git init`, `pnpm-workspace.yaml`, `pnpm create cloudflare@latest apps/agent --type=hello-world --lang=ts` | Workspaces; what c3 generated, file by file | Cloudflare Workers get started |
| A3 | Hello, Worker | A Worker that answers on localhost, and its first test | `pnpm dev` (`wrangler dev`), `src/index.ts`, `test/index.spec.ts`, `pnpm test` | Request in, Response out; `wrangler types`; tests run in the real runtime | Workers "How Workers works"; vitest-pool-workers docs |
| A4 | Your first call to Claude | `POST /ask` answers with Claude Haiku 5.5 through your AI Gateway | Dashboard: create gateway `pip`; `wrangler.jsonc` `ai` binding; `pnpm add agents ai @ai-sdk/provider`; `createAI`, `generateText`; `curl` | Bindings; why no key lives in the Worker (gateway BYOK or Unified Billing); the free Workers AI model as a no-card option | AI Gateway: Vercel AI SDK; Claude models overview |
| A5 | Checkpoint: ship it | Pip v0 live on `*.workers.dev`, logs and traces on | `wrangler login`, `pnpm deploy`, `observability` block, `wrangler tail` | Deploys, versions, rollback; compatibility date | Workers best practices (observability) |

### B. Give your model tools (rewritten on Pip, 10 → 9 lessons)

| # | Title | Builds | Touches | Concept | Source | From today |
|---|---|---|---|---|---|---|
| B1 | Why models need tools | (sandbox only) | in-app prompt + compare | What a tool is; Claude asks, your code acts | Anthropic tool use overview | keeps 01, reframed on Pip |
| B2 | Your first tool: the weather | `getWeather` (Open-Meteo) on `/ask` | `src/tools/weather.ts`, `tool({ description, inputSchema: z.object(…) , execute })`, `stopWhen: stepCountIs(2)` | name + description + schema | AI SDK tool calling; Anthropic "define tools" | merges 02 + 03 |
| B3 | Watch one round trip | A log of each step: tool call, tool result, final text | `onStepFinish`, `wrangler dev` output | The tool_use → tool_result exchange the SDK runs for you | Anthropic "how tool use works" | 03's idea, shown in real logs |
| B4 | Descriptions Claude follows | Better descriptions, plus a test that "what's 2+2?" calls no tool | in-app prompt; `test/tools.spec.ts` with a stubbed gateway | Descriptions are prompts | Anthropic "best practices for tool definitions" | keeps 04 |
| B5 | Pip remembers notes | `saveNote` / `listNotes` tools over D1 | `wrangler d1 create pip-db`, `packages/db` (Drizzle schema), `drizzle-kit generate`, `wrangler d1 migrations apply --local` | Your first database; migrations; tools that write | D1 get started; Drizzle D1 docs | new (D1 enters) |
| B6 | Choosing when Claude calls | `toolChoice` per route; a "notes only" mode | `toolChoice: "required" / { type: "tool", toolName }` | auto / any / tool / none | Anthropic tool_choice | keeps 05 |
| B7 | Strict inputs, honest failures | Zod refinements; a failed fetch comes back as an error result, not a crash | `tool` errors; `strict` | Schemas guard inputs; errors are tool results | Anthropic strict tool use; handling tool errors | merges 06 + 07 |
| B8 | Read a link | `readLink` via `webFetchTool({ binding: env.AI })` | one import, one line | Reuse a ready tool before writing one; fetched pages are untrusted | Agents webfetch docs | replaces 08 ("tools Anthropic runs" becomes one paragraph here) |
| B9 | Checkpoint: Pip with tools | Weather, time, notes, links over `curl`; tests green; deployed | `pnpm test`, `pnpm deploy`, `d1 migrations apply --remote` | Put it together | — | replaces 10 |
| — | *MCP: tools you can share* | | | | | **moves** to course G; B9 links to it |

### C. Your first agent loop (rewritten on Pip, 9 lessons)

| # | Title | Builds | Touches | Concept | Source | From today |
|---|---|---|---|---|---|---|
| C1 | Agents are loops | (sandbox) | prompt + compare | plan → act → observe | Anthropic "Building effective agents" | keeps 01 |
| C2 | Write the loop by hand, once | A 30-line loop in `scripts/loop.ts` with `@anthropic-ai/sdk`, then deleted | `pnpm add -D @anthropic-ai/sdk tsx`; `pnpm tsx scripts/loop.ts` | What `stopWhen` does for you; `stop_reason` | Anthropic Messages API, tool use | merges 02, 03, 04 |
| C3 | One Pip per person | `Pip extends AIChatAgent`, a Durable Object with SQLite | `wrangler.jsonc` `durable_objects` + `migrations` (`new_sqlite_classes`), `routeAgentRequest`, `onChatMessage` | Durable Objects: name → same instance; why a global array is a bug | Agents: chat agents; DO overview | moves from ship 03 |
| C4 | Talk to Pip from your terminal | `pnpm chat`: a streaming REPL | `scripts/chat.ts` with `agents/client` | WebSockets; resumable streams | Agents client SDK | new |
| C5 | Pip remembers you | `remember` / `forget` tools; facts in agent SQL, in the system prompt | `this.sql`, `system:` built per turn | Short-term (messages) vs long-term (facts) memory; `maxPersistedMessages` | Anthropic context engineering post; Agents state | rewrites 07 |
| C6 | Ask before you write | `saveNote` needs approval; terminal shows y/n | `needsApproval`, approval response | Human in the loop | Agents human-in-the-loop | new |
| C7 | When loops go wrong | Step cap, repeat-call guard, a stuck-loop test | `stepCountIs(8)`, `prepareStep`, test | Runaway loops, cost | Anthropic agents post (guardrails) | keeps 06 |
| C8 | Pip nudges you | "Remind me at 6pm to call Sam" → `this.schedule`, then a server-driven turn | `schedule()`, `saveMessages` | Agents that act without being asked | Agents schedule tasks; server-driven messages | new (fun one) |
| C9 | Checkpoint: Pip, the agent | Memory, approvals, nudges, terminal chat; deployed | `pnpm test`, `pnpm deploy` | — | — | replaces 09 |
| — | *Limits and logs* | | | | | **moves** to F |

### D. Build the front end with agents (new, beginner-friendly, 8 lessons)

The skill this course teaches is **directing a coding agent well**: setting up its context, its skills and
its tools, writing a clear brief, and reviewing what it builds. The UI is the vehicle.

| # | Title | Builds | Touches | Concept | Source |
|---|---|---|---|---|---|
| D1 | Your coding agent | Claude Code installed; an `AGENTS.md` for `pip/` | install, `/init`, edit AGENTS.md | Context files: what the agent reads first and why | Claude Code docs: memory, best practices |
| D2 | Skills: teach it your stack | Cloudflare, Remix and frontend-design skills installed in the repo | `npx skills add cloudflare/skills`, the Remix skill, `anthropics/skills` frontend-design (lane verifies each command) | What a skill is; prefer current docs over memory | Anthropic Agent Skills docs; skill repos |
| D3 | Tools for your agent: MCP | Firecrawl MCP (find design references, read docs) and Context7 connected to Claude Code | `claude mcp add …` | MCP from the user's side; keep tool access small | Claude Code MCP docs; Firecrawl MCP docs |
| D4 | Write the brief | `docs/ui-brief.md`: screens, states, tokens, accessibility bar; plan mode | Prompting a plan, not code | Briefs beat vibes; references via Firecrawl | Anthropic Claude Code best practices |
| D5 | The Remix shell | `apps/web`: Remix 3 on Workers, service binding to the agent, the stylesheet | Agent-built, learner-reviewed; the one full stylesheet allowed (§4) | Server-first pages; service bindings | Remix guides (start here, request handling); service bindings docs |
| D6 | The chat island | Streaming chat, tool cards, approval buttons, memory panel | `clientEntry` island, `agents/client` | Islands; what streams and what doesn't | Remix interactivity guide; Agents client SDK |
| D7 | Review what it built | Tests, typecheck, axe run, a list of what you rejected and why | `pnpm test`, Playwright + axe | Never merge unread code | Anthropic "Claude Code best practices" (verification) |
| D8 | Checkpoint: Pip on the web | The web app deployed beside the agent | `pnpm deploy` (both Workers) | — | — |

Honesty rule for D: the agent's output differs from run to run. Lessons show **our** recorded run (dated),
give the reference result at the tag, and teach the learner to judge theirs. They never promise identical
output.

### E. Retrieval without tears (rewritten on Pip, 9 lessons)

| # | Title | Builds | Touches | Concept | Source | From today |
|---|---|---|---|---|---|---|
| E1 | Paste it or search it? | (sandbox) Measure when notes outgrow the window | prompt | Long context vs retrieval; prompt caching first | Anthropic long-context tips; contextual retrieval post | keeps 01 |
| E2 | Ingest with a Workflow | Saving a link starts `IngestWorkflow`: fetch → Markdown → store | `AgentWorkflow`, `step.do`, `wrangler.jsonc` `workflows`; `env.AI.toMarkdown` for files | Durable steps; retries | Workflows docs; Agents run workflows | new |
| E3 | Chunking | Chunks in D1 with a source id and position | `chunk.ts` (~20 lines, ours) | Size, overlap, structure | Anthropic contextual retrieval post | keeps 02 |
| E4 | Embeddings into Vectorize | Chunks embedded and upserted with metadata | `wrangler vectorize create pip-notes --dimensions=768 --metric=cosine`, `metadata-index`, remote binding for dev | Vectors, cosine, metadata filters (per-user!) | Vectorize get started; 3Blue1Brown on embeddings | keeps 03 |
| E5 | Keywords too: hybrid search | D1 FTS5 + Vectorize, merged with reciprocal rank fusion | FTS5 migration, `rrf.ts` | Why hybrid wins | Anthropic contextual retrieval (BM25 + embeddings) | keeps 04 |
| E6 | Contextual retrieval | Haiku writes one line of context per chunk at ingest, with prompt caching | a Workflow step | Retrieval failures drop when chunks carry context | Anthropic contextual retrieval post | keeps 05 |
| E7 | Rerank, then answer with sources | `searchNotes` tool: hybrid → rerank → top 5; Pip cites; the UI shows sources | `@cf/baai/bge-reranker-base`; search-result content blocks / citations | Precision at the top; citations | Anthropic citations / search results docs | merges 06 + 07 |
| E8 | Measure it | `pnpm eval:retrieval`: recall@5 on 12 of your own questions | a vitest file | Measure before tuning | Anthropic "demystifying evals" | keeps 08 |
| E9 | Checkpoint: ask my notes | Pip answers from your saved notes and links, says "not in your notes" when they don't cover it; deployed | — | — | replaces 09 |

E4 also gives one paragraph to **AI Search** (Cloudflare's managed RAG): when to use it instead of
building, and why we build it once by hand.

### F. Ship an agent to the edge (rewritten on Pip, 8 lessons)

| # | Title | Builds | Touches | Concept | Source | From today |
|---|---|---|---|---|---|---|
| F1 | Lock the door | Cloudflare Access on the web app; the Access identity names the Pip instance | Zero Trust dashboard; verify `Cf-Access-Jwt-Assertion` with `jose`; `getAgentByName` | Choose the agent instance on the server, never from the client | Cloudflare Access: validate JWT; Agents routing | new (replaces "one agent per user", now in C3) |
| F2 | The gateway earns its keep | Caching, logs, a fallback model, spend alerts | `createAI({ cacheTtl, metadata })`, `fallback: […]` | Observability and cost control at the gateway | AI Gateway docs | rewrites 04 |
| F3 | Limits that hold | A rate-limit binding per user, plus a daily token budget in agent state | `ratelimits` binding; `onFinish` usage → budget | Limits enforced on the server, before the call | Workers Rate Limiting binding | rewrites 05 |
| F4 | Logs you can query | Structured JSON per turn; traces; one saved query | `console.log(JSON.stringify(…))`, Workers Logs query builder | Log the shape, never the secrets | Workers Logs; traces | rewrites 06 |
| F5 | Safety at the edge | Saved links are untrusted: wrapped, never obeyed; writes need approval; an injection test | `webfetch` untrusted wrapper, a test with a poisoned page | Prompt injection through retrieval; least privilege | Anthropic prompt-injection guidance; OWASP LLM top 10 | rewrites 07 |
| F6 | Tests and CI | GitHub Actions: typecheck, test, deploy on main | `.github/workflows/ci.yml`, `cloudflare/wrangler-action`, secrets | Deploys you trust | wrangler-action README; vitest-pool-workers | new |
| F7 | Your own domain, previews | A custom domain; preview URLs per PR | `routes` / custom domain; Workers previews | Environments | Workers custom domains; previews | new |
| F8 | Checkpoint: Pip in production | Everything above, live | — | — | replaces 08 |
| — | *Stream the reply* | | | | | **goes**: `AIChatAgent` streams by default; C4 covers it |

### G. MCP (coming soon, outline only)

`course.md` only, marked coming soon (engine support needed, §6). Planned lessons: what MCP is (from
B9's pointer) → Pip as an MCP server (`apps/mcp`, `createMcpHandler`, tools over the D1 notes) → lock it
with OAuth (`@cloudflare/workers-oauth-provider` or Access) → use Pip from Claude (Desktop/Code) → Pip as an
MCP client (`addMcpServer`) → checkpoint: two-way MCP.

### What happens to today's lessons

| Course | Stay (reframed) | Change | Go / move |
|---|---|---|---|
| give-your-model-tools | 01, 04, 05 | 02+03 merge, 06+07 merge, 08 becomes "read a link", 10 → B9 | 09 MCP → G |
| first-agent-loop | 01, 06 | 02+03+04 → C2, 07 → C5, 09 → C9 | 08 limits/logs → F |
| retrieval-without-tears | 01–05, 08 | 06+07 merge, 09 → E9 | — |
| ship-an-agent-to-the-edge | — | 04–07 rewritten, 08 → F8 | 01–02 go (covered by A, C4); 03 → C3 |

Completed lessons whose slug survives keep their progress. A retired slug drops from the course, and the
certificate rule (all current lessons) applies (open question 5).

---

## 4. Format: the rule for tutorial lessons

From the owner (2026-11-03): build-along lessons don't have to be 5–8 minutes. Learners code while they
read, with the snippets in front of them. Code arrives in small steps, each shown and explained. The four
conceptual courses keep the short format.

**Writers follow this, and reviewers fail a lesson that breaks it.**

| Rule | Limit |
|---|---|
| Lesson length (tutorial courses A–G) | 10–30 minutes, read and build together. Hard cap: 30. Over that, split the lesson. Frontmatter `minutes` is the honest total. |
| Lesson length (conceptual courses) | 5–8 minutes, unchanged. |
| Steps per lesson | 3–8. |
| Largest new snippet per step | **15 new or changed lines**, highlighted (`highlight=`) inside the file. Unchanged context lines around them don't count, up to 30 lines shown. |
| A whole file in one step | Only when it's ≤ 30 lines and every line is explained in that step, or it's generated config the lesson walks through. |
| The one exception | The Remix front-end course (D5) may give one full stylesheet in one go, labelled as such. Nothing else. |
| Never | A "copy all of this" block; an unexplained line; a step that changes two files without saying why both. |
| Every step ends with something you can see or run | A command and a "you should see" output, a page that visibly changed, or a test that turns green. |
| Recorded output | Shown in `OutputPanel` (recorded output, a Replay key, never "Run"). It's real output from the reference repo, dated in the lesson's sources comment. Never invented. |
| Step shape | Why (1–3 sentences) → snippet → what the important lines do → run it → what you should see → if it didn't work (the 1–2 likely mistakes). |
| Lesson ends | With the tag (`git checkout c-05`) and a link to the diff, so a stuck learner catches up. |
| Checkpoint lesson per course | Joins the parts, deploys, and ends with a quick check of the course's ideas. |

**What the in-app sandbox does in these courses** (honest split):
- It **does** run Claude for the prompt-shaped parts: writing tool descriptions, system prompts, the brief
  for course D, judging retrieval answers. These stay coached `:::prompt` exercises, graded as now.
- It **does not** run the learner's local code. The learner runs it on their own machine. Lessons show
  our recorded output and say plainly that it's ours.
- Quick checks (`:::ask`) test what the step taught ("what does `new_sqlite_classes` do?"), never "paste
  your terminal output", which we can't verify honestly.

---

## 5. Verification

| Layer | How |
|---|---|
| Reference repo | Public `ryanyogan/pip` (name pending). Built forward, one commit and one git tag per lesson (`a-01` … `f-08`). Each tag has a green CI run. |
| CI per tag | `pnpm i --frozen-lockfile`, `pnpm typecheck`, `pnpm test` (vitest-pool-workers, model calls stubbed), `wrangler deploy --dry-run` for each app. |
| Live proof | The reference agent runs each step against real Cloudflare and real Claude, through a gateway on the owner's account, and saves the output that the lesson's `OutputPanel` shows (dated). |
| Snippets match the repo | A bits CLI check, `pnpm content snippets <course> --repo ../pip`: every `:::code` block with `file=` and a `tag=` attribute must match that file at that tag (highlighted lines included). It runs in bits CI against a pinned commit of the repo. Engine lane, §6. |
| Fresh-learner run | Per course, an Opus agent with no repo context follows the lessons literally in a clean directory, from A1 or the course's start tag. It logs every place it got stuck, guessed, or needed knowledge the lesson hadn't given. A course doesn't ship with an unresolved "stuck". |
| Steel-man review | Per course, a fork reviewer argues the strongest case against the course. It compares with the best sources (Anthropic docs and engineering posts, Cloudflare docs, AI Hero, Karpathy, 3Blue1Brown) and with the competitor notes in `docs/research/competitors/` (being written in parallel). Its questions: what would a senior engineer say is wrong or outdated? What do competitors teach that we skip? Which line could be cut? Findings get fixed or answered in writing. |
| Format check | The reviewer checks §4 line by line. The build can enforce some rules: `minutes ≤ 30`, and highlighted lines per `:::code` ≤ 15 unless `stylesheet`. Engine lane, §6. |
| Dates | Every lesson's sources comment carries "checked YYYY-MM-DD". Model names and prices are checked against Claude docs on that date. |

---

## 6. Sub-agent plan (phase 2, after approval)

At most about 8 running at once. Model split per the owner: Opus for code, research and testing; a fork for
curriculum and review. Ports: bits dev servers 44200–44209; reference repo `wrangler dev` 8800–8809.

| Lane | Model | Owns | Port | Starts after |
|---|---|---|---|---|
| S0 spike: Remix on Workers + chat island | Opus | throwaway dir in scratchpad; report only | 8800 | approval |
| R reference repo (spine) | Opus | the `pip` repo, tags `a-01…` onward; hands off at about 250k tokens | 8801 | approval (D tags wait for S0) |
| X engine | Opus | bits: `tag=` on `:::code`, the snippets check, `minutes` cap + highlight limit, a coming-soon course state, a course "start from tag" field, catalog order | 44200 | approval |
| W1 writer A + B | fork | `content/courses/your-first-worker/`, `give-your-model-tools/` | 44201 | R reaches `b-09` |
| W2 writer C + D | fork | `first-agent-loop/`, `build-the-front-end-with-agents/` | 44202 | R reaches `d-08` |
| W3 writer E + F + G stub | fork | `retrieval-without-tears/`, `ship-an-agent-to-the-edge/`, `mcp/course.md` | 44203 | R reaches `f-08` |
| T fresh learner (one per course, reused) | Opus | report files under `docs/plans/build-along/qa/` | 8802–8805 | each writer's course |
| V steel-man reviewer (one per course) | fork | review files under `docs/plans/build-along/review/` | — | each writer's course |

Merge order: X first (writers need `tag=` and the coming-soon state) → A+B → C+D → E+F+G. Each course
merges only after its T and V reports are resolved, then deploy and publish (per the deploy-frequently
rule). Writers follow `docs/plans/build-along.md` §4 and edit only their course folders. Anything outside
goes into their report.

---

## 7. Open questions for the owner

1. **Front end: Remix 3, gated on spike S0** (recommended), or React + Vite (official chat hooks, less
   code). Remix matches your ask and our stack. The risk is the Workers build step.
2. **Name: "Pip"?** (recommended; short, friendly, no clash we found). Alternatives: "Sidekick", "Kip".
3. **Companion repo:** public `ryanyogan/pip` under MIT (recommended), so learners can clone any tag.
4. **Who pays for Claude?** Learners use their own Cloudflare account. Recommended: Claude Haiku 5.5 through
   their gateway (BYOK or Unified Billing, about cents per course), with a one-line switch to a free
   Workers AI model for anyone without a card. The lessons say so up front.
5. **Retired lessons:** replace the four courses in place, keeping slugs where a lesson maps (recommended).
   Progress on retired slugs stops counting toward certificates. The other option is to ship the new courses
   under new slugs and retire the old ones later.
6. **A new beginner course before tools** ("Your first Worker"), or fold it into the tools course as a
   first module. Recommended: a separate course, so anyone can start the build there.
