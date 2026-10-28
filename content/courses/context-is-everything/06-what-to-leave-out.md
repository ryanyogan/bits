---
# sources (checked 2026-10-27):
# - Anthropic Engineering, Effective context engineering for AI agents (find "the smallest
#   possible set of high-signal tokens"; minimal doesn't mean short; system prompts at the
#   right altitude, neither brittle hard-coded logic nor vague guidance that assumes shared
#   context; curate diverse, canonical examples rather than a laundry list of edge cases;
#   "just in time" context: keep lightweight references and load data when needed; start
#   minimal, add instructions based on observed failures)
#   https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
# - Anthropic, Prompting best practices (be clear and direct; add the context behind an
#   instruction; the new-colleague test)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
# Toy: both replies are illustrative.
title: "What to leave out"
order: 6
minutes: 6
xp: 40
module: Keeping it lean
---

Every token you send draws on the same attention budget. So the real skill
isn't stuffing the window, it's **choosing**. Anthropic's engineers put the
goal as the **smallest set of high-signal tokens** that gets you the result
you want. Smallest, not shortest: if Claude needs a fact, leaving it out is
its own failure.

A quick test for each piece of context: **would the answer change if this
were gone?** If not, it's costing you attention and money for nothing.

---

What usually earns its place: the task, the facts the task depends on, the
constraints, the format you want, and one or two good examples.

What usually doesn't. **Backstory nobody asked for**: how the project
started, who sits where. **Stale versions**: the 2019 rules and the 2021
rules that replaced them. **Repeats**: the same instruction three times in
capitals. **A laundry list of edge cases**: Anthropic recommends a few
varied, typical examples instead, because a model learns more from good
examples than from a long list of rules. **Whole files when a section will
do**, and raw logs or tool dumps the model doesn't need yet.

That last one has a better answer than deleting: keep a **pointer** (a file
path, a doc title, a link) and let the model fetch the content only when it
needs it. That's how agents like Claude Code work, and it's where **Give
your model tools** and **Retrieval without tears** pick up.

:::compare{left="Everything in" right="Only what matters" illustrative}
- prompt "Reply to a customer whose order #4417 arrived damaged and who wants a replacement."
- left "Thank you for reaching out, and congratulations on three years with Acme! We're sorry about the coffee machine. Per our 2019 guidelines, refunds are processed within 14 days, although under the 2021 update…"
- right "Sorry your order #4417 arrived damaged. A replacement is on its way at no cost, and you don't need to send the broken one back. Thanks for your patience."
:::

The left reply picked up the noise: a work anniversary, a broken coffee
machine, a policy that no longer applies. Nothing in it was wrong to
include on purpose. It was wrong to include by accident.

---

Your turn. The draft is a real-feeling mess. Cut it down to what the reply
needs: the customer's message, what to offer, the tone and a length. The
checks can only see what's there, not what you removed, so read your
version back before you run it.

:::prompt{id="trim-the-prompt" xp=40}
Trim the bloated prompt to what the reply needs

- placeholder "Reply to this customer: … Offer … Tone: … Under … words."
- draft "Hi! Hope you're well. Context: I've been at Acme for 3 years, our office moved floors last month and the coffee machine is broken again. Here are the 2019 returns rules (refunds within 14 days) and the 2021 rules that replaced them (we replace damaged items free, no return needed). Customer says: “My order #4417 arrived damaged. I want a replacement, not a refund.” Write a reply. Be nice. Be nice! Remember to be nice."
- check "Keeps the customer's message"  /4417|damaged/i
- check "Says what to offer"            /replac/i
- check "Sets a tone"                   /friendly|warm|polite|kind|apolog|empath|tone|calm|sincere/i
- check "Sets a length"                 /\bwords?\b|\bsentences?\b|\bunder\b|\bshort\b|\bbrief\b/i
- run temperature=[1.0]
- example T=1.0 "Sorry your order #4417 arrived damaged! We'll send a replacement free of charge, and there's no need to return the damaged item."
- example T=1.0 "I'm sorry order #4417 reached you damaged. A free replacement is on the way, no return needed. Thanks for bearing with us."
- example T=1.0 "Apologies that #4417 arrived broken. We're shipping you a replacement at no cost; you can keep or recycle the damaged one."
- success "Same answer, a fraction of the context." next="Next: checkpoint →"
:::

:::rabbithole
- read "Effective context engineering for AI agents" by="Anthropic" url="https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
- read "Prompting best practices" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"
:::
