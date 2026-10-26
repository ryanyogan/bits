import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from '../../router.ts'
import { routes } from '../../routes.ts'

after(() => disposePlatform())

function get(path: string) {
  return router.fetch(new Request(new URL(path, 'http://localhost')))
}

describe('/me', () => {
  it('renders the private profile with journal and account card', async () => {
    let response = await get(routes.me.index.href())
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.match(html, /<title>Your profile · bits<\/title>/)
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1)
    assert.match(html, /Jamie Park/)
    assert.match(html, /PROMPT JOURNAL/)
    assert.match(html, /jamie@example\.com/)
    assert.match(html, /Edit profile/)
    assert.match(html, /aria-label="Jamie(&#39;|')s generated avatar"/)
    assert.match(html, /aria-label="Activity heatmap: active \d+ of the last 182 days/)
    assert.match(html, /Tool wielder — locked/)
    // Sign out is a POST form, not a link.
    assert.match(html, new RegExp(`<form method="post" action="${routes.logout.action.href()}"`))
    // Only the three most recent journal entries before "All →".
    assert.equal(html.match(/<li[^>]*><p[^>]*><span aria-hidden="true"[^>]*>›/g)?.length, 3)
    assert.match(html, /href="\/me\?tab=journal"/)
  })

  it('?tab=journal lists the whole prompt journal', async () => {
    let response = await get(routes.me.index.href(undefined, { searchParams: { tab: 'journal' } }))
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.match(html, /<title>Prompt journal · bits<\/title>/)
    assert.ok((html.match(/<li[^>]*><p[^>]*><span aria-hidden="true"[^>]*>›/g)?.length ?? 0) > 3)
  })

  it('sends signed-out visitors to sign in', async () => {
    let response = await get(`${routes.me.index.href()}?as=anon`)
    assert.equal(response.status, 303)
    assert.match(response.headers.get('Location') ?? '', /^\/login\?next=%2Fme/)
  })
})

describe('/u/:handle', () => {
  it('renders a public profile without email, journal, account or Edit', async () => {
    let response = await get(routes.profile.index.href({ handle: 'jamie' }))
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.match(html, /<title>Jamie Park \(@jamie\) · bits<\/title>/)
    assert.match(html, /Share ↗/)
    assert.doesNotMatch(html, /jamie@example\.com/)
    assert.doesNotMatch(html, /PROMPT JOURNAL/)
    assert.doesNotMatch(html, /ACCOUNT/)
    assert.doesNotMatch(html, /Edit profile/)
  })

  for (let handle of ['sam-r', 'nobody-here']) {
    it(`/u/${handle} is a 404 that says the profile is private`, async () => {
      let response = await get(routes.profile.index.href({ handle }))
      assert.equal(response.status, 404)
      let html = await response.text()
      assert.match(html, /This profile is private\./)
      assert.doesNotMatch(html, /sam@example\.com/)
    })
  }
})
