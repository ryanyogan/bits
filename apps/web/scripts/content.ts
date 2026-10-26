// Course content CLI.
//
//   pnpm content validate <dir…>                  build only, print problems
//   pnpm content upload <dir…> [--publish]        build, save as the next version
//   pnpm content upload --all [--publish]         every folder in content/courses/
//
// Options: --as <email> records that user as the uploader and course author;
// --remote talks to the deployed D1 and R2 instead of the local state that
// `pnpm dev` and `pnpm preview` use (needs `wrangler login`).
//
// Problems print as `path:line: error: text`, and the exit code is 1 when a
// folder has errors. A failed upload is still recorded, report only, so the
// author page shows the same errors.
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { parseArgs } from 'node:util'

import { createD1Database, type ReportItem } from '@bits/db'
import { getPlatformProxy, unstable_readConfig } from 'wrangler'

import { buildCourse } from '../app/content/compile/index.ts'
import { listCourseFolders, readCourseFolder } from './lib/content-folder.ts'
import { uploadCourseFolder } from './lib/upload.ts'

const appDir = path.resolve(import.meta.dirname, '..')
const configPath = path.join(appDir, 'wrangler.jsonc')
// pnpm runs scripts from apps/web; resolve folders against where it was run.
const cwd = process.env.INIT_CWD ?? process.cwd()

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    all: { type: 'boolean', default: false },
    publish: { type: 'boolean', default: false },
    remote: { type: 'boolean', default: false },
    as: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const [command, ...folders] = positionals
const usage = 'usage: pnpm content <validate|upload> <dir…> [--all] [--publish] [--as email] [--remote]'

if (values.help || (command !== 'validate' && command !== 'upload')) {
  console.log(usage)
  process.exit(values.help ? 0 : 1)
}

const dirs = values.all ? await listCourseFolders() : folders.map((dir) => path.resolve(cwd, dir))
if (!dirs.length) {
  console.error(`no folders given\n${usage}`)
  process.exit(1)
}

let failed = 0

if (command === 'validate') {
  for (let dir of dirs) {
    let build = buildCourse(await readCourseFolder(dir), { folder: path.basename(dir) })
    print(dir, build.slug, build.report)
    if (build.errors) failed++
  }
} else {
  let proxy = await openBindings(values.remote)
  try {
    let db = createD1Database(proxy.env.DB)
    let userId = values.as ? await findUserId(proxy.env.DB, values.as) : null
    for (let dir of dirs) {
      let result = await uploadCourseFolder(db, proxy.env.CONTENT, dir, {
        source: values.remote ? 'cli (remote)' : 'cli',
        userId,
        publish: values.publish,
      })
      print(dir, result.build.slug, result.build.report)
      let { n, status } = result.version
      if (status === 'failed') {
        failed++
        console.log(`  v${n} recorded with errors; not publishable`)
      } else {
        console.log(`  v${n} saved${result.published ? ' and published' : ` (publish at /author/${result.build.slug})`}`)
      }
    }
  } finally {
    await proxy.dispose()
  }
}

process.exit(failed ? 1 : 0)

/** `dir/file:line: level: text` for problems, then a one-line summary. */
function print(dir: string, slug: string, report: ReportItem[]) {
  let rel = path.relative(cwd, dir) || '.'
  for (let item of report) {
    if (item.level === 'ok') continue
    let where = item.file ? `${path.join(rel, item.file)}${item.line ? `:${item.line}` : ''}` : rel
    console.log(`${where}: ${item.level}: ${item.text}`)
  }
  let errors = report.filter((item) => item.level === 'error').length
  let warnings = report.filter((item) => item.level === 'warning').length
  console.log(`${errors ? '✗' : '✓'} ${slug}: ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`)
}

/**
 * D1 and R2 from wrangler.jsonc: the local state `pnpm dev` uses, or, with
 * --remote, the deployed resources through wrangler's remote bindings.
 */
async function openBindings(remote: boolean) {
  if (!remote) {
    return getPlatformProxy<Env>({ configPath, persist: { path: path.join(appDir, '.wrangler/state/v3') } })
  }
  // A throwaway config with only DB and CONTENT, both marked remote.
  let config = unstable_readConfig({ config: configPath })
  let dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bits-content-'))
  let remoteConfig = path.join(dir, 'wrangler.json')
  await fs.writeFile(
    remoteConfig,
    JSON.stringify({
      name: config.name,
      compatibility_date: config.compatibility_date,
      d1_databases: config.d1_databases.filter((db: Binding) => db.binding === 'DB').map((db: Binding) => ({ ...db, remote: true })),
      r2_buckets: config.r2_buckets.filter((bucket: Binding) => bucket.binding === 'CONTENT').map((bucket: Binding) => ({ ...bucket, remote: true })),
    }),
  )
  let proxy = await getPlatformProxy<Env>({ configPath: remoteConfig, persist: false, remoteBindings: true })
  return {
    env: proxy.env,
    dispose: async () => {
      await proxy.dispose()
      await fs.rm(dir, { recursive: true, force: true })
    },
  }
}

type Binding = { binding: string }

async function findUserId(db: D1Database, email: string): Promise<string> {
  let row = await db.prepare('select id from users where email = ?').bind(email.toLowerCase()).first<{ id: string }>()
  if (!row) {
    console.error(`no user with email ${email}`)
    process.exit(1)
  }
  return row.id
}
