---
# sources (checked 2026-11-03):
# - Claude Code docs, Connect Claude Code to tools via MCP (claude mcp add --transport http
#   <name> <url>; stdio: claude mcp add [options] <name> -- <command> [args...]; --scope local,
#   project (writes .mcp.json), user; claude mcp list; /mcp for status and OAuth login;
#   "Verify you trust each server"; servers that fetch external content risk prompt injection)
#   https://code.claude.com/docs/en/mcp
#   (re-checked 2026-11-03 with `claude mcp add --help`, v2.1.317: `claude mcp add my-server
#   -e API_KEY=xxx -- npx my-mcp-server`; --env is variadic, so the name goes first)
# - Context7, MCP clients (remote https://mcp.context7.com/mcp; an API key gives higher rate
#   limits and private repos)
#   https://context7.com/docs/resources/all-clients
# - Firecrawl docs, Firecrawl in Claude & Claude Code
#   (claude mcp add --transport http firecrawl https://mcp.firecrawl.dev/v2/mcp-oauth;
#   search, scrape, interact)
#   https://docs.firecrawl.dev/quickstarts/claude-code
# Toy: the compared replies are illustrative.
title: "Give it new tools"
order: 5
minutes: 7
xp: 50
module: Give it more to work with
verified: 2026-11-03
versions:
  claude-code: "2.1.317"
---

Out of the box, Claude Code can read your files, run commands and fetch a
web page. **MCP servers** give it more tools: a docs search, a browser, your
issue tracker, a database. You met MCP from the other side in **Give your
model tools**; here you're the one plugging servers in.

Two make an immediate difference when you build with fast-moving libraries:

- **Context7** looks up **current** docs for a library, version by version.
  A model's training data is months old; Context7 isn't.
- **Firecrawl** searches the web and reads pages as clean text, for when
  the answer is in a blog post, a changelog or a GitHub issue.

---

Adding a server is one command (checked November 2026):

```sh
claude mcp add --transport http context7 https://mcp.context7.com/mcp
claude mcp add --transport http firecrawl https://mcp.firecrawl.dev/v2/mcp-oauth
```

Then, inside Claude Code, run `/mcp` to see each server's status and sign in
where a server asks (Firecrawl opens a browser login). `claude mcp list`
shows the same from your terminal.

:::new
A server added like this is yours, in this project only. Add `--scope
project` to share it with your team: it's written to a `.mcp.json` file in
the repo. `--scope user` makes it yours in every project.
:::

:::engineer
Scopes: `local` (the default: you, this project), `project` (written to
`.mcp.json` at the repo root and committed, so the team shares it) and
`user` (you, every project). Local servers run as a process:
`claude mcp add <name> --env KEY=value -- <command> [args...]`, with
everything after `--` passed to the server untouched. Put the name before
`--env`: the flag takes several `KEY=value` pairs and would swallow a name
that follows it. Remote servers use OAuth or a
`--header`; `/mcp` runs the login. Context7 works without a key, and a free
key raises its rate limit.
:::

---

:::new
Tools change what the agent can know, but it still needs a nudge to use
them. Say **which source to check** and **what to bring back**: "look up the
current Durable Objects alarm API with Context7 and tell me which version
the docs are for".

One warning from Anthropic's docs: only add servers you trust. A server
that reads the web brings back text written by strangers, and that text
lands in your agent's context. A page can contain instructions aimed at
your agent (**prompt injection**), so keep approvals on for anything risky.
:::

:::engineer
Make tool use explicit in the brief: which server to consult, for what, and
what evidence to return (the doc URL and version, the quoted signature).
That turns "it probably remembered the API" into a checkable claim.

Threat model: every MCP server is code you run or a service you grant
access to, and every fetched page is untrusted input in the context window.
Anthropic's docs flag prompt injection from servers that fetch external
content. Keep the default permission prompts for writes and commands,
prefer read-only tools for research, and don't give a web-reading session
secrets it doesn't need.
:::

:::compare{left="From memory" right="Checked with Context7" illustrative}
- prompt "How do I schedule a Durable Object to wake up in an hour?"
- left "Use setTimeout inside the Durable Object for 3,600,000 ms. It will keep running until the timer fires."
- right "Per the current Durable Objects docs (via Context7): call this.ctx.storage.setAlarm(Date.now() + 3_600_000) and handle it in alarm(). Timers don't survive the object being evicted; alarms do."
:::

:::ask{id="which-server" xp=10}
You're about to use a library that shipped a major version last month. Which brief makes the agent's answer checkable?
- choice "“Use the library's latest API.”" "Not quite. It will use whatever it remembers, which may be the old major version."
- choice "“Look up the current docs with Context7, use that API, and tell me the version and doc page you used.”" correct "Right. It names the source and brings back evidence you can check."
- choice "“Search the web for anything about this library.”" "Too open. It may land on an old blog post, and you won't know which version it used."
:::

---

Your turn. Brief an agent to add a reminder that fires in an hour, using
a Durable Object alarm in `src/reminders.ts`. Tell it to **check the current
docs with Context7 first**, to **report which version** the docs were for,
and to **run `pnpm test`**. The sandbox has no MCP servers, so Claude
replies with how it would go about it.

:::prompt{id="docs-first" xp=40 coach}
Brief a docs-first change: which tool to check, what to bring back, how to prove it

- goal "Get a plan that checks current docs before writing code, reports the version, and runs the tests"
- placeholder "Add a reminder in src/reminders.ts … First look up … with Context7 … tell me the version … then … pnpm test …"
- draft "Add a reminder that fires in an hour using a Durable Object alarm."
- check "Names the docs tool"          /context7/i
- check "Asks for the version"         /version/i
- check "Names the file"               /reminders\.ts|src\//i
- check "Names the check"              /pnpm test|\btests?\b/i
- expect "Starts from the docs"        match /context7|docs|documentation/i
- rubric "Says to check the docs before writing any code" must on=prompt
- rubric "Asks for evidence from the docs: the version or the page used" must on=prompt
- rubric "The reply puts looking up the docs before writing code" should
- hint "Which tool should it check, and what should it bring back from it?"
- hint "Ask for the version and the doc page, so you can check the API it used is current."
- reference "Add a reminder that fires in one hour, in src/reminders.ts, using a Durable Object alarm. Before writing code, look up the current Durable Objects alarm API with Context7, and tell me which version and doc page you used. Then write it with a test and run pnpm test, showing me the output."
- run temperature=[1.0]
- example T=1.0 "1. Query Context7 for the current Durable Objects alarms docs and note the version and page.\n2. Implement the reminder in src/reminders.ts with ctx.storage.setAlarm and an alarm() handler, per those docs.\n3. Add a test, run pnpm test, and share the output along with the doc version I used."
- example T=1.0 "First I'd look up the alarm API in the current docs through Context7 and report the version. Then I'd write the reminder in src/reminders.ts, add a test, and run pnpm test."
- example T=1.0 "Plan: check Context7 for the latest Durable Objects alarm docs (and tell you the version), then implement setAlarm in src/reminders.ts, then run pnpm test and paste the result."
- success "The right tool, named; evidence, requested; a check at the end." next="Next: subagents and hooks →"
:::
:::rabbithole
- read "Connect Claude Code to tools via MCP" by="Anthropic" url="https://code.claude.com/docs/en/mcp"
- read "Firecrawl in Claude Code" by="Firecrawl" url="https://docs.firecrawl.dev/quickstarts/claude-code"
- read "Context7 MCP clients" by="Upstash" url="https://context7.com/docs/resources/all-clients"
:::
