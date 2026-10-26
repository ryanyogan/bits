---
# sources (checked 2026-10-26):
# - Anthropic, Glossary ("Tokens": words, subwords, characters or bytes; counts depend on
#   model and language)
#   https://platform.claude.com/docs/en/about-claude/glossary
# - Anthropic, Token counting (Claude 4.7 and later use a newer tokenizer: the same text is
#   about 30% more tokens than on earlier models)
#   https://platform.claude.com/docs/en/build-with-claude/token-counting
# - Andrej Karpathy, Let's build the GPT Tokenizer (opening: spelling, arithmetic, non-English
#   text and code all trace back to tokenization)
#   https://www.youtube.com/watch?v=zduSFxRajkE
# Token ids below are illustrative; Claude's tokenizer isn't public.
title: "Tokenizers are weird"
order: 2
minutes: 5
xp: 30
module: How text becomes numbers
---

A tokenizer doesn't know what words **mean**. It learned its vocabulary by
counting which chunks of text show up most often, then keeps the frequent
ones whole and splits the rest. That one rule explains a lot of odd model
behaviour.

Look at the same word written four ways:

:::tokenizer{sample="hello Hello HELLO  hello" illustrative}
"hello"   15339
" Hello"  22691
" HEL"    51811
"LO"      1623
" "       220
" hello"  24748
:::

To you that's one word four times. To the model it's **different tokens**:
lowercase, capitalised, shouting and a double space all cut differently. The
model learns that they're related, but it never sees them as the same thing.

---

A few more places where the cuts surprise people.

**Numbers** split into chunks of digits, and not always the same way. `2026` may be one token while `20261` is two. That's part of why models can slip on long arithmetic: they're adding chunks, not digits.

**Other languages** usually cost more tokens for the same meaning, because the vocabulary was built from a mix of text that leans towards English.

**Code and unusual text** (long ids, base64, rare symbols) splits into lots of small pieces.

**Every model family has its own tokenizer.** Even Claude changed: Claude 4.7 and later count the same text as roughly 30% more tokens than older Claude models did.

None of this means the model is broken. It means the model sees the world in
chunks, and some questions (“how many r's?”, “add these 12-digit numbers”)
are about what's **inside** the chunks.

:::quiz{id="weird-splits" xp=30}
You send the same paragraph to Claude in English and in Thai. What's most likely?

- [ ] Both cost exactly the same number of tokens
  Not quite. Token counts follow how the text splits, not what it means.
- [x] The Thai version uses more tokens
  Right. The vocabulary favours text it saw most, so less common scripts split into more, smaller pieces.
- [ ] The Thai version uses fewer tokens, because it has no spaces
  Not quite. Fewer spaces doesn't mean fewer cuts. Less familiar text is usually split more finely.
:::

:::rabbithole
- video "Let's build the GPT Tokenizer" by="Andrej Karpathy" mins=134 deep url="https://www.youtube.com/watch?v=zduSFxRajkE"
- read "What Are Tokens?" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/what-are-tokens"
:::
