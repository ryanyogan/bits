import { findUserById } from '@bits/db'
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import { completeLesson, runAt, runPrompt, sessionCookieFrom, signIn, testDb, testIp } from '../test/auth.ts'
import { gatewayBaseUrl, LIVE_MODEL } from './model.ts'
import { runLimits } from './run.ts'

const COURSE = 'tokens-and-temperature'
const PROMPT = 'Write a tagline for a coffee shop on the moon. Under 6 words.'
const moon = { course: COURSE, lesson: 'temperature', exercise: 'moon-tagline', prompt: PROMPT }
const HOT_TAGLINES = /One small sip|Espresso at escape velocity|Low gravity|Fly me to the foam|Lunar roast/

interface GatewayCall {
  url: string
  headers: Headers
  signal: AbortSignal
  body: Record<string, unknown>
}

/** A reply that sends its first words, then stalls until the request is aborted. */
function stalledReply(call: GatewayCall): Response {
  let start = sseReply(['Lunar '])
  let head = start.body!.getReader()
  let aborted = new Promise<void>((resolve) => call.signal.addEventListener('abort', () => resolve()))
  let sent = false
  let body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!sent) {
        sent = true
        // The whole canned stream up to the first delta, minus the ending.
        let text = new TextDecoder().decode((await head.read()).value)
        controller.enqueue(new TextEncoder().encode(text.slice(0, text.indexOf('event: content_block_stop'))))
        return
      }
      await aborted
      controller.error(new DOMException('aborted', 'AbortError'))
    },
  })
  return new Response(body, { headers: start.headers })
}

/** An Anthropic Messages SSE stream, as the gateway relays it. */
function sseReply(chunks: string[], usage = { input: 42, output: 9 }): Response {
  let events = [
    {
      type: 'message_start',
      message: {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [],
        model: LIVE_MODEL,
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: usage.input, output_tokens: 1 },
      },
    },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ...chunks.map((text) => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })),
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: usage.output } },
    { type: 'message_stop' },
  ]
  let body = events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream', 'request-id': 'req_test' } })
}

/**
 * Configures the model and stubs the gateway for the duration of `fn`.
 * Only gateway URLs are intercepted; anything else goes to the real fetch.
 */
async function withGateway(reply: (call: GatewayCall) => Response, fn: (calls: GatewayCall[]) => Promise<void>) {
  let env = platform.env as unknown as Record<string, string | undefined>
  let saved = { key: env.ANTHROPIC_API_KEY, account: env.AI_GATEWAY_ACCOUNT_ID, token: env.CF_AIG_TOKEN }
  env.ANTHROPIC_API_KEY = 'sk-test'
  env.AI_GATEWAY_ACCOUNT_ID = 'acct-test'
  env.CF_AIG_TOKEN = 'aig-test'
  let realFetch = globalThis.fetch
  let calls: GatewayCall[] = []
  globalThis.fetch = async (input, init) => {
    let request = new Request(input, init)
    if (!request.url.startsWith('https://gateway.ai.cloudflare.com/')) return realFetch(input, init)
    let call = {
      url: request.url,
      headers: request.headers,
      signal: request.signal,
      body: (await request.json()) as Record<string, unknown>,
    }
    calls.push(call)
    return reply(call)
  }
  try {
    await fn(calls)
  } finally {
    globalThis.fetch = realFetch
    env.ANTHROPIC_API_KEY = saved.key
    env.AI_GATEWAY_ACCOUNT_ID = saved.account
    env.CF_AIG_TOKEN = saved.token
  }
}

interface Row {
  source: string
  temperature: number
  output: string
  model: string | null
  input_tokens: number
  output_tokens: number
  user_id: string | null
  visitor: string | null
}

async function rows(where: string, ...binds: unknown[]): Promise<Row[]> {
  let result = await testDb.d1
    .prepare(
      `select source, temperature, output, model, input_tokens, output_tokens, user_id, visitor
       from exercise_attempts where ${where} order by created_at, rowid`,
    )
    .bind(...binds)
    .all<Row>()
  return result.results
}

