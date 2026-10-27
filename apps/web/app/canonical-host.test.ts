import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { canonicalRedirect } from './canonical-host.ts'

const production = {
  APP_ENV: 'production',
  CANONICAL_ORIGIN: 'https://bits.yogan.dev',
  LEGACY_HOSTS: 'bits.ryanyogan.workers.dev',
}

describe('canonical host', () => {
  it('serves the canonical host', () => {
    assert.equal(canonicalRedirect(new URL('https://bits.yogan.dev/courses'), production), null)
  })

  it('301s a legacy host, keeping the path and query', () => {
    assert.equal(
      canonicalRedirect(new URL('https://bits.ryanyogan.workers.dev/courses/x?mode=read'), production),
      'https://bits.yogan.dev/courses/x?mode=read',
    )
  })

  it('in production, sends a Version URL host to the canonical one', () => {
    assert.equal(
      canonicalRedirect(new URL('https://1a2b3c4d-bits.ryanyogan.workers.dev/login'), production),
      'https://bits.yogan.dev/login',
    )
  })

  it('never leaves the site for a protocol-relative path', () => {
    let href = canonicalRedirect(new URL('https://1a2b3c4d-bits.ryanyogan.workers.dev//evil.example/x'), production)
    assert.equal(new URL(href ?? '').host, 'bits.yogan.dev')
  })

  it('lets a Preview answer on its own host', () => {
    let preview = { APP_ENV: 'preview' }
    assert.equal(canonicalRedirect(new URL('https://pr-12-bits.ryanyogan.workers.dev/'), preview), null)
    // Even if a Preview were given the production origin, only legacy hosts move.
    assert.equal(
      canonicalRedirect(new URL('https://pr-12-bits.ryanyogan.workers.dev/'), { ...production, APP_ENV: 'preview' }),
      null,
    )
  })

  it('leaves development alone', () => {
    let dev = { APP_ENV: 'development', CANONICAL_ORIGIN: 'https://bits.yogan.dev' }
    assert.equal(canonicalRedirect(new URL('http://localhost:44100/'), dev), null)
    // `pnpm preview` without a .dev.vars runs with the production vars.
    assert.equal(canonicalRedirect(new URL('http://localhost:8787/'), production), null)
  })
})
