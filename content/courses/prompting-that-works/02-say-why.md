---
# sources (checked 2026-10-27):
# - Anthropic, Prompting best practices, "Add context to improve performance" (give the
#   motivation behind an instruction; Claude generalizes from the explanation)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
# - Twilio, What is the SMS character limit? (a single GSM-7 segment holds 160 characters;
#   used only as the scenario's reason)
#   https://www.twilio.com/docs/glossary/what-sms-character-limit
# - Anthropic, Best practices for prompt engineering (blog, 2025-11-10)
#   https://claude.com/blog/best-practices-for-prompt-engineering
# Toy: both outputs are illustrative. The clinic and the dentist are made up.
title: "Say why"
order: 2
minutes: 6
xp: 40
module: Say what you mean
---

A rule tells Claude **what** to do. A reason tells it **why**, and the why is
what lets it make good calls you didn't spell out.

Anthropic's guidance puts it simply: explain the motivation behind an
instruction and Claude can generalise from it. A bare rule gets followed to
the letter. A rule with its reason gets followed in spirit too.

---

Say you send appointment reminders by text. Compare a rule with a reason.

**Rule only:** “Keep it short.” Short compared to what? An essay? A tweet?
Claude picks a length that seems short to it.

**Rule plus reason:** “It goes out as a single SMS, so it must fit in 160
characters, and most people read it on their lock screen, so put the day and
time first.” Now Claude knows the real limit, and it knows what matters most
in the first few words.

:::compare{left="Rule only" right="Rule plus reason" illustrative}
- prompt "Turn this into a text reminder: Dentist, Tue 3pm, Dr Ali, Bright Smile Clinic, bring your insurance card."
- left "Hi there! Just a friendly reminder that you have an upcoming dental appointment with Dr Ali at Bright Smile Clinic on Tuesday at 3pm. Please remember to bring your insurance card with you. We look forward to seeing you!"
- right "Tue 3pm: dentist with Dr Ali, Bright Smile Clinic. Please bring your insurance card. Reply C to cancel."
:::

Look at what the reason bought. The day and time lead, because of the lock
screen. The greeting is gone, because every character counts. Neither of those
was a rule in the prompt.

---

Good context answers a few quick questions. **Who** will read the output?
**What** is it for, and what happens to it next? **Why** does each constraint
exist? You don't need all of them every time. Add the ones a new colleague
would ask about.

One more benefit: a reason makes your prompt easier to fix later. When a reply
goes wrong, you can see which reason Claude misread, instead of staring at a
list of rules that don't say what they're for.

Your turn. Write the prompt for the dentist reminder above. Say **what it's
for** (a text message) and give **a reason** for at least one constraint.

:::prompt{id="say-why" xp=40}
Write the reminder prompt, with a reason for your constraints

- placeholder "Turn this into a text reminder … It's sent as … so … because …"
- draft "Turn this into a text reminder: Dentist, Tue 3pm, Dr Ali, Bright Smile Clinic, bring your insurance card. Keep it short."
- check "Includes the appointment"  /dentist|dr ali|appointment/i
- check "Says what it's for"        /\bsms\b|text message|\btexts?\b|lock screen|notification|\bphones?\b/i
- check "Gives a reason"            /because|so that|\bsince\b|\bas (it|they|people|patients|most)\b|which means|otherwise|so (it|they|people|patients)\b/i
- run temperature=[1.0]
- example T=1.0 "Tue 3pm: dentist with Dr Ali, Bright Smile Clinic. Please bring your insurance card."
- example T=1.0 "Reminder: Tue 3pm, Dr Ali at Bright Smile Clinic. Bring your insurance card. See you then!"
- example T=1.0 "Tuesday 3pm, Dr Ali (Bright Smile Clinic). Don't forget your insurance card."
- success "A reason turns a rule into a judgement Claude can make for you." next="Next: show, don't tell →"
:::

Try deleting your reason and running it again. Does the reply still put the
time first?

:::rabbithole
- read "Prompting best practices: Add context" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"
- read "Best practices for prompt engineering" by="Anthropic" url="https://claude.com/blog/best-practices-for-prompt-engineering"
:::
