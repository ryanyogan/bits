// Workers Previews helpers for CI (decision 032).
//
//   node --import remix/node-tsx scripts/preview.ts check     the previews block is set and isn't production
//                                                             (exit 0 ready, 3 not set up yet, 1 wrong)
//   node --import remix/node-tsx scripts/preview.ts migrate   apply D1 migrations to the shared preview database
//
// `wrangler d1 migrations apply` reads top-level d1_databases, which in
// wrangler.jsonc is production. `migrate` writes a throwaway config whose
// only database is the preview one, so it can't reach bits-db.
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { PreviewsNotConfigured, readPreviewResources } from './lib/preview-resources.ts'

const appDir = path.resolve(import.meta.dirname, '..')
const configPath = path.join(appDir, 'wrangler.jsonc')
const command = process.argv[2]

if (command !== 'check' && command !== 'migrate') {
  console.error('usage: scripts/preview.ts <check|migrate>')
  process.exit(1)
}

let resources
try {
  resources = readPreviewResources(configPath)
} catch (error) {
  console.error(`preview resources: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(error instanceof PreviewsNotConfigured ? 3 : 1)
}
let { config, db, content } = resources
console.log(`preview resources: D1 ${db.database_name} (${db.database_id}), R2 ${content.bucket_name}`)

if (command === 'migrate') {
  await fs.mkdir(path.join(appDir, '.wrangler'), { recursive: true })
  let dir = await fs.mkdtemp(path.join(appDir, '.wrangler', 'preview-migrations-'))
  let file = path.join(dir, 'wrangler.json')
  try {
    await fs.writeFile(
      file,
      JSON.stringify({
        name: config.name,
        compatibility_date: config.compatibility_date,
        d1_databases: [
          {
            binding: 'PREVIEW_DB',
            database_name: db.database_name,
            database_id: db.database_id,
            migrations_dir: path.resolve(appDir, db.migrations_dir ?? 'migrations'),
          },
        ],
      }),
    )
    let result = spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'PREVIEW_DB', '--remote', '--config', file], {
      cwd: appDir,
      stdio: 'inherit',
    })
    process.exitCode = result.status ?? 1
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}
