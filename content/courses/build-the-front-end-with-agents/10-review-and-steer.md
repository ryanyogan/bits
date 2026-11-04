---
# sources (checked 2026-11-03):
# - Anthropic, Claude Code best practices (review, plan mode, give Claude a way to verify)
#   https://www.anthropic.com/engineering/claude-code-best-practices
# - Claude Code docs, Skills (turning a repeated prompt into a skill) https://code.claude.com/docs/en/skills
# - Installed remix 3.1.0 docs: guides 04 and 05 (keep application logic outside components; TypedEventTarget)
# - Klippy d-09 → d-10, docs/outputs/d-10.txt (2026-11-03, Claude Code 2.1.317). The review is a REAL headless Claude
#   Code run in plan mode, quoted from the recording. The fixes were written by an agent against the steer prompts,
#   not by that session. The second browser run is real; the Workers AI fallback answered, not Claude.
title: "Review and steer"
order: 10
minutes: 25
xp: 90
module: Review and ship
device: desk
tag: d-09
verified: 2026-11-03
versions:
  claude-code: "2.1.317"
  remix: "3.1.0"
---

The chat works. Before you build on it, read it. **Never merge code you
haven't read**, however confident the agent sounds. A second agent session
can help you read: ask it to review the diff, in plan mode, so it can look
but not touch.

### 1. The review prompt

```text
Goal: review the chat front end (git diff d-07..d-09 -- apps/web) before I build on it, so nothing unread gets merged.
Use the remix skill and AGENTS.md; check claims against apps/web/node_modules/remix guides 04 and 05, not memory.
Constraints:
- Read only. Don't edit files; don't run the dev server.
- Look for: code that isn't isolated (protocol logic inside a component), UI that misrepresents what happened,
  security (token, Origin, hrefs from model output), accessibility (labels, live regions), and Remix v2/React patterns.
Done when every finding names a file and line and says why it matters.
Report at most 6 findings, most important first, each with the smallest fix. Say "none" for a category with nothing.
```

We ran it headless, in plan mode, with read-only tools:

```sh
claude -p "<the prompt>" --permission-mode plan --max-turns 25 --allowedTools "Read,Grep,Glob,Bash(git diff:*),Bash(git show:*),Bash(git log:*)"
```

- **Categories to look for.** "Review this" gets style nits. Naming what
  matters gets findings.
- **File, line, why, smallest fix.** Each finding is checkable and
  actionable.
- **"Say none for a category with nothing."** Permission to find nothing,
  so it doesn't invent problems to fill the list.

### 2. What it found

A real run, quoted (excerpt; it found six, here are the first three
headlines and its security verdict):

:::terminal{cmd="claude -p &quot;<the review prompt>&quot; --permission-mode plan …"}
### 1. The protocol logic lives inside the component
**`apps/web/app/actions/public/chat.tsx:25-92`**
- Guide 05 ("Keep application logic outside components") says to keep UI state in the component and put data and operations in plain TypeScript, using its `CartModel extends TypedEventTarget` example.
- **Why it matters:** none of this can be tested without a DOM. […] Also, `JSON.parse` at `:31` will throw inside the listener on any frame that isn't JSON.
### 2. "Sending your answer…" can stay on screen forever
- `answering.add(toolCallId)` is never removed. If `exchange` fails, the card loses its buttons and keeps saying "Sending your answer…" with no way to retry.
### 3. A failed send looks delivered, and the typed text is lost
[muted](… 4. lost connections aren't announced; 5. accessibility details; 6. entry.ts drops the guide's guard)
### Security: none
- **Origin:** `controller.tsx:28` requires an exact `Origin` match, and a missing `Origin` is rejected.
- **Token:** added only on the server in `agent.ts`, and the agent re-checks it.
- **Links from model output:** source hrefs are limited to `^https?://`.
:::

Plan mode also saves a copy of its notes under `~/.claude/plans/`, outside
the repo.

We took every finding except two it marked as optional. **But it missed
one.** In our own run last lesson, the tool card was drawn above the text,
so the model's early "Note saved" looked like it came after the tool. A
review agent misses things too. Your own run is the other half of the
review.

### 3. Steer: one change per prompt

Each steer prompt quotes the problem and says what you want instead:

