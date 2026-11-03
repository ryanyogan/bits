import * as assert from 'remix/assert'
import { users } from '@bits/db'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from '../../router.ts'
import { routes } from '../../routes.ts'
import { fetchAs, signIn, testDb } from '../../test/auth.ts'
import { heroQuestions, lessonOneHref, questionHref } from './links.ts'

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
    assert.match(html, /<title>bits — learn AI by typing to it<\/title>/)
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
    assert.match(html, /© 2026 bits/)
    assert.doesNotMatch(html, /latent/i)
  })

  it('has landmarks and a skip link', async () => {
    let { html } = await page(routes.home.href())
    assert.match(html, /<header/)
    assert.match(html, /<main id="main"/)
    assert.match(html, /<footer/)
    assert.match(html, /href="#main"/)
  })

  it('offers links, never a prompt box it would throw away (decision 065)', async () => {
    let { html } = await page(routes.home.href())
    let hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="how'))
    assert.doesNotMatch(hero, /<input|<form/)
    assert.doesNotMatch(html, /\?q=/)
    assert.ok(hero.includes(`href="${escape(lessonOneHref())}"`), 'Start lesson 1')
    assert.match(hero, />Start lesson 1 <span aria-hidden="true">→<\/span>/)
    // Each question links to the lesson that answers it, and that lesson exists.
    for (let question of heroQuestions) {
      let href = questionHref(question)
      assert.ok(hero.includes(`href="${escape(href)}"`), question.label)
      assert.equal((await page(href)).status, 200, href)
    }
    assert.equal((await page(lessonOneHref())).status, 200)
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
    // The question chips wrap (stack on phones): a plain named list, no scroller.
    assert.match(html, /<ul aria-labelledby="hero-questions"(?! tabindex)/i)
    // No paid tier exists yet, so the page never promises one.
    assert.doesNotMatch(html, /pro courses/i)
    // The progress showcase's numbers are made up, and it says so.
    assert.match(html, /<figcaption[^>]*>Example · what your progress looks like<\/figcaption>/)
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
    // The formation legend is gone (decision 065).
    assert.doesNotMatch(html, /01 · bits|04 · You/)
    assert.match(html, /<div inert[^>]*aria-hidden="true"/)
    assert.match(html, /<figcaption class="sr-only">Example lesson:/)
    // three is loaded lazily by the island, never preloaded.
    assert.doesNotMatch(html, /rel="modulepreload" href="[^"]*three/)
  })

  it('shows Sign in / Start free signed out; signed in, Continue and the account menu (decisions 048, 065)', async () => {
    let anon = await page(routes.home.href())
    assert.match(anon.html, />Sign in<\/a>/)
    assert.match(anon.html, />Start free<\/a>/)
    let anonFooter = anon.html.slice(anon.html.lastIndexOf('<footer'))
    assert.match(anonFooter, /href="\/login"[^>]*>Sign in</)
    let { cookie, user } = await signIn('home@example.com')
    await testDb.update(users, user.id, { xp_total: 1240 })
    let signedIn = { html: await (await fetchAs(cookie, routes.home.href())).text() }
    let header = signedIn.html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? ''
    assert.match(header, /aria-label="Your profile, [^"]+"/)
    assert.match(header, /popovertarget="account-menu"/)
    assert.match(header, /<form method="post" action="\/logout"/)
    assert.match(header, />Continue<\/a>/)
    assert.doesNotMatch(header, />Start free<|>Sign in</)
    assert.match(header, />My learning</)
    // One uniform header: no XP or streak pill.
    assert.doesNotMatch(header, /1,240|neurons|-day streak/)
    // Nothing done yet: the landing starts them on lesson 1.
    assert.match(signedIn.html, /aria-label="Continue where you left off"/)
    assert.match(signedIn.html, /Start here · lesson 1 of \d+/)
    // The footer drops Sign in once signed in.
    let footer = signedIn.html.slice(signedIn.html.lastIndexOf('<footer'))
    assert.doesNotMatch(footer, />Sign in</)
    assert.match(footer, /href="\/settings"[^>]*>Settings</)
  })

  it('shows Write a course only to authors (decision 065)', async () => {
    let anon = await page(routes.home.href())
    assert.doesNotMatch(anon.html, /Write a course|For authors/)
    let learner = await signIn('home-learner@example.com')
    let learnerHtml = await (await fetchAs(learner.cookie, routes.home.href())).text()
    assert.doesNotMatch(learnerHtml, /Write a course|For authors/)
    let author = await signIn('home-author@example.com', { role: 'author' })
    let authorHtml = await (await fetchAs(author.cookie, routes.home.href())).text()
    let header = authorHtml.match(/<header[\s\S]*?<\/header>/)?.[0] ?? ''
    assert.match(header, /href="\/author"[^>]*>Write a course</)
  })

  it('puts the site footer, with Terms and Privacy, under every page but the lesson and sign-in (decision 065)', async () => {
    for (let path of [routes.courses.index.href(), routes.legal.terms.href(), '/no-such-page']) {
      let { html } = await page(path)
      let footer = html.slice(html.lastIndexOf('<footer'))
      assert.match(footer, /href="\/terms"[^>]*>Terms</, path)
      assert.match(footer, /href="\/privacy"[^>]*>Privacy</, path)
      // The theme switch stays on the landing and in Settings (decision 062).
      assert.doesNotMatch(footer, /aria-label="Theme"/, path)
    }
    let login = await page(routes.login.index.href())
    assert.doesNotMatch(login.html, /<nav aria-label="Footer"/)
  })

  it('GET /continue sends a learner to their next lesson, never cached (decision 065)', async () => {
    let anon = await router.fetch(new Request(new URL(routes.continue.href(), 'http://localhost')))
    assert.equal(anon.status, 303)
    assert.equal(anon.headers.get('Location'), lessonOneHref())
    assert.match(anon.headers.get('Cache-Control') ?? '', /no-store/)
    let { cookie } = await signIn('home-continue@example.com')
    let response = await fetchAs(cookie, routes.continue.href())
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), lessonOneHref())
  })
})
