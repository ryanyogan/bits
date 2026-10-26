---
title: What is a token?
order: 1
minutes: 6
xp: 30
module: How text becomes numbers
video: assets/01-what-is-a-token.mp4
duration: 3:12
chapters:
  - { at: 0:00, title: "Text in, numbers out" }
  - { at: 1:10, title: "Pieces of words" }
  - { at: 2:10, title: "Why it matters" }
---

A model doesn’t read letters or words. Before it sees your prompt, a
**tokenizer** chops the text into pieces called tokens, and each piece becomes
a number.

Type anything below and watch where the cuts land. Spaces usually stick to the
start of the next word.

:::tokenizer{sample="Unbelievably, the cat fetched." illustrative}
"Un"       1844
"believ"   31141
"ably"     2915
","        11
" the"     279
" cat"     8415
" fetched" 42118
"."        13
:::

The cuts and ids above are illustrative: Claude's own tokenizer isn't
public, and every model family splits a little differently.

**Unbelievably** became three tokens, but ` the` is just one. Common words are
cheap; rare ones get split.

:::quiz{id="common-words" xp=10}
Which of these is most likely a single token?

- [x] “ the”
  Right. Very common words, with their leading space, get a token of their own.
- [ ] “Unbelievably”
  Not quite. Rare, long words get split into several familiar pieces.
- [ ] “fetched.”
  Not quite. Punctuation usually gets its own token, so this is at least two.
:::
