# AI Hero: what bits can learn

A synthesis of 207 free AI Hero pages (Matt Pocock, https://www.aihero.dev), fetched on
2026-10-29. Every page is listed in [INDEX.md](INDEX.md). This file is in our own words. When we
use one of these ideas, credit Matt and link the page in "Down the rabbit hole", and check
any API or model detail against the provider's current docs first: many AI Hero posts are
from 2024–25 and use older APIs.

## What the site is

About a third of it is the **AI Coding Dictionary**, 72 short glossary entries. Another
third is about **agent skills** for coding agents (a catalogue, a reference page per
skill, changelogs). The rest:

- **Older free series:** the AI Engineer Roadmap, short Vercel AI SDK recipes, an MCP
  tutorial and evals posts.
- **Coding-agent workflow posts:** AGENTS.md, hooks, Ralph loops, and the docs for his
  Sandcastle library.
- **Paid workshops and cohorts.** Only the outlines and two AI SDK v6 exercises are public.

The site's centre of gravity has moved from "call an LLM from TypeScript" to "engineer
well with a coding agent". bits has no course on the second.

## Ideas AI Hero teaches that bits doesn't yet

### Using coding agents (the largest gap)

bits teaches how to build with the API. It never teaches working alongside an agent such
as Claude Code. A grep of `content/courses/` finds no AGENTS.md or CLAUDE.md, hooks, plan
mode, skills, subagents, handoffs, TDD with agents or tracer bullets. AI Hero covers each
of these:

- **Keep the instruction file small.** It loads on every request, so it should hold only
  the project's purpose, the package manager and unusual commands. Everything else goes
  behind pointers, nested files or skills (progressive disclosure). Don't auto-generate
  it.
  - https://www.aihero.dev/a-complete-guide-to-agents-md
  - https://www.aihero.dev/never-run-claude-init
  - https://www.aihero.dev/ai-coding-dictionary/progressive-disclosure
- **Use hooks or checks for any rule that must always hold**, rather than prose. A hook
  can block a command and tell the agent why. A sandbox limits where an agent can act; a
  guardrail limits what it does.
  - https://www.aihero.dev/how-to-use-claude-code-hooks-to-enforce-the-right-cli
  - https://www.aihero.dev/this-hook-stops-claude-code-running-dangerous-git-commands
  - https://www.aihero.dev/skills-retro
- **Give the agent feedback loops** (types, tests, a pre-commit gate) so it can correct
  itself. Have it build one thin end-to-end slice (a tracer bullet) before widening.
  - https://www.aihero.dev/essential-ai-coding-feedback-loops-for-type-script-projects
  - https://www.aihero.dev/tracer-bullets
- **A workflow chain:** idea, then the agent interviews you about it ("grilling"), then
  research, prototypes for questions talk can't settle, a spec, tickets sized to one
  session with dependencies, a test-first build, a review in a fresh context on two axes
  (standards and spec), and human QA.
  - https://www.aihero.dev/my-7-phases-of-ai-development
  - https://www.aihero.dev/skills-grilling
  - https://www.aihero.dev/skills-to-tickets
  - https://www.aihero.dev/skills-tdd
  - https://www.aihero.dev/skills-code-review
- **Unattended loops (Ralph).** The same prompt runs in a fresh process each time: one
  task, run the checks, append to a progress file, commit, print a completion marker.
  Iterations are capped and the loop runs in a sandbox. You run it watched first and
  unattended later.
  - https://www.aihero.dev/getting-started-with-ralph
  - https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum
  - https://www.aihero.dev/why-the-anthropic-ralph-plugin-sucks
- **Writing for agents.** Distinguish context load from cognitive load. Choose leading
  words carefully. Apply a "no-op test": delete any line whose removal changes nothing.
  Skill descriptions cost context on every request.
  - https://www.aihero.dev/skills-writing-for-agents
  - https://www.aihero.dev/skills/skills-changelog-v1-announcement
- **Don't trust agent reports blindly.** Treat a subagent's report as a secondary source:
  a hypothesis to check against the code, not evidence. Ask for proof (a test that failed
  before and passes after), not "tests pass".
  - https://www.aihero.dev/ai-coding-dictionary/secondary-source
  - https://www.aihero.dev/skills-pr

### Context management in practice

context-is-everything explains context rot and compaction well. AI Hero adds a practical
order of choices at the end of a phase: keep going, clear, hand off to a file, use a
subagent, and compact only as the last resort, because a summary turns first-hand context
into second-hand. It also says one task per session, and to compact at phase boundaries,
never mid-task.

- https://www.aihero.dev/skills-ask-matt
- https://www.aihero.dev/skills-handoff
- https://www.aihero.dev/ai-coding-dictionary/compaction
- https://www.aihero.dev/ai-coding-dictionary/session

### Model behaviour bits doesn't name

- **Two kinds of hallucination with opposite fixes.** A factuality error needs more
  context. A faithfulness error, where the model ignores what is already in context,
  needs less. bits (`what-is-an-llm/07-what-it-cant-do.md`) treats hallucination as one
  thing.
  - https://www.aihero.dev/ai-coding-dictionary/hallucination
- **Sycophancy, and how to word a prompt neutrally to avoid it.** It appears nowhere in
  bits.
  - https://www.aihero.dev/ai-coding-dictionary/sycophancy
- **Serving-side non-determinism.** Batching on the provider's side can change outputs
  even with identical settings.
  - https://www.aihero.dev/ai-coding-dictionary/non-determinism
- **Parametric vs contextual knowledge.** Plan with a frontier model, because planning
  draws on what the model learned in training. A cheaper model can implement, because the
  plan and code in context do most of the work.
  - https://www.aihero.dev/things-people-get-wrong-with-grill-me-and-grill-with-docs

### Building with LLMs

- **Workflow patterns beyond chaining.** Routing, running calls in parallel,
  orchestrator-workers and evaluator-optimizer, plus "start with the raw API".
  first-agent-loop and prompting/08 teach only chaining and loops.
  - https://www.aihero.dev/building-effective-agents (a summary of Anthropic's essay;
    cite Anthropic as the primary source)
