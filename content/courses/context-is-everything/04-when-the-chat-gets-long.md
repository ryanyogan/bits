---
# sources (checked 2026-10-27):
# - Anthropic, Context windows (each turn's input is all previous history plus the new message;
#   previous turns are preserved completely; compaction is the primary strategy for long
#   conversations; context editing clears old tool results and thinking blocks)
#   https://platform.claude.com/docs/en/build-with-claude/context-windows
# - Anthropic, Compaction overview (beta; Claude writes a summary of older turns on the server
#   and it replaces them; on demand or at a token threshold; recent turns can stay word for
#   word; or run your own summarizer)
#   https://platform.claude.com/docs/en/build-with-claude/compaction
# - Anthropic Engineering, Effective context engineering for AI agents (compaction in Claude
#   Code keeps architectural decisions, unresolved bugs and implementation details, drops
#   redundant tool outputs; overly aggressive compaction loses subtle details)
#   https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
# - Messages API is stateless; usage.input_tokens per response (claude-api skill)
title: "When the chat gets long"
order: 4
minutes: 7
xp: 40
module: Packing it
---

The API has no memory, so a chat works by re-sending the **whole history**
every turn. Each new message rides on top of everything before it:

:::code{file="chat.ts" lang="ts" copy highlight="12"}
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const messages: Anthropic.MessageParam[] = [];

export async function chat(text: string) {
  messages.push({ role: "user", content: text });

  const res = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 1024,
    messages, // the whole history, every turn
  });

  messages.push({ role: "assistant", content: res.content });
  console.log(`input_tokens=${res.usage.input_tokens}`);
  return res;
}
:::

Run a few turns and the input count only goes one way. This is example output,
not a live run:

:::terminal{cmd="npx tsx chat.ts" summary="example output · input grows every turn"}
[ion]turn 1[quiet]  input_tokens=[volt]38
[ion]turn 2[quiet]  input_tokens=[volt]512
[ion]turn 3[quiet]  input_tokens=[volt]1,047
[ion]turn 4[quiet]  input_tokens=[volt]1,566
:::

Do the sum for a longer chat. If each turn (question plus reply) adds about
500 tokens, turn 20 sends about 10,000 tokens of input. Add up all 20 turns
and you've paid for roughly **105,000** input tokens, because the early
turns were re-sent nineteen times. Long chats also run into the last lesson's
problem: an old tangent stays in the window, competing for attention.

---

Three ways to keep it in check.

**Trim.** Drop the oldest turns. Simple, but anything said early (the user's
name, a key decision) silently disappears.

**Summarise.** Replace older turns with a short summary and keep the recent
turns word for word. Anthropic's API can do this for you: **compaction**
(in beta, October 2026) has Claude write the summary on the server, either
when you ask or when the input passes a token threshold you set. Claude Code
does the same when its context fills: it keeps decisions, open bugs and
details, and drops repeated tool output.

**Clear what's spent.** In agents, old tool results are often the bulk of
the history. Anthropic's context editing can clear them by rule. You'll meet
tools properly in **Give your model tools**.

The art is in what the summary keeps. Too aggressive, and a detail that turns
out to matter later is gone. So a good summary prompt says what to keep and
what to drop.

:::quiz{id="summary-keeps" xp=10}
A trip-planning chat is 60 turns long. Which detail must the summary keep?

- [ ] The assistant's first draft itinerary, which the user rejected
  Not quite. A rejected draft is noise now. Keep why it was rejected, if that matters.
- [x] The user is vegetarian and hates early starts
  Right. Lasting preferences and constraints shape every later answer.
- [ ] The small talk about the weather at the start
  Not quite. That's the first thing to drop.
:::

Your turn. Write the summary prompt for this chat. Say what to keep, what to
drop, and how long the summary can be.

:::prompt{id="summarise-chat" xp=30}
Summarise the chat for a handoff: what to keep, what to drop, how long

- placeholder "Summarise this conversation so another assistant can continue it. Keep … Drop … Under … words."
- draft "Summarise this. User: Planning 3 days in Lisbon in May, budget €600, no flights. Assistant: Here's a draft with a 7am food tour… User: I'm vegetarian and I hate early starts. Assistant: Noted, here's a new plan. User: Actually, make it 4 days."
- check "Asks for a summary"        /summar|recap|condense|handoff|hand off/i
- check "Says what to keep"         /keep|preserve|include|retain|must/i
- check "Says what to drop"         /drop|omit|leave out|skip|ignore|exclude|without/i
- check "Sets a length limit"       /\bwords?\b|\bsentences?\b|\bunder\b|bullets?|\bshort\b|\bbrief\b/i
- check "Includes the conversation" /lisbon/i
- run temperature=[1.0]
- example T=1.0 "Trip: 4 days in Lisbon in May, €600 budget, no flights to book. User is vegetarian and wants no early starts, so the 7am food tour is out. Next: revise the plan to 4 days."
- example T=1.0 "Lisbon, May, now 4 days (was 3). Budget €600, flights excluded. Vegetarian; nothing before mid-morning. Open task: extend the itinerary."
- example T=1.0 "User wants a 4-day Lisbon trip in May on €600 (no flights). Constraints: vegetarian food, late starts. The early food tour was rejected."
- success "Short, specific, and nothing that matters got lost." next="Next: prompt caching →"
:::

:::rabbithole
- read "Compaction" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/compaction"
- read "Effective context engineering for AI agents" by="Anthropic" url="https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
:::
