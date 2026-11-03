// Test helper: a fresh in-memory D1 database on Miniflare (the same workerd D1
// that `wrangler dev` uses), with the suite's schema applied.
import { convertV4MiniflareOptions, Miniflare } from 'miniflare'

import type { D1DatabaseLike } from '../src/types.ts'

const schema = [
  `create table users (
    id text primary key,
    email text not null unique,
    is_public integer not null default 0,
    goals text,
    settings text,
    created_at integer not null
  )`,
  `create table notes (
    id integer primary key autoincrement,
    user_id text not null references users(id) on delete cascade,
    body text not null,
    pinned integer not null default 0,
    created_at integer not null
  )`,
]

export async function createTestD1(): Promise<{ d1: D1DatabaseLike; dispose: () => Promise<void> }> {
  let mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response(null, { status: 404 }) } }',
      d1Databases: { DB: 'test-db' },
    }),
  )
  let d1 = (await mf.getD1Database('DB')) as unknown as D1DatabaseLike
  for (let statement of schema) await d1.prepare(statement).run()
  return { d1, dispose: () => mf.dispose() }
}