- **A one-token gate.** A cheap, fast model answers 1 or 0 before the main call. The same
  trick routes cheap traffic to a cheaper model.
  - https://www.aihero.dev/securing-your-ai-app-with-guardrails
- **When to use an LLM at all.** If code can do it deterministically, use code. The best
  uses are turning unstructured data into structured data, classification, summaries and
  translation, mostly hidden in the backend.
  - https://www.aihero.dev/what-are-llms-used-for
  - https://www.aihero.dev/2025-the-year-building-with-gen-ais-gets-boring~d53hd
- **Choosing a model.** Open vs closed weights, vendor vs host, latency as time to first
  token and time per output token, and benchmark contamination. Your own evals decide.
  - https://www.aihero.dev/how-to-choose-an-llm
- **A "staircase" of escalating cost:** prompt, then structure, then retrieval, then
  agents, then fine-tuning. Earn each step.
  - https://www.aihero.dev/how-to-improve-your-llm-powered-app
- **Evals beyond exact match.** Scores from 0 to 1 instead of pass/fail. Several scorers
  per case. A judge that compares against a reference answer. Tool-call accuracy and
  faithfulness scorers for agents. Cheap evals on every change and judge evals on a
  schedule. A flywheel where a downvoted production answer becomes a new case.
  prompting-that-works/09 and retrieval/08 only start on this.
  - https://www.aihero.dev/what-are-evals
  - https://www.aihero.dev/three-types-of-evals
  - https://www.aihero.dev/evalite-v1-preview
  - https://www.aihero.dev/the-ai-engineer-mindset
- **Building your own MCP server.** bits only covers using one. The missing pieces:
  - a one-file stdio server, https://www.aihero.dev/mcp-server-from-a-single-typescript-file
  - stdout is the protocol channel, so log elsewhere, https://www.aihero.dev/logging-a-huge-mcp-footgun
  - prompt templates that show up as slash commands, https://www.aihero.dev/using-mcp-prompts
  - publishing, https://www.aihero.dev/publish-your-mcp-server-to-npm
  - state on serverless hosts, https://www.aihero.dev/the-problem-with-mcp-stateful-server
