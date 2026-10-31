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

import { outbox } from './auth/mailer.ts'
import { router } from './router.ts'
import { routes } from './routes.ts'
import { ageSessions, completeLesson, requestCode, signIn, testDb } from './test/auth.ts'
import { plainCourse } from './test/plain-course.ts'

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')

const viewports = [
  { width: 360, height: 800 },
  { width: 1440, height: 900 },
] as const
// Every page in both themes (decision 062): with no pinned theme, the emulated
// scheme picks the tokens.
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
      await colourTransitionsDone(page)
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

/**
 * A scheme flip restarts every colour transition, and inherited colours chain
 * (a parent's finishing starts its child's). Reading mid-way would report a
 * ground from one theme under text from the other, so wait for them all.
 */
async function colourTransitionsDone(page: Page) {
  await page.evaluate(async () => {
    let running = () => document.getAnimations().filter((animation) => animation instanceof CSSTransition)
    for (let round = 0; round < 20 && running().length > 0; round++) {
      await Promise.allSettled(running().map((animation) => animation.finished))
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    }
  })
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

const lesson = (course: string, slug: string) => routes.courses.lesson.index.href({ course, lesson: slug })

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
  // A lesson with each toy (one view, decision 055): nexttoken + composer, training, attention, compare, rabbithole, odds, tokenizer + quiz.
  { name: 'lesson read: nexttoken + composer', href: lesson('tokens-and-temperature', 'probabilities-not-answers') },
  { name: 'lesson read: training', href: lesson('what-is-an-llm', 'where-it-learned-pretraining') },
  // Animation blocks (decision 060): steps in lesson 2, flow in lesson 6; marbles on the styleguide.
  { name: 'lesson read: steps', href: lesson('what-is-an-llm', 'a-very-good-next-word-guesser') },
  { name: 'lesson read: flow', href: lesson('what-is-an-llm', 'your-prompt-is-all-it-sees') },
  { name: 'lesson read: attention', href: lesson('what-is-an-llm', 'attention-how-it-keeps-track') },
  { name: 'lesson read: compare', href: lesson('tokens-and-temperature', 'greedy-vs-sampled') },
  { name: 'lesson read: tokenizer + quiz', href: lesson('tokens-and-temperature', 'what-is-a-token') },
  { name: 'lesson read: video + odds', href: lesson('tokens-and-temperature', 'temperature') },
  { name: 'lesson read: code', href: lesson('first-agent-loop', 'the-loop') },
  { name: 'lesson read: composer', href: lesson('what-is-an-llm', 'say-hi-to-claude') },
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

  it('quick check wrong and right (decision 052), and the composer after a run', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(lesson('tokens-and-temperature', 'what-is-a-token'))
    await settled(page)
    // Unanswered is the public "tokenizer + quiz" page above.
    let ask = page.locator('form[id^="ask-"]').first()
    await ask.getByRole('button', { name: /Unbelievably/ }).click()
    await ask.getByRole('button', { name: /Check/ }).click()
    let answers = ask.getByRole('list', { name: 'Your answers' })
    await answers.locator('[data-correct="false"]').waitFor()
    await settled(page)
    await expectClean(page, 'quick check wrong')
    await ask.getByRole('textbox').fill('a')
    await ask.getByRole('textbox').press('Enter')
    await answers.locator('[data-correct="true"]').waitFor()
    await settled(page)
    await expectClean(page, 'quick check right')

    await page.goto(lesson('what-is-an-llm', 'say-hi-to-claude'))
    await settled(page)
    let prompt = page.getByRole('textbox').first()
    await prompt.fill('Say hi in five words.')
    await prompt.press('Enter')
    await page.getByRole('region', { name: 'Your runs' }).getByRole('listitem').first().waitFor()
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'))
    await expectClean(page, 'composer after a run')
  })

  it('shared field (decision 051): hosts focused, Type it typing, the phone outline open', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(lesson('what-is-an-llm', 'say-hi-to-claude'))
    await settled(page)
    await page.getByRole('textbox').first().focus()
    await expectClean(page, 'composer field focused')

    await page.goto(lesson('first-agent-loop', 'the-loop'))
    await settled(page)
    await page.getByRole('button', { name: /Type it/ }).first().click()
    await page.keyboard.type('import Anth')
    await expectClean(page, 'code editor: Type it, typing')

    await page.goto(lesson('what-is-an-llm', 'attention-how-it-keeps-track'))
    await settled(page)
    await page.setViewportSize({ width: 360, height: 800 })
    await page.locator('nav[aria-label="Lessons"] summary').last().click()
    await expectClean(page, 'phone lesson chrome: outline open', 360)

    await page.goto(`${routes.styleguide.index.href()}#field-specimen`)
    await settled(page)
    await page.locator('#field-specimen textarea').first().focus()
    await expectClean(page, 'styleguide field specimen, a prompt focused', 1440)
  })

  it('lesson depth control (decisions 053, 055): the sub-bar tabs, both depths, and the phone chrome row', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let href = lesson(plainCourse.slug, plainCourse.lessons[0])
    await page.goto(href)
    await settled(page)
    await expectClean(page, 'lesson depth: new')
    await page.goto(`${href}?depth=engineer`)
    await settled(page)
    await expectClean(page, 'lesson depth: engineer')
    await page.goto(href)
    await settled(page)
    await page.setViewportSize({ width: 360, height: 800 })
    await page.locator('main nav[aria-label="Lesson depth"]').waitFor()
    await page.locator('nav[aria-label="Lessons"] summary').last().click()
    await expectClean(page, 'lesson depth: phone row, outline open', 360)
  })

  it('lesson prose (decision 061): lists, a ### subheading and ``` samples at both depths, one copied', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let href = lesson(plainCourse.slug, plainCourse.lessons[1])
    for (let depth of ['new', 'engineer']) {
      await page.goto(`${href}?depth=${depth}`)
      await settled(page)
      await page.locator('main ul').first().waitFor()
      await page.locator('main figure pre[role="region"]').first().waitFor()
      await expectClean(page, `lesson prose: ${depth}`)
    }
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.setViewportSize({ width: 360, height: 800 })
    await page.locator('main figure button').first().click()
    await page.locator('main figure button', { hasText: 'Copied ✓' }).waitFor()
    await expectClean(page, 'lesson prose: sample copied', 360)
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

    await page.goto(lesson('tokens-and-temperature', 'temperature'))
    await settled(page)
    let transcript = page.getByRole('button', { name: 'Transcript' })
    // Closed at first (decision 055): the lesson's first block stays in view.
    assert.equal(await transcript.getAttribute('aria-pressed'), 'false')
    await transcript.click()
    await page.getByRole('region', { name: 'Transcript' }).waitFor()
    await page.getByRole('button', { name: 'CC: captions' }).click()
    await expectClean(page, 'lesson video: transcript + captions toggled')

    await page.goto(lesson('what-is-an-llm', 'where-it-learned-pretraining'))
    await settled(page)
    let slider = page.getByRole('slider', { name: 'training step' })
    await slider.focus()
    await slider.press('End')
    await expectClean(page, 'training scrubber at the end')
  })

  it('animation blocks (decision 060): a step picked, the window full, the timeline scrubbed to the end', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.setViewportSize({ width: 360, height: 800 })
    // Reduced motion: no autoplay, so the states below are the ones we set.
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await page.goto(lesson('what-is-an-llm', 'a-very-good-next-word-guesser'))
    await settled(page)
    let steps = page.getByRole('group', { name: 'step by step' })
    await steps.getByRole('button', { name: 'Next step' }).click()
    await steps.getByRole('button', { name: 'Next step' }).click()
    assert.equal(await steps.locator('[aria-current="step"]').count(), 1, 'one current step')
    await expectClean(page, 'steps: third step current', 360)

    await page.goto(lesson('what-is-an-llm', 'your-prompt-is-all-it-sees'))
    await settled(page)
    let flow = page.getByRole('group', { name: 'context window' })
    let next = flow.getByRole('button', { name: 'Next arrival' })
    while (await next.isEnabled()) await next.click()
    assert.ok((await flow.locator('[data-state="out"]').count()) > 0, 'something fell out of the window')
    await expectClean(page, 'flow: every item arrived', 360)

    await page.goto(routes.styleguide.index.href())
    await settled(page)
    let time = page.getByRole('slider', { name: 'time' })
    await time.focus()
    await time.press('End')
    assert.equal(await page.locator('#sg-marbles').getAttribute('aria-valuetext'), '5 s')
    await expectClean(page, 'marbles at the end', 360)
  })

  it('one header everywhere (decision 059): the phone menu sheet, and the same bar on landing, app and sign-in pages', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.setViewportSize({ width: 360, height: 800 })
    for (let href of [routes.home.href(), routes.login.index.href()]) {
      await page.goto(href)
      await settled(page)
      let header = page.locator('body > header')
      await header.getByRole('button', { name: 'Menu' }).click()
      let sheet = page.locator('#app-nav-sheet:popover-open')
      await sheet.waitFor()
      assert.ok(await sheet.getByRole('link', { name: 'Courses' }).isVisible(), `${href}: the nav is in the sheet`)
      if (href === routes.home.href()) {
        // Signed out, the bar hides Sign in under 420px; the sheet keeps it.
        assert.ok(await sheet.getByRole('link', { name: 'Sign in' }).isVisible(), 'Sign in is in the sheet')
      }
      await expectClean(page, `${href} menu sheet open`, 360)
      await page.keyboard.press('Escape')
      await sheet.waitFor({ state: 'detached' })
    }

    // The same bar on every page: --appbar-h tall, the logo and the row at
    // the same spot, sticky at the top on an opaque ground after a scroll.
    for (let width of [360, 1440]) {
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 })
      let shapes: string[] = []
      for (let href of [routes.home.href(), routes.courses.index.href(), routes.login.index.href()]) {
        await page.goto(href)
        await settled(page)
        await page.evaluate(() => window.scrollTo(0, 600))
        await page.waitForFunction(() => document.querySelector('body > header')?.getBoundingClientRect().top === 0)
        let shape = await page.evaluate(() => {
          let bar = document.querySelector('body > header') as HTMLElement
          let row = bar.firstElementChild as HTMLElement
          let logo = row.querySelector('a') as HTMLElement
          let appbar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--appbar-h'))
          let r = row.getBoundingClientRect()
          let l = logo.getBoundingClientRect()
          return {
            tall: bar.getBoundingClientRect().height === appbar,
            ground: getComputedStyle(bar).backgroundColor,
            row: [r.left, r.width, r.height].join(),
            logo: [l.left, l.top, l.width, l.height].join(),
          }
        })
        assert.ok(shape.tall, `${href} @ ${width}: the bar is --appbar-h tall`)
        assert.notEqual(shape.ground, 'rgba(0, 0, 0, 0)', `${href} @ ${width}: an opaque ground`)
        shapes.push(JSON.stringify({ row: shape.row, logo: shape.logo, ground: shape.ground }))
        await expectClean(page, `${href} header scrolled @ ${width}`, width)
      }
      assert.equal(new Set(shapes).size, 1, `one bar shape @ ${width}: ${shapes.join(' | ')}`)
    }
  })

  it('code and terminal blocks never widen a 360px page (tabs, long lines, type mode)', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.setViewportSize({ width: 360, height: 800 })
    // Measured on body: html clips sideways overflow and reserves the
    // scrollbar gutter (decision 049), so the root's own widths never show it.
    let overflow = () => page.evaluate(() => document.body.scrollWidth - document.body.clientWidth)
    for (let href of [lesson('first-agent-loop', 'the-loop'), lesson('tokens-and-temperature', 'temperature')]) {
      await page.goto(href)
      await settled(page)
      assert.equal(await overflow(), 0, `${href}: no sideways page scroll`)
    }

    // Type mode: a long typed line scrolls inside the editor, not the page.
    await page.goto(lesson('first-agent-loop', 'the-loop'))
    await settled(page)
    await page.getByRole('button', { name: /Type it/ }).first().click()
    await page.getByRole('textbox', { name: /^Type / }).fill(`import Anthropic from "@anthropic-ai/sdk"\n\n${'x'.repeat(200)}`)
    assert.equal(await overflow(), 0, 'type mode: no sideways page scroll')
    await expectClean(page, 'code editor in type mode', 360)
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
    await page.goto(routes.courses.lesson.index.href({ course: plainCourse.slug, lesson: plainCourse.lessons[0] }))
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
    for (let lesson of plainCourse.lessons) await completeLesson(cookie, plainCourse.slug, lesson)
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.certificates.show.href({ handle: user.handle, course: plainCourse.slug }))
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

  it('theme switch (decision 062): the footer and Settings with a pinned theme', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.home.href())
    await settled(page)
    let footer = page.getByRole('form', { name: 'Theme' })
    await footer.getByRole('button', { name: 'Light' }).click()
    await footer.getByRole('button', { name: 'Light', pressed: true }).waitFor()
    await expectClean(page, 'landing pinned light')
    await footer.getByRole('button', { name: 'Dark' }).click()
    await footer.getByRole('button', { name: 'Dark', pressed: true }).waitFor()
    await expectClean(page, 'landing pinned dark')

    await signInBrowser(page, uniqueEmail('theme'))
    await page.goto(routes.settings.index.href())
    await settled(page)
    await page.locator('label', { hasText: 'Light' }).click()
    await page.getByRole('button', { name: 'Save theme' }).click()
    await page.getByText('Every page uses this theme now').waitFor()
    await expectClean(page, 'settings appearance saved')
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

  it('admin: /admin/authors with an open invite and an error, then the invite page', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let user = await signInBrowser(page, uniqueEmail('admin'))
    await testDb.update(users, user.id, { role: 'admin' })
    await page.goto(routes.admin.authors.index.href())
    await settled(page)
    await expectClean(page, '/admin/authors')

    let invitee = uniqueEmail('invitee')
    await page.getByLabel('Email address').fill(invitee)
    await page.getByRole('button', { name: /Send invite/ }).click()
    await page.getByText(invitee, { exact: true }).waitFor()
    await settled(page)
    await expectClean(page, '/admin/authors open invite')

    await page.getByLabel('Email address').fill('not-an-email')
    await page.getByRole('button', { name: /Send invite/ }).click()
    await page.locator('[aria-invalid="true"]').first().waitFor()
    await expectClean(page, '/admin/authors error')

    // The invitee's page, seen from the wrong account.
    let token = /token=([A-Za-z0-9_-]+)/.exec(outbox.findLast((m) => m.to === invitee)!.text)![1]!
    await page.goto(routes.admin.invite.index.href(undefined, { searchParams: { token } }))
    await settled(page)
    await expectClean(page, '/admin/invite')
  })
})
