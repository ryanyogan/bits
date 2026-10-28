// End to end: an automated accessibility check of every page type (decision
// 031, milestone 6). Each page is loaded in Chromium against the real router
// and audited with axe-core at 360×800 and 1440×900, in both colour schemes,
// with every serious or critical violation failing the test.
//
// axe-core is injected with `page.evaluate` (the DevTools protocol), which
// the strict nonce CSP (decision 027) doesn't govern, so the audit needs no
// markup or policy change. (@axe-core/playwright wants a page from its own
// `browser.newContext()`, which `t.serve` doesn't give us.)
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import type { AxeResults } from 'axe-core'
import type { Page } from 'playwright'
import { users } from '@bits/db'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from './router.ts'
import { routes } from './routes.ts'
import { ageSessions, completeLesson, requestCode, signIn, testDb } from './test/auth.ts'

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')

const viewports = [
  { width: 360, height: 800 },
  { width: 1440, height: 900 },
] as const
// The app is dark-only today (`color-scheme: dark`, one token set), so light
// renders the same; it stays in the matrix so a light theme can't land unchecked.
const schemes = ['dark', 'light'] as const

/** Audits the page as it stands at both widths (or `only` one) and in both schemes; returns readable failures. */
async function audit(page: Page, label: string, only?: number): Promise<string[]> {
  let failures: string[] = []
  for (let viewport of viewports.filter((v) => !only || v.width === only)) {
    await page.setViewportSize(viewport)
    for (let colorScheme of schemes) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      // Let layout and transitions settle after the resize/scheme change.
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      let results = await runAxe(page)
      for (let violation of results.violations) {
        if (violation.impact !== 'serious' && violation.impact !== 'critical') continue
        let nodes = violation.nodes
          .slice(0, 6)
          .map((node) => `      ${node.target.join(' ')}\n        ${node.failureSummary?.split('\n').slice(1).join(' ').trim()}`)
          .join('\n')
        failures.push(
          `${label} @ ${viewport.width}px ${colorScheme}: ${violation.id} (${violation.impact}, ${violation.nodes.length} nodes) ${violation.help}\n${nodes}`,
        )
      }
    }
  }
  return failures
}

async function runAxe(page: Page): Promise<AxeResults> {
  if (!(await page.evaluate(() => 'axe' in window))) await page.evaluate(axeSource)
  return page.evaluate(() =>
    (window as unknown as { axe: typeof import('axe-core') }).axe.run(document, { resultTypes: ['violations'] }),
  )
}

async function expectClean(page: Page, label: string, only?: number) {
  let failures = await audit(page, label, only)
  assert.equal(failures.length, 0, `\n${failures.join('\n')}`)
}

/** Waits until client islands have hydrated (the entry module sets this up). */
async function settled(page: Page) {
  await page.waitForLoadState('networkidle')
}

