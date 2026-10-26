---
# sources (checked 2026-10-26):
# - Holtzman et al., The Curious Case of Neural Text Degeneration (2019): nucleus (top-p)
#   sampling keeps the smallest set of tokens whose probabilities add up to p
#   https://arxiv.org/abs/1904.09751
# - Anthropic, API version 2026-10-21: a Messages request that sends temperature, top_p or
#   top_k returns a 400 on every model, even at the default value; requests sample with the
#   defaults (temperature 1.0). Claude Haiku 5.5 also rejects non-default values on older
#   API versions. Checked via the Anthropic API migration notes.
# - Anthropic, Glossary ("Temperature")
#   https://platform.claude.com/docs/en/about-claude/glossary
title: "Top-p and friends"
order: 7
minutes: 6
xp: 40
module: Putting it together
---

Temperature reshapes the odds. Two more dials **cut the list** before the
draw, so long shots can't win at all.

**Top-k** keeps the `k` most likely tokens and drops the rest. With `top_k = 3`, only the three favourites can be picked.

**Top-p** (also called **nucleus sampling**) keeps the smallest group of favourites whose odds add up to `p`. With `top_p = 0.9`, it keeps adding tokens from the top until it has 90% of the probability, then drops the tail.

Either way, the odds of the survivors are scaled back up to 100% and the model
draws from them. Top-p adapts to the moment: when one token is a near-certain
pick, the group is tiny; when many tokens are plausible, it widens.

:::quiz{id="nucleus" xp=20}
The next-token odds are “ Brew” 0.60, “ One” 0.25, “ Lunar” 0.10 and “ Fly” 0.05. With top_p = 0.9, which tokens can still be picked?

- [ ] Only “ Brew”
  Not quite. 0.60 is short of 0.9, so top-p keeps adding tokens.
- [ ] “ Brew” and “ One”
  Not quite. Together they make 0.85, still short of 0.9.
- [x] “ Brew”, “ One” and “ Lunar”
  Right. 0.60 + 0.25 + 0.10 = 0.95, the first total to reach 0.9. “ Fly” is dropped.
- [ ] All four
  Not quite. Top-p's job is to drop the tail, and “ Fly” is the tail.
:::

---

**Now the honest bit about Claude.** On Anthropic's current API (version
`2026-10-21`), you can't set any of these. A request that sends
`temperature`, `top_p` or `top_k` gets an error back, even if the value is
the default. Claude samples at its defaults, which means temperature 1.0 with
no cut-off.

Anthropic's bet is that the model and your prompt do a better job than a
dial. To steer Claude, you change **what you ask**: tighter instructions and
examples for consistency, open-ended asks for variety. That's the skill the
rest of bits teaches.

You'll still meet these dials. Many other providers and open-weight model
runtimes expose them, and older code is full of them. If you have them, the
defaults are fine for most tasks. Change **one** dial at a time, or you won't
know which one did what. Go lower for extraction and labels, higher for
brainstorming.

:::quiz{id="claude-dials" xp=20}
Your code sends `temperature: 0` to Claude Haiku 5.5 on API version 2026-10-21. What happens?

- [ ] Claude answers the same way every time
  Not quite. The current API doesn't accept the setting at all.
- [x] The request fails with an error
  Right. It's rejected with a 400. Remove the parameter, and steer with the prompt instead.
- [ ] It's silently ignored
  Not quite. It isn't ignored. The API refuses the request so you notice.
:::

:::rabbithole
- read "The Curious Case of Neural Text Degeneration" by="Holtzman et al." deep url="https://arxiv.org/abs/1904.09751"
- video "Transformers, the tech behind LLMs" by="3Blue1Brown" mins=27 url="https://www.youtube.com/watch?v=wjZofJX0v4M"
:::