- **Images and PDFs as input, and structured output beyond tool schemas** (enums, arrays,
  streamed partial objects).
  - https://www.aihero.dev/describe-images-with-vercel-ai-sdk
  - https://www.aihero.dev/structured-data-from-pdfs-with-vercel-ai-sdk
  - https://www.aihero.dev/generate-enums-with-vercel-ai-sdk
  - https://www.aihero.dev/streaming-objects-with-vercel-ai-sdk

## How Matt structures a lesson

- **Length.** Free posts are short: 300–1,200 words, or 2–8 minutes. The AI SDK recipes
  teach one function with one toy each (recipe, weather, sentiment, invoice). Reference
  pages run longer (1.5–2.5k words for a skill page; 4k for the "17 techniques"
  directory, which opens with a table of contents). Paid crash courses use 2–3 minute
  videos with bite-sized exercises.
- **Shape.** He opens with a pain the reader recognises, explains why it happens in terms
  of how the model or harness works, then gives a concrete fix. The fix is usually a
  prompt to paste or a script, not prose. Many sections end with a "Try it out" prompt
  and a check you can verify ("re-run /context", "watch the push fail").
- **Failure first.** He often shows the broken version, then debugs it in the open, for
  example by reading the SDK's step log to find why an agent stopped after one step. He
  sets bad and good code side by side.
- **Exercises (paid courses).** A "Steps to complete" checklist over TODO stubs, a
  reveal-the-solution toggle and an optional stretch task. Free posts have no in-page
  exercises: you practise by pasting the prompt into your own agent.
- **Progression.** Strictly additive within a series:
  - AI SDK: generate, stream, system prompt, swap models, history, structured output,
    files, embeddings, tools, agent.
  - MCP: why, how, a server, prompts, logging, hosting, publishing.
  - Coding agents: supervised first, then autonomous.
