---
# sources (checked 2026-10-26):
# - Anthropic, Prompting best practices (give Claude a role; be explicit about format and
#   length; say what to do when it can't help)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
# - Anthropic, Pricing (output tokens cost 5× input on Claude Haiku 5.5)
#   https://platform.claude.com/docs/en/about-claude/pricing
# - Anthropic, API version 2026-10-21 (no sampling parameters; steer with the prompt)
title: "Checkpoint: tune a chatbot"
order: 8
minutes: 10
xp: 60
module: Putting it together
project: true
---

Time to put the whole course to work. You're building the help bot for
**Moon Café**, the coffee shop from the temperature lesson. You can't touch
Claude's dials, so you'll tune it the way you do in real life: with the
prompt.

A good bot here does four things. It stays **in character**: it knows it's
Moon Café's assistant, and sounds like it. It keeps replies **short**, because
replies are output tokens and output is the expensive half. It stays **on
topic**, answering about the café and politely saying no to the rest. And it
stays **grounded**: it only uses the menu you give it, so it can't invent a
dish that doesn't exist.

Here's the difference that makes:

:::compare{left="No tuning" right="Tuned prompt" illustrative}
- prompt "Do you have anything without caffeine?"
- left "Great question! Many coffee shops offer a variety of caffeine-free options, such as herbal teas, hot chocolate, steamers, decaf coffee, fruit smoothies and more. You may want to check with your local café about their specific menu, as offerings can vary widely…"
- right "Yes! Our Zero-g mint tea is caffeine-free, $3. Want it iced?"
:::

Checkpoint. Write the bot's prompt: who it is, its tone, a length limit,
what to do with off-topic questions, the menu, and a customer question to
answer. Hit every check, then run it a few times. A well-tuned prompt gives
you **different words but the same behaviour** on every run.

:::prompt{id="moon-cafe-bot" xp=60}
Tune the Moon Café help bot with a prompt

- placeholder "You are Moon Café's assistant. Be … Reply in under … words. If asked about anything else, … Menu: … Customer: …"
- draft "Answer this customer: Do you have anything without caffeine?"
- check "Gives it a role"              /you are|you're|act as|\brole\b|assistant for|assistant at/i
- check "Sets a tone"                  /friendly|warm|cheerful|playful|polite|tone|upbeat/i
- check "Sets a length limit"          /\bwords?\b|\bsentences?\b|\bunder\b|\bshort\b|\bbrief\b/i
- check "Handles off-topic questions"  /\bonly\b|off.topic|unrelated|anything else|can.t help|cannot help|decline/i
- check "Includes the menu"            /menu/i
- check "Includes a customer question" /customer|\?/i
- run temperature=[1.0]
- example T=1.0 "Yes! Our Zero-g mint tea is caffeine-free, $3. Want it iced?"
- example T=1.0 "Sure do: the Zero-g mint tea has no caffeine at all. $3, and it's lovely iced."
- example T=1.0 "Our Zero-g mint tea is caffeine-free ($3). Everything else on the menu has a kick!"
- success "Different words, same behaviour. That's a tuned bot." next="Finish the course →"
:::

Finish this checkpoint and the **Temperature tamer** badge is yours. You now
know what a token costs, where the odds come from, how a reply gets drawn from
them, and how to steer Claude without touching a dial. Next up: **Prompting
that works** turns that steering into a toolkit.

:::rabbithole
- read "Prompting best practices" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"
- video "AI prompt engineering: A deep dive" by="Anthropic" mins=77 deep url="https://www.youtube.com/watch?v=T9aRN5JkmL8"
:::
