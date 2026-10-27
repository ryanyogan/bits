import * as assert from 'remix/assert'
import { renderToString } from 'remix/component/server'
import { describe, it } from 'remix/test'

import { AppBar } from '../app-bar.tsx'
import { AvatarButton } from '../avatar-button.tsx'
import { BackButton } from '../back-button.tsx'
import { SuggestionChip } from '../chip.tsx'
import { ContinueBanner } from '../continue-banner.tsx'
import { CourseCard, WriteCourseCard } from '../course-card.tsx'
import { FilterPill } from '../filter-pill.tsx'
import { Footer } from '../footer.tsx'
import { Keycap } from '../keycap.tsx'
import { Logo } from '../logo.tsx'
import { NavLink } from '../nav-link.tsx'
import { ProviderButton } from '../provider-button.tsx'
import { RabbitHole } from '../rabbit-hole.tsx'
import { isSameOriginPath, prefetchFor } from './prefetch.ts'

const INTENT = /data-rmx-prefetch="intent"/
const ANY = /data-rmx-prefetch=/

describe('prefetch rule', () => {
  it('prefetches same-origin paths on intent by default', () => {
    assert.equal(prefetchFor('/courses'), 'intent')
    assert.equal(prefetchFor('/courses?track=agents'), 'intent')
    assert.equal(prefetchFor('?track=agents'), 'intent')
    assert.equal(prefetchFor('lesson-2'), 'intent')
  })

  it('honours viewport and an opt-out', () => {
    assert.equal(prefetchFor('/courses', 'viewport'), 'viewport')
    assert.equal(prefetchFor('/courses', false), undefined)
  })

  it('never prefetches a document navigation or a download', () => {
    assert.equal(prefetchFor('/auth/oauth/github', 'intent', { document: true }), undefined)
    assert.equal(prefetchFor('/settings/export', 'intent', { download: true }), undefined)
    assert.equal(prefetchFor('/settings/export', 'intent', { download: 'bits.json' }), undefined)
    assert.equal(prefetchFor('/courses', 'intent', { download: false }), 'intent')
  })

  it('never prefetches off-origin, other schemes, fragments or nothing', () => {
    for (let href of ['https://anthropic.com', 'http://x.test/a', '//cdn.test/a', 'mailto:a@b.c', 'tel:123', '#main', '']) {
      assert.equal(prefetchFor(href), undefined, href)
    }
    assert.equal(prefetchFor(undefined), undefined)
    assert.equal(isSameOriginPath('/a#b'), true)
  })
})

describe('link components prefetch', () => {
  it('marks page links with intent', async () => {
    let cover = { sigil: 'T', tone: 'volt', pattern: 'grid' } as const
    let cases = [
      <NavLink href="/courses">Courses</NavLink>,
      <Logo brand="bits" href="/" />,
      <BackButton href="/courses/x" label="Back to course" />,
      <AvatarButton initials="RY" href="/me" />,
      <SuggestionChip href="/courses">Courses</SuggestionChip>,
      <FilterPill href="?track=agents">Agents</FilterPill>,
      <Keycap href="/courses">Start</Keycap>,
      <CourseCard
        href="/courses/x"
        title="T"
        desc="d"
        track="Foundations"
        level="Beginner"
        lessons={3}
        mins={20}
        formats={['text']}
        {...cover}
      />,
      <WriteCourseCard href="/author" />,
      <ContinueBanner href="/courses/x/y" courseTitle="T" eyebrow="Continue" nextLesson="Y" mins={5} pct={40} {...cover} />,
    ]
    for (let node of cases) assert.match(await renderToString(node), INTENT)
  })

  it('marks every app-bar and footer link, including the mobile sheet', async () => {
    let links = [
      { href: '/courses', label: 'Courses' },
      { href: '/me', label: 'Profile' },
    ]
    let bar = await renderToString(<AppBar brand="bits" homeHref="/" links={links} />)
    // Logo + 2 desktop links + 2 sheet links.
    assert.equal(bar.match(/data-rmx-prefetch="intent"/g)?.length, 5)
    let footer = await renderToString(<Footer brand="bits" homeHref="/" links={links} copyright="©" />)
    assert.equal(footer.match(/data-rmx-prefetch="intent"/g)?.length, 3)
  })

  it('leaves out document, download, disabled, opted-out and external links', async () => {
    let cases = [
      <Keycap href="/auth/oauth/github" document>Connect</Keycap>,
      <Keycap href="/settings/export" download>Download</Keycap>,
      <Keycap href="/courses" disabled>Start</Keycap>,
      <Keycap href="/courses" prefetch={false}>Start</Keycap>,
      <NavLink href="https://github.com/x">GitHub</NavLink>,
      <ProviderButton icon="github" href="/auth/oauth/github">GitHub</ProviderButton>,
      <RabbitHole links={[{ kind: 'read', title: 'Docs', by: 'Anthropic', url: 'https://docs.anthropic.com', mins: 5 }]} />,
    ]
    for (let node of cases) assert.doesNotMatch(await renderToString(node), ANY)
  })
})
