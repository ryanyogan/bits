import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { PLACEHOLDER_ID, PreviewsNotConfigured, previewResources, readConfigShape, type ConfigShape } from './preview-resources.ts'

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
})
