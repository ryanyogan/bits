---
# sources (checked 2026-11-03, Firecrawl, maxAge 0):
# - Anthropic, Prompting best practices, "Tool usage" (latest models follow instructions
#   precisely; "can you suggest some changes" gets suggestions, "Change this function…" gets
#   changes; sample prompts for acting by default and for not acting before instructions)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
# - Anthropic, Effective context engineering for AI agents (2025-09-29: tools let agents pull
#   in context as they work; context is a finite "attention budget")
#   https://www.anthropic.com/research/effective-context-engineering-for-ai-agents
# - Matt Pocock (AI Hero), An Introduction To Plan Mode (align with the agent before code is
#   written; questions and steps at the end of the plan)
#   https://www.aihero.dev/plan-mode-introduction
# Toy: both replies in the compare are illustrative.
title: "Plan first, then act"
order: 10
minutes: 7
xp: 50
module: Prompt with tools
---

So far Claude has only written text back to you. Give it **tools** (a web
search, your files, a terminal) and a prompt stops being a question. It
becomes a job Claude **does**: it searches, reads, edits and runs things,
one step after another.

That raises the stakes on one small habit. Before a job with several steps,
**ask for the plan, and stop there.** Read it, fix it, then say go.

---

The reason is simple: a wrong plan costs more once it's running. If Claude
misreads the job in step one, every search, edit and command after it builds
on the mistake. A plan is cheap to read and cheap to change.

The second half of the habit is to **say what you want done**, in plain
verbs. Anthropic's guide says its latest models are trained to follow
instructions precisely. Ask "can you suggest some changes?" and Claude will
often give you suggestions instead of making them. Write "change this
function to…" and it makes the change.

:::compare{left="Can you suggest…" right="Change… / Plan only" illustrative}
- prompt "Our blog moves from WordPress to a static site this week."
- left "Here are some things you could consider: exporting your posts, picking a static site generator, setting up redirects…"
- right "Plan (no changes yet):\n1. Export posts and images from WordPress.\n2. Convert posts to Markdown, keeping each URL.\n3. Build the site and compare page counts.\n4. Add redirects for any URL that changed.\n5. Switch DNS last.\nShall I start with step 1, or change anything first?"
:::

The left reply is vague because the prompt was. The right one came from a
prompt that said exactly what to produce, how long, and when to stop.

---

A good plan-first prompt has four parts:

1. **The job**, with the detail that matters ("keep every old URL working").
2. **Plan only:** a numbered list of steps, with a limit, say six.
3. **A stop:** "don't start yet" or "wait for my go-ahead".
4. **The question back:** ask Claude to end by checking the plan with you.

Coding agents build this in. Claude Code has a plan mode, and the **Work
with coding agents** course uses it. But the habit works with any tool, and
with no tools at all, which is how you'll practise it here.

:::ask{id="act-or-suggest" xp=10}
You want Claude, which can edit your files, to fix a typo in your README. Which prompt gets the edit made?
- choice "“Can you suggest a fix for the typo in the README?”" "Not quite. You'll get a suggestion, because that's what you asked for."
- choice "“Fix the typo in the README: ‘recieve’ should be ‘receive’.”" correct "Right. A plain verb and the exact change: Claude makes the edit."
- choice "“What do you think about the README's spelling?”" "Too open. You'll get an opinion, not an edit."
:::

---

Your turn. The job is the blog move from the example. Write a prompt that
asks for a **numbered plan of at most six steps**, says **don't start yet**,
and asks Claude to **finish by checking the plan with you**.

:::prompt{id="plan-only" xp=40 coach}
Ask for a short plan for the blog move, and a stop before any work

- goal "Get a numbered plan of six steps or fewer, no work done yet, ending with a question that hands the decision back to you"
- placeholder "We're moving our blog from WordPress to a static site … Give me a plan only: … steps … Don't … End by …"
- draft "Help me move my blog from WordPress to a static site."
- check "Describes the job"                /wordpress/i
- check "Asks for a plan or steps"         /plan|steps/i
- check "Sets a limit"                     /\d|five|six|seven|short|brief/i
- check "Says don't start yet"             /don.t start|do not start|don.t begin|not yet|before you start|wait for|until I|no changes|plan only|only the plan|don.t do/i
- check "Asks for a check-in at the end"   /ask(ing)? me|check(ing)? (in )?with me|confirm|approv|go.ahead|my ok|question|whether to (begin|start|go)/i
- expect "A numbered list"                 match /1\.|1\)|step 1/i
- expect "Short"                           words<=160
- expect "Asks you something"               match /\?/
- rubric "Gives six steps or fewer, in a sensible order" must evidence
- rubric "Ends by asking you to approve or change the plan" must evidence
- rubric "Only plans: no finished code, config or migration commands in the reply" must
- hint "Read the reply as the person who has to approve it. Could you say yes or no to it in ten seconds?"
- hint "Say how many steps, and say what Claude should do after the plan: stop, and ask you."
- hint for="Asks you something" "Ask Claude to end with one question: should it start, or change something first?"
- reference "We're moving our blog from WordPress to a static site, and every old post URL must keep working. Give me a plan only: a numbered list of at most six steps, one line each. Don't start any of the work yet. End by asking me whether to begin or change the plan."
- run temperature=[1.0]
- example T=1.0 "1. Export posts, pages and images from WordPress.\n2. Convert the posts to Markdown, keeping each slug.\n3. Pick a static site generator and build the site.\n4. Check every old URL against the new build.\n5. Add redirects for any that changed.\n6. Switch DNS once it all checks out.\n\nShall I start with step 1, or would you like to change the plan?"
- example T=1.0 "Plan (no work done yet):\n1. Back up the WordPress site.\n2. Export content to Markdown.\n3. Set up the static site with the same URL structure.\n4. Test old links.\n5. Go live and keep WordPress as a fallback for a week.\n\nDoes this look right before I begin?"
- example T=1.0 "1. Export your posts.\n2. Convert them to Markdown with matching slugs.\n3. Build and preview the static site.\n4. Map old URLs to new ones and add redirects.\n5. Switch over.\n\nWant me to start, or adjust anything first?"
- success "A plan you can read in ten seconds, and a stop before anything runs. That's the habit for every tool-using job." next="Next: research prompts →"
:::

:::rabbithole
- read "Prompting best practices: tool usage" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"
- read "An introduction to plan mode" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/plan-mode-introduction"
- read "Effective context engineering for AI agents" by="Anthropic" deep url="https://www.anthropic.com/research/effective-context-engineering-for-ai-agents"
:::
