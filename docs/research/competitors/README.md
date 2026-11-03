# Competitors: who else teaches AI engineering, and where bits fits

Dated 2026-11-03. This is our own summary, written from the competitors' landing and syllabus
pages, fetched with Firecrawl on this date. No course text is copied. Machine-readable
version: [data.json](data.json). Items marked *(from memory)* weren't re-checked against a
live page.

Scales used below and in `data.json`:

- **Topic depth, 0–3:** 0 = not covered, 1 = mentioned, 2 = taught with an example,
  3 = taught in depth with practice.
- **Hands-on, 0–3:** 0 = watch or read only, 1 = runnable snippets, 2 = guided exercises or
  notebooks, 3 = the learner builds and deploys a real project.

Topic columns: **LLM** basics, **Pr**ompting, **Ctx** (context), **Tools**, **Agt**
(agents), **RAG**, **Edge** (deploying to the edge), **MCP**, **FE** (building a frontend
with agents and skills).

## Summary table

| Who | Price | Format | Hours | LLM | Pr | Ctx | Tools | Agt | RAG | Edge | MCP | FE | Hands-on |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **bits** | free | 5–8 min interactive lessons, live graded Claude | ~7.5 | 3 | 3 | 3 | 2 | 2 | 2 | 2 | 1 | 0 | 2 |
| Claude Academy (Anthropic) | free + certs | video/text courses, quizzes, webinars | ~20 | 2 | 3 | 2 | 3 | 2 | 2 | 0 | 3 | 1 | 2 |
| anthropics/courses (GitHub) | free | Jupyter notebooks | ~10 | 1 | 3 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| DeepLearning.AI short courses | videos free; Pro ~$25–30/mo | 1–2.5 h video + notebooks | ~2 each | 2 | 2 | 1 | 2 | 3 | 3 | 1 | 2 | 1 | 1 |
| Hugging Face Agents Course | free + certs | text units, notebooks, Spaces | ~20 | 1 | 1 | 1 | 2 | 3 | 2 | 1 | 1 | 0 | 2 |
| Hugging Face MCP Course | free + certs | text units, Python or TS | ~12 | 0 | 0 | 1 | 2 | 1 | 0 | 1 | 3 | 0 | 2 |
| Hugging Face Context Course | free | text units for coding agents | ~8 | 0 | 1 | 2 | 1 | 2 | 0 | 0 | 2 | 2 | 2 |
| AI Hero (Matt Pocock) | free library; cohorts $995 | articles, videos, cohorts | ~15 free | 1 | 2 | 3 | 2 | 2 | 1 | 0 | 2 | 3 | 1 (3 paid) |
| Cloudflare Agents docs + Labs | free | reference, guides, 40-min lab | ~6 | 0 | 0 | 0 | 2 | 3 | 2 | 3 | 3 | 1 | 3 |
| Microsoft AI Agents for Beginners | free | 18 lessons, notebooks, videos | ~18 | 1 | 1 | 2 | 2 | 3 | 2 | 1 | 2 | 0 | 2 |
| Microsoft GenAI for Beginners | free | 21 lessons | ~21 | 2 | 2 | 1 | 1 | 1 | 2 | 0 | 0 | 0 | 2 |
| Microsoft MCP for Beginners | free | modules in 6 languages | ~15 | 0 | 0 | 1 | 2 | 1 | 0 | 1 | 3 | 0 | 2 |
| Kaggle × Google 5-Day Agents | free + certs | whitepapers, codelabs, livestreams | ~15 | 1 | 1 | 2 | 2 | 3 | 1 | 2 | 2 | 0 | 2 |
| LangChain Academy | free | video + notebooks | ~10 | 0 | 1 | 2 | 2 | 3 | 1 | 1 | 1 | 0 | 2 |
| Scrimba AI Engineer Path | Pro ~$24.50/mo (annual) | interactive screencasts | 13.4 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 |
| Frontend Masters / Master.dev | subscription | long workshop videos | ~45 | 2 | 2 | 2 | 2 | 3 | 2 | 1 | 2 | 2 | 2 |
| egghead.io | some free; membership | short screencasts | ~3 | 0 | 1 | 1 | 1 | 1 | 0 | 0 | 1 | 2 | 1 |
| Maven cohorts | $999–$4,400 | live cohorts | ~30 | 1 | 2 | 2 | 2 | 3 | 2 | 1 | 1 | 0 | 3 |
| freeCodeCamp | free | long YouTube + handbooks | varies | 2 | 1 | 1 | 2 | 2 | 2 | 2 | 2 | 0 | 2 |
| OpenAI Academy | free *(from memory)* | courses + livestreams | ~10 | 1 | 2 | 1 | 2 | 2 | 2 | 0 | 1 | 2 | 1 |
| Brilliant: How LLMs Work | Premium subscription | interactive phone lessons | ~2 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| YouTube (Karpathy, 3B1B, Theo) | free | long-form video | ~20 | 3 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 1 | 1 |

