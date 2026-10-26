---
# sources (checked 2026-10-26):
# - Anthropic, Glossary ("Pretraining": trained on a large unlabeled corpus to predict the
#   next word; pretrained models aren't good at following instructions on their own)
#   https://platform.claude.com/docs/en/about-claude/glossary
# - Anthropic, Transparency Hub, Claude Haiku 5.5 ("Training Data": proprietary mix of public
#   internet information, public and private datasets, permitted user data, synthetic data;
#   deduplication and filtering)
#   https://www.anthropic.com/transparency
# - Andrej Karpathy, [1hr Talk] Intro to Large Language Models, "LLM Training" (4:17)
#   and the lossy-compression analogy
#   https://www.youtube.com/watch?v=zjkBMFhNj_g
# Toy: steps, losses and outputs are illustrative. Loss at step 0 sits near ln(vocab size),
# about 11 for a ~100k-token vocabulary.
title: "Where it learned: pretraining"
order: 4
minutes: 7
xp: 40
module: How it got this way
---

Before training, a model is a huge set of numbers called **parameters**, all
set at random. Ask it anything and it guesses tokens at random too. Pure
noise.

**Pretraining** fixes that with one exercise, repeated an enormous number of
times. Take some real text. Hide the next token. Let the model guess. Then
check.

---

The check gives a score called the **loss**: how surprised the model was by
the real next token. High loss means it barely saw it coming. Then every
parameter gets nudged a tiny bit, so the right token comes out a little more
likely next time.

That's it. Guess, check, nudge, over and over, across a mountain of text.
Drag through the training run below and watch one prompt go from noise to
sense.

:::training{prompt="Once upon a" illustrative}
- step 0 loss=11.0 "qz# lorp vv]"
- step 200 loss=7.6 "the the the the"
- step 1000 loss=5.4 "time and of the was"
- step 5000 loss=3.9 "time the king was a"
- step 20000 loss=2.8 "time, there was a little"
- step 100000 loss=2.1 "time, there was a little fox who"
:::

The numbers are illustrative, but the arc is real. Roughly, it learns which
tokens are common, then which ones go together, then grammar, then whole
stories. Nobody wrote those rules in. They show up because they help the
guesses.

---

What text? For Claude Haiku 5.5, Anthropic says it's a proprietary mix of public
information from the internet, public and private datasets, some user data
(from feedback, or that people allowed for training) and text written by other
models, cleaned and de-duplicated first.

Here's a useful way to think about the result. The text is far bigger than the
model, so it can't keep a copy. It keeps **patterns** instead, a bit like a
lossy zip file of everything it read. The gist survives. Rare details get
fuzzy. Hold on to that, because it explains a lot in lesson 7.

:::quiz{id="what-pretraining-practises" xp=20}
During pretraining, what is the model practising, over and over?

- [x] Guessing the next token of real text
  Right. Every skill it ends up with grows out of getting better at that one guess.
- [ ] Answering questions that people send it
  Not yet. Answering like an assistant comes later, in post-training. That's the next lesson.
- [ ] Storing facts in a database it can look up
  Not quite. There's no database. Whatever it knows lives in its parameters, as patterns.
:::

What comes out of pretraining is a **base model**: a brilliant continuer of
documents, but not yet something that answers you. Next lesson, it becomes
one.

:::rabbithole
- video "[1hr Talk] Intro to Large Language Models" by="Andrej Karpathy" mins=60 deep url="https://www.youtube.com/watch?v=zjkBMFhNj_g&t=257s"
:::
