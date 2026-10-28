---
# sources (checked 2026-10-27):
# - Anthropic, Prompting best practices, "Give Claude a role" (a role in the system prompt
#   focuses behaviour and tone; even one sentence helps; TypeScript `system` example)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
# - Anthropic, Prompting Claude Haiku 5.5, "Keep chatbots to their system prompt" (add a line
#   saying the rules hold when users argue or keep asking; use high effort when instruction
#   following matters most)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5
# - Matt Pocock (AI Hero), Messages, System Prompts and Reasoning Tokens
#   https://www.aihero.dev/messages-system-prompts-and-reasoning-tokens
# - bits app/runs/model.ts (the sandbox's fixed system prompt, quoted below; the learner's
#   text is the user message)
# Toy: both outputs are illustrative.
title: "Roles and the system prompt"
order: 5
minutes: 7
xp: 50
module: Shape the prompt
---

A request to Claude has two places for words. The **system prompt** says who
Claude is and the rules that hold for the whole conversation. The **messages**
carry the conversation itself: what the user asks, and Claude's replies.

The most common thing to put in the system prompt is a **role**. Anthropic's
guidance is that even a single sentence of role focuses Claude's behaviour and
tone for your use case.

:::code{file="tutor.ts" lang="ts" copy highlight="8-9"}
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const reply = await client.messages.create({
  model: "claude-haiku-5-5",
  max_tokens: 1024,
  system: "You are a patient science tutor for 12-year-olds. Use everyday examples and no jargon.",
  messages: [{ role: "user", content: "Why is the sky blue?" }],
});

for (const block of reply.content) {
  if (block.type === "text") console.log(block.text);
}
:::

The role lives in `system`, so it applies to every turn. The user's question
goes in `messages`. The loop at the end prints only the `text` blocks:
Claude Haiku 5.5 thinks by default, so a reply can start with a `thinking`
block (more on that in lesson 7).

---

A good role is more than a job title. “You are a tutor” helps a little. Add
**who it's talking to** and **how it should sound**, and it helps a lot.

:::compare{left="No role" right="Role, audience and tone" illustrative}
- prompt "What is an API?"
- left "An API (Application Programming Interface) is a set of rules and protocols that allows different software applications to communicate with each other, defining the methods and data formats for requests and responses."
- right "Think of a restaurant. You don't walk into the kitchen; you tell the waiter what you want, and the waiter brings it back. An API is the waiter between two apps."
:::

The right column came from adding: “You are a patient teacher explaining tech
to a 10-year-old. Use one everyday comparison and no jargon.”

**Building a chatbot?** Anthropic suggests telling Claude Haiku 5.5, in the
system prompt, that its rules hold for the whole conversation, even when a
user argues, gives a sympathetic reason or keeps asking. In their testing,
that line made it stick to the system prompt more often.

:::quiz{id="where-it-goes" xp=10}
You're building Moon Café's help bot. Where does “You are Moon Café's assistant. Only answer questions about the café.” belong?

- [x] In the system prompt
  Right. It's who the bot is and a rule for the whole conversation, which is what the system prompt is for.
- [ ] At the start of every user message
  Not quite. That works in a pinch, but the system prompt is built for standing rules and keeps your messages clean.
- [ ] In Claude's first reply
  Not quite. You can't write Claude's replies for it, and the bot needs the rule before the first message.
:::

---

**An honest note about this sandbox.** It already has a system prompt, and you
can't change it: “You are the model in bits, a sandbox where people learn to
prompt. Answer the prompt directly and briefly (under 80 words). No preamble.”
Whatever you type arrives as the **user message**.

So here, put your role at the top of your message. That works too; it's just
not where a role belongs in your own app.

Your turn. Ask Claude to explain what an API is, with a **role**, an
**audience** and a **tone**.

:::prompt{id="give-a-role" xp=40}
Give Claude a role, an audience and a tone, then ask your question

- placeholder "You are a … explaining to … Be … Explain …"
- draft "Explain what an API is."
- check "Gives a role"         /you are|you're|act as|your role|pretend/i
- check "Names the audience"   /\bfor (a|an|my|our|someone|people|kids|beginners)\b|\bto (a|an|my|our|someone|people|kids|beginners)\b|year.old|beginner|audience|grandm|grandp|manager|non.technical/i
- check "Sets a tone"          /patient|friendly|playful|blunt|\bplain\b|simple|jargon|encouraging|warm|casual|gentle|\bclear\b|\bfun\b|tone/i
- check "Asks the question"    /\bapi\b/i
- run temperature=[1.0]
- example T=1.0 "Think of a restaurant. You don't go into the kitchen; you tell the waiter what you want and they bring it back. An API is the waiter between two apps: one app asks, the API carries the order, and the answer comes back."
- example T=1.0 "Imagine a vending machine. You press a button and a snack drops out, without knowing what happens inside. An API is a set of buttons one app gives another, so they can ask for things."
- example T=1.0 "An API is like a menu at a café. It lists what you can ask for and how to ask. Apps use these menus to order things from each other."
- success "One sentence of role, and the same question gets a different teacher." next="Next: ask for the format →"
:::

:::rabbithole
- read "Prompting best practices: Give Claude a role" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"
- read "Prompting Claude Haiku 5.5" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5"
- read "Messages, system prompts and reasoning tokens" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/messages-system-prompts-and-reasoning-tokens"
:::
