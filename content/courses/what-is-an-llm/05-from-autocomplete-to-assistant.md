---
# sources (checked 2026-10-29):
# - Anthropic, Glossary ("Pretraining": base models aren't good at following instructions;
#   "Fine-tuning": Claude is not a bare language model; "RLHF": people rank two or more
#   texts, RL favours the higher-ranked)
#   https://platform.claude.com/docs/en/about-claude/glossary
# - Anthropic, Constitutional AI: Harmlessness from AI Feedback (self-critique and revision,
#   then RL from AI feedback against written principles)
#   https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback
# - Anthropic, Claude's Constitution (shapes Claude's training)
#   https://www.anthropic.com/constitution
# - Anthropic, Transparency Hub, Claude Haiku 5.5 ("substantial post-training" towards the
#   values in Claude's constitution)
#   https://www.anthropic.com/transparency
# - Anthropic, Steering thinking (thinking is adaptive: the model decides per request whether
#   to think and how much; effort levels; thinking tokens count toward max_tokens)
#   https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost
# - Anthropic, Messages API (thinking: {type: "adaptive"}; the legacy manual budget_tokens)
#   https://platform.claude.com/docs/en/api/messages
# - Andrej Karpathy, Deep Dive into LLMs like ChatGPT, "pretraining to post-training" (59:23)
#   https://www.youtube.com/watch?v=7xTGNNLPyMI
# Toy: both outputs are illustrative; no base model runs in bits. The sandbox runs with
# thinking off (app/runs/model.ts).
title: "From autocomplete to assistant"
order: 5
minutes: 6
xp: 40
module: How it got this way
---

Here's the one idea in this lesson. Pretraining is where the model gets what
it **knows**. Post-training is where it learns how to **behave**. Everything
below is those two sentences, slowed down.

---

:::new
A base model continues documents. That's all pretraining taught it. So if you
type a question, it asks itself: what kind of page starts like this, and what
comes next on that page? Often the answer is “more questions”. Here's the
same prompt sent to a base model and to an assistant.
:::

:::engineer
A base model is a document continuer. Given a question with no framing, the
highest-likelihood continuation is often more of the page it looks like it
came from: a forum thread, a quiz sheet, a list of FAQs. Same prompt, base
model against assistant:
:::

:::compare{left="Base model" right="Assistant" illustrative}
- prompt "How do I boil an egg?"
- left "How do I boil an egg? I tried twice and the yolk went grey both times. Posted in Kitchen Help · 14 replies · Sort by: newest"
- right "Lower the egg into boiling water. Cook 6–7 minutes for a jammy yolk or 10–12 for hard, then cool it in cold water before peeling."
:::

Both are good next-token guesses. Only one is useful to you. Turning the left
into the right is called **post-training**.

:::new

First, the model is shown a large set of example conversations: a person
asks, a helpful assistant answers. It's the same next-token exercise as
pretraining, but now the text is always a chat, so the model learns to
continue one **as the assistant**. Each example has the same shape you'll meet
next lesson: the person's turn, the assistant's turn, and often a hidden note
up top saying how to behave.

Then it's polished by **preference**. The model writes several answers to the
same prompt. People rank them, and later an AI judge does most of the ranking
against written principles. The model is nudged towards the answers that rank
well, over and over, so being helpful, honest and careful becomes its habit.
Anthropic's version of that judge-with-principles is called Constitutional AI,
and the principles are published as Claude's constitution.

---

One more thing current assistants learn: to **think before they answer**.
Given a hard question, Claude can write out its working first and the reply
after. That working is produced the same way as everything else, one token at
a time. It's just text the model writes to itself.

Underneath all of this, it's still predicting the next token. It's just
predicting what a helpful assistant would say. Which is why most of what
Claude knows comes from pretraining, and most of how it acts comes from
post-training.
:::

:::engineer

Stage one is **supervised fine-tuning** on conversations: the same
next-token objective, but the corpus is now dialogues in a fixed format
(a system note, `user` turns, `assistant` turns), so the model learns to
continue the transcript as the assistant. The chat format you'll send next
lesson is that training format, which is why the roles carry weight.

Stage two is **preference optimisation**. The model samples several
responses per prompt; a reward signal ranks them; reinforcement learning
shifts the policy towards what ranks well. The glossary's RLHF is the human
version: people rank two or more candidates. Anthropic's Constitutional AI
adds self-critique and revision against written principles and then RL from
AI feedback, so most of the ranking is done by a model judging against the
constitution. The Transparency Hub describes Claude Haiku 5.5 as having had
substantial post-training toward those values. Post-training uses far less
text than pretraining; it steers behaviour more than it adds knowledge.

---

Current Claude models also do **adaptive thinking**: per request, the model
decides whether to reason before answering and how much, with an `effort`
level you can set. The reasoning is ordinary sampled tokens, counted against
`max_tokens` and billed as output. The sandbox here runs with thinking off
and low effort, which is fine for one-line answers and wrong for anything
multistep.

The invariant: it is still next-token prediction, now over the distribution
of what a helpful, honest assistant would say. Knowledge mostly comes from
pretraining; behaviour mostly comes from post-training.
:::

:::quiz{id="knows-vs-behaves" xp=20}
Claude knows the capital of Mongolia. It also answers your question instead of listing more questions. Where did each of those come from?

- [x] The knowing from pretraining, the answering from post-training
  Right. Pretraining soaked up the facts. Post-training taught it to reply like an assistant.
- [ ] Both from pretraining
  Not quite. A base model has the facts but tends to continue the page, not answer you.
- [ ] Both from post-training
  Not quite. Post-training uses far less text than pretraining; it shapes behaviour more than it adds knowledge.
:::

:::rabbithole
- video "Deep Dive into LLMs like ChatGPT (from “pretraining to post-training”)" by="Andrej Karpathy" mins=211 deep url="https://www.youtube.com/watch?v=7xTGNNLPyMI&t=3563s"
- read "Constitutional AI: Harmlessness from AI Feedback" by="Anthropic" url="https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback"
- read "Claude's constitution" by="Anthropic" url="https://www.anthropic.com/constitution"
:::
