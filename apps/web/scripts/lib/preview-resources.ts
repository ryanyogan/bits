// The shared preview database and bucket (decision 032), read from the
// `previews` block of wrangler.jsonc so there is one place to change them.
// Anything that writes to them from a script goes through here, and refuses
// to run when the block is unset or names a production resource: a preview
// must never migrate or write production.
import { unstable_readConfig } from 'wrangler'

export const PLACEHOLDER_ID = '00000000-0000-0000-0000-000000000000'

/** The preview database hasn't been created yet: previews are off, not broken. */
export class PreviewsNotConfigured extends Error {}

export interface D1Binding {
  binding: string
  database_name?: string
  database_id?: string
  migrations_dir?: string
}

export interface R2Binding {
  binding: string
  bucket_name?: string
}

/** The fields of a read wrangler config that the preview check needs. */
export interface ConfigShape {
  name?: string
  compatibility_date?: string
  d1_databases: D1Binding[]
  r2_buckets: R2Binding[]
  vars?: Record<string, unknown>
  send_email?: unknown[]
  previews?: {
    d1_databases?: D1Binding[]
    r2_buckets?: R2Binding[]
    vars?: Record<string, unknown>
    send_email?: unknown[]
  }
}

export interface PreviewResources {
  db: D1Binding
  content: R2Binding
}

/** The preview DB and CONTENT bindings, or an error saying what's wrong. */
export function previewResources(config: ConfigShape): PreviewResources {
  let db = config.previews?.d1_databases?.find((entry) => entry.binding === 'DB')
  let content = config.previews?.r2_buckets?.find((entry) => entry.binding === 'CONTENT')
  if (!db?.database_id || !db.database_name) throw new Error('previews.d1_databases has no DB binding with a database_id')
  if (!content?.bucket_name) throw new Error('previews.r2_buckets has no CONTENT binding')
  if (db.database_id === PLACEHOLDER_ID) {
    throw new PreviewsNotConfigured(
      'previews.d1_databases DB still has the placeholder id: create bits-preview-db and set it (decision 032)',
    )
  }
  let production = config.d1_databases.find((entry) => entry.binding === 'DB')
  if (production && (db.database_id === production.database_id || db.database_name === production.database_name)) {
    throw new Error('previews DB names the production database')
  }
  let productionBucket = config.r2_buckets.find((entry) => entry.binding === 'CONTENT')
  if (productionBucket && content.bucket_name === productionBucket.bucket_name) {
    throw new Error('previews CONTENT names the production bucket')
  }
  return { db, content }
}

/**
 * Preview sign-in shows the code on the page (decision 038), and the app
 * turns it on only for APP_ENV=preview with no CANONICAL_ORIGIN and no
 * EMAIL binding (`previewMode` in app/auth/preview-mode.ts). This keeps production
 * on the other side of all three: production says APP_ENV=production and
 * has its origin and mail, and only the previews block says preview and
 * goes without them. Checked even before the preview database exists.
 */
export function checkPreviewMode(config: ConfigShape): void {
  let production = config.vars ?? {}
  let previews = config.previews?.vars ?? {}
  if (production.APP_ENV !== 'production') throw new Error('top-level vars.APP_ENV must be "production"')
  if (!production.CANONICAL_ORIGIN) throw new Error('top-level vars.CANONICAL_ORIGIN must be set')
  if (!config.send_email?.length) throw new Error('top-level send_email (EMAIL) must be set')
  if (previews.APP_ENV !== 'preview') throw new Error('previews.vars.APP_ENV must be "preview"')
  if ('CANONICAL_ORIGIN' in previews) throw new Error('previews.vars must not set CANONICAL_ORIGIN')
  if (config.previews?.send_email?.length) throw new Error('previews must not bind send_email')
}

export function readConfigShape(configPath: string): ConfigShape {
  return unstable_readConfig({ config: configPath })
}

export function readPreviewResources(configPath: string): PreviewResources & { config: ConfigShape } {
  let config = readConfigShape(configPath)
  checkPreviewMode(config)
  return { config, ...previewResources(config) }
}
