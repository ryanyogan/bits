import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { packManifest, unpackManifest } from './packed-manifest.ts'
import type { AssetManifest } from './types.ts'

describe('packed asset manifest (decision 026)', () => {
  it('round-trips, storing each repeated URL once', () => {
    let shared = '/assets/npm/component/runtime/jsx.@Bi6bAA.js'
    let manifest: AssetManifest = {
      entry: { href: '/assets/entry.js', preloads: ['/assets/entry.js', shared], importMap: { imports: { '/a.js': shared } } },
      stylesheets: ['/assets/app.css'],
      fontPreloads: [],
      fonts: { 'mono.woff2': '/assets/mono.@x.woff2' },
      clientEntries: {
        'packages/ui/src/one.tsx': { href: '/assets/one.js', preloads: ['/assets/one.js', shared], importMap: { imports: {} } },
        'packages/ui/src/two.tsx': { href: '/assets/two.js', preloads: ['/assets/two.js', shared], importMap: { imports: {} } },
      },
    }
    let packed = packManifest(manifest)
    assert.equal(packed.strings.filter((value) => value === shared).length, 1)
    assert.deepEqual(unpackManifest(JSON.parse(JSON.stringify(packed))), JSON.parse(JSON.stringify(manifest)))
  })

  it('refuses values it cannot represent', () => {
    assert.throws(() => packManifest({ entry: { href: 1 } } as unknown as AssetManifest), /only hold strings/)
  })
})
