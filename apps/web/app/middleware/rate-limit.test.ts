import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import { completeLesson, form, fetchAs, runPrompt } from '../test/auth.ts'
import { routes } from '../routes.ts'

type Tier = 'RL_WRITES' | 'RL_SIGNIN' | 'RL_RUNS'

/** Installs a fake limiter for `tier` that allows `allow` requests per key, for the duration of `fn`. */
async function withLimiter(tier: Tier, allow: number, fn: (keys: string[]) => Promise<void>) {
  let env = platform.env as unknown as Record<string, unknown>
  let keys: string[] = []
  env[tier] = {
    async limit({ key }: { key: string }) {
      keys.push(key)
      return { success: keys.filter((k) => k === key).length <= allow }
    },
  }
  try {
    await fn(keys)
  } finally {
    env[tier] = undefined
  }
}

// One flat suite: remix test runs after() around every describe.
describe('burst rate limits', () => {
  after(() => disposePlatform())

  it('POST /login past the burst limit renders a 429 page', async () => {
    await withLimiter('RL_SIGNIN', 1, async (keys) => {
      let send = () =>
        fetchAs(null, routes.login.action.href(), {
          method: 'POST',
          headers: { 'CF-Connecting-IP': '198.51.100.7' },
          body: form({ email: 'burst@example.com' }),
        })
      assert.equal((await send()).status, 303)
      let limited = await send()
      assert.equal(limited.status, 429)
      assert.equal(limited.headers.get('Retry-After'), '60')
      assert.match(await limited.text(), /That was a lot, very fast\./)
      assert.deepEqual(keys, ['ip:198.51.100.7', 'ip:198.51.100.7'])
    })
  })

  it('saving lessons and running prompts are limited per IP when signed out', async () => {
    await withLimiter('RL_WRITES', 0, async () => {
      let response = await completeLesson(null, 'tokens-and-temperature', 'what-is-a-token')
      assert.equal(response.status, 429)
      await response.text()
    })
    await withLimiter('RL_RUNS', 0, async () => {
      let response = await runPrompt(null, {
        course: 'tokens-and-temperature',
        lesson: 'temperature',
        exercise: 'moon-tagline',
        prompt: 'A tagline for a moon café',
        temperature: 0,
      })
      assert.equal(response.status, 429)
      assert.equal(((await response.json()) as { error: string }).error, 'rate_limited')
    })
  })
})
