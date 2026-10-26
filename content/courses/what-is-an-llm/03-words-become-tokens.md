---
# sources (checked 2026-10-26):
# - Anthropic, Glossary ("Tokens": words, subwords, characters or bytes; counts depend on
#   model and language; Claude's tokenizer changed with Claude 4.7)
#   https://platform.claude.com/docs/en/about-claude/glossary
# - Matt Pocock (AI Hero), What Are Tokens?
#   https://www.aihero.dev/what-are-tokens
# - Andrej Karpathy, Deep Dive into LLMs like ChatGPT, chapter "tokenization revisited:
#   models struggle with spelling" (2:01:11)
#   https://www.youtube.com/watch?v=7xTGNNLPyMI
# Token ids below are illustrative; Claude's tokenizer isn't public.
title: "Words become tokens"
order: 3
minutes: 5
xp: 30
module: Meet the model
---

Last lesson said the model guesses one **token** at a time. So what is a
token?

Before Claude sees your prompt, a **tokenizer** chops the text into pieces
from a fixed vocabulary. Each piece has an id number, and the numbers are all
the model ever sees. It doesn't see the letters inside them.

:::tokenizer{sample="How many r's in strawberry?"}
"How"     4438
" many"   1690
" r"      436
"'s"      596
" in"     304
" straw"  31446
"berry"   15717
"?"       30
:::

The cuts and ids above are illustrative. Every model family has its own
tokenizer, Claude's included, so real splits differ a little. Type your own
text to see roughly where cuts land.

---

Three things to notice. Common words get one token each. Rarer words get
split into familiar chunks. And the space usually sticks to the **front** of
the next word.

Why should you care? Two reasons. Limits and prices are counted in tokens, not
words. And tokens explain some odd mistakes: ask a model to count letters and
it has to work from chunks like “straw” and “berry”, not from letters.

:::quiz{id="strawberry" xp=20}
A model miscounts the r's in “strawberry”. What's the most likely reason?

- [ ] It has never seen the word before
  Not quite. It has seen “strawberry” countless times. Seeing a word isn't the problem.
- [x] It sees chunks of the word, not its letters
  Right. The tokenizer hands it pieces like “straw” and “berry”, so it has to work out the spelling indirectly.
- [ ] Counting is switched off to save tokens
  Not quite. Nothing is switched off. The model just never gets the letters one by one.
:::

That's enough tokens for now. The **Tokens & temperature** course goes deeper:
counting them, weird splits, and how the odds turn into a choice.

:::rabbithole
- read "What Are Tokens?" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/what-are-tokens"
- video "Let's build the GPT Tokenizer" by="Andrej Karpathy" mins=134 deep url="https://www.youtube.com/watch?v=zduSFxRajkE"
:::
