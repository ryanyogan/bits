---
# sources (checked 2026-10-27):
# - Anthropic, Streaming Messages (client.messages.stream, content_block_delta / text_delta
#   events; stream long or high-max_tokens requests to avoid HTTP timeouts)
#   https://platform.claude.com/docs/en/build-with-claude/streaming
# - Cloudflare, Workers limits (CPU time excludes time waiting on fetch; Free 10 ms CPU,
#   Paid 30 s default up to 5 min; no wall-clock limit on HTTP requests while the client is
#   connected; work may be cancelled when the client disconnects)
#   https://developers.cloudflare.com/workers/platform/limits/
# - Cloudflare, Agents "HTTP and Server-Sent Events" (ReadableStream with an async start())
#   https://developers.cloudflare.com/agents/agent-class/http-sse/
# - Cloudflare, Workers best practices (stream bodies instead of buffering; tie async work
#   to the request)
#   https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
# - bits itself: apps/web/app/runs/model.ts streams Claude the same way and aborts the
#   provider request when the reader cancels.
# Compare timings and terminal output are illustrative.
title: "Stream the reply"
order: 2
minutes: 6
xp: 40
module: From script to endpoint
---

Last lesson's Worker waits for Claude's **whole** answer, then sends it. For
a one-line reply that's fine. For a long answer, or an agent that calls three
tools first, the user stares at a spinner the whole time.

**Streaming** sends each piece of text the moment Claude writes it. Same
answer, same cost, but the first words arrive almost at once.

:::compare{left="Buffered" right="Streamed" illustrative}
- prompt "After 1 second"
- left "(waiting…)"
- right "Chicago is overcast,"
- prompt "After 4 seconds"
- left "(waiting…)"
- right "Chicago is overcast, 41°F, with light wind from the north. Bring a jacket."
- prompt "After 5 seconds"
- left "Chicago is overcast, 41°F, with light wind from the north. Bring a jacket."
- right "(done)"
:::

---

The SDK's `messages.stream()` gives you events. You keep the text deltas and
pass them into a `ReadableStream`, which becomes the response body:

:::code{file="src/index.ts" lang="ts" highlight="10-34" label="stream the reply"}
import Anthropic from "@anthropic-ai/sdk";

export default {
  async fetch(request, env): Promise<Response> {
    const { question } = await request.json<{ question?: unknown }>();
    if (typeof question !== "string" || question.length > 2000) {
      return new Response("question must be a string under 2,000 characters", { status: 400 });
    }
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const stream = client.messages.stream({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: question }],
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
      cancel() {
        stream.abort(); // the reader left: stop paying for tokens nobody reads
      },
    });

    return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
  },
} satisfies ExportedHandler<Env>;
:::

:::terminal{cmd='curl -N $URL -d @question.json'}
[muted]# example output: the words arrive a few at a time
Layer up: November in Chicago swings from mild to freezing,
and the wind off the lake makes it feel colder…
:::

Two Workers facts make this safe. **Waiting doesn't count as CPU time.** The
CPU limit (10 ms on the free plan, 30 seconds by default on paid, as of
October 2026) only counts time your code is computing. Seconds spent waiting
on Claude are free. And an HTTP request has **no wall-clock limit** while the
client stays connected, so a long stream can run to the end.

The flip side: when the client disconnects, Cloudflare may cancel the work.
That's what `cancel()` is for. If the reader closes the tab, abort the model
request so you aren't billed for the rest of an answer nobody will see.

:::quiz{id="cpu-time" xp=20}
On the free plan (10 ms of CPU per request), your Worker waits 8 seconds for Claude to finish streaming. What happens?

- [ ] It fails: 8 seconds is far over 10 ms
  Not quite. The 10 ms is CPU time. Waiting on a network response isn't counted.
- [x] It works: waiting on fetch isn't CPU time
  Right. Relaying a stream uses a tiny amount of CPU. The waiting is free.
- [ ] It works, but only if you buffer the whole answer first
  Not quite. Buffering doesn't change CPU time, and it makes the user wait.
:::

:::quiz{id="reader-left" xp=20}
A user closes the tab halfway through a long answer. What should your Worker do?

- [ ] Keep streaming, so the answer is complete in the logs
  Not quite. You'd pay for every remaining output token, and output tokens are the expensive half.
- [x] Abort the model request in the stream's `cancel()`
  Right. Nobody is reading, so stop generating. bits does exactly this for the prompts you run in its sandbox.
- [ ] Nothing: Cloudflare refunds unfinished requests
  Not quite. Anthropic bills the tokens Claude generates, whoever reads them.
:::

:::rabbithole
- read "Streaming Messages" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/streaming"
- read "Workers limits" by="Cloudflare" url="https://developers.cloudflare.com/workers/platform/limits/"
:::
