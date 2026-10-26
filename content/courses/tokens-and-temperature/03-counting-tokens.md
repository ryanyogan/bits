---
# sources (checked 2026-10-26):
# - Anthropic, Pricing (Claude Haiku 5.5, prompts up to 100K tokens: $0.10 / MTok input,
#   $0.50 / MTok output; above 100K: $0.50 / $2.50)
#   https://platform.claude.com/docs/en/about-claude/pricing
# - Anthropic, Token counting (POST /v1/messages/count_tokens; free, own rate limits; counts
#   are per model and an estimate; Claude 4.7+ tokenizer ≈ 30% more tokens)
#   https://platform.claude.com/docs/en/build-with-claude/token-counting
# - Anthropic, Models overview (Claude Haiku 5.5: 1M context window, 128K max output)
#   https://platform.claude.com/docs/en/about-claude/models/overview
title: "Counting tokens (and cost)"
order: 3
minutes: 6
xp: 40
module: How text becomes numbers
---

Everything you pay for, and every limit you hit, is counted in **tokens**,
and they come in two kinds.

**Input tokens** are everything you send: your prompt, the instructions, the
earlier messages in the chat, any document you paste in. **Output tokens**
are everything the model writes back.

Output is the expensive half. For Claude Haiku 5.5, the model behind this
sandbox, Anthropic charges **$0.10 per million input tokens** and **$0.50 per
million output tokens** (prices checked October 2026, for prompts up to
100,000 tokens). Each token Claude writes costs five times one it reads.

---

Let's do the maths once, so it stops being scary. A chat turn with a
2,000-token prompt and a 500-token reply costs 2,000 ÷ 1,000,000 × $0.10 =
**$0.0002** for the input, plus 500 ÷ 1,000,000 × $0.50 = **$0.00025** for the
output.

That's **$0.00045** in total, under a twentieth of a cent. Cost only gets interesting
at scale, or when a chat history grows: every turn re-sends everything
before it as input.

:::quiz{id="cheaper-turn" xp=20}
You want to halve the bill for a chatbot. Prompts are about 1,000 tokens; replies are about 800. What helps most?

- [ ] Shorten the prompt to 500 tokens
  Not quite. That saves $0.00005 a turn. Input is the cheap half.
- [x] Ask for replies of about 200 tokens
  Right. Cutting 600 output tokens saves $0.0003 a turn, six times more than trimming the prompt.
- [ ] Switch tokenizers
  Not quite. You can't choose a model's tokenizer, and its counts are what you're billed for.
:::

---

**Don't guess the count. Measure it.** Rules of thumb about words per token
break on code, numbers and other languages, and every model family counts
differently. Even Claude's newer models count the same text as about 30% more
tokens than older ones.

Anthropic's API has a free `count_tokens` endpoint: send the same request you
would send to Claude, and it returns the input token count without running the
model. Use the model id you'll actually call, and treat the result as a close
estimate. Don't count Claude tokens with another provider's tokenizer
library; it gives you that provider's count, not Claude's.

The cheapest output token is the one you never ask for. Your turn: ask Claude
to explain what a token is, with a length limit.

:::prompt{id="short-answer" xp=20}
Ask for an explanation with a length limit

- placeholder "Explain … in under … words."
- draft "Explain what a token is."
- check "Asks about tokens"     /token/i
- check "Sets a length limit"   /\bwords?\b|\bsentences?\b|\bunder\b|\bshort\b|\bbrief\b|\bmax/i
- run temperature=[1.0]
- example T=1.0 "A token is a chunk of text, like a word or part of one, that a model reads and writes."
- example T=1.0 "Tokens are the small pieces a model splits text into before turning them into numbers."
- example T=1.0 "A token is a piece of text, often a word or word fragment, that a language model processes as one unit."
- success "Short ask, short (cheap) answer." next="Next: probabilities, not answers →"
:::

:::rabbithole
- read "Token counting" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/token-counting"
- read "Pricing" by="Anthropic" url="https://platform.claude.com/docs/en/about-claude/pricing"
:::
