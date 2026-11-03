// "Try it now" on the landing (decision 074): the section a fresh visitor
// gets, the landing's tighter live caps on /api/run, and a pass carrying
// into lesson 1's save. The gateway is stubbed for runs and the judge.
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import { router } from '../../router.ts'
import { routes } from '../../routes.ts'
import { JUDGE_MODEL, LIVE_MODEL } from '../../runs/model.ts'
import { tryLimits, tryLiveCap } from '../../runs/run.ts'
import { completeLesson, fetchAs, form, sessionCookieFrom, signIn, testDb, testIp } from '../../test/auth.ts'
import { lessonOneHref } from './links.ts'
import { TRY_EXERCISE } from './try-it.tsx'

const GOOD = "Hi Claude! In two short sentences: what are you, and what's one thing you can't do from here?"
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

const metBoth = {
  criteria: [
    { id: 0, met: true, evidence: 'an AI model made by Anthropic', source: '' },
    { id: 1, met: true, evidence: "I can't browse the web from here", source: '' },
  ],
  hint: '',
}

function judgeReply(): Response {
  return Response.json(
    {
      id: 'msg_judge',
      type: 'message',
      role: 'assistant',
      model: JUDGE_MODEL,
      content: [{ type: 'text', text: JSON.stringify(metBoth) }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 700, output_tokens: 40 },
    },
    { headers: { 'request-id': 'req_judge' } },
  )
}

/** Connects a model and stubs the gateway; counts model calls. */
async function withGateway(fn: (calls: { runs: number; judge: number }) => Promise<void>) {
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
    await fn(calls)
  } finally {
    globalThis.fetch = realFetch
    env.ANTHROPIC_API_KEY = saved.key
    env.AI_GATEWAY_ACCOUNT_ID = saved.account
    env.CF_AIG_TOKEN = saved.token
  }
}

/** One run of the landing's exercise, as its composer posts it (`from=landing`) or as lesson 1 does. */
async function run(cookie: string | null, options: { landing?: boolean; ip?: string; prompt?: string } = {}) {
  let { course, lesson, exercise } = TRY_EXERCISE
  let fields: Record<string, string> = { course, lesson, exercise, prompt: options.prompt ?? GOOD, temperature: '100' }
  if (options.landing !== false) fields.from = 'landing'
  let response = await fetchAs(cookie, routes.api.run.href(), {
    method: 'POST',
    headers: { 'CF-Connecting-IP': options.ip ?? testIp() },
    body: form(fields),
  })
  let text = await response.text()
  return {
    status: response.status,
    source: response.headers.get('X-Run-Source'),
    reason: response.headers.get('X-Run-Reason'),
    id: response.headers.get('X-Run-Id'),
    cookie: sessionCookieFrom(response) ?? cookie,
    text,
  }
}

async function liveToday(): Promise<number> {
  let since = Date.now() - (Date.now() % 86_400_000)
  let row = await testDb.d1
    .prepare(
      `select (select count(*) from exercise_attempts where source = 'live' and created_at >= ?1)
            + (select count(*) from coach_verdicts where judged = 1 and created_at >= ?1) as n`,
    )
    .bind(since)
    .first<{ n: number }>()
  return row?.n ?? 0
}

async function withDailyCap(cap: number, fn: () => Promise<void>) {
  let env = platform.env as unknown as Record<string, string | undefined>
  let saved = env.RUN_DAILY_LIVE_CAP
  env.RUN_DAILY_LIVE_CAP = String(cap)
  try {
    await fn()
  } finally {
    env.RUN_DAILY_LIVE_CAP = saved
  }
}

/** Journal rows for the landing's exercise, from every owner: compare before and after. */
async function journalCount(): Promise<number> {
  let row = await testDb.d1
    .prepare('select count(*) as n from exercise_attempts where exercise_id = ? and lesson_slug = ?')
    .bind(TRY_EXERCISE.exercise, TRY_EXERCISE.lesson)
    .first<{ n: number }>()
  return row?.n ?? 0
}

