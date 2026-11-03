// End to end (decision 074): a fresh visitor on the landing writes a prompt,
// Claude answers live (the gateway stubbed in this process), the coach
// grades it, and the one next step continues lesson 1, which opens passed
// and saves. Also: the section keeps its size while the reply streams in.
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { after, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import { router } from './router.ts'
import { routes } from './routes.ts'
import { JUDGE_MODEL, LIVE_MODEL } from './runs/model.ts'

const PROMPT = "Hi Claude! In two short sentences: what are you, and what's one thing you can't do?"
const REPLY = "I'm Claude, an AI model made by Anthropic. I can't browse the web from here."

function sseReply(text: string): Response {
  let events = [
    {
      type: 'message_start',
      message: {
        id: 'msg_run',
        type: 'message',
        role: 'assistant',
        content: [],
        model: LIVE_MODEL,
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 30, output_tokens: 1 },
      },
    },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 9 } },
    { type: 'message_stop' },
  ]
  let body = events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream', 'request-id': 'req_run' } })
}

function judgeReply(): Response {
  let verdict = {
    criteria: [
      { id: 0, met: true, evidence: 'an AI model made by Anthropic', source: '' },
      { id: 1, met: true, evidence: "I can't browse the web from here", source: '' },
    ],
    hint: '',
  }
  return Response.json(
    {
      id: 'msg_judge',
      type: 'message',
      role: 'assistant',
      model: JUDGE_MODEL,
      content: [{ type: 'text', text: JSON.stringify(verdict) }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 700, output_tokens: 40 },
    },
    { headers: { 'request-id': 'req_judge' } },
  )
}

const runReady = () =>
  [...document.querySelectorAll('#try button')].some(
    (b) => /^Run/.test(b.textContent?.trim() ?? '') && !(b as HTMLButtonElement).disabled,
  )

// One flat suite: remix test runs after() around every describe.
describe('landing try it now', () => {
  after(() => disposePlatform())

  it('runs live, is graded by the coach, and continues into lesson 1 with the pass kept', async (t) => {
    let env = platform.env as unknown as Record<string, string | undefined>
    let saved = { key: env.ANTHROPIC_API_KEY, account: env.AI_GATEWAY_ACCOUNT_ID, token: env.CF_AIG_TOKEN }
    env.ANTHROPIC_API_KEY = 'sk-test'
    env.AI_GATEWAY_ACCOUNT_ID = 'acct-test'
    env.CF_AIG_TOKEN = 'aig-test'
    let realFetch = globalThis.fetch
    let calls = { runs: 0, judge: 0 }
    globalThis.fetch = async (input, init) => {
      let request = new Request(input, init)
      if (!request.url.startsWith('https://gateway.ai.cloudflare.com/')) return realFetch(input, init)
      let body = (await request.json()) as { stream?: boolean }
      if (body.stream) {
        calls.runs++
        return sseReply(REPLY)
      }
      calls.judge++
      return judgeReply()
    }
    try {
      let page = await t.serve(await createTestServer(router.fetch))
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(routes.home.href())
      let section = page.locator('#try')
      await page.waitForFunction(runReady)
      await section.scrollIntoViewIfNeeded()
      let before = await section.boundingBox()
      // Layout shifts from here on, as CLS counts them (not within 500ms of input).
      await page.evaluate(() => {
        let w = window as unknown as { __shift: number }
        w.__shift = 0
        new PerformanceObserver((list) => {
          for (let entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
            if (!entry.hadRecentInput) w.__shift += entry.value
          }
        }).observe({ type: 'layout-shift' })
      })

      let prompt = section.getByRole('textbox').first()
      await prompt.fill(PROMPT)
      await section.getByRole('button', { name: /^Run/ }).click()

      // Claude's reply, live (no saved-example label), then the coach's pass.
      await section.getByText(REPLY).first().waitFor()
      await section.getByText('Passed.').first().waitFor()
      assert.equal(await section.getByText(/saved example|example output/).count(), 0, 'a live reply is never labelled an example')
      assert.deepEqual(calls, { runs: 1, judge: 1 })

      // The section never grows with the reply: the run window opens full
      // size and scrolls inside (decision 023). The criteria fold after the
      // first verdict, and the composer scrolls by that so it stays put.
      let after = await section.boundingBox()
      assert.ok(before && after)
      assert.ok(after.height <= before.height, `height ${before.height} → ${after.height}`)
      let shift = await page.evaluate(() => (window as unknown as { __shift: number }).__shift)
      assert.ok(shift < 0.1, `layout shift ${shift}`)

      // One next step: continue the course. Lesson 1 opens passed, and its footer key saves it.
      let next = section.getByRole('link', { name: 'Continue the course →' })
      assert.equal(await next.count(), 1)
      await next.click()
      await page.waitForURL('**/courses/what-is-an-llm/say-hi-to-claude')
      await page.waitForFunction(() =>
        [...document.querySelectorAll('button')].some(
          (b) => /Complete and continue/.test(b.textContent ?? '') && !(b as HTMLButtonElement).disabled,
        ),
      )
      await page.getByRole('button', { name: /Complete and continue/ }).click()
      await page.waitForURL('**/a-very-good-next-word-guesser')
    } finally {
      globalThis.fetch = realFetch
      env.ANTHROPIC_API_KEY = saved.key
      env.AI_GATEWAY_ACCOUNT_ID = saved.account
      env.CF_AIG_TOKEN = saved.token
    }
  })
})