Hours are rough totals for the parts relevant to us. bits: about 70 lessons at about 6.5
minutes each.

## The competitors

### Claude Academy / Anthropic courses (Skilljar)

https://academy.claude.com/ (mirrors https://anthropic.skilljar.com/)

- **Price:** free, with Skilljar certificates.
- **What's there for developers:**
  - *Building with the Claude API*: 67 lessons, 8 quizzes, about 9 h. Sections cover API
    basics, prompt engineering, tool use (13 lessons), RAG and agentic search (7), MCP (11),
    Claude Code and computer use, and agents and workflows.
  - *Claude Platform 101*: 13 lessons, 1.5 h.
  - *Introduction to MCP*: 10 lessons, about 1 h, Python; plus *MCP: Advanced Topics*
    (11 lessons).
  - *Tool use with the Messages API* (9 lessons).
  - *Claude Code 101*, *Claude Code in Action*, *Introduction to agent skills*,
    *Introduction to subagents*, and *AI capabilities and limitations* (13 lessons,
    3.5 h).
  - Recurring live webinars (Claude Code Foundations and Advanced).
- **Hands-on:** Python exercises against the API. Nothing is deployed, and nothing is run
  live inside the lesson.
- **Strengths:** the primary source and a strong brand; free certificates; wide coverage
  that is updated through 2026.
- **Gaps:** Python-first; courses run for hours; no TypeScript or edge track; it teaches
  Claude's features more than general engineering judgement.
- **Audience:** developers already committed to Claude, and enterprise teams.
- **Threat level: highest.** This is the free, official version of most of our catalogue.

### anthropics/courses (GitHub)

https://github.com/anthropics/courses

- Five notebook courses: API fundamentals, the prompt-engineering interactive tutorial,
  real-world prompting, prompt evaluations and tool use. 23k stars.
- **Stale:** built on Claude 3 Haiku. Most folders were last changed in 2024; the newest
  commit is from Nov 2025. You need your own key and a local Python setup.
- **Use:** it's still the best-known prompt tutorial, but Claude Academy has replaced it.
  Link to it, don't compete with it.

### DeepLearning.AI short courses

https://www.deeplearning.ai/courses

