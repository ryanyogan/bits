---
# sources (checked 2026-11-03):
# - Cloudflare Agents, Schedule tasks (this.schedule, listSchedules; stored in the agent's SQLite, run by an alarm)
#   https://developers.cloudflare.com/agents/api-reference/schedule-tasks/
# - Installed @cloudflare/ai-chat 0.12.2 docs: saveMessages (adds a message and runs onChatMessage),
#   waitUntilStable
# - Klippy c-07 → c-08, recorded output docs/outputs/c-08.txt (2026-11-03, amended after a security review). The
#   Workers AI fallback (@cf/zai-org/glm-4.7-flash) answered, not Claude. The three wordings of the injected message
#   are from the recording notes.
title: "Klippy nudges you"
order: 8
minutes: 30
xp: 90
module: Keep it safe
device: desk
tag: c-07
verified: 2026-11-03
versions:
  agents: "0.33.0"
  "@cloudflare/ai-chat": "0.12.2"
  ai: "7.0.162"
---

So far Klippy only speaks when spoken to. This lesson lets it start a
conversation: "Remind me in an hour to call Sam", and an hour later, Klippy
messages you. Nobody typed anything. That's the agent acting on its own, so
it gets the tightest locks in the course.

### 1. A tool that schedules

Make `apps/agent/src/tools/remind.ts`:

:::code{file="apps/agent/src/tools/remind.ts" lang="ts" tag="c-08" highlight="11-13" label="apps/agent/src/tools/remind.ts"}
export function remindTools(agent: Klippy) {
	const remindMe = tool({
		description:
			'Remind the user about something later: Klippy wakes up and messages them. Work out the delay in minutes first (use getTime if the user names a clock time).',
		inputSchema: z.object({
			minutes: z.number().int().min(1).max(7 * 24 * 60).describe('How many minutes from now'),
			message: z.string().trim().min(1).max(200).describe('What to remind them about, e.g. "Call Sam"'),
		}),
		execute: async ({ minutes, message }) => {
			if ((await agent.listSchedules()).length >= MAX_REMINDERS) return { error: `${MAX_REMINDERS} reminders are already waiting.` };
			// schedule() stores the task in this Klippy's SQLite and sets a Durable Object alarm. When it's due,
			// Cloudflare wakes this Klippy and calls its nudge() method with the payload.
			const { id } = await agent.schedule(minutes * 60, 'nudge', { message });
			return { scheduled: { id, inMinutes: minutes, message } };
		},
	});
	return { remindMe };
}
:::

- `agent.schedule(seconds, 'nudge', payload)` stores the task in this
  Klippy's SQLite and sets a Durable Object **alarm**. When it's due,
  Cloudflare wakes this Klippy, even with nobody connected, and calls its
  `nudge()` method with the payload.
- The tool takes **minutes from now**, never a date, so the model doesn't
  parse times. For "at 6pm", its description tells it to call `getTime`
  first and work out the minutes.

Each reminder wakes Klippy and costs a model turn, so the limits are a
budget: at most a week ahead, at most 10 waiting:

:::code{file="apps/agent/src/tools/remind.ts" lang="ts" tag="c-08" label="apps/agent/src/tools/remind.ts"}
// Each reminder wakes Klippy and costs a model turn, so keep them few and soon: 10 waiting, at most a week ahead,
// and at most 20 that fire per day (counted in nudge()).
export const MAX_REMINDERS = 10;
export const MAX_NUDGES_PER_DAY = 20;
:::

In `agent.ts`, add `...remindTools(agent)` next to `...memoryTools(agent)`
inside `afterPage(...)` in `chatTools`. It's a private tool: it can send a
message to future you, so a page must never reach it.

### 2. Klippy starts the turn

