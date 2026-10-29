import * as assert from 'remix/assert'
import { renderToString } from 'remix/component/server'
import { describe, it } from 'remix/test'

import { inlineNodes, inlineText } from './inline.tsx'

describe('lesson inline markdown', () => {
  it('renders site links client-routed with intent prefetch, https links with noopener', async () => {
    let html = await renderToString(
      <p>
        {inlineNodes([
          'See ',
          { link: 'the loop', href: '/courses/first-agent-loop/the-loop' },
          ' or ',
          { link: 'the docs', href: 'https://docs.anthropic.com/' },
        ])}
      </p>,
    )
    let [site, external] = html.match(/<a [^>]*>/g) ?? []
    assert.match(site ?? '', /href="\/courses\/first-agent-loop\/the-loop"/)
    assert.match(site ?? '', /data-rmx-prefetch="intent"/)
    assert.doesNotMatch(site ?? '', /rel=/)
    assert.match(external ?? '', /href="https:\/\/docs\.anthropic\.com\/"/)
    assert.match(external ?? '', /rel="noopener noreferrer"/)
    assert.doesNotMatch(external ?? '', /data-rmx-prefetch/)
    assert.equal(inlineText(['See ', { link: 'the loop', href: '/x' }]), 'See the loop')
  })
})
