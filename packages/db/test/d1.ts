// Test helper: an in-memory D1 database (Miniflare, the same workerd D1
// implementation `wrangler dev` uses) with every migration applied.
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { convertV4MiniflareOptions, Miniflare } from 'miniflare'

import type { D1Database } from '../src/d1/types.ts'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

export async function createTestD1(): Promise<{ d1: D1Database; dispose: () => Promise<void> }> {
  let mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response(null, { status: 404 }) } }',
      d1Databases: { DB: 'test-db' },
    }),
  )
  let d1 = (await mf.getD1Database('DB')) as unknown as D1Database

  for (let file of (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()) {
    let sql = await fs.readFile(path.join(migrationsDir, file), 'utf8')
    let statements = sql
      .replace(/--.*$/gm, '')
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean)
    await d1.batch(statements.map((statement) => d1.prepare(statement)))
  }

  return { d1, dispose: () => mf.dispose() }
}
