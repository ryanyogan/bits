---
# sources (checked 2026-10-27):
# - Anthropic, Models overview (every current Claude model: 1M-token context window, roughly
#   555k words on the current tokenizer)
#   https://platform.claude.com/docs/en/about-claude/models/overview
# - Anthropic, Introducing Contextual Retrieval (2024-09-19): under ~200k tokens (~500 pages),
#   include the whole knowledge base in the prompt and use prompt caching; RAG for larger ones
#   https://www.anthropic.com/engineering/contextual-retrieval
# - Anthropic, Pricing (Claude Haiku 5.5, prompts up to 100K tokens: $0.10 / MTok input,
#   $0.125 / MTok 5-minute cache write, $0.01 / MTok cache hit; prompts over 100K cost 5x)
#   https://platform.claude.com/docs/en/about-claude/pricing
# - Anthropic, Context windows ("more context isn't automatically better": accuracy and recall
#   degrade as tokens grow, "context rot")
#   https://platform.claude.com/docs/en/build-with-claude/context-windows
# - Anthropic, Effective context engineering for AI agents (2025-09-29): "just in time"
#   retrieval with tools; Claude Code uses glob and grep instead of an index
#   https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
# - AI Hero (Matt Pocock), Contextual knowledge (facts in the window vs. in the parameters)
#   https://www.aihero.dev/ai-coding-dictionary/contextual-knowledge
title: "Paste it or search it?"
order: 1
minutes: 6
xp: 40
module: Do you need retrieval?
---

Claude knows a lot, but it doesn't know **your** stuff: your docs, your
tickets, the decision your team made yesterday. Its training is frozen, so
the only way to give it a fact it lacks is to put that fact in the prompt.

**Retrieval** is a way to pick which facts go in. You search your documents
for the passages that match the question, and send Claude only those. People
call this **RAG**, retrieval-augmented generation.

Before you build a search pipeline, check that you need one.

---

Every current Claude model has a **1M-token context window** (as of October
2026). That's roughly 555,000 words. Anthropic's own advice, from when the
window was a fifth of that: if your knowledge base is under about 200,000
tokens (around 500 pages), skip retrieval and put **all of it** in the
prompt.

The catch is cost, and the fix is **prompt caching**. Your documents sit at
the start of every request, unchanged, so Claude can cache them. On Claude
Haiku 5.5, a cache hit costs **$0.01 per million tokens**, a tenth of the
normal $0.10 (prices checked October 2026, for prompts up to 100,000 tokens).
A 60,000-token handbook read from the cache costs 60,000 ÷ 1,000,000 × $0.01
= **$0.0006** per question.

:::quiz{id="paste-or-search" xp=10}
Your support bot answers from a 40-page product handbook, about 25,000 tokens. What's the simplest good setup?

- [x] Put the whole handbook in every prompt, and cache it
  Right. It fits easily, caching makes it cheap, and there's no search step to get wrong.
- [ ] Chunk it, embed it, and store it in a vector database
  Not quite. That works, but it's a lot of moving parts for something that fits in the prompt.
- [ ] Train a custom model on the handbook
  Not quite. That's slow and costly to redo every time the handbook changes. Facts in the prompt are easy to update.
:::

---

So when does retrieval win?

**It doesn't fit.** Two million support tickets won't go in any window, and
on Haiku 5.5 a prompt over 100,000 tokens costs five times as much per token.

**More isn't better.** Anthropic's docs warn that as the prompt grows,
accuracy and recall drop. They call it **context rot**. Five passages that
answer the question often beat a million tokens of everything.

**It changes, or it's per user.** Docs that change hourly, or each
customer's own files, are easier to index than to re-paste.

One more option: let the model search for itself. Agents can call a search
tool when they need something. Claude Code finds files with `grep` and
`glob` instead of a prebuilt index. That's still retrieval, done just in
time. This course builds the classic pipeline, because it powers most "ask
my docs" features and every idea in it carries over to search tools.

:::quiz{id="when-retrieval" xp=10}
Which of these most needs a retrieval pipeline?

- [ ] A bot that answers from a 10-page refund policy
  Not quite. Ten pages fit in the prompt with room to spare.
- [x] Search across 3 years of an engineering team's tickets and docs
  Right. That's far too much to paste, and it changes every day.
- [ ] A one-off summary of a 200-page report
  Not quite. Paste it once. 200 pages fit in a 1M-token window, and there's nothing to search.
:::

Your turn: the "just paste it" approach. The policy is already in the box.
Add a question, and tell Claude to answer **only from the policy**, and to
say so if the policy doesn't cover it. Try a question it can't answer, like
one about shipping.

:::prompt{id="just-paste-it" xp=20}
Answer a question from a pasted policy, and nothing else

- placeholder "…policy text… Using only the policy above, answer: …? If the policy doesn't say, …"
- draft "Orbit Bikes returns policy: You can return any bike within 30 days of delivery for a full refund, if it has under 50 km on the odometer. E-bike batteries have a separate 2-year warranty. Refunds go back to the original payment method within 5 business days."
- check "Includes the policy"               /returns policy/i
- check "Asks a question"                   /\?/
- check "Limits Claude to the policy"       /\bonly\b|based on|according to|from the policy|using the policy/i
- check "Says what to do if it isn't there" /don.t know|not in|isn.t in|doesn.t say|doesn.t cover|not covered|say so|tell me/i
- run temperature=[1.0]
- example T=1.0 "No. The policy only allows returns within 30 days of delivery, so 40 days is outside the window."
- example T=1.0 "The policy doesn't say anything about shipping times, so I can't answer that from it."
- example T=1.0 "Yes, as long as it's within 30 days of delivery and has under 50 km on the odometer. Your refund goes back to your original payment method within 5 business days."
- success "Small corpus, no search needed. Next: what to do when it won't fit." next="Next: chunking →"
:::

:::rabbithole
- read "Contextual knowledge" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/ai-coding-dictionary/contextual-knowledge"
- read "Context windows" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/context-windows"
- read "Effective context engineering for AI agents" by="Anthropic" deep url="https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
:::
