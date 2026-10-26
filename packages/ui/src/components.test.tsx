import * as assert from 'remix/assert'
import { renderToString } from 'remix/component/server'
import { describe, it } from 'remix/test'

import { CheckChip } from './check-chip.tsx'
import { CourseCard } from './course-card.tsx'
import { coverPatterns, CourseCover } from './course-cover.tsx'
import { FilterPill } from './filter-pill.tsx'
import { Keycap } from './keycap.tsx'
import { LessonNode, LessonNodeRow } from './lesson-node.tsx'
import { oddsAt, temperatureNote } from './odds-bars.tsx'
import { ProgressBar } from './progress-bar.tsx'
import { ProgressRing } from './progress-ring.tsx'
import { checkPasses, draftTokens } from './prompt-composer.tsx'
import { SegmentedTabs } from './segmented-tabs.tsx'
import { TextField } from './text-field.tsx'
import { formatTime } from './video-player.tsx'

describe('Keycap', () => {
  it('renders a typed button by default', async () => {
    let html = await renderToString(<Keycap type="submit">Run ↵</Keycap>)
    assert.match(html, /<button[^>]*type="submit"/)
    assert.match(html, /Run ↵/)
  })

  it('renders a link when given href', async () => {
    let html = await renderToString(<Keycap href="/courses">Start free</Keycap>)
    assert.match(html, /<a[^>]*href="\/courses"/)
  })

  it('drops the href and marks a disabled link', async () => {
    let html = await renderToString(
      <Keycap href="/courses" disabled>
        Start
      </Keycap>,
    )
    assert.doesNotMatch(html, /href=/)
    assert.match(html, /aria-disabled="true"/)
  })

  it('shows a busy caret while loading', async () => {
    let html = await renderToString(<Keycap loading>Sending</Keycap>)
    assert.match(html, /aria-busy="true"/)
    assert.match(html, /▍/)
  })

  it('exposes forced states for the style guide', async () => {
    let html = await renderToString(<Keycap forceState="hover">Hover</Keycap>)
    assert.match(html, /data-force="hover"/)
  })
})

describe('URL-backed selection', () => {
  it('marks the current segmented tab with aria-current="page"', async () => {
    let html = await renderToString(
      <SegmentedTabs
        label="Lesson format"
        items={[
          { label: 'Read', href: '?mode=read', current: true },
          { label: 'Watch', href: '?mode=watch' },
        ]}
      />,
    )
    let body = html.replace(/<head>[\s\S]*<\/head>/, '')
    assert.match(body, /<nav[^>]*aria-label="Lesson format"/)
    assert.match(body, /<a[^>]*aria-current="page"[^>]*>Read</)
    assert.equal((body.match(/aria-current="page"/g) ?? []).length, 1)
  })

  it('renders a selected filter pill as a link with aria-current', async () => {
    let html = await renderToString(
      <FilterPill href="?track=all" count={8} selected>
        All
      </FilterPill>,
    )
    assert.match(html, /<a[^>]*aria-current="true"/)
    assert.match(html, />8</)
  })
})

describe('TextField', () => {
  it('labels the input and wires the error message', async () => {
    let html = await renderToString(<TextField name="email" label="Email" type="email" error="Enter a full email address." />)
    assert.match(html, /<label[^>]*for="field-email"/)
    assert.match(html, /aria-invalid="true"/)
    assert.match(html, /aria-describedby="field-email-error"/)
    assert.match(html, /id="field-email-error"/)
  })
})