```text
Move the socket and protocol code out of Chat into app/actions/public/chat-session.ts, a ChatSession that extends TypedEventTarget like guide 05's CartModel. The component only draws and calls send()/answer().
```

```text
Sending your answer… can stick, and a failed send looks delivered. Clear answering in every case, treat a null stream as an error, and on a failed send take the message back and keep the typed text.
```

```text
The tool cards render above the text, so 'Note saved' looks like it came after the tool ran. Render parts in order.
```

And one from our run after the refactor:

```text
After Deny the card still says 'Waiting for you'. Apply the agent's saved chat when the reply ends.
```

The result: the island's file now only draws (about 70 lines), and the
protocol lives in a class with no JSX. Its `send()` takes your message back
if it didn't go through:

:::code{file="apps/web/app/actions/public/chat-session.ts" lang="ts" tag="d-10" highlight="7-9" label="apps/web/app/actions/public/chat-session.ts"}
// The chat with your Klippy, without any UI: one WebSocket to /chat, the messages, and what's in progress.
// The island draws it and calls send() and answer(); every change fires "change". (Remix guide 05: keep application
// logic outside components.) The browser never names the agent or holds the token: the web Worker adds both.
export class ChatSession extends TypedEventTarget<{ change: Event }> {
	messages: UIMessage[];
	busy = false; // a reply is streaming
	offline = false; // the socket dropped; AgentClient reconnects by itself
	problem = ''; // the last thing that went wrong, in plain words
	announced = ''; // the finished reply, for the live region
	readonly answering = new Set<string>(); // tool calls whose Approve/Deny was clicked
	#saved: UIMessage[] | undefined; // the agent's copy of the chat, if it arrived while a reply was streaming
	#agent: AgentClient;
	#transport: WebSocketChatTransport;
:::

### 4. Run it again: Deny this time

Our second browser run (real; the Workers AI fallback answered):

:::terminal{cmd="node browser-run.mjs   # our scratch Playwright script, not in the repo"}
[1.7s] YOU: Please save a note: call Sam about the trip
[19.5s] approval card: saveNote [ion]Waiting for you[text] Input { "body": "call Sam about the trip" } Approve saving this note Deny saving this note
[19.5s] clicking: Deny saving this note
[19.8s] DOM: Klippy: saveNote Waiting for you Input { … } Sending your answer…
[25.1s] DOM: Klippy: saveNote [synapse]You said no[text] I'm sorry, but I wasn't able to save the note at the moment - the system returned an error. [muted](…)
:::

The card says **You said no**, and the note wasn't saved: the newest note
on `/notes` is still last lesson's. The model said "the system returned an
error", which isn't what happened. **Read the card, not the model's
sentence.**

### 5. Review the refactor

- `chat.tsx` has no `AgentClient`, `MessageType` or `JSON.parse` left;
  `chat-session.ts` has no JSX.
- Every path through `send()` and `answer()` ends with `busy = false`, and
  a failure sets a message.
- Live regions are rendered from the start, never conditionally.
- Nothing new in `package.json`.
- **Reject**: a refactor that changes behaviour you didn't ask for, a new
  state library.

**Save it as a skill (optional).** You'll ask for reviews like this again.
A skill with a description such as "Review a diff in apps/web against
AGENTS.md and the Remix guides. Use before merging front-end changes."
loads it when you need it. Keep it in your own `.claude/skills/`.

:::quiz{id="review-miss" xp=20}
The review agent said "Security: none" and missed that tool cards were drawn out of order. What does that tell you?

- [ ] Review agents aren't worth running
  Not quite. It found five real problems with files, lines and fixes.
- [x] A review agent helps you read, and your own run of the app catches what reading misses
  Right. Use both, and you still own what you merge.
- [ ] Ask for more than 6 findings next time
  Not quite. More findings wouldn't catch something that only shows when you run it.
:::

Your repo matches tag `d-10`
([changes from d-09](https://github.com/ryanyogan/klippy/compare/d-09...d-10)).

:::rabbithole
- read "Claude Code best practices" by="Anthropic" url="https://www.anthropic.com/engineering/claude-code-best-practices"
- read "Agent Skills in Claude Code" by="Anthropic" url="https://code.claude.com/docs/en/skills"
:::
