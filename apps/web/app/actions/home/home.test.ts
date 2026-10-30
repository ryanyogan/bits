import * as assert from 'remix/assert'
import { users } from '@bits/db'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from '../../router.ts'
import { routes } from '../../routes.ts'
import { fetchAs, signIn, testDb } from '../../test/auth.ts'
import { agentLessonHref, lessonOneHref } from './links.ts'

after(() => disposePlatform())

async function page(path: string) {
  let response = await router.fetch(new Request(new URL(path, 'http://localhost')))
  return { status: response.status, html: await response.text() }
}

function count(html: string, pattern: RegExp) {
  return html.match(new RegExp(pattern.source, 'g'))?.length ?? 0
}

function escape(value: string) {
  return value.replaceAll('&', '&amp;')
}

describe('landing page', () => {
  it('server-renders every section with the spec copy', async () => {
    let { status, html } = await page(routes.home.href())
    assert.equal(status, 200)
    assert.match(html, /<title>Bits — learn AI by typing to it<\/title>/)
    assert.equal(count(html, /<h1[\s>]/), 1)
    assert.match(html, /Learn AI by <span[^>]*>typing<\/span> to it\./)
    for (let heading of [
      'Every lesson is a conversation.',
      'From one prompt to a team of agents.',
      'Progress you can feel.',
      'Your first prompt is waiting.',
    ]) {
      assert.ok(html.includes(heading), heading)
    }
    assert.ok(html.includes('Read\u00a0it. Watch\u00a0it. Run\u00a0it.'), 'modes heading')
    assert.match(html, /© 2026 Bits/)
    assert.doesNotMatch(html, /latent/i)
  })

  it('has landmarks, a skip link and a labelled prompt', async () => {
    let { html } = await page(routes.home.href())
    assert.match(html, /<header/)
    assert.match(html, /<main id="main"/)
    assert.match(html, /<footer/)
    assert.match(html, /href="#main"/)
    assert.match(html, /<label for="hero-prompt"[^>]*>Ask your first question<\/label>/)
    assert.match(html, /<input id="hero-prompt" name="q"/)
    assert.match(html, /placeholder="Explain tokens like I(&#39;|')m ten"/)
  })

  it('submits the hero prompt to lesson 1 with GET ?q=', async () => {
    let { html } = await page(routes.home.href())
    let action = lessonOneHref()
    assert.match(action, /^\/courses\/[^/]+\/[^/?]+$/)
    assert.ok(html.includes(`<form method="get" action="${action}"`), 'GET form to lesson 1')
    assert.ok(html.includes(`href="${escape(lessonOneHref('Why do models make things up?'))}"`))
    let agent = agentLessonHref('Build me a tiny agent')
    assert.equal(agent, '/courses/first-agent-loop/the-loop?q=Build+me+a+tiny+agent')
    assert.ok(html.includes(`href="${escape(agent)}"`))
    let lesson = await page(lessonOneHref('hello'))
    assert.equal(lesson.status, 200)
  })

  it('tags every path course free, claims "free to start" and never a price (decision 048)', async () => {
    let { html } = await page(routes.home.href())
    assert.equal(count(html, />Free<\/span>/), 8)
    assert.doesNotMatch(html, />Pro<\/span>/)
    assert.doesNotMatch(html, /\$\d/)
    assert.doesNotMatch(html, /every course is free|Free forever|no trial, no catch/)
    assert.equal(count(html, /Free to start/), 2)
    // The hero badge is gone: the h1 is the first thing in the hero.
    assert.doesNotMatch(html, /from zero to your first agent/)
    // The phone chip row scrolls sideways, so it is focusable and named.
    assert.match(html, /<ul aria-label="Try asking" tabindex="0"/i)
  })

  it('links each track to the filtered catalog', async () => {
    let { html } = await page(routes.home.href())
    for (let track of ['foundations', 'prompting', 'tools', 'agents']) {
      assert.ok(html.includes(`href="/courses?track=${track}"`), track)
    }
  })

  it('prefetches page links on intent, never same-page anchors (decisions 040, 042)', async () => {
    let { html } = await page(routes.home.href())
    assert.match(html, /href="\/courses\?track=agents"[^>]*data-rmx-prefetch="intent"/)
    assert.match(html, /href="\/courses" data-rmx-prefetch="intent"/)
    assert.doesNotMatch(html, /href="#how"[^>]*data-rmx-prefetch/)
    assert.doesNotMatch(html, /href="#path"[^>]*data-rmx-prefetch/)
  })

  it('keeps Sign in reachable on phones through the menu sheet', async () => {
    let { html } = await page(routes.home.href())
    let sheet = html.slice(html.indexOf('id="app-nav-sheet"'))
    assert.match(sheet, /href="\/login"[^>]*>Sign in<\/a>/)
  })

  it('renders the field layer hidden from assistive tech, with the lesson preview inert', async () => {
    let { html } = await page(routes.home.href())
    assert.match(html, /<div aria-hidden="true"[^>]*><canvas data-field=""/)
    assert.match(html, /01 · Bits/)
    assert.match(html, /<div inert[^>]*aria-hidden="true"/)
    assert.match(html, /<figcaption class="sr-only">Example lesson:/)
    // three is loaded lazily by the island, never preloaded.
    assert.doesNotMatch(html, /rel="modulepreload" href="[^"]*three/)
  })

  it('shows Sign in / Start free signed out and only the avatar signed in (decision 048)', async () => {
    let anon = await page(routes.home.href())
    assert.match(anon.html, />Sign in<\/a>/)
    assert.match(anon.html, />Start free<\/a>/)
    let { cookie, user } = await signIn('home@example.com')
    await testDb.update(users, user.id, { xp_total: 1240 })
    let signedIn = { html: await (await fetchAs(cookie, routes.home.href())).text() }
    let header = signedIn.html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? ''
    assert.match(header, /aria-label="Your profile, [^"]+"/)
    // One uniform header: no XP or streak pill.
    assert.doesNotMatch(header, /1,240|neurons|-day streak/)
  })
})
