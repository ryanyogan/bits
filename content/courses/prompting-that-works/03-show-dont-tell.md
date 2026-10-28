---
# sources (checked 2026-10-27):
# - Anthropic, Prompting best practices, "Use examples effectively" (few-shot / multishot;
#   examples are one of the most reliable ways to steer format, tone and structure; make them
#   relevant, diverse and structured in <example> / <examples> tags; 3–5 examples; Claude can
#   check your examples or write more)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
# Toy: both outputs are illustrative. The error messages are made up.
title: "Show, don't tell"
order: 3
minutes: 7
xp: 50
module: Say what you mean
---

Some things are hard to describe and easy to show. Tone is one. “Friendly but
not cheesy” means something different to everyone. One good example settles
it.

Putting examples in your prompt is called **few-shot** or **multishot**
prompting. Anthropic calls it one of the most reliable ways to steer the
format, tone and structure of Claude's replies.

---

Say your app shows raw errors like `ECONNRESET` and you want them in plain
English, in your house style. You could describe the style. Or you could show
it:

:::code{file="prompt.txt" lang="text" copy}
Rewrite error messages for our app's users, in our house style.

<examples>
<example>
Error: 504 upstream timeout
Rewrite: That took too long on our side. Try again in a minute.
</example>
<example>
Error: 401 invalid session
Rewrite: You've been signed out. Sign in again to pick up where you left off.
</example>
<example>
Error: 413 payload too large
Rewrite: That file is over 10 MB. Try a smaller one.
</example>
</examples>

Now rewrite this one:
Error: ECONNRESET
:::

Notice three things Anthropic recommends. The examples are **relevant**: real
errors from the same app. They're **diverse**: a server problem, a sign-in
problem and a user mistake. And they're **wrapped in tags**, so Claude can
tell the examples apart from your instructions. Three to five is a good
number.

---

There's a catch. Claude copies examples closely, **including the things you
didn't mean to teach**. If every example starts with “Oops!”, every reply
will too.

:::compare{left="Three look-alike examples" right="Three varied examples" illustrative}
- prompt "Error: ECONNRESET"
- left "Oops! The connection dropped. Please try again!"
- right "We lost the connection for a moment. Check you're online, then try again."
:::

On the left, all three examples opened with “Oops!” and ended with “Please
try again!”, so the reply did too. On the right, the examples varied their
openings and each said what to do next, so Claude picked up the real pattern:
plain words, then a next step.

If you're stuck, ask Claude to check your examples for variety, or to write a
few more like them.

:::quiz{id="lookalike-examples" xp=10}
All three of your examples are under six words and end with an exclamation mark. What will Claude most likely do?

- [ ] Ignore the length and punctuation, since you didn't ask for them
  Not quite. Examples are instructions too. Claude reads every pattern in them.
- [x] Write short replies that end with an exclamation mark
  Right. It copies the patterns your examples share, wanted or not. Vary anything you don't want copied.
- [ ] Ask you which style you prefer
  Not quite. The examples look like a clear answer to that question, so it just follows them.
:::

---

Your turn. The draft has one example. Add **a second example** for a
**sign-in or password error**, keep both in `<example>` tags, and keep the new
error at the end. Run it, then try changing your examples' style and watch
the reply follow.

:::prompt{id="show-dont-tell" xp=40}
Add a second, different example and run it

- placeholder "Rewrite error messages … <example>…</example> <example>…</example> Now rewrite: …"
- draft "Rewrite error messages for our app's users, in our house style. <example>Error: 504 upstream timeout. Rewrite: That took too long on our side. Try again in a minute.</example> Now rewrite: Error: ECONNRESET"
- check "Wraps examples in tags"            /<example>/i
- check "Wraps examples in tags"            /<\/example>/i
- check "Keeps the first example"           /504|too long/i
- check "Adds a sign-in or password example" /sign.?in|log.?in|password|session|401|403/i
- check "Ends with the error to rewrite"    /econnreset/i
- run temperature=[1.0]
- example T=1.0 "We lost the connection for a moment. Check you're online, then try again."
- example T=1.0 "The connection dropped on our side. Give it a few seconds and try again."
- example T=1.0 "We couldn't reach our servers just then. Try again in a moment."
- success "Show it once, well, and Claude picks up the pattern." next="Next: structure with XML tags →"
:::

:::rabbithole
- read "Prompting best practices: Use examples effectively" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"
- read "Prompt engineering interactive tutorial (written for Claude 3)" by="Anthropic" url="https://github.com/anthropics/prompt-eng-interactive-tutorial"
:::