Add `nudge()` to the `Klippy` class:

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="c-08" type-mode highlight="14-19" label="apps/agent/src/agent.ts"}
	// A reminder is due (see remindMe). Nobody sent a message: Klippy starts the turn itself.
	async nudge({ message }: { message: string }) {
		// Wait for any reply in progress, or a question waiting for your answer. Still busy? Try again in a minute.
		if (!(await this.waitUntilStable({ timeout: 30_000 }))) {
			await this.schedule(60, 'nudge', { message });
			return;
		}
		// However many were scheduled, at most 20 reminders speak per day (UTC), per Klippy.
		this.sql`CREATE TABLE IF NOT EXISTS nudges (day TEXT PRIMARY KEY, fired INTEGER NOT NULL)`;
		const day = new Date().toISOString().slice(0, 10);
		const [{ fired }] = this.sql<{ fired: number }>`INSERT INTO nudges (day, fired) VALUES (${day}, 1)
			ON CONFLICT (day) DO UPDATE SET fired = fired + 1 RETURNING fired`;
		if (fired > MAX_NUDGES_PER_DAY) return;
		// saveMessages adds a message and runs onChatMessage, just as if it came from you. Open clients see the reply.
		await this.saveMessages((messages) => [
			...messages,
			// metadata.nudge marks it as Klippy's own message: its text never counts as something you typed.
			{ id: crypto.randomUUID(), role: 'user', metadata: { nudge: true }, parts: [{ type: 'text', text: `A reminder you scheduled for me is due now: "${message}". Tell me in one short sentence. Don't schedule anything.` }] },
		]);
	}
:::

- `waitUntilStable` waits for any reply in progress, or a `y/n` waiting for
  you. Still busy after 30 seconds? It reschedules itself a minute later
  instead of dropping the reminder.
- The `nudges` table counts reminders per day: at most 20 speak, however
  many were scheduled.
- `saveMessages` adds a message and runs `onChatMessage`, just as if you'd
  sent it. Open clients see the reply.
- `metadata: { nudge: true }` marks it as Klippy's own message.

### 3. A nudge turn can only speak

A reminder's text was written by the model, maybe after reading something
it shouldn't trust. So a nudge turn gets **no tools at all**: none built,
none offered. Import `MAX_NUDGES_PER_DAY` and `remindTools`, then in
`onChatMessage`:

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="c-08" highlight="3" label="apps/agent/src/agent.ts"}
		const question = lastQuestion(this.messages);
		// A turn nudge() started: it only speaks. No tools at all, so a reminder can't fetch, write or schedule more.
		const nudged = isNudge(this.messages.findLast((m) => m.role === 'user'));
:::

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="c-08" highlight="2" label="apps/agent/src/agent.ts"}
		// A nudge turn gets no tools at all (built empty, and none offered below), so a reminder can only speak.
		const tools = nudged ? {} : chatTools(this, this.env, question, turn, pageInChat);
:::

and first thing in `prepareStep`, `if (nudged) return { activeTools: [] };`.
A reminder can't schedule another reminder, fetch a page, or touch your
notes.

