// Applies every SQL migration to a D1 binding, in order. Test-only: the real
// databases are migrated by `wrangler d1 migrations apply`.
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { D1Database } from '../src/d1/types.ts'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

export async function applyMigrations(d1: D1Database): Promise<void> {
  for (let file of (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()) {
    let sql = await fs.readFile(path.join(migrationsDir, file), 'utf8')
    let statements = sql
      .replace(/--.*$/gm, '')
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean)
    await d1.batch(statements.map((statement) => d1.prepare(statement)))
  }
}
