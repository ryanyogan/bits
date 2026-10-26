---
title: Temperature & randomness
order: 6
minutes: 7
xp: 40
module: Picking the next word
video: assets/06-temperature.mp4
duration: 4:30
chapters:
  - { at: 0:00, title: "A ranked list" }
  - { at: 0:54, title: "Sharpening the odds" }
  - { at: 2:15, title: "Flattening the odds" }
  - { at: 3:09, title: "Picking a temperature" }
---

Last lesson you saw that a model never picks “the” next word. It gives
**every possible token a probability**, then rolls a weighted die.

**Temperature** reshapes those odds before the roll. Low temperature sharpens
them — the favourite almost always wins. High temperature flattens them — long
shots get a real chance. Drag it and watch.

:::odds{prompt="Moon café tagline:" blank="“___" slider=0.7}
" Brew"  3.1
" One"   2.4
" Lunar" 1.9
" Fly"   1.2
" Zero"  0.6
:::

An honest catch: you can't turn this dial on Claude. Anthropic's current API
doesn't accept a temperature, so Claude always samples at **1.0**. In this
sandbox, `1.0` runs Claude live, and the other settings show saved examples
of what a low temperature looks like. Next lesson covers what that means for
you.

Your turn. Write a prompt that asks for a **tagline for a coffee shop on the
moon** with a length limit. Look at the `0` examples, then run it a few times
at `1.0` and compare.

:::prompt{id="moon-tagline" xp=40}
Write the prompt yourself — no pasting the answer

- placeholder "Write a tagline for…"
- draft "Write a tagline for a coffee shop on the moon."
- check "Asks for a tagline"   /tagline|slogan/i
- check "Coffee + moon"        /coffee|caf[eé]/i
- check "Coffee + moon"        /moon|lunar/i
- check "Sets a length limit"  /\bwords?\b|\bshort\b|\bunder\b|\bmax/i
- run temperature=[0, 1.0]
- example T=0 "Brewed beyond gravity."
- example T=0.7 "One small sip for mankind."
- example T=0.7 "Espresso at escape velocity."
- example T=0.7 "Low gravity. High caffeine."
- example T=0.7 "Fly me to the foam."
- example T=0.7 "Lunar roast, zero atmosphere, full flavour."
- example T=1.0 "One small sip for mankind."
- example T=1.0 "Espresso at escape velocity."
- example T=1.0 "Low gravity. High caffeine."
- example T=1.0 "Fly me to the foam."
- example T=1.0 "Lunar roast, zero atmosphere, full flavour."
- success "Same prompt, different answers — and now you know why." next="Next: Top-p →"
:::
