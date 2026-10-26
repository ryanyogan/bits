---
# sources (checked 2026-10-26):
# - Anthropic, Glossary ("Pretraining": base models aren't good at following instructions;
#   "Fine-tuning"; "RLHF": people rank two or more texts, RL favours the higher-ranked)
#   https://platform.claude.com/docs/en/about-claude/glossary
# - Anthropic, Constitutional AI: Harmlessness from AI Feedback (self-critique and revision,
#   then RL from AI feedback against written principles)
#   https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback
# - Anthropic, Claude's Constitution (shapes Claude's training)
#   https://www.anthropic.com/constitution
# - Anthropic, Transparency Hub, Claude Haiku 5.5 ("substantial post-training" towards the
#   values in Claude's constitution)
#   https://www.anthropic.com/transparency
# - Andrej Karpathy, Deep Dive into LLMs like ChatGPT, "pretraining to post-training" (59:23)
#   https://www.youtube.com/watch?v=7xTGNNLPyMI
# Toy: both outputs are illustrative; no base model runs in bits.
title: "From autocomplete to assistant"
order: 5
minutes: 7
xp: 40
module: How it got this way
---

A base model continues documents. That's all pretraining taught it. So if you
type a question, it asks itself: what kind of page starts like this, and what
comes next on that page?

Often the answer is “more questions”. Here's the same prompt sent to a base
model and to an assistant.

:::compare{left="Base model" right="Assistant" illustrative}
- prompt "How do I boil an egg?"
- left "How do I boil an egg? I tried twice and the yolk went grey both times. Posted in Kitchen Help · 14 replies · Sort by: newest"
- right "Lower the egg into boiling water. Cook 6–7 minutes for a jammy yolk or 10–12 for hard, then cool it in cold water before peeling."
:::

Both are good next-token guesses. Only one is useful to you. Turning the left
into the right is called **post-training**, and it comes in layers.

---

**Fine-tuning on conversations.** Show the model a large set of example
chats: a person asks, a helpful assistant answers. It's the same next-token
exercise as before, but now the text is always a conversation. The model
learns to continue it **as the assistant**.

**Learning from human preferences (RLHF).** The model writes two or more
answers to the same prompt, and people rank them. A second model learns to
predict which answers people prefer. Then **reinforcement learning** nudges
the assistant towards answers that score well.

---

**Constitutional AI.** Ranking harmful answers by hand is slow, and people
have to read the worst of them. Anthropic's approach writes the goals down as
**principles** instead. The model critiques and rewrites its own answers
against them, and an AI judge, not a person, picks the answer that better
follows them.

Today Anthropic publishes **Claude's constitution**, a long document about the
values and character it's aiming for, and uses it in training. Labs also use
reinforcement learning on tasks whose answers can be checked automatically,
like maths and code.

The thing to remember: most of what Claude **knows** comes from pretraining.
Post-training mostly shapes how it **behaves**: answering instead of
rambling, being honest about uncertainty, and declining harmful requests.
Underneath, it's still predicting the next token. It's just predicting what a
helpful assistant would say.

:::quiz{id="constitutional-ai" xp=20}
In Constitutional AI, what replaces most of the human labels about which answers are harmful?

- [ ] A bigger pretraining dataset
  Not quite. Pretraining teaches knowledge and patterns, not which answers are better.
- [x] An AI judging answers against written principles
  Right. People write the principles; a model applies them to compare answers, and that feedback trains the assistant.
- [ ] A list of banned words the model can't say
  Not quite. It's about judging whole answers against principles, not filtering words.
:::

:::rabbithole
- video "Deep Dive into LLMs like ChatGPT (from “pretraining to post-training”)" by="Andrej Karpathy" mins=211 deep url="https://www.youtube.com/watch?v=7xTGNNLPyMI&t=3563s"
- read "Constitutional AI: Harmlessness from AI Feedback" by="Anthropic" url="https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback"
:::
