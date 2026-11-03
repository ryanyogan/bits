---
# sources (checked 2026-10-29):
# - Anthropic, Glossary ("Tokens": words, subwords, characters or bytes; counts depend on
#   model and language; Claude 4.7 and later use a newer tokenizer that produces about
#   30% more tokens for the same text)
#   https://platform.claude.com/docs/en/about-claude/glossary
# - Anthropic, Messages API (POST /v1/messages/count_tokens; usage.input_tokens and
#   usage.output_tokens on every response)
#   https://platform.claude.com/docs/en/api/messages
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

:::new
Before Claude sees your prompt, a **tokenizer** chops the text into pieces
from a fixed menu. The menu is big (modern models carry on the order of a
hundred thousand pieces) but fixed, chosen so that any text can be written
from it. Each piece has an id number, and the numbers are all the model ever
sees. It doesn't see the letters inside them.
:::

:::engineer
A **tokenizer** maps text to a sequence of integer ids from a fixed
vocabulary, on the order of a hundred thousand entries, learned so that
frequent strings get one id and anything else can be spelled from smaller
pieces, down to bytes. The model is trained and run on those ids only. It
never receives characters, which is why spelling, counting letters and
exact string manipulation are off-distribution for it.
:::

:::tokenizer{sample="How many r's in strawberry?" illustrative}
"How"     4438
" many"   1690
" r"      436
"'s"      596
" in"     304
" straw"  31446
"berry"   15717
"?"       30
:::

:::new
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
:::

:::engineer
The split and the ids above are illustrative; Claude's tokenizer is not
public, and it changed with Claude 4.7: Anthropic says the newer tokenizer
yields roughly 30% more tokens for the same text than before. Never estimate
from another vendor's tokenizer. Count with `POST /v1/messages/count_tokens`
before a request, and read `usage.input_tokens` and `usage.output_tokens` on
every response; that is what you are billed for and what fills the context
window.

---

Patterns worth knowing. Common words are one token. Rare words, names and
identifiers split into several. The leading space belongs to the token
(“ straw”), so “straw” mid-sentence and “Straw” at a line start are different
ids. Code, JSON and non-English text tokenize worse than English prose, so
the same information costs more tokens.

Two consequences for building. Budgets, rate limits and prices are in tokens,
so measure, don't guess. And tasks that depend on characters (count the r's,
reverse this string, exact byte offsets) are the wrong shape for the model:
do them in code and hand the model the result.
:::

Here's the fix in action. Claude works in chunks, but it can write the letters
out one by one, and then each letter is its own token to count.

:::prompt{id="spell-it-out" xp=20 coach}
Get Claude to count the r's in “strawberry” by spelling it out first

- goal "Get the right count of r's in “strawberry”, with Claude spelling the word letter by letter before it counts"
- placeholder "Spell “strawberry” …, then …"
- draft "How many r's are in strawberry?"
- check "Names the word"                 /strawberry/i
- check "Asks it to spell the word out"  /spell|letter by letter|one letter|each letter|every letter|list the letters/i
- expect "Gets the count right" match /\b3\b|\bthree\b/i
- rubric "Spells the word out letter by letter before counting" must evidence
- rubric "The count it gives is three" must evidence
- hint "Your prompt asks for the answer straight away. What could Claude write first that would make each letter visible?"
- hint "Ask for the letters one per line, then the count."
- reference "Spell the word “strawberry” one letter per line. Then count how many of those letters are r, and give the total."
- run temperature=[1.0]
- example T=1.0 "s\nt\nr\na\nw\nb\ne\nr\nr\ny\n\nThat's 3 r's: one in “straw” and two in “berry”."
- example T=1.0 "S-T-R-A-W-B-E-R-R-Y. The r's are letters 3, 8 and 9, so there are three."
- success "Writing the letters out turned a spelling question into something the model can see. For real character work in your code, count in code." next="Next: where it learned →"
:::
That's enough tokens for now. The **Tokens & temperature** course goes deeper:
counting them, weird splits, and how the odds turn into a choice.

:::rabbithole
- read "What Are Tokens?" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/what-are-tokens"
- video "Let's build the GPT Tokenizer" by="Andrej Karpathy" mins=134 deep url="https://www.youtube.com/watch?v=zduSFxRajkE"
:::