- **Price:** all videos free. Pro adds labs and certificates: $25/mo billed annually or
  $30/mo billed monthly, from a third-party listing in Oct 2026
  (https://www.deeplearning.ai/membership).
- **Relevant courses:**
  - *MCP: Build Rich-Context AI Apps with Anthropic*: 1h58m, 11 videos, 6 code examples,
    Python, FastMCP and Inspector. It deploys a remote server. Updated Aug 13, 2026.
  - *Agent Skills with Anthropic*: 2h19m, 10 videos. Updated Jul 2026.
  - Also: *Claude Code*, *Spec-Driven Development with Coding Agents*, *Evaluating AI
    Agents*, *RAG*, and many vendor courses (crewAI, LangGraph, Box MCP).
- **Strengths:** about 120 courses; Andrew Ng's brand; Anthropic co-produced the MCP and
  skills courses.
- **Gaps:** mostly watching; labs are behind Pro; Python only; many courses showcase a
  vendor; quality varies.

### Hugging Face: Agents, MCP and Context courses

- **Agents Course** (https://huggingface.co/learn/agents-course): free, certified, uses
  smolagents, LlamaIndex and LangGraph. A 2026 review says it's in low-maintenance mode,
  with navigation stopping at Unit 4 and a broken leaderboard.
- **MCP Course** (https://huggingface.co/learn/mcp-course): built with Anthropic, Gradio
  and Continue. Python or TypeScript. A "deployed use case" unit on the HF ecosystem. Two
  certificates; 3–4 h a week.
- **Context Course** (https://huggingface.co/learn/context-course): new and agent-neutral
  (Claude Code, Codex, OpenCode). It covers skills, MCP, plugins, subagents, hooks and a
  minimal agent loop. This is the closest free rival to our planned "frontend with agents
  and skills" course, though it builds no product.

### AI Hero (Matt Pocock)

https://www.aihero.dev. Our full notes are in [../aihero/NOTES.md](../aihero/NOTES.md); we
didn't crawl it again.

- **Price:** a large free library; cohorts such as *AI Coding for Real Engineers* cost
  $995 for 2 weeks.
- **Strengths:** the best teacher of coding-agent workflow (AGENTS.md, skills, hooks, TDD,
  unattended loops); TypeScript-native; the AI Coding Dictionary.
- **Gaps:** the older free API posts use 2024–25 AI SDK APIs; real hands-on work is paid;
  no deployment or edge content.
- **Relation to us:** a source of ideas to credit and link, and a model for short
  glossary-style explanations.

### Cloudflare's own material

- Agents docs: https://developers.cloudflare.com/agents/
- Remote MCP guide (updated Oct 27, 2026):
  https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/
- RAG tutorial (Workers AI, Vectorize, D1):
  https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai/
- Labs workshop: https://labs.cloudflare.dev/agents
- Durable Objects learning path: https://developers.cloudflare.com/learning-paths/

What we found:

- **Hands-on: 3.** Every guide goes from `npm create cloudflare` to `wrangler deploy`.
- **Not a course.** There is no sequence from zero, no checks and no feedback. The Labs
  workshop is about 40 minutes: run the starter (with an OpenAI key), try its tools and
  scheduling, then clone the repo.
- **Churn.** On Oct 29, 2026 the quick start was rewritten: it now runs a "Pi harness" in a
  Durable Object with a Cloudflare Computer workspace and a Workers AI model. The docs now
  explain the runtime as a Lifecycle plus capabilities added with `.use()`. `McpAgent` is
  deprecated in favour of `createMcpHandler` (MCP SDK v2). Any tutorial we write will age
  fast unless we pin versions and test it.
- **Not Claude-first.** Examples default to Workers AI or OpenAI.
- **Coding-agent support:** Cloudflare ships a Skills plugin and a docs MCP server
  (`https://agents.cloudflare.com/mcp`) for coding agents.
- **Relation to us:** the primary source to cite, and the lane we can own as its teaching
  layer: a Claude-first course from zero with graded checkpoints.

### Microsoft: AI Agents, GenAI and MCP for Beginners

- **AI Agents for Beginners** (https://github.com/microsoft/ai-agents-for-beginners): 18
  lessons with videos for 1–13 and 78.7k stars, actively updated. It covers patterns
  (tool use, planning, multi-agent, metacognition), agentic RAG, context engineering,
  memory, MCP/A2A/NLWeb, computer use and security. Built on Microsoft Agent Framework,
  with deployment to Microsoft Foundry.
- **Generative AI for Beginners** (https://microsoft.github.io/generative-ai-for-beginners/):
  21 lessons, version 3, Azure-first.
- **MCP for Beginners** (https://github.com/microsoft/mcp-for-beginners): code in C#, Java,
  JavaScript, Python, Rust and TypeScript, with advanced modules on OAuth2 and Entra ID.
- **Overall:** wide, free and well maintained, but tied to Azure and delivered as notebooks
  and READMEs.

### Kaggle × Google 5-Day AI Agents Intensive

https://www.kaggle.com/learn-guide/5-day-agents

- **Format:** five days of whitepaper, podcast, Kaggle notebook codelabs and a livestream.
  The days cover agents, tools and MCP, sessions and memory, quality (observability and
  evals), and prototype to production (A2A, optional deploy to Vertex AI Agent Engine).
- **Stack:** ADK on Gemini.
- **Reach:** about 1.5M learners in the first edition; 353k in the June 2026 "vibe coding"
  edition. It's now also a self-paced guide.
- **Lesson for us:** a time-boxed event plus certificates and capstone prizes draws
  enormous sign-ups.

### LangChain Academy

https://academy.langchain.com/

- Free: Intro to LangChain, Intro to LangGraph, Deep Agents, LangSmith Essentials and
  LangSmith Deployment.
- Deep on long-running agents and observability, but tied to the framework and mostly
  Python.

### Scrimba AI Engineer Path

https://scrimba.com/ai-engineer-path-c02v

- **Price:** Pro, about $24.50/mo billed annually (from Scrimba's own 2026 comparison).
- **Content:** 13.4 h across intro, deployment, open-source models, embeddings and vector
  databases, agents, context engineering, Vercel AI SDK, MCP and multimodality. JavaScript.
- **Our closest rival in format:** you edit code inside the instructor's screencast in the
  browser.
- **Gaps:** paid; OpenAI-first; nothing is graded by a model.

### Frontend Masters (now Master.dev)

https://master.dev/topics/artificial-intelligence/

- **2026 releases:** *Practical AI Agent Workflows* (Oct), *Build an Agent that Never
  Sleeps* (Oct), *Harness Engineering & Agent Orchestration* (Jul), *Claude Code* (May),
  *Applied AI Engineering Fundamentals* (9 h, Apr), *AI Agents Fundamentals v2* (Jan).
  Older: *Complete Intro to MCP* (Sep 2025).
- The durable-agent course uses Inngest, OpenAI and Neon, not Cloudflare.
- **Price:** subscription, *(from memory)* about $39/mo, unverified.
- **Strengths:** senior instructors and real codebases. **Gaps:** paid, long, desk-bound.

### Smaller or adjacent players

- **egghead.io** (https://egghead.io/q/claude-code): short screencasts close to our lesson
  length, including free Claude Code skills courses. Thin on API engineering. Membership
  price not checked.
- **Maven cohorts:**
  - *AI Evals for Engineers & PMs* (Hamel Husain and Shreya Shankar), $4,400:
    https://maven.com/parlance-labs/evals
  - *Agentic AI Engineering Bootcamp*, $999:
    https://maven.com/stemplicity/become-an-agentic-ai-engineer
  - The best depth on evals anywhere, with live feedback. Expensive and on a fixed
    schedule.
- **freeCodeCamp:** free multi-hour YouTube courses and long handbooks. One handbook builds
  a RAG chatbot on Workers, Vectorize and Workers AI, which overlaps directly with our
  planned Cloudflare RAG lessons:
  https://www.freecodecamp.org/news/build-a-production-rag-system-with-cloudflare-workers-handbook/.
  Quality depends on the guest author.
- **OpenAI Academy** (https://academy.openai.com/pages/courses): a new "Build with AI"
  path (scope, evaluate, agentic systems, RAG, performance, Codex), announced around Nov 1,
  2026. OpenAI-only.
- **Brilliant, *How LLMs Work*:** seven interactive phone lessons, per a third-party
  listing. The best mobile interactivity around, but it stops at intuition and needs a
  paid subscription.
- **Free video benchmarks** *(from memory)*:
  - Karpathy: *Intro to Large Language Models*, *Deep Dive into LLMs*, *Zero to Hero*.
    LLM101n is still listed as in development at Eureka Labs.
  - 3Blue1Brown's transformer and attention chapters.
  - Theo (t3.gg): news, opinion and model comparisons.
  - These set the bar for explaining how LLMs work. None is a path to building apps.

### bits, rated the same way

- **Coverage:** strong on LLM basics, prompting and context, with depth 3 in all three and
  live graded practice. Tools, agents, RAG and edge deployment are taught with examples
  (depth 2).
- **MCP:** only "use a server", one lesson in `give-your-model-tools`.
- **Missing:** frontend with agents, evals, and coding-agent workflow.
- **Hands-on: 2.** Prompts are run and graded in the browser. In the code courses
  (`first-agent-loop`, `ship-an-agent-to-the-edge`) the learner reads and runs code
  elsewhere, and the app never sees the learner's own Worker.

## Synthesis

### (a) Where bits already wins

1. **Graded practice with zero setup.** A learner's prompt runs on Claude and a Claude
   judge marks it against criteria, free, in the browser, with no key. Every other free
   option needs a key, a notebook or an environment. Scrimba is interactive but paid and
   ungraded. Brilliant is interactive but has no engineering.
2. **Lesson size.** 5–8 minutes and one idea. The free leaders run 1–20 hours per course.
3. **Two reading depths** in the same lesson. Nobody else adapts the text to the reader.
4. **Claude-first, TypeScript, edge.** The official Claude material is Python-first and
   never deploys. Cloudflare's material deploys but isn't Claude-first or a course. That
   intersection is empty.

### (b) Gaps where we must do better (blunt)

1. **We can't out-official Anthropic.** Claude Academy gives away about 20 hours of
   current Claude courses with certificates, MCP and skills included. If a bits lesson is
   only a shorter version of theirs, it has no reason to exist. Each one has to add live
   grading, a toy or a deployed result.
2. **MCP is our weakest topic in the most crowded category.** Anthropic (two courses),
   DLAI, HF, Microsoft, Frontend Masters and Kaggle day 2 all teach building servers. We
   teach using one.
3. **No evals course.** Kaggle, OpenAI Academy, DLAI, anthropics/courses and Maven
   ($4,400) all treat evals as core. We have the judge infrastructure and no course.
4. **No proof of build.** Cloudflare guides, the HF MCP course and Kaggle end with
   something deployed. Our code courses end with reading about a deploy.
5. **Freshness risk on Cloudflare.** The Agents SDK docs changed shape this week. Without
   pinned versions and a CI run of the tutorial, our hands-on courses will break quietly.
6. **Coding-agent workflow is a busy field.** Anthropic, DLAI, HF Context, AI Hero,
   egghead and Frontend Masters all teach skills, subagents and hooks for free or cheaply.
   A concepts course would be the eighth of its kind.
7. **No video, no community, no instructor brand.** Rivals have Discords, livestreams and
   famous teachers. Our trust has to come from accuracy, dates and citations.

### (c) Where we complement (link from "Down the rabbit hole", don't duplicate)

- **Long-form follow-ups:**
  - Claude Academy: *Building with the Claude API*, *Intro to MCP*, *MCP Advanced*,
    *agent skills*, *subagents*.
  - DLAI: *MCP with Anthropic* (the Python counterpart to our TS course).
- **Primary-source essays:** Anthropic's *Building effective agents*, *Writing effective
  tools for agents*, *Effective context engineering*, *Contextual retrieval*.
- **Reference:** Cloudflare's remote MCP guide, Agents SDK reference, Durable Objects
  learning path and RAG tutorial.
- **Intuition:** Karpathy and 3Blue1Brown for `what-is-an-llm`; Brilliant for readers who
  want more toys.
- **Coding-agent context:** HF Context Course (agent-neutral) and AI Hero's dictionary and
  AGENTS.md guide.
- **The deep end of evals:** the Maven AI Evals cohort and Kaggle's *Agent Quality*
  whitepaper.
- **MCP in other languages:** Microsoft MCP for Beginners.

### (d) Recommendations, in priority order

1. **Make the Cloudflare build one repo with checkpoints and a grader (L).** Give each
   lesson a git tag. Add a check, either a CLI or bits calling the learner's
   `workers.dev` URL, that marks the step done. No free course goes from `npm create` to a
   deployed Claude agent and then verifies it.
2. **Pin versions and re-run the tutorial in CI every week (M).** State the package
   versions and a "verified on" date in every code lesson. Run a scheduled job that
   scaffolds the tutorial against the latest `agents` and `wrangler` releases and fails
   loudly. Cloudflare rewrote its quick start on Oct 29, 2026.
3. **Audit `ship-an-agent-to-the-edge` against the current Agents SDK docs (S).** It uses
   `Agent`, `getAgentByName` and `this.sql`. The `Agent` class still exists, but the docs
   now frame it as Lifecycle plus capabilities. Fix the details before the new tutorials
   build on it.
4. **MCP course: remote-first, TypeScript, on Workers (L).**
   - Teach `createMcpHandler`, Streamable HTTP and OAuth.
   - Test with MCP Inspector and Claude.
   - Cover MCP security: tool poisoning, confused deputy, scoped tokens.
   - Grade it by connecting to the learner's deployed server and calling a tool.
   - Link Anthropic's and DLAI's Python courses for anyone who wants the long version.
5. **Use Claude by default through AI Gateway, with one Workers AI swap lesson (S).** This
   keeps our Claude-first niche and stays honest about cheaper options.
6. **A short evals course built on the coach and judge we already run (M).** Learners
   write cases and a rubric, then see where their judge agrees or disagrees with ours.
7. **Frontend with agents: ship a real UI and grade the deployed page (L).** Build with
   Claude Code and a skill. Grade the live page with axe, a screenshot rubric and a test.
   Leave skills theory to Anthropic and HF and link them.
8. **Lead with "try a graded prompt in 30 seconds, no key" (S).** Put a live exercise on
   the landing page and on signed-out course pages, so the difference shows before anyone
   reads a syllabus.
9. **Mark phone lessons and desk lessons (S).** Concepts and checks work on a phone; the
   build steps need a laptop. Let learners carry their progress from one to the other.
10. **Certificates that link to proof of work (M).** HF and Kaggle show that certificates
    drive sign-ups. Ours can link to the learner's deployed agent or MCP server, checked
    by bits.
11. **A coding-agent workflow mini-course (M).** Five graded lessons on AGENTS.md, hooks,
    and plan, test, review. This fills our biggest topic gap and leads into the frontend
    course. See the AI Hero notes.
12. **Curate "Down the rabbit hole" from section (c) (S).** This makes bits the fast front
    door to the long official courses at almost no cost.

## Sources

Fetched 2026-11-03 unless noted:

- https://anthropic.skilljar.com/
- https://academy.claude.com/ ,
  https://academy.claude.com/products/platform ,
  https://academy.claude.com/courses/building-with-the-claude-api
- https://github.com/anthropics/courses
- https://www.deeplearning.ai/courses ,
  https://www.deeplearning.ai/courses/mcp-build-rich-context-ai-apps-with-anthropic ,
  https://www.deeplearning.ai/courses/agent-skills-with-anthropic ,
  https://www.deeplearning.ai/membership
- https://huggingface.co/learn/mcp-course/en/unit0/introduction ,
  https://huggingface.co/learn/context-course/en/unit0/introduction
- https://spectrumailab.com/blog/hugging-face-free-courses-ranked-2026 (status of the HF
  Agents Course)
- https://www.aihero.dev/cohorts/ai-coding-for-real-engineers-m0k0w ,
  [../aihero/NOTES.md](../aihero/NOTES.md) (crawled 2026-10-29)
- https://developers.cloudflare.com/agents/ ,
  https://developers.cloudflare.com/agents/getting-started/quick-start/ ,
  https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/ ,
  https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/ ,
  https://labs.cloudflare.dev/agents ,
  https://developers.cloudflare.com/learning-paths/
- https://github.com/microsoft/ai-agents-for-beginners ,
  https://microsoft.github.io/generative-ai-for-beginners/ ,
  https://github.com/microsoft/mcp-for-beginners
- https://www.kaggle.com/learn-guide/5-day-agents ,
  https://blog.google/innovation-and-ai/technology/developers-tools/ai-agents-intensive-recap-2026/
- https://academy.langchain.com/
- https://scrimba.com/ai-engineer-path-c02v ,
  https://scrimba.com/articles/best-ai-engineering-courses-and-certifications-in-2026/
- https://master.dev/topics/artificial-intelligence/ ,
  https://master.dev/courses/background-ai-agents/
- https://maven.com/parlance-labs/evals ,
  https://maven.com/stemplicity/become-an-agentic-ai-engineer
- https://www.freecodecamp.org/news/build-a-production-rag-system-with-cloudflare-workers-handbook/
- https://academy.openai.com/pages/courses
- https://egghead.io/q/claude-code
