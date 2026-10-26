---
# sources (checked 2026-10-26):
# - Holtzman et al., The Curious Case of Neural Text Degeneration (2019): always taking the
#   most likely token leads to bland, repetitive text; sampling from the distribution reads
#   more like human writing
#   https://arxiv.org/abs/1904.09751
# - Anthropic, API version 2026-10-21 (temperature, top_p and top_k are no longer accepted;
#   requests sample with the defaults, temperature 1.0) and bits decision 019
# - Anthropic, Prompting best practices (be clear and specific; give examples; say the
#   format you want)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
title: "Greedy vs. sampled"
order: 5
minutes: 6
xp: 40
module: Picking the next word
---

You have a list of odds. There are two basic ways to pick from it.

**Greedy:** always take the top token. Same prompt, same answer, every time.
**Sampled:** roll a weighted die. A 60% token wins about 6 times in 10, a 5%
token about once in 20.

Greedy sounds safer. For long text, it's usually worse:

:::compare{left="Greedy (always the top pick)" right="Sampled" illustrative}
- prompt "Write one sentence about the sea."
- left "The sea is a vast and beautiful place. The sea is a vast and beautiful place where the sea meets the sky and the sea is a vast…"
- right "The sea keeps its own time, pulling the tide in and out whether anyone is watching or not."
:::

The top pick at every step is the most **typical** next token, and a run of
typical tokens drifts into bland, repetitive text. Researchers studying this
found that sampled text reads much more like something a person wrote.

---

**Claude samples.** On Anthropic's current API you can't switch Claude to
greedy. It always draws from its odds, at the default settings (more on
those dials in two lessons). That's why the same prompt can give you different
answers.

So how do you get a **consistent** answer when you need one? Change the
odds, not the dice. A clear, narrow prompt makes the right answer such an
overwhelming favourite that sampling picks it nearly every time. Say exactly
what form the answer takes (“reply with one word”), list the answers you'll
accept (“positive, negative or neutral”), and show an example of a good
answer.

:::quiz{id="consistent" xp=20}
You need Claude to label 1,000 reviews the same way every time. What helps most?

- [ ] Ask it to be consistent
  Not quite. Being asked to “be consistent” barely changes the odds of any single label.
- [x] Give the exact labels allowed and the format to reply in
  Right. Narrow choices make one answer the clear favourite, so sampling lands on it reliably.
- [ ] Set temperature to 0
  Not on Claude's current API: it doesn't accept a temperature, so you shape the odds with the prompt instead.
:::

Your turn. Write a prompt that labels the review **“Arrived late, but it
works great.”** and only allows `positive`, `negative` or `neutral`. Run it a
few times. Does the label hold?

:::prompt{id="sentiment-label" xp=20}
Label one review, with a fixed set of answers

- placeholder "Label this review as positive, negative or neutral…"
- draft "Is this review good? Arrived late, but it works great."
- check "Includes the review"     /arrived late/i
- check "Lists the labels"        /positive/i
- check "Lists the labels"        /negative/i
- check "Lists the labels"        /neutral/i
- check "Limits the reply"        /\bonly\b|one word|single word|just the|reply with|answer with/i
- run temperature=[1.0]
- example T=1.0 "positive"
- example T=1.0 "positive"
- example T=1.0 "positive"
- success "Narrow the choices and the dice stop mattering." next="Next: temperature →"
:::

:::rabbithole
- read "The Curious Case of Neural Text Degeneration" by="Holtzman et al." deep url="https://arxiv.org/abs/1904.09751"
- read "Prompting best practices" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"
:::