// One flat suite: remix test runs after() around every describe.
describe('landing: try it now', () => {
  after(() => disposePlatform())

  it('gives a fresh visitor lesson 1’s exercise right under the hero, wired to the real endpoints, with no D1 read', async () => {
    let response = await router.fetch(new Request(new URL(routes.home.href(), 'http://localhost')))
    assert.equal(response.status, 200)
    let html = await response.text()
    let hero = html.indexOf('id="hero-title"')
    let section = html.indexOf('id="try"')
    let how = html.indexOf('id="how"')
    assert.ok(hero >= 0 && section > hero && section < how, 'between the hero and How it works')
    let slice = html.slice(section, how)
    assert.match(slice, /Write a prompt\. Claude answers\. A coach grades it\./)
    assert.match(slice, /<textarea/)
    // The composer's props: the lesson's own id, the real endpoints, and labels only.
    assert.ok(html.includes('what-is-an-llm/say-hi-to-claude/say-hi'), 'the lesson’s composer id')
    assert.ok(html.includes('"from":"landing"'), 'runs say where they come from')
    assert.ok(html.includes(routes.api.coach.href()), 'graded by /api/coach')
    assert.ok(html.includes('Continue the course →'), 'one next step after a pass')
    assert.ok(html.includes(lessonOneHref()))
    // Patterns, rubric wording beyond the label and the reference stay on the server (decision 064).
    assert.doesNotMatch(html, /two sentences\|2 sentences/)
    assert.doesNotMatch(html, /what's one thing you can't do from here\?/)
    // The catalog is memoised or read from R2: never D1 (decisions 026, 054).
    assert.doesNotMatch(response.headers.get('Server-Timing') ?? '', /\bdb;/)
  })

  it('isn’t shown once there is progress: the landing opens on the next lesson instead (decision 070)', async () => {
    let { cookie } = await signIn('try-signed-in@example.com')
    let html = await (await fetchAs(cookie, routes.home.href())).text()
    assert.doesNotMatch(html, /id="try"/)
    assert.match(html, /aria-label="Continue where you left off"/)
  })

  it('goes live through /api/run and /api/coach, and a pass carries into lesson 1’s save', async () => {
    await withGateway(async (calls) => {
      let first = await run(null)
      assert.equal(first.status, 200)
      assert.equal(first.source, 'live')
      assert.equal(first.text, REPLY)
      assert.ok(first.id)
      let coach = await fetchAs(first.cookie, routes.api.coach.href(), {
        method: 'POST',
        body: form({ course: TRY_EXERCISE.course, lesson: TRY_EXERCISE.lesson, exercise: TRY_EXERCISE.exercise, attempt: first.id! }),
      })
      assert.equal(coach.status, 200)
      let verdict = (await coach.json()) as { layer: string; passed: boolean; xp: number }
      assert.deepEqual([verdict.layer, verdict.passed], ['coach', true])
      assert.deepEqual(calls, { runs: 1, judge: 1 })
      // Lesson 1 reads the pass from the journal: the save goes on to lesson 2.
      let saved = await completeLesson(first.cookie, TRY_EXERCISE.course, TRY_EXERCISE.lesson)
      assert.equal(saved.status, 303)
      assert.equal(saved.headers.get('Location'), routes.courses.lesson.index.href({ course: 'what-is-an-llm', lesson: 'a-very-good-next-word-guesser' }))
    })
  })

  it(`goes live ${tryLimits.perHour} times an hour per visitor; then refuses, unjournalled, and the lesson still runs live`, async () => {
    await withGateway(async (calls) => {
      let ip = testIp()
      let cookie: string | null = null
      for (let i = 0; i < tryLimits.perHour; i++) {
        let result = await run(cookie, { ip })
        assert.equal(result.source, 'live', `run ${i + 1}`)
        cookie = result.cookie
      }
      let before = await journalCount()
      let over = await run(cookie, { ip })
      assert.equal(over.status, 429)
      assert.equal(over.reason, 'try-limit')
      assert.equal(over.id, null)
      assert.equal(await journalCount(), before, 'a refusal writes nothing')
      assert.equal(calls.runs, tryLimits.perHour)
      // The same visitor in lesson 1 has the lessons' hourly allowance.
      let lesson = await run(cookie, { ip, landing: false })
      assert.equal(lesson.source, 'live')
    })
  })

  it('stops going live at its share of the daily cap, leaving the rest to lessons', async () => {
    await withGateway(async () => {
      let spent = await liveToday()
      // The landing's share is already used; the day's cap isn't.
      let cap = Math.ceil((spent + 2) / tryLimits.dailyShare)
      await withDailyCap(cap, async () => {
        assert.ok(cap - tryLiveCap() >= 2, 'room left for lessons')
        // Push the day past the landing's share with lesson runs.
        while ((await liveToday()) < tryLiveCap()) assert.equal((await run(null, { landing: false })).source, 'live')
        let landing = await run(null)
        assert.equal(landing.status, 429)
        assert.equal(landing.reason, 'try-limit')
        let lesson = await run(null, { landing: false })
        assert.equal(lesson.source, 'live')
      })
    })
  })

  it('past the day’s whole budget, the landing gets the lessons’ labelled fallback, not its own refusal', async () => {
    await withGateway(async () => {
      await withDailyCap(await liveToday(), async () => {
        let landing = await run(null)
        assert.equal(landing.status, 200)
        assert.deepEqual([landing.source, landing.reason], ['fallback', 'budget'])
      })
    })
  })
})
