// The global daily mail cap (decision 039): sign-in, step-up and
// email-change codes share one counter per UTC day, reserved atomically.
import { readMailQuota } from '@bits/db'
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import { routes } from '../routes.ts'
import { fetchAs, form, requestCode, signIn, testDb, testIp } from '../test/auth.ts'
import { requestEmailChange } from './email-change.ts'
import { DEFAULT_MAIL_DAILY_CAP, mailDailyCap } from './mail-quota.ts'
import { outbox } from './mailer.ts'

/** Runs `body` with the cap at today's count + `headroom`, then restores it. */
async function withHeadroom<T>(headroom: number, body: () => Promise<T>): Promise<T> {
  let env = platform.env as { SIGNIN_MAIL_DAILY_CAP?: string }
  let saved = env.SIGNIN_MAIL_DAILY_CAP
  let sent = (await readMailQuota(testDb, Date.now()))?.sent ?? 0
  env.SIGNIN_MAIL_DAILY_CAP = String(sent + headroom)
  try {
    return await body()
  } finally {
    env.SIGNIN_MAIL_DAILY_CAP = saved
  }
}

/** Captures `console.error` JSON lines while `body` runs. */
async function errorLogs(body: () => Promise<void>): Promise<Record<string, unknown>[]> {
  let lines: Record<string, unknown>[] = []
  let original = console.error
  console.error = (line: unknown) => {
    try {
      lines.push(JSON.parse(String(line)))
    } catch {
      original(line)
    }
  }
  try {
    await body()
  } finally {
    console.error = original
  }
  return lines
}

const askForCode = (email: string) =>
  fetchAs(null, routes.login.action.href(), {
    method: 'POST',
    headers: { 'CF-Connecting-IP': testIp() },
    body: form({ email }),
  })

// One flat suite: remix test runs after() around every describe.
describe('daily mail cap', () => {
  after(() => disposePlatform())

  it('reads SIGNIN_MAIL_DAILY_CAP, falling back to the default when unset or invalid', () => {
    let env = platform.env as { SIGNIN_MAIL_DAILY_CAP?: string }
    let saved = env.SIGNIN_MAIL_DAILY_CAP
    try {
      env.SIGNIN_MAIL_DAILY_CAP = '25'
      assert.equal(mailDailyCap(), 25)
      env.SIGNIN_MAIL_DAILY_CAP = '0'
      assert.equal(mailDailyCap(), 0)
      for (let raw of [undefined, '', 'lots', '-1', '2.5']) {
        env.SIGNIN_MAIL_DAILY_CAP = raw
        assert.equal(mailDailyCap(), DEFAULT_MAIL_DAILY_CAP)
      }
    } finally {
      env.SIGNIN_MAIL_DAILY_CAP = saved
    }
  })

  it('past the cap, /login answers a calm 429 that points at the other ways in, and sends nothing', async () => {
    let logs = await errorLogs(() =>
      withHeadroom(2, async () => {
        await requestCode('cap-one@example.com')
        await requestCode('cap-two@example.com')

        let mailed = outbox.length
        let response = await askForCode('cap-three@example.com')
        assert.equal(response.status, 429)
        let html = await response.text()
        assert.match(html, /sent all the email we can for today/)
        assert.match(html, /Continue with GitHub/)
        assert.equal(outbox.length, mailed, 'no email sent')
        let stored = await testDb.d1
          .prepare('select count(*) as n from email_tokens where email = ?')
          .bind('cap-three@example.com')
          .first<{ n: number }>()
        assert.equal(stored?.n, 0, 'no token stored')

        // A second refusal the same day doesn't log again.
        assert.equal((await askForCode('cap-four@example.com')).status, 429)
      }),
    )
    let capped = logs.filter((line) => line.message === 'Daily mail cap reached')
    assert.equal(capped.length, 1)
    assert.equal(capped[0]!.purpose, 'sign-in')
    assert.doesNotMatch(JSON.stringify(logs), /cap-(three|four)@example\.com/, 'no addresses in logs')
  })

  it('a request refused by the per-address limit does not spend a slot', async () => {
    let email = 'cap-repeat@example.com'
    for (let i = 0; i < 3; i++) await requestCode(email)
    let before = (await readMailQuota(testDb, Date.now()))!.sent
    let response = await askForCode(email)
    assert.equal(response.status, 429)
    assert.match(await response.text(), /3 emails in the last 10 minutes/)
    assert.equal((await readMailQuota(testDb, Date.now()))!.sent, before)
  })

  it('email-change codes share the cap', async () => {
    let { user } = await signIn('cap-mover@example.com')
    await withHeadroom(0, async () => {
      let result = await requestEmailChange(testDb, {
        user,
        email: 'cap-moved@example.com',
        ip: testIp(),
        origin: 'http://localhost',
      })
      assert.deepEqual(result, { ok: false, reason: 'rate-global' })
      assert.equal(outbox.findLast((m) => m.to === 'cap-moved@example.com'), undefined)
    })
  })
})
