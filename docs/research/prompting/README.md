# Prompting courses and guides: what the best teach (2026-11-03)

Researched with Firecrawl on 2026-11-03 for lane P2 (the prompting course upgrade). Our own
words throughout; no course text copied. Companion to `docs/research/competitors/README.md`.

## What each one teaches well

| Source | Format, price | What it does best | Where it stops |
|---|---|---|---|
| Anthropic, Prompting best practices ([link](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)) | Docs, free | The canonical list for current Claude models: be clear and direct, give the why, examples in tags, XML structure, a role, long documents first with quotes for grounding, say what to do rather than what not to, explicit tool-use instructions (act vs suggest), research prompts with success criteria and source checks, autonomy and safety for agents | Reference, not a course: no practice, no feedback |
| Anthropic, interactive tutorial ([link](https://github.com/anthropics/prompt-eng-interactive-tutorial)) | Notebooks, free, needs a key | Nine chapters plus appendices with exercises; still the best-known hands-on prompting course | Written for Claude 3; Anthropic's own overview says to follow the best-practices page where they differ ([overview](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview)) |
| Claude Academy, AI Fluency ([link](https://academy.claude.com/courses/ai-fluency-framework-foundations/effective-prompting-techniques)) | Video and text, free | Places prompting inside a wider fluency framework (Description is one of its competencies). Six techniques: context, examples, constraints, steps, think first, role and tone | Introductory; no live practice |
| Claude Academy, Building with the Claude API, "Prompt engineering" ([link](https://academy.claude.com/courses/building-with-the-claude-api/prompt-engineering)) | Python notebooks, free | Prompting as a loop: baseline prompt, eval, apply one technique, re-measure | Python and a key; hours long |
| OpenAI, Prompt engineering guide ([link](https://platform.openai.com/docs/guides/prompt-engineering)) | Docs, free | Message roles and authority, Markdown and XML sections (identity, instructions, examples, context), few-shot, RAG context, reasoning vs fast models (high-level vs explicit guidance), stable content first for caching, pin snapshots and build evals, keep prompts in code (reusable prompt objects are being retired 30 Nov 2026) | OpenAI models only |
| Google, Gemini prompt design strategies ([link](https://ai.google.dev/gemini-api/docs/prompting-strategies)) | Docs, free | Always include few-shot examples, add context instead of assuming it, break prompts into parts, iterate by rephrasing or reordering, ground with search, agentic prompt dimensions | Gemini-specific parameters; little on tools beyond grounding |
| DeepLearning.AI, ChatGPT Prompt Engineering for Developers ([link](https://www.deeplearning.ai/courses/chatgpt-prompt-eng)) | 9 videos, free (graded assignment is Pro) | Two principles (clear instructions, time to think) applied to summarising, inferring, transforming, expanding | Dated (2023, ChatGPT-era API); watch-only for free users |
| Learn Prompting ([link](https://learnprompting.org/docs/introduction), [course](https://stage.learnprompting.org/courses/introduction-to-prompt-engineering)) | Free docs; course $21/mo | Breadth: 60+ modules; the course adds hallucination spotting, conflicting outputs, bias and ethics with assignments | Long; much of the technique catalogue is research-paper history, not current practice |
| AI Hero (Matt Pocock) ([skills](https://github.com/mattpocock/skills), [writing for agents](https://www.aihero.dev/skills-writing-for-agents), our notes in `docs/research/aihero/`) | Articles, free skills repo (MIT); paid cohorts | Prompting as engineering for agents: align first (the grill-me interview), a shared glossary, tight feedback loops, skills as small composable instructions; skill descriptions cost context every request | Coding-agent focused; not a beginner prompting path |

## What our course (prompting-that-works, before this lane) lacked

1. **Context as a budget.** We taught *what* to put in a prompt but not that tools, skills and
   fetched pages share the same window. Anthropic's context engineering post frames context as
   "a precious, finite resource" ([link](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents)).
2. **Prompting with tools.** Nothing on MCP servers or connectors, on research prompts (name the
   tool, the sources, the fields, ask for URLs), or on "act vs suggest". Anthropic's best-practices
   page and the Claude help centre both cover these; no beginner course does it with Claude.
3. **Fetched content is untrusted.** Lesson 04 teaches it for a pasted email; tools make it
   routine (every scraped page), so it needed repeating where tools are introduced.
4. **Reusable prompts.** Nothing on skills: write the instructions once, load them only when
   needed. Matt Pocock's skills are the best public examples; Anthropic made Agent Skills an open
   standard ([post](https://www.anthropic.com/research/equipping-agents-for-the-real-world-with-agent-skills)).
5. **Align before you prompt.** AI Hero's strongest idea: have the model interview you first.
   Lesson 12 teaches the prompt and points to `/grill-me`.

Items 1 and 4 are taught elsewhere in bits (context-is-everything; work-with-coding-agents 04),
so lessons 10–12 cover 2, 3 and 5 and link to those courses.

Already strong, kept as they are: clear ask, the why, examples, XML tags, roles, formats,
thinking, chains, testing (lessons 01–09) and the release-notes checkpoint.

## Best practices we adopt (and where)

Checked again with Firecrawl (`maxAge: 0`) on 2026-11-03 while writing lessons 10–12.
Context budgets are already taught in context-is-everything (02, 06), and installing MCP
servers and writing skills in work-with-coding-agents (04, 05), so the new lessons teach the
**prompting** side only and link there.

| Practice | Source | Where in bits |
|---|---|---|
| Plain verbs get action: "can you suggest" gets suggestions, "change this" gets changes | Anthropic best practices, "Tool usage" | prompting-that-works 10 |
| Ask for a short numbered plan and a stop before a multi-step tool job | Anthropic best practices (structured approach); AI Hero, plan mode | prompting-that-works 10 |
| Name the tool, the sources that count, the fields, a URL per value, and "not found" for gaps | Anthropic best practices, "Research and information gathering" and "Tool usage" | prompting-that-works 11 |
| Ask for fields, not whole pages: tool output fills the window | Anthropic context engineering (2025-09-29: token-efficient tools, just-in-time retrieval); Claude Code MCP docs (10k-token warning, 25k default cap) | prompting-that-works 11 |
| Fetched pages are data, never instructions; connect only servers you trust | Claude Code MCP docs (prompt-injection warning); lesson 04 | prompting-that-works 11 |
| Align first: Claude interviews you, one question at a time, each with a recommended answer | Matt Pocock, grill-me (`mattpocock/skills`: `/grill-me`, `/grill-with-docs`) | prompting-that-works 12 |
| Save a prompt you reuse as a skill; its description decides when it loads | Claude Code skills docs | prompting-that-works 12 (pointer), work-with-coding-agents 04 |
| Iterate against a few test cases | Academy API course; OpenAI evals; Google iteration | prompting-that-works 09 (kept) |
| All of the above, applied to briefing Claude Code to build a UI | — | `docs/plans/build-along/prompting-practices.md` |

## Not adopted (yet)

- Sycophancy and neutral wording (AI Hero notes, item 97): a good candidate lesson for a later
  pass.
- Bias and ethics modules (Learn Prompting): out of scope for a prompting-skills course; partly in
  what-is-an-llm 08.
