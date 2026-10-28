import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'

import { createTestD1 } from '../../test/d1.ts'
import { createD1Database } from '../d1/database.ts'
import { createD1Meter, meterD1 } from '../d1/meter.ts'
import type { D1Database } from '../d1/types.ts'
import { findPendingEmailChange, listIdentities, listUserSessions } from './auth.ts'
import { listPasskeys } from './passkeys.ts'
import { readSettingsRows } from './settings.ts'
import { createUser } from './users.ts'

describe('settings reads in one batch (decisions 035, 045)', () => {
  let d1: D1Database
  let dispose: () => Promise<void>

  before(async () => {
    let testD1 = await createTestD1()
    dispose = testD1.dispose
    d1 = testD1.d1
  })

  after(async () => {
    await dispose()
  })

  async function seed(email: string) {
    let db = createD1Database(d1)
    let user = await createUser(db, { email })
    await db.batch([
      d1
        .prepare(
          `insert into sessions (id, user_id, data, user_agent, expires_at, created_at, last_seen_at)
           values (?1 || '-live', ?1, '[{}, {}]', 'UA', 100000, 1, 50), (?1 || '-old', ?1, '[{}, {}]', null, 10, 1, 5)`,
        )
        .bind(user.id),
      d1
        .prepare(`insert into identities (provider, provider_user_id, user_id, email, created_at) values ('github', ?1, ?1, null, 9)`)
        .bind(user.id),
      d1
        .prepare(
          `insert into passkeys (credential_id, user_id, public_key, name, created_at) values (?1 || '-pk', ?1, 'key', 'Laptop', 3)`,
        )
        .bind(user.id),
      d1
        .prepare(
          `insert into email_tokens (token_hash, code_hash, email, expires_at, created_at, purpose, user_id)
           values (?1 || '-t1', 'c', 'new@example.com', 100000, 20, 'email-change', ?1),
                  (?1 || '-t2', 'c', 'gone@example.com', 10, 30, 'email-change', ?1)`,
        )
        .bind(user.id),
    ])
    return user
  }

  it('reads the same rows as the separate queries, in one call', async () => {
    let db = createD1Database(d1)
    let user = await seed('settings@example.com')
    let now = 1000
    let expected = {
      identities: await listIdentities(db, user.id),
      sessions: await listUserSessions(db, user.id, now),
      passkeys: await listPasskeys(db, user.id),
      pendingEmailChange: await findPendingEmailChange(db, user.id, now),
    }
    assert.equal(expected.identities.length, 1)
    assert.equal(expected.sessions.length, 1, 'the expired session is left out')
    assert.equal(expected.passkeys.length, 1)
    assert.equal(expected.pendingEmailChange?.email, 'new@example.com', 'the expired change is left out')

    let meter = createD1Meter()
    let metered = createD1Database(meterD1(d1, meter))
    assert.deepEqual(await readSettingsRows(metered, user.id, now), expected)
    assert.deepEqual({ calls: meter.calls, waves: meter.waves }, { calls: 1, waves: 1 })
  })

  it('reads nothing for a fresh account', async () => {
    let db = createD1Database(d1)
    let user = await createUser(db, { email: 'fresh@example.com' })
    assert.deepEqual(await readSettingsRows(db, user.id, 1000), {
      identities: [],
      sessions: [],
      passkeys: [],
      pendingEmailChange: null,
    })
  })
})
