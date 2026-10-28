---
# sources (checked 2026-10-27):
# - Anthropic, Define tools, "Best practices for tool definitions" (detailed descriptions are by
#   far the most important factor; say what it does, when to use it and when not, what each
#   parameter means, caveats; aim for 3–4 sentences or more; consolidate related operations;
#   namespace names by service; return only high-signal fields; input_examples for complex inputs)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
# - Anthropic Engineering, Writing effective tools for agents, 2025-09-11 (describe a tool as
#   you would to a new hire; unambiguous parameter names like user_id; search_contacts beats
#   list_contacts; Claude was appending "2025" to web search queries until the description was fixed)
#   https://www.anthropic.com/engineering/writing-tools-for-agents
# Compare toy: illustrative. The prompt exercise is a stand-in: the sandbox has no tools, so
# Claude reports the call it would make rather than making one.
title: "Descriptions Claude follows"
order: 4
minutes: 7
xp: 50
module: Getting calls right
---

Anthropic's own advice on tools is blunt: the description is **by far the
most important factor** in how well Claude uses a tool. Claude can't read
your code or ask you what you meant. The description is the whole briefing.

A good test: write it the way you'd brief a **new hire** who has never seen
your system. Spell out what the tool does, **when to use it and when not
to**, what each input means, and what it doesn't do. That's usually three or
four sentences, more for a complicated tool.

:::compare{left="Thin description" right="Briefing" illustrative}
- prompt "search_orders: what Claude is told"
- left "Searches orders."
- right "Find a customer's orders by email address, newest first. Use it when the user asks about a past purchase, a delivery or a refund. It can't change or cancel orders. Returns at most 10 orders with id, date, status and total."
- prompt "User asks: “Where's the blender I bought last week? It's jo@example.com”"
- left "Claude guesses: is the email the search term, or an order id? Will results be in date order?"
- right "Claude calls search_orders with { email: \"jo@example.com\" } and looks at the newest result."
:::

The thin version leaves Claude guessing: search by what? Which orders come
back? Can it cancel one? Every guess is a chance for a wrong call.

---

The same care goes into the **inputs**. Name them so they can't be misread:
`customer_email` beats `user`, which could be a name, an email or an id.
Give each one a description with an example of the format you want. And
use an `enum` whenever there's a fixed set of values.

Small wording changes matter more than you'd think. When Anthropic launched
Claude's web search tool, Claude kept adding the year to search queries,
which skewed the results. The fix wasn't new code. It was a better
description.

Two habits help as your list grows. **Fewer, sharper tools** beat one tool
per API endpoint: a `search_contacts` tool that returns the right person is
better than `list_contacts`, which makes Claude read the whole address book.
And **prefix names by service**, like `github_list_prs` and
`slack_send_message`, so Claude never mixes up two tools called `search`.

:::quiz{id="better-param" xp=20}
Which input name will Claude misuse least?

- [ ] user
  Not quite. Is that a name, an email or an id? Claude has to guess.
- [ ] id
  Not quite. An id of what? An order, a customer, a product?
- [x] customer_email
  Right. It says exactly what goes in it.
:::

Your turn. The sandbox has no real tools, so you'll do the next best thing:
write a **description** for a `get_weather` tool (what it does, when to use
it, when not to), then give Claude a user message and ask it to reply with
**only the input it would send**, as JSON, or “no tool”. Try a question that
should use the tool and one that shouldn't.

:::prompt{id="describe-and-pick" xp=30}
Write a tool description, then ask what call Claude would make

- placeholder "Tool get_weather: … Use it when … Don't use it for … User: “…” Reply with only the JSON input you'd send, or no tool."
- draft "Tool: get_weather. User: Should I bring an umbrella in Leeds tomorrow?"
- check "Says what the tool does"     /weather|forecast|temperature/i
- check "Says when to use it"         /\bwhen\b|use (it|this) (for|if)|whenever/i
- check "Says when not to"            /\bnot\b|don.t|never|only for/i
- check "Includes a user message"     /user|customer|question|message/i
- check "Asks for the JSON input"     /json/i
- run temperature=[1.0]
- example T=1.0 "{\"city\": \"Leeds, UK\"}"
- example T=1.0 "no tool. The tool only gives current conditions, and you asked about tomorrow."
- example T=1.0 "{\"city\": \"Leeds\", \"unit\": \"celsius\"}"
- success "This is the decision Claude makes on every request. Your description is all it has to go on." next="Next: choosing when Claude calls →"
:::

Notice the second example. If your description says the tool only covers
**right now**, a question about tomorrow shouldn't use it. Claude follows the
description you wrote, including its limits.

:::rabbithole
- read "Writing effective tools for agents" by="Anthropic" url="https://www.anthropic.com/engineering/writing-tools-for-agents"
- read "Define tools: best practices" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools"
:::
