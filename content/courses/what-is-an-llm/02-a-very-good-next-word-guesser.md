---
# sources (checked 2026-10-29):
# - Anthropic, Glossary ("Pretraining": autoregressive models predict the next word; "Temperature";
#   non-determinism even at temperature 0)
#   https://platform.claude.com/docs/en/about-claude/glossary
# - Anthropic, Messages API (current models expose no sampling parameters; the request is the
#   turns so far, the response is the next turn; max_tokens)
#   https://platform.claude.com/docs/en/api/messages
# - Anthropic, Tracing the thoughts of a large language model (Claude plans rhymes ahead
#   even though it writes one token at a time), 2025-03-27
#   https://www.anthropic.com/research/tracing-thoughts-language-model
# - 3Blue1Brown, Transformers (Deep Learning Chapter 5): one score per vocabulary entry,
#   softmax turns the scores into a distribution, sample one, append, repeat
#   https://www.youtube.com/watch?v=wjZofJX0v4M
# - bits decision 019 and app/runs/model.ts (the sandbox runs live only at T=1.0)
title: "A very good next-word guesser"
order: 2
minutes: 6
xp: 40
module: Meet the model
---

Here's the whole trick, in one sentence. A language model looks at the text so
far and guesses **what comes next**.

:::new
Not the whole answer at once. One small piece, called a **token** (often a
word, sometimes part of one). Then it adds that piece to the text and guesses
again. And again. Until it guesses that it's done.

---

Slow it right down and one reply is a loop of five moves. Play it below,
then step through a real reply and watch the odds at each draw.
:::

:::engineer
The unit is a **token**, not a word (lesson 3). One forward pass takes the
token sequence so far and returns one score (a logit) per entry in the
vocabulary, on the order of a hundred thousand of them. Softmax turns the
scores into a distribution. One token is sampled, appended, and the pass
runs again. That is **autoregressive decoding**, and it ends when the model
emits an end-of-turn token or hits `max_tokens`.

So a reply is never computed as a whole. It is a sequence of draws, each one
conditioned on everything before it, your prompt included. Play the loop
below, then step through one reply; the probabilities are illustrative, the
shape is real.
:::

:::steps{title="One reply, five moves" loop}
- "Read" "Everything so far: your prompt, and every token it has already written."
- "Score" "One score for every token in its vocabulary, tens of thousands of them."
- "Odds" "The scores become odds that add up to 100%."
- "Draw" "One token is sampled from those odds. Not always the top one."
- "Append" "It joins the text. Back to Read, until it draws the token that means “done”."
:::

:::nexttoken{prompt="Finish the sentence: The best thing about rainy days is" illustrative}
" the" 0.41 | " curling":0.22 " staying":0.14
" sound" 0.63 | " smell":0.21 " excuse":0.09
" of" 0.97 | " on":0.01 " it":0.01
" rain" 0.78 | " the":0.12 " raindrops":0.06
" on" 0.69 | " against":0.22 " tapping":0.04
" the" 0.88 | " a":0.07 " your":0.03
" roof" 0.52 | " window":0.38 " windows":0.07
"." 0.91 | "!":0.05 " while":0.02
:::

:::new
Notice that some steps are nearly certain (“of” after “sound”) and some are
close calls (“roof” or “window”). The model doesn't always take the top
pick. Claude **samples** from the odds, so a 38% option wins roughly 4 times in
10. That's why the same prompt can give different answers.

---

“So it's just autocomplete?” Sort of, but don't let the word fool you. To
guess well across every kind of text, a model has to pick up grammar, facts,
tone and how an argument hangs together.

It doesn't only think one word ahead either. Anthropic looked inside Claude
while it wrote a rhyming couplet and found it had picked the rhyme **before**
starting the line, then wrote towards it. It writes one token at a time, but
it can plan further ahead.
:::

:::engineer
Some steps are near-deterministic (“of” after “sound”), some are close
(“roof” 0.52 against “window” 0.38). Claude **samples** rather than taking
the argmax, so the 0.38 branch wins about 4 runs in 10 and the same prompt
gives different replies. Two practical consequences. The current Messages
API exposes no sampling parameters, so you can't turn this off; design for
variance instead (lesson 8 has the habits). And Anthropic notes that even a
fixed setting is not fully deterministic across calls, so never build on
byte-identical output.

---

“Just autocomplete” undersells the objective. Minimising next-token error
over every kind of text forces the model to encode grammar, facts, register
and argument structure, because each of those lowers the error. And the
one-token-at-a-time output does not mean one-token-at-a-time planning:
Anthropic's interpretability work found Claude choosing a rhyme word before
writing the line that leads to it. The decoding is sequential; the
computation behind each step is not that naive.
:::

Your turn. Ask Claude to finish a sentence with **just one word**, then run it
a few times. Does the word change?

:::prompt{id="finish-the-sentence" xp=40}
Ask Claude to finish a sentence with one word

- placeholder "Finish this sentence with one word: …"
- draft "Finish this sentence: The best thing about rainy days is"
- check "Asks it to finish a sentence"  /finish|complete|continue|fill in|next word/i
- check "Asks for one word"             /one word|1 word|single word|one-word/i
- check "Gives it a sentence to finish" /[:…_]|\.\.\./
- run temperature=[1.0]
- example T=1.0 "Puddles."
- example T=1.0 "Coziness."
- example T=1.0 "Naps."
- example T=1.0 "Tea."
- success "Same sentence, different words. Now you know where they come from." next="Next: words become tokens →"
:::

:::rabbithole
- video "Transformers, the tech behind LLMs" by="3Blue1Brown" mins=27 url="https://www.youtube.com/watch?v=wjZofJX0v4M"
- read "Next-token prediction" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/ai-coding-dictionary/next-token-prediction"
:::
