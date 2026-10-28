---
# sources (checked 2026-10-27):
# - Anthropic, Prompt caching (prefix match over tools → system → messages up to the
#   cache_control block; any change invalidates that level and everything after; automatic
#   caching via a top-level cache_control; 5-minute default lifetime, refreshed free on each
#   use, measured from the start of the request; 1-hour TTL at extra cost; writes 1.25× base
#   input (5 min) or 2× (1 h); reads 0.1× (0.05× on Opus 5.5 and Sonnet 5.5, 0.025× on
#   Fable 5.1); Haiku 5.5 up to 100K-token prompts: $0.10 base, $0.125 5-min write, $0.01
#   read per MTok; minimum cacheable prompt 512 tokens on current models, shorter prompts
#   aren't cached and no error is returned; check usage.cache_creation_input_tokens and
#   usage.cache_read_input_tokens; improved time-to-first-token for long documents)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-caching
# - Anthropic, Context windows (cached prefixes still occupy the context window)
#   https://platform.claude.com/docs/en/build-with-claude/context-windows
# - TypeScript cache_control syntax from the claude-api skill (typescript/claude-api/README.md)
title: "Prompt caching"
order: 5
minutes: 8
xp: 40
module: Keeping it lean
---

Lots of requests start the same way: the same instructions, the same
handbook, the same long chat history, and only the last bit changes.
**Prompt caching** lets Claude keep the work it did on that shared start,
so the next request that begins with exactly the same text skips straight
to the new part. It's cheaper, and faster to the first token on long
prompts.

The rule that makes or breaks it: **caching is a prefix match.** Claude
reads a request in a fixed order (tools, then the system prompt, then the
messages) and a cache hit needs every token up to your cache marker to be
identical. Change one character early on, and everything after it misses.

So put what **never changes first**, and what **changes every time last**:

:::code{file="handbook-bot.ts" lang="ts" copy highlight="9-13"}
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function askHandbook(handbook: string, question: string) {
  const res = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 1024,
    system: [
      { type: "text", text: "Answer staff questions from the handbook. Quote it." },
      {
        type: "text",
        text: `<document>${handbook}</document>`,
        cache_control: { type: "ephemeral" }, // cache everything up to here
      },
    ],
    messages: [{ role: "user", content: question }], // changes every time
  });

  console.log(res.usage.cache_creation_input_tokens, res.usage.cache_read_input_tokens);
  return res;
}
:::

The first call writes the cache; the next ones read it. This is example
output, not a live run:

:::terminal{cmd="npx tsx handbook-bot.ts" summary="example output · one write, then reads"}
[ion]question 1[quiet]  cache_creation=[volt]50,214[quiet]  cache_read=0
[ion]question 2[quiet]  cache_creation=0  cache_read=[volt]50,214
[ion]question 3[quiet]  cache_creation=0  cache_read=[volt]50,214
:::

For a chat, there's a shortcut: put one `cache_control` at the top level of
the request and the API moves the marker forward to the newest message for
you (Anthropic calls this automatic caching).

---

**The price**, as of October 2026. Writing to the cache costs a bit more than
normal input: **1.25×** for the default cache. Reading from it costs
**0.1×**, and less on some models (0.05× on Opus 5.5 and Sonnet 5.5). On
Haiku 5.5 that's $0.125 per million tokens to write and **$0.01** to read,
against $0.10 uncached.

Say staff ask 10 questions about a 50,000-token handbook in a few minutes.
Uncached, that's 10 × 50,000 tokens at $0.10 per million: **$0.05**.
Cached, it's one write ($0.00625) plus nine reads ($0.0045): about
**$0.011**, nearly 80% less.

**The fine print.** The cache lives for 5 minutes and every hit resets the
clock for free. A 1-hour cache exists, at 2× the write price, for traffic
with longer gaps. On current models a prefix shorter than **512 tokens**
isn't cached at all, and you get no error, so check
`cache_read_input_tokens` in the response. And cached tokens still take up
room in the window: caching changes what you pay, not what fits.

:::quiz{id="cache-layout" xp=20}
Your system prompt is a 20,000-token handbook. Which layout gets cache hits on every question?

- [ ] “Current time: 14:02:37” first, then the handbook, then the question
  Not quite. The time changes every request, so the prefix never matches and nothing after it is reused.
- [x] The handbook first, then the cache marker, then the time and the question
  Right. Everything stable sits before the marker; everything that changes sits after it.
- [ ] The question first, then the handbook
  Not quite. The question is different every time, so the very first tokens differ and the cache misses.
:::

:::quiz{id="too-short" xp=20}
You mark a 300-token system prompt with `cache_control` on Claude Haiku 5.5 and send it again a minute later. What happens?

- [ ] The second request reads it from the cache
  Not quite. 300 tokens is under the 512-token minimum for current models.
- [ ] The API returns an error about the cache
  Not quite. It fails quietly: no error, just no cache.
- [x] Nothing is cached, and both requests pay full price
  Right. Too-short prefixes are processed without caching. `cache_read_input_tokens` shows 0.
:::

:::rabbithole
- read "Prompt caching" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-caching"
- read "Pricing" by="Anthropic" url="https://platform.claude.com/docs/en/about-claude/pricing"
:::
