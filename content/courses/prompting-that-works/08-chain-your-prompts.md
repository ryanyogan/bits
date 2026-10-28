---
# sources (checked 2026-10-27):
# - Anthropic, Prompting best practices, "Chain complex prompts" (with adaptive thinking Claude
#   handles most multistep reasoning in one call; chaining still pays when you need to inspect
#   intermediate outputs or enforce a pipeline; the common pattern is self-correction:
#   draft → review against criteria → refine, each a separate call)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
# - Anthropic, Building effective agents (2024-12-19), "Workflow: Prompt chaining" (fixed
#   subtasks; trade latency for accuracy by making each call easier; programmatic "gate"
#   checks between steps; outline → check → write)
#   https://www.anthropic.com/engineering/building-effective-agents
# The announcement draft is made up.
title: "Chain your prompts"
order: 8
minutes: 7
xp: 50
module: Make it reliable
---

Some jobs are too much for one prompt. Not because Claude can't think them
through (with thinking on, it handles a lot in one go), but because **you**
want to see, check or steer the steps in between.

That's **prompt chaining**: split the job into a few fixed steps, and make
each step its own call to Claude. The output of one step becomes the input of
the next.

---

Anthropic's most common chain is **self-correction**, in three calls.
**Draft:** write the thing. **Review:** check the draft against your criteria
and list the problems. **Refine:** rewrite the draft to fix them.

Why not one prompt that says “write it, check it and fix it”? Because with
separate calls you can **log** each step, **test** each step on its own, and
put a check from your own code between them. Each call also has an easier,
narrower job, and that's where the extra accuracy comes from. The price is
more calls, so more time and tokens.

:::code{file="chain.ts" lang="ts" copy highlight="12-15"}
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();

async function ask(prompt: string) {
  const reply = await client.messages.create({
    model: "claude-haiku-5-5", max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });
  return reply.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
}

const facts = "Dark mode ships 2 November. Turn it on in Settings, then Appearance.";
const draft = await ask(`Write a 60-word launch note for our dark mode. <facts>${facts}</facts>`);
const review = await ask(`<draft>${draft}</draft> Check it against: under 60 words, no jargon, mentions the date. List problems in <review> tags, or reply with only OK.`);
const final = review.trim() === "OK" ? draft : await ask(`<draft>${draft}</draft> <review>${review}</review> Rewrite the draft to fix every problem.`);
:::

Line 15 is a **gate**: plain code that decides whether the refine step needs
to run at all. You can't put a check like that in the middle of a single
prompt.

:::quiz{id="when-to-chain" xp=10}
When is splitting a job into a chain of prompts most worth it?

- [ ] Whenever the task is hard, since one call can't reason well
  Not quite. With thinking on, Claude handles a lot of multi-step reasoning in one call.
- [x] When you want to check or steer the output between steps
  Right. Separate calls let you log, test and gate each step, at the cost of more calls.
- [ ] When you want the cheapest, fastest answer
  Not quite. A chain makes several calls, so it's usually slower and costs more than one.
:::

---

This sandbox runs one prompt at a time, so you'll play the middle of the chain
by hand. The draft below has three problems: it's long, it's full of jargon
and it never says when dark mode ships (it's **2 November**).

Write the **review** step. Put the draft in `<draft>` tags, give your
**criteria**, and ask Claude to **list the problems** (not rewrite it) in
`<review>` tags.

:::prompt{id="review-step" xp=40}
Write the review step: the draft in tags, your criteria, problems in <review> tags

- placeholder "<draft>…</draft> Check it against: … List the problems in <review> tags. Don't rewrite it."
- draft "We are thrilled to announce that, leveraging our cutting-edge theming infrastructure, we have shipped a paradigm-shifting dark mode experience that synergistically reduces ocular strain across every surface of the platform for all stakeholders."
- check "Puts the draft in <draft> tags"  /<draft>/i
- check "Puts the draft in <draft> tags"  /<\/draft>/i
- check "Gives criteria"                  /criteria|check (it |that |for |against )|must|should|under \d|no jargon|plain|mention/i
- check "Asks for problems, not a rewrite" /problems|issues|what.s wrong|mistakes|feedback/i
- check "Asks for <review> tags"          /review>|review tags/i
- run temperature=[1.0]
- example T=1.0 "<review>1. Jargon: leveraging, paradigm-shifting, synergistically, stakeholders. 2. Never says when it ships (2 November). 3. Doesn't say how to turn it on.</review>"
- example T=1.0 "<review>Too much jargon (cutting-edge theming infrastructure, synergistically). Missing the launch date. Says nothing users can act on.</review>"
- example T=1.0 "<review>Problems: no date; jargon in nearly every phrase; one long sentence that's hard to read.</review>"
- success "That's the middle link of a chain. Feed this review back in, and the refine step knows exactly what to fix." next="Next: test your prompt →"
:::

Want to finish the chain by hand? Copy Claude's review, then write a third
prompt with the draft and the review in tags, and ask for a rewrite.

:::rabbithole
- read "Building effective agents: prompt chaining" by="Anthropic" url="https://www.anthropic.com/engineering/building-effective-agents"
- read "Prompting best practices: Chain complex prompts" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"
:::
