// Test helper: an in-memory D1 database (Miniflare, the same workerd D1
// implementation `wrangler dev` uses) with every migration applied.
import { convertV4MiniflareOptions, Miniflare } from 'miniflare'

import type { D1Database } from '../src/d1/types.ts'
import { applyMigrations } from './migrations.ts'

export async function createTestD1(): Promise<{ d1: D1Database; dispose: () => Promise<void> }> {
  let mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response(null, { status: 404 }) } }',
      d1Databases: { DB: 'test-db' },
    }),
  )
  let d1 = (await mf.getD1Database('DB')) as unknown as D1Database
  await applyMigrations(d1)
  return { d1, dispose: () => mf.dispose() }
}
