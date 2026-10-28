---
# sources (checked 2026-10-27):
# - Anthropic, Thinking (thinking blocks come before the answer; thinking tokens are billed as
#   output and count toward max_tokens)
#   https://platform.claude.com/docs/en/build-with-claude/thinking
# - Anthropic, Prompting best practices, "Leverage thinking" (adaptive thinking on Claude 4.6+;
#   always on for Fable 5.1 and Opus 5.5; on by default for Haiku 5.5 when `thinking` is
#   omitted; general instructions beat prescriptive steps; manual chain of thought with
#   <answer> tags as the fallback when thinking is off; on Fable / Opus 5.5 / Sonnet 5.5 a prompt
#   asking for written-out reasoning may be declined; ask Claude to self-check)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
# - Anthropic, Effort (levels low, medium, high, xhigh, max; medium is the default on Haiku 5.5
#   and Opus 5.5, high on most others)
#   https://platform.claude.com/docs/en/build-with-claude/effort
# - Anthropic, Prompting Claude Haiku 5.5 (effort is the main thinking control; thinking can be
#   disabled only at low, medium and high; asking it to answer directly didn't stop thinking)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5
# - bits app/runs/model.ts (sandbox: thinking disabled, effort low, max_tokens 300)
# The meeting times are made up; the overlap answer is worked out in the lesson.
title: "Let it think"
order: 7
minutes: 8
xp: 60
module: Make it reliable
---

Remember how a reply gets written: one token at a time, each one picked
straight after the last. With no scratch space, the model has to get a tricky
answer right in a single pass, with no chance to try an approach and back
out.

**Thinking** gives it that scratch space. When thinking is on, Claude works
through the problem in `thinking` blocks first, then writes its answer. It
can try an approach, check it and change course. That helps most with maths,
logic and multi-step jobs.

---

On current Claude models, thinking is **adaptive**: Claude decides whether a
question needs thinking, and how much. You steer it with one setting,
**effort**: `low`, `medium`, `high`, and on some models `xhigh` and `max`.
Higher effort means more thinking, better answers on hard problems, and more
cost and wait.

How that plays out depends on the model (as of October 2026). On **Claude
Fable 5.1** and **Opus 5.5**, thinking is always on. On **Claude Haiku 5.5**,
it's on unless you switch it off, which you can only do at `high` effort or
below. Its default effort is `medium`.

:::code{file="think.ts" lang="ts" copy highlight="6-7"}
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();

const reply = await client.messages.create({
  model: "claude-haiku-5-5",
  thinking: { type: "adaptive" },
  output_config: { effort: "high" },
  max_tokens: 16000,
  messages: [{ role: "user", content: "Plan a 3-day trip to Kyoto for someone who hates crowds." }],
});
:::

Two things to know. Thinking tokens are billed as **output tokens**, the
expensive kind. And they count toward `max_tokens`, so leave room, or the
answer gets cut off.

---

What do you write in the prompt? Less than you'd think.

**Say “think carefully”, not how.** Anthropic finds that a general nudge often
gets better reasoning than a step-by-step plan you wrote by hand. Claude's own
approach is often better than the one you'd prescribe.

**Ask it to check its work.** End with something like “Before you answer,
check it against these requirements: …”. That catches mistakes, especially in
maths and code.

**Show worked examples.** Examples (lesson 3) shape how Claude thinks, too.

:::quiz{id="more-careful" xp=20}
Your app runs Claude Opus 5.5 and gets hard questions wrong. You want more careful reasoning. What do you change?

- [ ] Send `temperature: 0`
  Not quite. The current API rejects temperature on every model, and randomness isn't the problem.
- [ ] Add “write out your reasoning in thinking tags” to the prompt
  Not quite. Opus 5.5 always thinks already, and asking it to write its reasoning in the reply may be declined.
- [x] Raise `effort` to `high`
  Right. Effort is the main dial for how much Claude thinks. Check the gain on your own tests, since it costs more.
- [ ] Set a `budget_tokens` thinking budget
  Not quite. That's the older way; on Claude 4.7 and later, `budget_tokens` returns a 400 error.
:::

---

**When thinking is off.** This sandbox runs Claude Haiku 5.5 with thinking
**switched off** and effort at `low`, to keep every run small and cheap. With
thinking off, Anthropic's fallback still works: ask Claude to reason through
the problem **in its reply** before answering, and to put the final answer in
`<answer>` tags so your code can find it. (On models where thinking is always
on, skip this and rely on thinking.)

Here's a small puzzle with a trap in it. Meeting A runs **9:40 to
10:25**, B runs **10:15 to 11:00**, and C runs **11:00 to 11:30**. Which ones
overlap? Ask Claude to reason first, and to give the answer in tags.

:::prompt{id="let-it-think" xp=40}
Ask Claude to reason it through, then answer in <answer> tags

- placeholder "Which meetings overlap? … Work through it step by step, then give the final answer in <answer> tags."
- draft "Which of these meetings overlap? A 9:40–10:25, B 10:15–11:00, C 11:00–11:30."
- check "Includes the meetings"         /10:15/
- check "Asks it to reason first"       /step by step|reason|think|work (it )?(through|out)|show (your )?work|before (you )?answer|explain why/i
- check "Asks for <answer> tags"        /answer>|answer tags/i
- run temperature=[1.0]
- example T=1.0 "A ends at 10:25, after B starts at 10:15, so A and B share 10 minutes. B ends at 11:00, exactly when C starts, so they only touch. A ends before C starts. <answer>Only A and B overlap, from 10:15 to 10:25.</answer>"
- example T=1.0 "A and B: B starts at 10:15, before A ends at 10:25, so yes. B and C: B ends at 11:00 and C starts at 11:00, so they meet but don't overlap. A and C: no. <answer>A and B overlap (10:15–10:25).</answer>"
- example T=1.0 "Compare each pair. A (9:40–10:25) and B (10:15–11:00) overlap for 10 minutes. B and C touch at 11:00 with no overlap. A and C are an hour apart. <answer>A and B.</answer>"
- success "Room to reason, a place for the answer. Your code can read the tags and skip the working." next="Next: chain your prompts →"
:::

Check the answer yourself: A and B overlap from 10:15 to 10:25, and B and C
only **touch** at 11:00. Claude Haiku 5.5 often gets this one right even
without the reasoning, so don't expect a dramatic difference on a puzzle this
small. The habit pays off on harder problems, and the `<answer>` tags pay off
every time: your code can read the answer and skip the working.

:::rabbithole
- read "Thinking" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/thinking"
- read "Effort" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/effort"
:::
