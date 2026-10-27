import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { previewMode as isPreview } from '../../app/auth/preview-mode.ts'
import {
  checkPreviewMode,
  PLACEHOLDER_ID,
  PreviewsNotConfigured,
  previewResources,
  readConfigShape,
  type ConfigShape,
} from './preview-resources.ts'

const production = {
  d1_databases: [{ binding: 'DB', database_name: 'bits-db', database_id: 'prod-id' }],
  r2_buckets: [{ binding: 'CONTENT', bucket_name: 'bits-content' }],
}

function withPreviews(db: { database_name: string; database_id: string }, bucket = 'bits-preview-content'): ConfigShape {
  return {
    ...production,
    previews: {
      d1_databases: [{ binding: 'DB', ...db }],
      r2_buckets: [{ binding: 'CONTENT', bucket_name: bucket }],
    },
  }
}

describe('preview resources', () => {
  it('returns the previews block bindings', () => {
    let { db, content } = previewResources(withPreviews({ database_name: 'bits-preview-db', database_id: 'preview-id' }))
    assert.equal(db.database_id, 'preview-id')
    assert.equal(content.bucket_name, 'bits-preview-content')
  })

  it('says previews are off while the id is the placeholder', () => {
    assert.throws(
      () => previewResources(withPreviews({ database_name: 'bits-preview-db', database_id: PLACEHOLDER_ID })),
      PreviewsNotConfigured,
    )
  })

  it('refuses a previews block that names production', () => {
    assert.throws(() => previewResources(withPreviews({ database_name: 'bits-preview-db', database_id: 'prod-id' })), /production database/)
    assert.throws(() => previewResources(withPreviews({ database_name: 'bits-db', database_id: 'other' })), /production database/)
    assert.throws(
      () => previewResources(withPreviews({ database_name: 'bits-preview-db', database_id: 'preview-id' }, 'bits-content')),
      /production bucket/,
    )
  })

  it('refuses a config with no previews block', () => {
    assert.throws(() => previewResources(production), /no DB binding/)
  })

  it('reads wrangler.jsonc: a separate database and bucket, never production', () => {
    let config = readConfigShape(path.resolve(import.meta.dirname, '../../wrangler.jsonc'))
    try {
      previewResources(config)
    } catch (error) {
      // Before the owner creates bits-preview-db, the placeholder is fine.
      assert.ok(error instanceof PreviewsNotConfigured, String(error))
    }
  })

  it('keeps production out of preview sign-in mode (decision 038)', () => {
    let config = readConfigShape(path.resolve(import.meta.dirname, '../../wrangler.jsonc'))
    checkPreviewMode(config)
    // What the Worker sees in production and on a Preview, from the real config.
    let production = { ...config.vars, EMAIL: config.send_email?.length ? {} : undefined }
    let previews = { ...config.previews?.vars, EMAIL: config.previews?.send_email?.length ? {} : undefined }
    assert.equal(isPreview(production), false)
    assert.equal(isPreview(previews), true)
  })

  it('refuses a config that could put production in preview mode', () => {
    let good: ConfigShape = {
      ...production,
      vars: { APP_ENV: 'production', CANONICAL_ORIGIN: 'https://bits.yogan.dev' },
      send_email: [{ name: 'EMAIL' }],
      previews: { vars: { APP_ENV: 'preview' } },
    }
    checkPreviewMode(good)
    assert.throws(() => checkPreviewMode({ ...good, vars: { ...good.vars, APP_ENV: 'preview' } }), /APP_ENV must be "production"/)
    assert.throws(() => checkPreviewMode({ ...good, vars: { APP_ENV: 'production' } }), /CANONICAL_ORIGIN must be set/)
    assert.throws(() => checkPreviewMode({ ...good, send_email: [] }), /send_email/)
    assert.throws(() => checkPreviewMode({ ...good, previews: { vars: { APP_ENV: 'production' } } }), /previews\.vars\.APP_ENV/)
    assert.throws(
      () => checkPreviewMode({ ...good, previews: { vars: { APP_ENV: 'preview', CANONICAL_ORIGIN: 'https://x' } } }),
      /must not set CANONICAL_ORIGIN/,
    )
    assert.throws(
      () => checkPreviewMode({ ...good, previews: { vars: { APP_ENV: 'preview' }, send_email: [{ name: 'EMAIL' }] } }),
      /must not bind send_email/,
    )
  })

  it('needs all three signals before the app is in preview mode', () => {
    assert.equal(isPreview({ APP_ENV: 'preview' }), true)
    assert.equal(isPreview({ APP_ENV: 'production' }), false)
    assert.equal(isPreview({ APP_ENV: 'development' }), false)
    assert.equal(isPreview({}), false)
    assert.equal(isPreview({ APP_ENV: 'preview', CANONICAL_ORIGIN: 'https://bits.yogan.dev' }), false)
    assert.equal(isPreview({ APP_ENV: 'preview', EMAIL: {} }), false)
  })
})
