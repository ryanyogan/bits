# Sources to crawl next

Free, best-in-class sources for bits lessons, after AI Hero (`docs/research/aihero/`).
Mapped with `firecrawl map` on 2026-10-29 (about one credit per site). Nothing below was
scraped. Every URL listed here showed up in a map result. "Pages" is the number of URLs
the map returned, capped at 400.

Crawl rule for all of these: save raw text under `docs/research/<source>/raw/`, which
`.gitignore` already covers, and write only our own summaries in the committed files.

| Source | Start URL | Pages mapped | Shape for crawling | Why |
|---|---|---|---|---|
| Claude developer docs | https://platform.claude.com/docs/en/llms.txt | 393+ | Clean. Has `llms.txt` and `.md` twins (e.g. `/docs/en/models/overview.md`, `/docs/en/about-claude/pricing.md`). Scrape the `.md` twins from `llms.txt`, skip `/api/<lang>/…` SDK reference pages and non-`/en/` locales. | Canonical for model names, prices, tool use, prompt caching, thinking. Every bits lesson that names a model or price must check here. `docs.claude.com` mapped noisy (query-string duplicates); use platform.claude.com. |
| Anthropic engineering blog | https://www.anthropic.com/engineering | 17 | Small, clean article pages; strip query strings (the map returned tracking variants). Seen: `building-effective-agents`, `claude-code-best-practices`, `claude-think-tool`, `built-multi-agent-research-system`, `code-execution-with-mcp`, `demystifying-evals-for-ai-agents`, `building-agents-with-the-claude-agent-sdk`, `a-postmortem-of-three-recent-issues`, `infrastructure-noise`. | First-party agent, eval and harness practice; AI Hero often builds on these (e.g. its `building-effective-agents` and think-tool posts). Grounds first-agent-loop, give-your-model-tools and a future evals course. |
| Anthropic research | https://www.anthropic.com/research | 232 | Mostly papers and announcements; select by hand (e.g. `research/claude-code-sandboxing`). | Background for "what it can't do" and safety lessons. Low priority; pick per lesson. |
| Anthropic courses (GitHub) | https://github.com/anthropics/courses | 71 (mostly issues/PR chrome) | Notebook folders; the map surfaced `prompt_engineering_interactive_tutorial` and `prompt_evaluations`. Clone or read raw files rather than scraping GitHub HTML; check the README for the other folders. | Anthropic's own prompt-engineering and eval curriculum: the closest primary source to prompting-that-works. Use for ideas only (MIT-style licence aside, our words). |
| Claude cookbooks (GitHub) | https://github.com/anthropics/claude-cookbooks | 90 | Notebooks (`misc/building_evals.ipynb`, `misc/building_moderation_filter.ipynb`, `skills/…`, `managed_agents/…`). Read raw notebooks, not GitHub HTML. | Worked, runnable recipes for evals, moderation, skills and agents: exercises to adapt. |
| Anthropic Academy | https://academy.claude.com/learn (anthropic.com/learn redirects here) | 1 | Course platform; map found only the landing page, so lessons are likely behind sign-in or client-rendered. Check by hand before crawling. | Official free courses on the API and Claude Code. |
| 3Blue1Brown | https://www.3blue1brown.com/lessons/gpt | 215 | Clean lesson pages with text versions of the videos. Relevant: `lessons/gpt`, `lessons/attention`, `lessons/mini-llm`, `lessons/transformers-talk`, `lessons/neural-networks`, `lessons/gradient-descent`, `lessons/backpropagation`. | Best visual intuition for what-is-an-llm (next-token, attention, embeddings). Link in rabbit holes; don't reproduce visuals. |
| Andrej Karpathy | https://karpathy.ai | 56 | Small static site. Relevant: `intro-to-llms`, `llm-course/zero-to-hero.html`, `llm101n.html`, `microgpt.html`, `nanochat`, `blog/software-is-changing`, `blog/verifiability.html`, `blog/vibe-coding.html`, `blog/2025-10-llm-evals`. | Primary source for how LLMs are trained and the "LLM OS" framing. Videos themselves are on YouTube (not mapped). |
| Theo (t3.gg) | https://t3.gg/blog | 32 | Site is thin: only three blog posts mapped, one relevant (`blog/post/what-is-a-harness`). His teaching is on YouTube (linked from `t3.gg/youtube`), which needs transcripts, not a crawl. | Opinionated, current takes on harnesses, model choice and costs; good for "Down the rabbit hole" links. |
| Vercel AI SDK docs | https://ai-sdk.dev | 330 | Clean docs; skip `/providers/community-providers/*`. | AI Hero teaches with it; useful if bits adds a TypeScript-SDK track or compares to the Anthropic SDK. Version-sensitive (check against the installed version). |
| Model Context Protocol | https://modelcontextprotocol.io | 330 | Versioned spec with `.md` twins (`/specification/2026-07-28/...md`, older `2025-11-25`). Crawl only the newest version. | Canonical for give-your-model-tools/09-mcp. |
| Cloudflare Agents docs | https://developers.cloudflare.com/agents | 164 | Clean, with `index.md` twins. | Our runtime: grounds ship-an-agent-to-the-edge (state, workflows, MCP on Workers). |
| Gemini API docs | https://ai.google.dev/gemini-api/docs | 398+ | Many locale/`authuser` duplicates; strip query strings. | Only for a future "compare providers" lesson. |
| OpenAI Cookbook | https://cookbook.openai.com | 1 | Map returned just the home page (client-rendered). Would need a different approach (its GitHub repo). | Only for provider comparisons. Low priority. |

Suggested order: Claude docs (`llms.txt`) → Anthropic engineering → anthropics/courses →
3Blue1Brown transformer lessons → Karpathy → Cloudflare Agents → MCP spec. Firecrawl
credits after the AI Hero crawl and these maps: 944 remaining.