/** Signs in through the emailed magic link in the browser; returns the user. */
async function signInBrowser(page: Page, email: string) {
  let { token } = await requestCode(email)
  await page.goto(routes.auth.verify.index.href(undefined, { searchParams: { token } }))
  await page.getByRole('button', { name: 'Continue to Bits →' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
  return (await testDb.findOne(users, { where: { email } }))!
}

let counter = 0
const uniqueEmail = (tag: string) => `a11y-${tag}-${Date.now()}-${++counter}@example.com`

const lesson = (course: string, slug: string, mode?: 'read' | 'watch' | 'terminal') =>
  routes.courses.lesson.index.href({ course, lesson: slug }, mode ? { searchParams: { mode } } : undefined)

/** Pages that look the same to everyone: audited signed out (and, where the shell differs, signed in below). */
const publicPages: Array<{ name: string; href: string; ready?: (page: Page) => Promise<void> }> = [
  {
    name: 'landing',
    href: routes.home.href(),
    // Audit with the field live, so its pause toggle (decision 034) is visible.
    ready: (page) => page.getByRole('button', { name: 'Pause animation' }).waitFor({ timeout: 15_000 }),
  },
  { name: 'courses', href: routes.courses.index.href() },
  { name: 'courses search', href: routes.courses.index.href(undefined, { searchParams: { q: 'token' } }) },
  { name: 'courses search, no results', href: routes.courses.index.href(undefined, { searchParams: { q: 'zzzzqx' } }) },
  { name: 'course', href: routes.courses.course.index.href({ course: 'tokens-and-temperature' }) },
  // Read mode with each toy: nexttoken + composer, training, attention, compare, rabbithole, odds, tokenizer + quiz.
  { name: 'lesson read: nexttoken + composer', href: lesson('tokens-and-temperature', 'probabilities-not-answers') },
  { name: 'lesson read: training', href: lesson('what-is-an-llm', 'where-it-learned-pretraining') },
  { name: 'lesson read: attention', href: lesson('what-is-an-llm', 'attention-how-it-keeps-track') },
  { name: 'lesson read: compare', href: lesson('tokens-and-temperature', 'greedy-vs-sampled') },
  { name: 'lesson read: tokenizer + quiz', href: lesson('tokens-and-temperature', 'what-is-a-token') },
  { name: 'lesson read: odds', href: lesson('tokens-and-temperature', 'temperature') },
  { name: 'lesson watch', href: lesson('tokens-and-temperature', 'temperature', 'watch') },
  { name: 'lesson terminal: code + quiz', href: lesson('first-agent-loop', 'the-loop', 'terminal') },
  { name: 'lesson read: code', href: lesson('first-agent-loop', 'the-loop') },
  { name: 'lesson terminal: composer', href: lesson('what-is-an-llm', 'say-hi-to-claude', 'terminal') },
  { name: 'login email', href: routes.login.index.href() },
  { name: 'login signup', href: routes.login.index.href(undefined, { searchParams: { mode: 'signup' } }) },
  { name: 'terms', href: routes.legal.terms.href() },
  { name: 'privacy', href: routes.legal.privacy.href() },
  { name: 'styleguide', href: routes.styleguide.index.href() },
  { name: '404', href: '/no-such-page' },
]

// One flat suite: remix test runs after() around every describe.
describe('accessibility (axe, 360 and 1440, dark and light)', () => {
  after(() => disposePlatform())

  for (let { name, href, ready } of publicPages) {
    it(`${name} (signed out)`, async (t) => {
      let page = await t.serve(await createTestServer(router.fetch))
      await page.goto(href)
      await settled(page)
      await ready?.(page)
      await expectClean(page, name)
    })
  }

  it('quiz after answering, and the composer after a run', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(lesson('tokens-and-temperature', 'what-is-a-token'))
    await settled(page)
    let quiz = page.locator('form:has(input[type="radio"])').first()
    // The radio is visually hidden under its drawn mark: check it the way a keyboard would.
    await quiz.locator('input[type="radio"]').nth(1).check({ force: true })
    await quiz.locator('button[type="submit"]').click()
    await page.getByText('Not quite').first().waitFor()
    await settled(page)
    await expectClean(page, 'quiz answered')

    await page.goto(lesson('what-is-an-llm', 'say-hi-to-claude'))
    await settled(page)
    let prompt = page.getByRole('textbox').first()
    await prompt.fill('Say hi in five words.')
    await prompt.press('Enter')
    await page.getByRole('region', { name: 'Your runs' }).getByRole('listitem').first().waitFor()
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'))
    await expectClean(page, 'composer after a run')
  })

  it('interactive states: mobile menu, attention pick, transcript, toy steps', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto(routes.courses.index.href())
    await settled(page)
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.locator(':popover-open').waitFor()
    await expectClean(page, 'mobile menu open', 360)

    await page.goto(lesson('what-is-an-llm', 'attention-how-it-keeps-track'))
    await settled(page)
    let toolbar = page.getByRole('toolbar', { name: /Tokens: pick one/ })
    await toolbar.getByRole('button').first().click()
    await expectClean(page, 'attention: another token picked')

    await page.goto(lesson('tokens-and-temperature', 'temperature', 'watch'))
    await settled(page)
    let transcript = page.getByRole('button', { name: 'Transcript' })
    if ((await transcript.getAttribute('aria-pressed')) !== 'true') await transcript.click()
    await page.getByRole('button', { name: 'CC: captions' }).click()
    await expectClean(page, 'watch: transcript + captions toggled')

    await page.goto(lesson('what-is-an-llm', 'where-it-learned-pretraining'))
    await settled(page)
    let slider = page.getByRole('slider', { name: 'training step' })
    await slider.focus()
    await slider.press('End')
    await expectClean(page, 'training scrubber at the end')
  })

  it('landing: the phone menu sheet, and the frosted header after a scroll (decision 040)', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto(routes.home.href())
    await settled(page)
    let header = page.locator('header').first()
    await header.getByRole('button', { name: 'Menu' }).click()
    let sheet = page.locator('#landing-nav-sheet:popover-open')
    await sheet.waitFor()
    // The sheet lists the page's links and Sign in.
    assert.ok(await sheet.getByRole('link', { name: 'Sign in' }).isVisible(), 'Sign in is in the sheet')
    await expectClean(page, 'landing menu sheet open', 360)
    await page.keyboard.press('Escape')
    await page.locator('#landing-nav-sheet:popover-open').waitFor({ state: 'detached' })

    // Past the 120px frost range the header is sticky, opaque and blurred
    // (a scroll-driven animation, so it follows the scroll position).
    for (let width of [360, 1440]) {
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 })
      await page.evaluate(() => window.scrollTo(0, 600))
      await page.waitForFunction(() => {
        let bar = document.querySelector('header')
        return bar != null && bar.getBoundingClientRect().top === 0 && getComputedStyle(bar).backgroundColor !== 'rgba(0, 0, 0, 0)'
      })
      await expectClean(page, `landing header scrolled @ ${width}`, width)
    }
  })

  it('reward toasts: a composer reward and a badge after completing a lesson', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(lesson('tokens-and-temperature', 'temperature'))
    await settled(page)
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent('bits:reward', { detail: { xp: 40, message: 'Every check passed.' } })),
    )
    await expectClean(page, 'lesson reward event')

    let { token } = await requestCode(uniqueEmail('badge'))
    await page.goto(routes.auth.verify.index.href(undefined, { searchParams: { token } }))
    await page.getByRole('button', { name: 'Continue to Bits →' }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
    await page.goto(routes.courses.lesson.index.href({ course: 'context-is-everything', lesson: 'lesson-1' }))
    await settled(page)
    await page.locator('form#lesson-complete button[type="submit"]').click()
    // The server-rendered badge moves into the (already present, empty) live region, so it is announced.
    await page.getByRole('status').filter({ hasText: 'Badge earned: First token' }).waitFor()
    await expectClean(page, 'badge toast')
  })

  it('login code step', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.login.index.href())
    await page.getByLabel('Email').fill(uniqueEmail('code'))
    await page.getByRole('button', { name: /Email me a sign-in link/ }).click()
    await page.getByRole('button', { name: 'Verify & continue' }).waitFor()
    await settled(page)
    await expectClean(page, 'login code')

    await page.getByLabel('Digit 1').fill('000000')
    await page.getByText('That code isn’t right').first().waitFor()
    await expectClean(page, 'login wrong code')
  })

  it('signed in: landing, courses, lesson, /me and /u/:handle', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let user = await signInBrowser(page, uniqueEmail('me'))
    for (let [label, href] of [
      ['landing (signed in)', routes.home.href()],
      ['courses (signed in)', routes.courses.index.href()],
      ['lesson (signed in)', lesson('tokens-and-temperature', 'probabilities-not-answers')],
      ['/me', routes.me.index.href()],
      ['/u/:handle', routes.profile.index.href({ handle: user.handle })],
    ] as const) {
      await page.goto(href)
      await settled(page)
      await expectClean(page, label)
    }
  })

  it('certificate', async (t) => {
    let { cookie, user } = await signIn(uniqueEmail('cert'), { displayName: 'Cert Holder' })
    for (let n = 1; n <= 7; n++) await completeLesson(cookie, 'context-is-everything', `lesson-${n}`)
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.certificates.show.href({ handle: user.handle, course: 'context-is-everything' }))
    await page.getByText('Certificate of completion').first().waitFor()
    await expectClean(page, 'certificate')
  })

  it('settings: fresh, email form error, pending email change, reauth needed', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let user = await signInBrowser(page, uniqueEmail('settings'))
    await page.goto(routes.settings.index.href())
    await settled(page)
    await expectClean(page, 'settings')

    await page.getByText('Change email', { exact: true }).click()
    let field = page.getByLabel('New email')
    await field.fill('not-an-email')
    await page.getByRole('button', { name: /Send confirmation link/ }).click()
    await page.locator('[aria-invalid="true"]').first().waitFor()
    await expectClean(page, 'settings email error')

    await page.getByLabel('New email').fill(uniqueEmail('new'))
    await page.getByRole('button', { name: /Send confirmation link/ }).click()
    await page.getByRole('button', { name: 'Confirm new email' }).waitFor()
    await settled(page)
    await expectClean(page, 'settings pending email')

    await ageSessions(user.id)
    await page.goto(routes.settings.index.href())
    await settled(page)
    await expectClean(page, 'settings reauth')
  })

  it('author: /author, /author/:course and a preview', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let user = await signInBrowser(page, uniqueEmail('author'))
    await testDb.update(users, user.id, { role: 'admin' })
    for (let [label, href] of [
      ['/author', routes.author.index.href()],
      ['/author/:course', routes.author.course.index.href({ course: 'tokens-and-temperature' })],
      ['/author preview', routes.author.course.preview.href({ course: 'tokens-and-temperature', lesson: 'temperature' })],
    ] as const) {
      await page.goto(href)
      await settled(page)
      await expectClean(page, label)
    }
  })
})