`lastQuestion` (see [the full file](https://github.com/ryanyogan/klippy/blob/c-08/apps/agent/src/agent.ts))
skips nudge messages, so a link planted in a reminder never joins
`readLink`'s list of links you typed.

### 4. The injected message is a prompt too

`nudge()` writes a message to the model. Its wording decides what Klippy
does, and we needed three tries (with the free fallback model):

:::compare{left="The message we sent" right="What Klippy said"}
- left "[Reminder you scheduled: Drink some water] Remind me now, in one sentence."
- right "I'll remind you in one sentence as scheduled!"
- left "It's time for the reminder I asked you to set: “Drink some water”. Remind me now."
- right "I can't set an immediate reminder, but ... drink that water now!"
- left "A reminder you scheduled for me is due now: “Drink some water”. Tell me in one short sentence. Don't schedule anything."
- right "Here's a one short sentence: Drink some water to stay hydrated. (I did not schedule anything.)"
:::

The first two read as a **request to set** a reminder. The third says it's
**due now**, says what to do, and says what not to do. Your turn: write that
message for Claude.

:::prompt{id="nudge-message" xp=40 coach}
Write the message a due reminder sends to Claude
- goal "Write the message Klippy sends itself when a reminder is due, so Claude tells the user in one short sentence and does nothing else"
- placeholder "A reminder you scheduled for me is due now: \"…\". …"
- draft "Reminder: call Sam"
- check "Says what the reminder is about" /remind/i
- check "Says it's due now" /\bnow\b|\bdue\b/i
- expect "Answers in a sentence or two" sentences<=2
- rubric "Tells the user what the reminder is about, briefly" must evidence
- rubric "Doesn't offer, claim or promise to set another reminder or take any other action" must
- rubric "The prompt says the reminder is due now, not asking to set one" must on=prompt
- rubric "The prompt says not to schedule anything" should on=prompt
- hint "Read your message as Claude would. Does it sound like a request to set a reminder, or one that's already due?"
- hint "Say three things: it's due now, what it's about, and how to answer."
- hint "Add what not to do: one short sentence, and don't schedule anything."
- reference "A reminder you scheduled for me is due now: \"Call Sam\". Tell me in one short sentence. Don't schedule anything."
- run temperature=[1.0]
- example T=1.0 "Time to call Sam!"
- example T=1.0 "Your reminder: it's time to call Sam."
- example T=1.0 "Don't forget, you wanted to call Sam now."
- success "That's the message Klippy sends itself. Next, ship Klippy for bits to check." next="Next: the checkpoint →"
:::

### 5. Print replies you didn't ask for

The terminal only printed replies to lines you typed. Now the agent can
speak first, so `scripts/chat.ts` also listens for the finished chat it
broadcasts, and prints a reply it hasn't shown yet:

:::code{file="apps/agent/scripts/chat.ts" lang="ts" tag="c-08" highlight="9-14" label="apps/agent/scripts/chat.ts"}
const seen = new Set<string>(); // the replies already on screen
const textOf = (reply: UIMessage) => reply.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n');
// A reply that continues after you approve a tool is announced with STREAM_RESUMING: hand it to the transport.
agent.addEventListener('message', (event) => {
	const data = JSON.parse(String(event.data));
	if (data.type === MessageType.CF_AGENT_STREAM_RESUMING) transport.handleStreamResuming(data);
	if (data.type === MessageType.CF_AGENT_STREAM_RESUME_NONE) transport.handleStreamResumeNone(data);
	if (data.type === MessageType.CF_AGENT_STREAM_PENDING) transport.handleStreamPending();
	// A turn Klippy started on its own (a reminder, c-08): print its reply when the finished chat arrives.
	const last: UIMessage | undefined = data.type === MessageType.CF_AGENT_CHAT_MESSAGES ? data.messages.at(-1) : undefined;
	if (last?.role === 'assistant' && !seen.has(last.id)) {
		seen.add(last.id);
		process.stdout.write(`\nklippy> ${textOf(last)}\nyou> `);
	}
});
:::

`seen` also gets every streamed reply's id (`seen.add(reply.id)` in
`print()`) and the history's ids at start, so nothing prints twice. Here's
[the diff](https://github.com/ryanyogan/klippy/compare/c-07...c-08).

### 6. Try it

Copy [`test/remind.spec.ts`](https://github.com/ryanyogan/klippy/blob/c-08/apps/agent/test/remind.spec.ts).
It calls `nudge()` directly instead of waiting a minute:

:::terminal{cmd="pnpm exec vitest run test/remind.spec.ts"}
 ✓ schedules a reminder, then starts a turn on its own when it is due
 ✓ refuses a tool the model forces in a reminder turn: none were even built
 ✓ never treats a reminder's text as something you typed
 ✓ refuses an 11th waiting reminder
 ✓ lets at most 20 reminders speak per day
 ✓ refuses a reminder more than a week ahead
[volt] Tests  6 passed (6)
:::

Then for real, on local `wrangler dev`: no deploy needed for alarms. Our
run (the Workers AI fallback answered, not Claude). The second `klippy>`
arrived on its own, about a minute later:

:::terminal{cmd="(printf &quot;Remind me in one minute to drink some water.\n&quot;; sleep 110) | KLIPPY_URL=http://localhost:8801 pnpm chat xia"}
Talking to Klippy "xia" (0 messages so far). /clear to start over, Ctrl+D to quit.
you> [synapse]klippy>[text] You'll get a reminder in 1 minute to drink some water.
you>
[synapse]klippy>[text] It's time to drink some water.
:::

The stored chat shows the hidden message, marked as a nudge:
`{nudge: true} "A reminder you scheduled for me is due now: "Drink some water". Tell me in one short sentence. Don't schedule anything."`

Your code matches tag `c-08`
([changes from c-07](https://github.com/ryanyogan/klippy/compare/c-07...c-08)).

:::rabbithole
- read "Schedule tasks" by="Cloudflare" url="https://developers.cloudflare.com/agents/api-reference/schedule-tasks/"
:::