// One flat suite: remix test runs after() around every describe, and D1 must
// stay up until the last test.
describe('/api/run', () => {
  after(() => disposePlatform())

  it('streams a live reply through the gateway and journals it with its tokens', async () => {
    let { cookie, user } = await signIn('live@example.com')
    await withGateway(
      () => sseReply(['Lunar ', 'lattes, ', 'zero gravity.']),
      async (calls) => {
        let response = await runPrompt(cookie, { ...moon, temperature: 100 })
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('X-Run-Source'), 'live')
        assert.equal(response.headers.get('X-Run-Model'), LIVE_MODEL)
        assert.equal(response.headers.get('Cache-Control'), 'no-store')
        assert.match(response.headers.get('Content-Type') ?? '', /^text\/plain/)
        assert.equal(await response.text(), 'Lunar lattes, zero gravity.')

        // One request to the gateway's Anthropic endpoint, small and sampling-free.
        assert.equal(calls.length, 1)
        let call = calls[0]!
        assert.equal(call.url, `${gatewayBaseUrl({ AI_GATEWAY_ACCOUNT_ID: 'acct-test', AI_GATEWAY_ID: 'bits' })}/v1/messages`)
        assert.equal(call.headers.get('x-api-key'), 'sk-test')
        assert.equal(call.headers.get('cf-aig-authorization'), 'Bearer aig-test')
        assert.equal(call.body.model, LIVE_MODEL)
        assert.equal(call.body.max_tokens, 300)
        assert.equal(call.body.stream, true)
        assert.deepEqual(call.body.output_config, { effort: 'low' })
        assert.deepEqual(call.body.thinking, { type: 'disabled' })
        assert.deepEqual(call.body.messages, [{ role: 'user', content: PROMPT }])
        for (let key of ['temperature', 'top_p', 'top_k']) assert.equal(key in call.body, false, key)
      },
    )
    assert.deepEqual(await rows('user_id = ?', user.id), [
      {
        source: 'live',
        temperature: 100,
        output: 'Lunar lattes, zero gravity.',
        model: LIVE_MODEL,
        input_tokens: 42,
        output_tokens: 9,
        user_id: user.id,
        visitor: null,
      },
    ])
  })

  it('a rerun (the browser aborting the fetch) stops the model and keeps the partial reply', async () => {
    let { cookie, user } = await signIn('abort@example.com')
    await withGateway(stalledReply, async (calls) => {
      let response = await runPrompt(cookie, { ...moon, temperature: 100 })
      assert.equal(response.headers.get('X-Run-Source'), 'live')
      let reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
      assert.equal((await reader.read()).value, 'Lunar ')
      await reader.cancel()
      // The provider request is aborted, and the row is finished in the background.
      for (let i = 0; i < 50 && !calls[0]!.signal.aborted; i++) await new Promise((resolve) => setTimeout(resolve, 10))
      assert.equal(calls[0]!.signal.aborted, true)
      let row: Row | undefined
      for (let i = 0; i < 50; i++) {
        ;[row] = await rows('user_id = ?', user.id)
        if (row?.output) break
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      assert.equal(row!.output, 'Lunar ')
      assert.equal(row!.input_tokens, 42)
    })
  })

  it('answers other temperatures with the labelled example, never the model', async () => {
    let { cookie, user } = await signIn('example@example.com')
    await withGateway(
      () => sseReply(['unexpected']),
      async (calls) => {
        let response = await runPrompt(cookie, { ...moon, temperature: 0 })
        assert.equal(response.headers.get('X-Run-Source'), 'example')
        assert.equal(response.headers.get('X-Run-Reason'), null)
        assert.equal(await response.text(), 'Brewed beyond gravity.')
        assert.equal(calls.length, 0)
      },
    )
    let [row] = await rows('user_id = ?', user.id)
    assert.equal(row!.source, 'example')
    assert.equal(row!.output, 'Brewed beyond gravity.')
  })

  it('falls back to the example output when no API key is configured', async () => {
    let response = await runPrompt(null, { ...moon, temperature: 100 })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('X-Run-Source'), 'fallback')
    assert.equal(response.headers.get('X-Run-Reason'), 'unconfigured')
    assert.match(await response.text(), HOT_TAGLINES)
    // The signed-out visitor got a session with a visitor id, and the run was journalled.
    let cookie = sessionCookieFrom(response)
    assert.ok(cookie)
    let journal = await rows('user_id is null and source = ? and temperature = 100', 'fallback')
    assert.ok(journal.some((row) => row.visitor && HOT_TAGLINES.test(row.output)))
  })

  it('falls back when the gateway errors (rate limited upstream)', async () => {
    let { cookie } = await signIn('upstream@example.com')
    await withGateway(
      () => Response.json({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }, { status: 429 }),
      async (calls) => {
        let response = await runPrompt(cookie, { ...moon, temperature: 100 })
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('X-Run-Source'), 'fallback')
        assert.equal(response.headers.get('X-Run-Reason'), 'rate-limited')
        assert.match(await response.text(), HOT_TAGLINES)
        assert.equal(calls.length, 1, 'no retries')
      },
    )
  })

  it('the 11th signed-out run within an hour falls back to the example output', async () => {
    let ip = testIp()
    await withGateway(
      () => sseReply(['Moon ', 'roast.']),
      async (calls) => {
        let cookie: string | null = null
        for (let n = 1; n <= runLimits.anonymousPerHour; n++) {
          let response = await runPrompt(cookie, { ...moon, temperature: 100, ip })
          assert.equal(response.headers.get('X-Run-Source'), 'live', `run ${n}`)
          assert.equal(await response.text(), 'Moon roast.')
          cookie = sessionCookieFrom(response) ?? cookie
        }
        let eleventh = await runPrompt(cookie, { ...moon, temperature: 100, ip })
        assert.equal(eleventh.status, 200)
        assert.equal(eleventh.headers.get('X-Run-Source'), 'fallback')
        assert.equal(eleventh.headers.get('X-Run-Reason'), 'limit')
        assert.match(await eleventh.text(), HOT_TAGLINES)
        assert.equal(calls.length, runLimits.anonymousPerHour)

        // A fresh session from the same IP still gets live runs, up to the per-IP cap.
        let other = await runPrompt(null, { ...moon, temperature: 100, ip })
        assert.equal(other.headers.get('X-Run-Source'), 'live')
        await other.text()
      },
    )
  })

  it('parallel runs at the limit boundary get exactly the allowed number of live runs', async () => {
    let ip = testIp()
    await withGateway(
      () => sseReply(['Moon ', 'roast.']),
      async (calls) => {
        // One run makes the session (visitor id); the rest race for the 9 slots left.
        let first = await runPrompt(null, { ...moon, temperature: 100, ip })
        await first.text()
        let cookie = sessionCookieFrom(first)
        let burst = await Promise.all(
          Array.from({ length: 15 }, () => runPrompt(cookie, { ...moon, temperature: 100, ip })),
        )
        let sources = await Promise.all(
          burst.map(async (response) => {
            await response.text()
            return response.headers.get('X-Run-Source')
          }),
        )
        assert.equal(sources.filter((source) => source === 'live').length, runLimits.anonymousPerHour - 1)
        assert.equal(sources.filter((source) => source === 'fallback').length, 15 - (runLimits.anonymousPerHour - 1))
        assert.equal(calls.length, runLimits.anonymousPerHour, 'the model ran only for reserved runs')
      },
    )
  })

  it('the daily live cap holds under parallel runs from many visitors', async () => {
    let env = platform.env as unknown as Record<string, string | undefined>
    let saved = env.RUN_DAILY_LIVE_CAP
    let liveSoFar = (await rows(`source = 'live' and created_at >= ?`, Date.now() - (Date.now() % 86_400_000))).length
    env.RUN_DAILY_LIVE_CAP = String(liveSoFar + 3)
    try {
      await withGateway(
        () => sseReply(['Moon ', 'roast.']),
        async (calls) => {
          let burst = await Promise.all(
            Array.from({ length: 8 }, () => runPrompt(null, { ...moon, temperature: 100, ip: testIp() })),
          )
          let results = await Promise.all(
            burst.map(async (response) => {
              await response.text()
              return [response.headers.get('X-Run-Source'), response.headers.get('X-Run-Reason')]
            }),
          )
          assert.equal(results.filter(([source]) => source === 'live').length, 3)
          assert.deepEqual(
            results.filter(([source]) => source !== 'live'),
            Array.from({ length: 5 }, () => ['fallback', 'budget']),
          )
          assert.equal(calls.length, 3)
        },
      )
    } finally {
      env.RUN_DAILY_LIVE_CAP = saved
    }
  })

  it('a failed model call turns the reserved live row into a fallback', async () => {
    let { cookie, user } = await signIn('reserve-fail@example.com')
    await withGateway(
      () => new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'busy' } }), { status: 529 }),
      async () => {
        let response = await runPrompt(cookie, { ...moon, temperature: 100 })
        assert.equal(response.headers.get('X-Run-Source'), 'fallback')
        await response.text()
      },
    )
    let journal = await rows('user_id = ?', user.id)
    assert.equal(journal.length, 1)
    assert.equal(journal[0]!.source, 'fallback')
    assert.equal(journal[0]!.model, null)
    assert.match(journal[0]!.output, HOT_TAGLINES)
  })

  it('refuses runs far past the limit without journalling them', async () => {
    let ip = testIp()
    let cookie: string | null = null
    let limit = runLimits.anonymousPerHour * runLimits.refuseAfter
    for (let n = 0; n < limit; n++) {
      let response = await runPrompt(cookie, { ...moon, temperature: 0, ip })
      await response.text()
      cookie = sessionCookieFrom(response) ?? cookie
    }
    let refused = await runPrompt(cookie, { ...moon, temperature: 0, ip })
    assert.equal(refused.status, 429)
    assert.equal(refused.headers.get('Cache-Control'), 'no-store')
    assert.equal(((await refused.json()) as { error: string }).error, 'rate_limited')
  })

  it('rejects bad input with JSON errors', async () => {
    let unknown = await runPrompt(null, { ...moon, exercise: 'nope', temperature: 100 })
    assert.equal(unknown.status, 404)
    assert.equal(((await unknown.json()) as { error: string }).error, 'not_found')
    let notOffered = await runPrompt(null, { ...moon, temperature: 50 })
    assert.equal(notOffered.status, 422)
    let empty = await runPrompt(null, { ...moon, prompt: '   ', temperature: 100 })
    assert.equal(empty.status, 422)
    assert.equal(empty.headers.get('Cache-Control'), 'no-store')
    let long = await runPrompt(null, { ...moon, prompt: 'x'.repeat(4001), temperature: 100 })
    assert.equal(long.status, 422)
  })

  it('a forged `ran` field earns nothing; journalled runs pass the run check', async () => {
    let { cookie, user } = await signIn('ran@example.com')
    let forged = await completeLesson(cookie, COURSE, 'temperature', {
      'prompt.moon-tagline': PROMPT,
      'ran.moon-tagline': ['0', '100'],
    })
    assert.equal(forged.status, 422)
    assert.match(await forged.text(), /Ran at 0 and 1\.0/)
    assert.equal((await findUserById(testDb, user.id))!.xp_total, 0)

    // Running at only one of the two temperatures is still not enough.
    await runAt(cookie, moon, [100])
    assert.equal((await completeLesson(cookie, COURSE, 'temperature', { 'prompt.moon-tagline': PROMPT })).status, 422)

    await runAt(cookie, moon, [0])
    let saved = await completeLesson(cookie, COURSE, 'temperature', { 'prompt.moon-tagline': PROMPT })
    assert.equal(saved.status, 303)
    assert.equal((await findUserById(testDb, user.id))!.xp_total, 40)

    // The journal: two runs (canned without a key) and the submitted prompt.
    let journal = await rows('user_id = ?', user.id)
    assert.deepEqual(
      journal.map((row) => [row.source, row.temperature]),
      [
        ['fallback', 100],
        ['example', 0],
        ['submit', null],
      ],
    )
  })
})
