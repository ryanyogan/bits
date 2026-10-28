---
# sources (checked 2026-10-27):
# - Anthropic, Prompting best practices (be clear and direct, add context, examples in tags,
#   XML tags for inputs, a role, explicit output format)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
# - Anthropic, Define success criteria and build evaluations (edge cases: input with nothing
#   relevant in it)
#   https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
# Toy: both outputs are illustrative. The commits are made up.
title: "Checkpoint: release notes"
order: 10
minutes: 8
xp: 80
module: Make it reliable
project: true
---

Time to use the whole toolkit on one real job. Your team writes commit
messages like `fix: null check in avatar upload` and `chore: bump eslint`.
Your users don't read those. You want Claude to turn each week's commits into
**release notes a customer would actually read**.

Here's the gap between a bare prompt and a toolkit prompt:

:::compare{left="Bare prompt" right="Toolkit prompt" illustrative}
- prompt "fix: crash when avatar upload is over 5MB; chore: bump eslint to 9.2; feat: dark mode for settings page; refactor: split auth module"
- left "## Release Notes\n\n**Bug Fixes**\n- Fixed crash when avatar upload exceeds 5MB\n\n**Chores**\n- Bumped eslint to 9.2\n\n**Features**\n- Added dark mode for settings page\n\n**Refactoring**\n- Split auth module"
- right "Settings now has a dark mode. Big profile photos no longer crash the upload: anything up to 5 MB now works smoothly."
:::

The left copied every commit, including the two your users will never notice.
The right knew who the notes were for, so it left the internal work out.

---

A quick map of the toolkit, so you can tick each one off.

**A clear ask** that a new colleague could follow (lesson 1). **The why**:
who reads the notes and what they care about (lesson 2). **An example** of a
note in your style (lesson 3). **Tags** around the commits (lesson 4). **A
role** at the top (lesson 5). **A format**: a length and a shape (lesson 6).
And a rule for the **edge case** your tests would find: a week with nothing
users would notice (lesson 9).

---

Checkpoint. Write the release-notes prompt with every check ticked, then run
it. Then try the edge case: swap the commits for only `chore:` and
`refactor:` lines and run it again. Does your rule hold?

:::prompt{id="release-notes" xp=80}
Write a release-notes prompt that uses the whole toolkit

- placeholder "You are … Our users are … so … <example>…</example> Write … in under … <commits>…</commits> If nothing is user-facing, …"
- draft "Write release notes from these commits: fix: crash when avatar upload is over 5MB; chore: bump eslint to 9.2; feat: dark mode for settings page; refactor: split auth module"
- check "Gives a role"                       /you are|you're|act as|your role/i
- check "Says who reads it, and why"         /because|so that|\bso\b|users|customers|non.technical|audience|readers?/i
- check "Shows an example"                   /<example>|example:|for example|e\.g\.|like this/i
- check "Wraps the commits in tags"          /<\/[a-z]/i
- check "Sets a length or shape"             /\bwords?\b|sentences?|bullet|\blist\b|\bunder\b|paragraph|\blines?\b|\bshort\b/i
- check "Handles a week with nothing to say" /nothing|no user|none of|internal|skip|leave out|omit|ignore (chore|refactor|internal)/i
- run temperature=[1.0]
- example T=1.0 "Settings now has a dark mode. Big profile photos no longer crash the upload: anything up to 5 MB now works."
- example T=1.0 "New: dark mode for your settings page. Fixed: uploading a profile photo over 5 MB no longer crashes the app."
- example T=1.0 "Two changes this week. Your settings page now comes in dark mode, and large profile photos upload without crashing."
- success "That's the toolkit: clear, motivated, shown, tagged, shaped and tested." next="Finish the course →"
:::

Finish this checkpoint and the **Prompting that works** badge is yours. You
can now write prompts that are clear and specific, steer Claude with
examples, tags, roles and formats, know when to let it think or split the
job, and test a prompt before you trust it.

:::rabbithole
- read "Prompting best practices" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"
- video "AI prompt engineering: A deep dive" by="Anthropic" mins=77 deep url="https://www.youtube.com/watch?v=T9aRN5JkmL8"
- read "Prompt engineering interactive tutorial (written for Claude 3)" by="Anthropic" url="https://github.com/anthropics/prompt-eng-interactive-tutorial"
:::
