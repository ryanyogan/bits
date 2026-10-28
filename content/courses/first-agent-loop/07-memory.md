---
# sources (checked 2026-10-27):
# - Claude API docs, multi-turn: the API is stateless; send the full history each time
#   https://platform.claude.com/docs/en/build-with-claude/working-with-messages
# - Anthropic, Effective context engineering for AI agents (2025-09-29: context rot, the
#   "attention budget", smallest set of high-signal tokens; compaction, tool-result clearing,
#   structured note-taking)
#   https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
# - Anthropic docs, Compaction overview (beta, server-side summaries) and Context editing
#   (beta, tool result clearing)
#   https://platform.claude.com/docs/en/build-with-claude/compaction
#   https://platform.claude.com/docs/en/build-with-claude/context-editing
# - Anthropic docs, Preserved thinking ("make your integration append-only"; editing or
#   trimming earlier turns invalidates later thinking blocks; 400 by default for accounts
#   created on or after 2026-08-31)
#   https://platform.claude.com/docs/en/build-with-claude/preserved-thinking
# - Anthropic docs, Memory tool (client-side; files under /memories that your code stores)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
# - Anthropic, Effective harnesses for long-running agents (2025-11-26: progress file + git log)
#   https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
# - Code typechecked against @anthropic-ai/sdk 1.3.0 (2026-10-27).
title: "Memory"
order: 7
minutes: 8
xp: 40
module: Shipping it
---

Ask your agent about Chicago, then ask “and the day after?” With last
lesson's code it has no idea what you mean. Claude doesn't remember anything
between requests. The API is **stateless**: each request carries the whole
conversation, and the model sees nothing else.

So an agent's memory is just **the `messages` array you keep**. Move it out
of the function, pass it in each time, and every follow-up sees everything
that came before: the questions, the tool calls, the results.

:::code{file="chat.ts" lang="ts" copy highlight="5" label="memory is this array"}
import * as readline from "node:readline/promises";
import type Anthropic from "@anthropic-ai/sdk";
import { agent } from "./agent";

const history: Anthropic.MessageParam[] = []; // lives as long as the chat
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

while (true) {
  const question = await rl.question("you › ");
  if (!question.trim()) break;
  console.log(await agent(history, question)); // agent() pushes onto history
}
rl.close();
:::

Inside `agent()`, the only change is the first line: push the user's
question onto `history` instead of starting a fresh array.

---

That memory isn't free. Every request re-sends the whole history, so a long
chat pays for its early turns again and again. Quality slips too. Anthropic
calls it **context rot**: the more tokens in the window, the worse the model
gets at recalling any one of them. Context is a budget, and Anthropic's
advice is to fill it with the **smallest set of high-signal tokens** you can.

On current models there's a catch: **don't edit old turns yourself**. Claude's
earlier thinking is tied to everything before it, so trimming or rewriting
past messages breaks it, and newer accounts get a 400 error for it (as of
October 2026). Keep `system` and `tools` fixed, only ever append, and let the
API do the trimming.

:::quiz{id="where-memory-lives" xp=10}
A user comes back to your agent tomorrow, in a new process. What does Claude remember of yesterday's chat?

- [ ] Everything. The API keeps each conversation for you.
  Not quite. The Messages API is stateless. Nothing carries over unless you send it.
- [x] Only what your code saved and sends back in the new request
  Right. Memory is whatever you store and replay: the history, or notes about it.
- [ ] A summary, if the account has memory turned on
  Not quite. That's a feature of apps like claude.ai, not of the API your agent calls.
:::

---

When the history gets long, there are three tools for it, from Anthropic's
context engineering guide. **Clear old tool results**: once the agent has
used a raw forecast, it rarely needs to read it again. **Compact**: replace
older turns with a summary and carry on. **Take notes**: the agent writes the
facts worth keeping to a file outside the context window, and reads them
back next time.

The first two are API features, in beta as of October 2026: context editing
clears tool results, and compaction writes the summary on Anthropic's side.
For notes, Anthropic has a **memory tool**: Claude asks to read and write
files under `/memories`, and your code stores them wherever you like. Their
long-running agent harness does the same with a plain progress file.

Whoever writes the summary, the prompt behind it decides what survives, and
the API's compaction takes your own instructions for it. Your turn: write
one. Paste a short chat and ask Claude to boil it down to notes a fresh
session could pick up from.

:::prompt{id="compact-notes" xp=30}
Ask Claude to compress a conversation into notes for next time

- placeholder "Summarise this chat as notes for an assistant that starts fresh tomorrow. Keep … Drop … Under … words. Chat: user: … assistant: …"
- draft "Summarise this chat. user: What's the weather in Chicago tomorrow? assistant: 75°F and dry. user: I bike to work, leaving at 8."
- check "Asks for notes or a summary"   /summar|notes|compress|condense|boil/i
- check "Says what to keep"             /\bkeep\b|preferences?|decisions?|facts?|open|unanswered|remember/i
- check "Sets a length limit"           /\bwords?\b|\bsentences?\b|\bunder\b|\bshort\b|\bbrief\b|\bbullets?\b|\bmax/i
- check "Includes the chat"             /user:|assistant:|\bme:|\byou:|\bchat\b|conversation/i
- run temperature=[1.0]
- example T=1.0 "User lives in Chicago and bikes to work, leaving at 8 a.m. Last forecast checked: tomorrow 75°F and dry. Re-check before answering anything about later days."
- example T=1.0 "Notes: location Chicago. Commutes by bike, leaves 8:00. Cares about rain and wind at that hour. Tomorrow looked dry, 75°F (may be stale)."
- example T=1.0 "Chicago-based bike commuter, departs 8 a.m. Wants go/no-go advice on biking. One forecast checked so far (dry, 75°F)."
- success "Short, factual, and it flags what might be stale. That's a summary an agent can trust." next="Next: limits and logs →"
:::

Notice what good notes keep: **who, what they want, and what's still
uncertain**. The raw tool results are gone; the facts they taught survive.

:::rabbithole
- read "Effective context engineering for AI agents" by="Anthropic" url="https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
- read "Effective harnesses for long-running agents" by="Anthropic" url="https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents"
- read "Memory tool" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool"
:::