- **Recurring devices:**
  - named mental models ("smart zone / dumb zone", "staircase", "tracer bullet", "AFK vs
    human-in-the-loop")
  - situation→tool tables
  - an "Avoid:" synonym note and a two-line example dialogue in each glossary entry
  - an "It's working if…" checklist on skill pages (an informal eval)
  - "Common questions" drawn from real user reports, with bugs admitted openly
  - links back to classic books (Pragmatic Programmer, A Philosophy of Software Design)
- **Glossary as a graph.** Every term links to its neighbours, so the dictionary builds
  from model to harness to agent to working patterns.

## Best practices he repeats

1. **Start simple and earn every layer.** Default to deterministic code; prefer a
   workflow to an agent when the task is well specified; use the raw API before a
   framework.
   - https://www.aihero.dev/how-to-improve-your-llm-powered-app
   - https://www.aihero.dev/what-is-an-agent
2. **Fewer tokens in context beat a bigger window.** When an instruction is being
   ignored, remove context rather than repeating the instruction.
   - https://www.aihero.dev/what-is-the-context-window
   - https://www.aihero.dev/ai-coding-dictionary/attention-degradation
3. **Only your own evals decide** which model to use or whether a change helped. Build
   eval sets from real user data.
   - https://www.aihero.dev/how-to-choose-an-llm
   - https://www.aihero.dev/what-are-evals
4. **Prefer deterministic checks; treat an LLM judge as a smoke test** that flags things
   for a person to look at.
   - https://www.aihero.dev/three-types-of-evals
5. **Never leave an agent loop unbounded.** Cap the steps and sandbox unattended runs.
   - https://www.aihero.dev/agents-with-vercel-ai-sdk
   - https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum
6. **Make tool calls visible and show tool errors to the model.**
   - https://www.aihero.dev/tool-calls-with-vercel-ai-sdk
   - https://www.aihero.dev/what-are-tools
7. **Describe every schema field.**
   - https://www.aihero.dev/structured-outputs-with-vercel-ai-sdk
8. **Write decisions down for a reader with zero context, and verify them against the
   code.** Treat summaries and subagent output as secondary sources.
   - https://www.aihero.dev/ai-coding-dictionary/handoff-artifact
9. **Rules that must hold belong in checks and hooks, not prose.** A correction you have
   given twice goes into AGENTS.md.
   - https://www.aihero.dev/skills-retro
   - https://www.aihero.dev/ai-coding-dictionary/agents-md
10. **Agents copy the codebase they see,** so clean it up and state the quality bar.
    - https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum
11. **Ground teaching in primary sources and distrust the model's recall.** This is the
    same rule as bits'.
    - https://www.aihero.dev/skills-teach

## Where AI Hero and bits disagree

We checked each item against the bits lesson file named. In every case **bits is current
and needs no fix**, apart from the optional caveats marked. AI Hero pages written before
recent Claude API changes will confuse learners who read them next, so don't link those
pages as current practice.

1. **Temperature as a dial.** AI Hero suggests about 0–0.3 for code and facts and about
   0.8–1.2 for brainstorming (https://www.aihero.dev/how-to-improve-your-llm-powered-app),
   and says you can tweak temperature (https://www.aihero.dev/what-is-an-llm).
   `content/courses/tokens-and-temperature/07-top-p-and-friends.md` says that on
   Anthropic's current API (`2026-10-21`) "you can't set any of these", and already says
   other providers still can. bits is right for Claude.
2. **Prescribed reasoning steps.** AI Hero recommends "guided chain of thought" (outline
   the steps) and `<thinking>`/`<answer>` tags
   (https://www.aihero.dev/how-to-improve-your-llm-powered-app), and presents a "think"
   tool as an add-on
   (https://www.aihero.dev/implementing-anthropics-think-tool-in-typescript).
   `content/courses/prompting-that-works/07-let-it-think.md` says: "Say 'think
   carefully', not how." Its quiz marks thinking tags as the wrong move with adaptive
   thinking. bits follows Anthropic's current docs.
3. **Greedy decoding is deterministic.**
   `content/courses/tokens-and-temperature/05-greedy-vs-sampled.md`: "Same prompt, same
   answer, every time." AI Hero says batching on the serving side adds variation that no
   setting removes (https://www.aihero.dev/ai-coding-dictionary/non-determinism). True of
   the algorithm, not quite of a hosted API. **Optional: add a one-line caveat.**
4. **A cliff or a slope.** AI Hero describes a "smart zone" in roughly the first 40% of
   the window and a "dumb zone" after it, and once calls the growth "exponential"
   (https://www.aihero.dev/why-the-anthropic-ralph-plugin-sucks,
   https://www.aihero.dev/ai-coding-dictionary/smart-zone). Elsewhere it gives the
   threshold as about 120k or about 150k tokens. Matt admits the boundary is disputed.
   `content/courses/context-is-everything/02-bigger-isnt-better.md` says it's "a slope",
   following Anthropic. If we cite the smart-zone idea, call it a rule of thumb, and keep
   "quadratic", not "exponential".
5. **Hitting the window.** AI Hero says an over-long response can cause an API error
   (https://www.aihero.dev/how-to-choose-an-llm). `context-is-everything/02` says Claude
   stops with `model_context_window_exceeded`. Minor; bits is right for Claude.
6. **Where tool definitions go.** AI Hero says they are "injected into the system prompt"
   (https://www.aihero.dev/what-are-tools).
   `content/courses/give-your-model-tools/02-describing-a-tool.md` says to send them in
   the `tools` field, which adds a hidden system prompt. The two are compatible, but
   Matt's phrasing could lead a learner to paste schemas into their own system prompt.
7. **MCP transports.** AI Hero's 2024–25 MCP posts describe stdio plus SSE
   (https://www.aihero.dev/how-does-the-model-context-protocol-work).
   `content/courses/give-your-model-tools/09-mcp.md` says remote servers use Streamable
   HTTP. Keep bits.
8. **Compaction framing.** `content/courses/context-is-everything/04-when-the-chat-gets-long.md`
   presents compaction neutrally. Matt ranks it as the last resort
   (https://www.aihero.dev/skills-ask-matt). This is a missing caveat, not a conflict.

Also dated on AI Hero:

- AI SDK `maxSteps` (newer versions use `stopWhen`; from memory, not docs)
- model names such as Claude 3.5/3.7 and gpt-4o
- "Gemini has the largest windows"
- an instruction-budget figure that varies between posts (150–200, 300–400, about 500).
  Don't quote a number.

## Ten lesson and feature ideas for bits

1. **New course, "Working with a coding agent" (Claude Code first).** Possible lessons:
   - harness vs model
   - a small AGENTS.md, with a sandbox exercise to trim a bloated one using the no-op test
   - hooks vs instructions
   - feedback loops
   - tracer bullets
   - handoffs and session-sized tickets

   Sources:
   - https://www.aihero.dev/a-complete-guide-to-agents-md
   - https://www.aihero.dev/how-to-use-claude-code-hooks-to-enforce-the-right-cli
   - https://www.aihero.dev/essential-ai-coding-feedback-loops-for-type-script-projects
   - https://www.aihero.dev/tracer-bullets
   - https://www.aihero.dev/skills-writing-for-agents
2. **New course, "Evals that hold up."** Lessons:
   - scores vs pass/fail
   - three kinds of grader
   - a judge with a reference answer
   - tool-call accuracy on the existing weather agent
   - the feedback flywheel: a sandbox run marked "bad" becomes a new case

   Sources:
   - https://www.aihero.dev/what-are-evals
   - https://www.aihero.dev/three-types-of-evals
   - https://www.aihero.dev/evalite-v1-preview
3. **Lesson "Two kinds of wrong"** (what-is-an-llm or context-is-everything). A quiz sorts
   short transcripts into factuality and faithfulness errors and picks the fix: add
   sources, or clear context.
   - https://www.aihero.dev/ai-coding-dictionary/hallucination
4. **Lesson "It just agrees with you"** (prompting-that-works). Ask the same review
   question with a leading frame and with a neutral one, and compare. Use real runs or
   examples labelled as examples.
   - https://www.aihero.dev/ai-coding-dictionary/sycophancy
5. **Lesson "Let Claude interview you"** (prompting-that-works). The learner writes an
   interview-first prompt. Checks look for "one question at a time", "recommend an
   answer" and "wait for confirmation". Use our own wording.
   - https://www.aihero.dev/skills-grilling
   - https://www.aihero.dev/my-grill-me-skill-has-gone-viral
6. **Lesson "Workflow patterns"** (first-agent-loop, before the loop). Show routing,
   parallel split-and-merge and evaluator-optimizer with a `:::compare` toy, then an
   exercise to write a router prompt with fixed labels. Ground it in Anthropic's essay.
   - https://www.aihero.dev/building-effective-agents
7. **Lesson "Gate it with a fast model"** (ship-an-agent-to-the-edge). A Haiku one-token
   safe/unsafe gate, checked with a regex for a bare 1 or 0, then reused as a cost
   router.
   - https://www.aihero.dev/securing-your-ai-app-with-guardrails
8. **Lesson "End of a phase: continue, clear, hand off, compact"** (context-is-everything).
   A decision quiz, and a "context meter" toy labelled illustrative.
   - https://www.aihero.dev/skills-ask-matt
   - https://www.aihero.dev/creating-the-perfect-claude-code-status-line
9. **Lesson or short course "Build your own MCP server"**, after give-your-model-tools/09.
   It covers a one-file stdio server added with `claude mcp add`, a quiz on the stdout
   logging trap, and a prompt template that appears as a slash command.
   - https://www.aihero.dev/mcp-server-from-a-single-typescript-file
   - https://www.aihero.dev/logging-a-huge-mcp-footgun
   - https://www.aihero.dev/using-mcp-prompts
10. **Feature: a linked bits glossary** with inline definitions in our own words and a
    credit link. Add an "It's working if…" checklist to each exercise or toy. Start with
    the terms the courses already use: token, context window, harness, tool call,
    compaction, prefix cache, sycophancy.
    - https://www.aihero.dev/ai-coding-dictionary
    - https://www.aihero.dev/skills/skills-changelog-v12-wait-what-writing-for-agents-claude-code-plugin-and-more

Smaller ideas worth keeping:

- **"Should this be an LLM?"** A sorting quiz. https://www.aihero.dev/what-are-llms-used-for
- **"Choosing a model."** Claude-first, with a cost and latency calculator toy.
  https://www.aihero.dev/how-to-choose-an-llm
- **"Show it a picture or a PDF."**
  https://www.aihero.dev/structured-data-from-pdfs-with-vercel-ai-sdk
- **Follow-up suggestion chips after a sandbox run.**
  https://www.aihero.dev/streaming-in-next-question-suggestions-with-the-ai-sdk