describe('course components', () => {
  it('renders every named cover pattern', async () => {
    for (let pattern of coverPatterns) {
      let html = await renderToString(<CourseCover pattern={pattern} tone="ion" sigil="T°" />)
      assert.match(html, /aria-hidden="true"[^>]*>T°</)
    }
  })

  it('renders a started course card with one link, a heading and progress', async () => {
    let html = await renderToString(
      <CourseCard
        href="/courses/tokens"
        title="Tokens & temperature"
        desc="Why answers vary."
        track="Prompting"
        level="Beginner"
        lessons={8}
        mins={42}
        sigil="T°"
        tone="ion"
        pattern="stripes-115"
        formats={['text', 'video']}
        pct={62}
      />,
    )
    assert.equal((html.match(/<a /g) ?? []).length, 1)
    assert.match(html, /<h3[^>]*>Tokens &amp; temperature<\/h3>/)
    assert.match(html, /62%/)
    assert.doesNotMatch(html, /DONE/)
  })

  it('shows the done tag and no bar at 100%', async () => {
    let html = await renderToString(
      <CourseCard
        href="/c"
        title="Done"
        desc="d"
        track="Foundations"
        level="Beginner"
        lessons={1}
        mins={1}
        sigil="LLM"
        tone="volt"
        pattern="dots"
        formats={['text']}
        pct={100}
      />,
    )
    assert.match(html, /✓ DONE/)
    assert.doesNotMatch(html, /complete/)
  })

  it('exposes a labelled progressbar', async () => {
    let html = await renderToString(<ProgressBar pct={62.4} label="Course progress" />)
    assert.match(html, /role="progressbar"/)
    assert.match(html, /aria-valuenow="62"/)
  })

  it('omits the ring fill at 0%', async () => {
    let zero = await renderToString(<ProgressRing pct={0} />)
    let some = await renderToString(<ProgressRing pct={62} />)
    assert.equal((zero.match(/<circle/g) ?? []).length, 1)
    assert.equal((some.match(/<circle/g) ?? []).length, 2)
    assert.match(some, /aria-label="62 percent complete"/)
  })
})

describe('lesson components', () => {
  it('keeps nodes decorative and states in text', async () => {
    let node = await renderToString(<LessonNode state="current" />)
    assert.match(node, /aria-hidden="true"/)
    let row = await renderToString(<LessonNodeRow state="current">Temperature</LessonNodeRow>)
    assert.match(row, /aria-current="step"/)
    assert.match(row, /in progress/)
  })

  it('renders readable numerals in the 20px outline node', async () => {
    let html = await renderToString(<LessonNode size={20} state="next" n={7} />)
    assert.match(html, />7</)
  })

  it('announces check state to screen readers', async () => {
    let html = await renderToString(<CheckChip passed>Asks for a tagline</CheckChip>)
    assert.match(html, /data-passed="true"/)
    assert.match(html, /passed/)
  })
})

describe('island logic', () => {
  it('estimates tokens as max(1, round(len / 4))', () => {
    assert.equal(draftTokens(''), 1)
    assert.equal(draftTokens('You are a salty pirate captain.'), 8)
  })

  it('evaluates regex and temperature checks', () => {
    let tagline = { label: 't', patterns: [{ source: 'tagline', flags: 'i' }] }
    assert.equal(checkPasses(tagline, 'A TAGLINE please', new Set()), true)
    assert.equal(checkPasses(tagline, 'a slogan', new Set()), false)
    let ran = { label: 'r', ranAt: [0, 100] }
    assert.equal(checkPasses(ran, '', new Set([0])), false)
    assert.equal(checkPasses(ran, '', new Set([0, 100])), true)
  })

  it('computes one-hot odds at 0 and a softmax above it', () => {
    let candidates: [string, number][] = [
      [' Brew', 3.1],
      [' One', 2.4],
    ]
    assert.deepEqual(oddsAt(candidates, 0), [1, 0])
    let odds = oddsAt(candidates, 0.7)
    assert.ok(Math.abs(odds[0]! + odds[1]! - 1) < 1e-9)
    assert.ok(odds[0]! > odds[1]!)
    assert.match(temperatureNote(0.7), /Balanced/)
  })

  it('formats player time', () => {
    assert.equal(formatTime(112), '1:52')
    assert.equal(formatTime(270), '4:30')
  })
})
