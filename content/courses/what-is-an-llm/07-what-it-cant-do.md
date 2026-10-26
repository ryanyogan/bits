---
# sources (checked 2026-10-26):
# - Anthropic, Models overview (Claude Haiku 5.5 reliable knowledge cutoff: Jun 2026)
#   https://platform.claude.com/docs/en/models/overview
# - Anthropic, Tracing the thoughts of a large language model, 2025-03-27 ("Hallucinations":
#   declining is the default, misfires on half-familiar names; "Mental math": parallel paths,
#   and Claude describes the schoolbook method it didn't use)
#   https://www.anthropic.com/research/tracing-thoughts-language-model
# - Anthropic, Reduce hallucinations (allow "I don't know", ground in quotes, verify,
#   best-of-N comparison)
#   https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations
# - Anthropic, Glossary ("Context window" as working memory, separate from training data)
#   https://platform.claude.com/docs/en/about-claude/glossary
# - bits app/runs/model.ts (the sandbox sends one user message, no tools, no history)
# Toy: odds are illustrative; "The Glass Orchard" is a made-up book.
title: "What it can't do"
order: 7
minutes: 7
xp: 50
module: Using it well
---

Now that you know how it works, its weak spots make sense. Here are the four
that catch people out.

**It has a cutoff.** It learned from text up to a date. For Claude Haiku 5.5,
Anthropic gives a reliable knowledge cutoff of June 2026 (checked October
2026). Anything newer, it doesn't know unless you paste it in or a tool looks
it up. This sandbox has no tools.

**It doesn't remember you.** Chatting doesn't change its parameters. In each
conversation it sees only what's in its context window. Apps that “remember”
save notes and quietly add them to your next prompt. Here, every run starts
blank.

---

**It can make things up.** Remember the lossy zip from lesson 4. When the
details are fuzzy, the odds go flat. But the next token still comes out, and
it reads just as fluently as a sure thing. Here are illustrative odds for a
book that doesn't exist.

:::nexttoken{prompt="The 1923 novel The Glass Orchard was written by" illustrative}
" Margaret" 0.19 | " Edith":0.17 " John":0.15
" Hale" 0.11 | " Ward":0.10 " Ellis":0.09
"," 0.62 | ".":0.30 " in":0.04
" an" 0.44 | " a":0.39 " who":0.08
" English" 0.36 | " American":0.33 " Irish":0.12
" novelist" 0.71 | " writer":0.18 " poet":0.06
:::

Each pick was close to a coin flip, but the sentence sounds sure of itself.
That's a **hallucination**.

Claude is trained to push back. Looking inside an earlier Claude, Anthropic's
researchers found that “I don't know” is its default, and recognising
something switches that off.
It goes wrong when a name feels **familiar** but it knows nothing else about
it.

---

**It slips on maths and counting.** It does sums “in its head” with shortcuts
it learned from text, not with a calculator. The same study caught it adding
two numbers by working out a rough total and the exact last digit in parallel,
then combining them. Ask how it did the sum, though, and it describes carrying
the 1, the method from school.

So check what matters. Ask it to say when it's unsure. Paste in the source
and ask it to quote from it. Check names, numbers, quotes and links yourself.
Use a calculator for maths. And if an answer changes between runs, treat it as
a guess.

Your turn. Ask about something obscure or made up (a half-familiar book
works well), and give Claude permission to say it doesn't know.

:::prompt{id="catch-a-guess" xp=50}
Ask about something obscure, and let Claude say it doesn't know

- placeholder "Who wrote …? If you're not sure, say so."
- draft "Who wrote the 1923 novel The Glass Orchard?"
- check "Asks about a specific fact"   /\bwho\b|\bwhen\b|what year|which|how many|what (is|was)/i
- check "Lets it say it doesn't know"  /not sure|don.t know|do not know|unsure|uncertain|say so|admit/i
- run temperature=[1.0]
- example T=1.0 "I don't know of a 1923 novel called The Glass Orchard. It may not exist, or it may be too obscure for me to know reliably, so I won't guess an author. A library catalogue would settle it."
- example T=1.0 "I'm not sure. I don't have reliable information about that title, and I'd rather not invent an author. If you have a source, I can help you check it."
- example T=1.0 "I don't recognise that book, so I can't name its author with any confidence. It may not exist."
- success "Giving it room to say “I don't know” is one of the best habits you can build." next="Next: checkpoint →"
:::

:::rabbithole
- video "Tracing the thoughts of a large language model" by="Anthropic" mins=3 url="https://www.youtube.com/watch?v=Bj9BD2D3DzA"
- read "Reduce hallucinations" by="Anthropic" url="https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations"
:::
