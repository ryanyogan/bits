---
# sources (checked 2026-10-27):
# - Anthropic, Tool use with Claude ("server tools" such as web_search, web_fetch, code_execution
#   and tool_search run on Anthropic's infrastructure; results come back in the same response)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
# - Anthropic, Web search tool (web_search_20260209 adds dynamic filtering on Claude 4.6 and later
#   models; Claude searches for current or changing information and answers stable knowledge
#   directly; max_uses; allowed_domains / blocked_domains; cited sources; $10 per 1,000 searches
#   plus tokens; errors come back as a result block with an error_code, e.g. max_uses_exceeded)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
# - Anthropic, Code execution tool (code_execution_20260521 is the latest; sandboxed container
#   with Python 3.11 and Bash; no internet access; 1,550 free hours per organization per month,
#   then $0.05 per hour per container; free when used with web_search/web_fetch 20260209+)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool
# - claude-api skill server-tools reference (2026-10-06): web_search_20260209 on Opus 5.5 / Sonnet 5.5
# Terminal block: example output written for this lesson, not a recorded run.
title: "Tools Anthropic runs"
order: 8
minutes: 6
xp: 40
module: Real-world calls
---

Everything so far has been a **client tool**: Claude asks, your code runs
it. Some tools are so common that Anthropic runs them for you. These are
**server tools**. You add one line to `tools`, and the call, the run and the
result all happen inside a single API request. Your code never sees a
`tool_use` to handle.

As of October 2026, the main ones are **web search** (look things up, with
citations), **web fetch** (read a page whose URL is already in the
conversation), and **code execution** (run Python and Bash in a sandbox).

:::code{file="search.ts" lang="ts" copy highlight="9-11" label="one line turns it on"}
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const reply = await client.messages.create({
  model: "claude-sonnet-5-5",
  max_tokens: 4096,
  messages: [{ role: "user", content: "What changed in the latest TypeScript release?" }],
  tools: [
    { type: "web_search_20260209", name: "web_search", max_uses: 3 },
  ],
});

for (const block of reply.content) {
  if (block.type === "text") console.log(block.text);
}
:::

:::terminal{cmd="npx tsx search.ts"}
[muted]example output, written for this lesson (not a live run)
[ion]server_tool_use[quiet]          web_search { query: "TypeScript latest release notes" }
[volt]web_search_tool_result[quiet]   8 results
[ion]text[quiet]                     The latest release adds … (with citations to the pages it used)
:::

Notice the `type`: server tools don't take a name you make up or a schema
you write. You pick a **versioned type** from Anthropic's docs, like
`web_search_20260209`, and Anthropic owns the description. Newer versions add
features, so check the docs for the current one and the models that support
it.

---

Each one has its own controls and costs. **Web search** costs $10 per 1,000
searches plus tokens, and the search results count as input tokens, so cap it
with `max_uses` and restrict it to trusted sites with `allowed_domains` when
you can. **Code execution** runs in a container with **no internet access**.
Each organization gets 1,550 free hours a month, then it's $0.05 an hour per
container, and it's free when you use it alongside the newer web search or
web fetch. (Prices as of October 2026.)

When a server tool fails, the request doesn't. You get a normal reply with a
result block that holds an `error_code`, like `max_uses_exceeded`, and Claude
usually explains what happened in its answer.

:::quiz{id="who-runs-it" xp=20}
You add `{ type: "web_search_20260209", name: "web_search" }` to your tools. Who runs the search?

- [ ] Your code, after Claude returns a tool_use block
  Not quite. That's a client tool. Server tools never hand you a call to run.
- [x] Anthropic, inside the same request
  Right. The searches and the results happen server-side, and you get the finished answer.
- [ ] Claude, from memory
  Not quite. That's what happens with no tools at all. Search fetches live pages.
:::

:::quiz{id="server-or-client" xp=20}
Which job needs a client tool you write yourself?

- [ ] Finding this week's news about a library
  Not quite. Web search already does that.
- [ ] Running a quick pandas calculation on a CSV
  Not quite. Code execution can do that in its sandbox.
- [x] Checking a customer's order in your database
  Right. Anthropic can't reach your database. Only your code can.
:::

That's the rule of thumb: use a server tool when Anthropic already offers
it, and write a client tool for **your** systems.

:::rabbithole
- read "Web search tool" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool"
- read "Code execution tool" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool"
:::
