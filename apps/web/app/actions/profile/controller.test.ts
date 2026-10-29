import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import { routes } from '../../routes.ts'
import { loadCatalog } from '../../content/store.ts'
import { badgeDefinitions } from '../../progress/badges.ts'
import { answerAsk, completeLesson, fetchAs, runAt, signIn, testDb } from '../../test/auth.ts'

function get(path: string) {
  return fetchAs(null, path)
}

const prompt = (n: number) => `Write a tagline for a coffee shop on the moon, under ${n} words.`

/** Jamie: a public profile with four journal prompts and two lessons done. */
let jamie: Promise<string> | undefined
async function getSignedIn(path: string) {
  jamie ??= (async () => {
    let { cookie } = await signIn('jamie@example.com', { displayName: 'Jamie Park' })
    let exercise = { course: 'tokens-and-temperature', lesson: 'temperature', exercise: 'moon-tagline', prompt: prompt(4) }
    await runAt(cookie, exercise, [0, 100])
    for (let n = 5; n <= 8; n++) {
      await completeLesson(cookie, 'tokens-and-temperature', 'temperature', { 'prompt.moon-tagline': prompt(n) })
    }
    await answerAsk(cookie, 'tokens-and-temperature', 'what-is-a-token', 'common-words', 'a')
    await completeLesson(cookie, 'tokens-and-temperature', 'what-is-a-token')
    return cookie
  })()
  return fetchAs(await jamie, path)
}

// One flat suite: remix test runs after() around every describe, and D1 must
// stay up until the last test.
describe('/me and /u/:handle', () => {
  after(() => disposePlatform())

  it('renders the private profile with journal and account card', async () => {
    let response = await getSignedIn(routes.me.index.href())
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.match(html, /<title>Your profile · Bits<\/title>/)
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1)
    assert.match(html, /Jamie Park/)
    assert.match(html, /id="journal-heading"[^>]*>Prompt journal</)
    assert.match(html, /jamie@example\.com/)
    assert.match(html, /Edit profile/)
    assert.match(html, /aria-label="Jamie(&#39;|')s generated avatar"/)
    assert.match(html, /aria-label="Activity heatmap: active 1 of the last 182 days; current streak 1 day"/)
    assert.match(html, />Level 2<\/span>.*First words/)
    assert.match(html, /aria-label="70 neurons"|>70</)
    assert.match(html, /aria-label="First token"/)
    // Four general badges plus one per published course (the test-only fixture included).
    let badges = badgeDefinitions(await loadCatalog(testDb, platform.env.CONTENT)).length
    assert.match(html, new RegExp(`>Badges</h2><div[^>]*>1 of ${badges}<`))
    assert.match(html, /Loop Closer — locked/)
    assert.match(html, /Write a tagline for a coffee shop on the moon, under 8 words\./)
    assert.match(html, /Tokens &amp; temperature · L6/)
    assert.match(html, /✓ passed 4\/4 checks/)
    // Sign out is a POST form, not a link.
    assert.match(html, new RegExp(`<form method="post" action="${routes.logout.action.href()}"`))
    // Only the three most recent journal entries before "All →".
    assert.equal(html.match(/<li[^>]*><p[^>]*><span aria-hidden="true"[^>]*>›/g)?.length, 3)
    assert.match(html, /href="\/me\?tab=journal"/)
  })

  it('?tab=journal lists the whole prompt journal', async () => {
    let response = await getSignedIn(routes.me.index.href(undefined, { searchParams: { tab: 'journal' } }))
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.match(html, /<title>Prompt journal · Bits<\/title>/)
    assert.ok((html.match(/<li[^>]*><p[^>]*><span aria-hidden="true"[^>]*>›/g)?.length ?? 0) > 3)
  })

  it('sends signed-out visitors to sign in', async () => {
    let response = await get(routes.me.index.href())
    assert.equal(response.status, 303)
    assert.match(response.headers.get('Location') ?? '', /^\/login\?next=%2Fme/)
  })

  it('renders a public profile without email, journal, account or Edit', async () => {
    await getSignedIn(routes.me.index.href())
    let response = await get(routes.profile.index.href({ handle: 'jamie_park' }))
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.match(html, /<title>Jamie Park \(@jamie_park\) · Bits<\/title>/)
    assert.match(html, /Share ↗/)
    assert.doesNotMatch(html, /jamie@example\.com/)
    assert.doesNotMatch(html, /Prompt journal/)
    assert.doesNotMatch(html, /id="account-heading"/)
    assert.doesNotMatch(html, /Edit profile/)
  })

  it('costs /me one D1 round trip and a public profile one batch (decision 035)', async () => {
    // Session, user and the six profile reads come back in one batch.
    let me = await getSignedIn(routes.me.index.href())
    assert.equal(me.status, 200)
    assert.match(me.headers.get('Server-Timing') ?? '', /^db;dur=\d+;desc="7 queries, 1 round trips"$/)
    await me.text()
    // Signed out: the user by handle and the same six reads, one batch.
    let profile = await get(routes.profile.index.href({ handle: 'jamie_park' }))
    assert.equal(profile.status, 200)
    assert.match(profile.headers.get('Server-Timing') ?? '', /^db;dur=\d+;desc="7 queries, 1 round trips"$/)
    await profile.text()
  })

  for (let handle of ['private-sam', 'nobody-here']) {
    it(`/u/${handle} is a 404 that says the profile is private`, async () => {
      if (handle === 'private-sam') {
        let { cookie } = await signIn('sam@example.com', { displayName: 'Private Sam' })
        let saved = await fetchAs(cookie, routes.settings.profile.href(), {
          method: 'POST',
          body: new URLSearchParams({ name: 'Private Sam', handle: 'private-sam', visibility: 'private' }),
        })
        assert.equal(saved.status, 303)
      }
      let response = await get(routes.profile.index.href({ handle }))
      assert.equal(response.status, 404)
      let html = await response.text()
      assert.match(html, /This profile is private\./)
      assert.doesNotMatch(html, /sam@example\.com/)
    })
  }
})
