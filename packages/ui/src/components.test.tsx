import * as fs from 'node:fs'
import * as assert from 'remix/assert'
import { renderToString } from 'remix/component/server'
import { describe, it } from 'remix/test'

import { AttentionMap } from './attention-map.tsx'
import { CheckChip } from './check-chip.tsx'
import { ComparePanel } from './compare-panel.tsx'
import { CellGrid } from './cell-grid.tsx'
import { CourseCard } from './course-card.tsx'
import { Crosshair } from './crosshair.tsx'
import { PageFrame } from './page-frame.tsx'
import { Panel } from './panel.tsx'
import { RuledSection } from './ruled-section.tsx'
import { coverPatterns, CourseCover } from './course-cover.tsx'
import { Document } from './document.tsx'
import { FilterPill } from './filter-pill.tsx'
import { Keycap } from './keycap.tsx'
import { LessonNode, LessonNodeRow } from './lesson-node.tsx'
import { NextTokenPlayer, stepRows } from './next-token.tsx'
import { OddsBars, oddsAt, temperatureNote } from './odds-bars.tsx'
import { ProgressBar } from './progress-bar.tsx'
import { ProgressRing } from './progress-ring.tsx'
import { RabbitHole } from './rabbit-hole.tsx'
import { checkPasses, draftTokens, PromptComposer } from './prompt-composer.tsx'
import { SegmentedTabs } from './segmented-tabs.tsx'
import { TextField } from './text-field.tsx'
import { CodeInput } from './code-input.tsx'
import { QuizChoice } from './quiz-choice.tsx'
import { SearchField } from './search-field.tsx'
import { OutputPanel } from './terminal.tsx'
import { sparkPoints, TrainingScrubber } from './training-scrubber.tsx'
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

  it('opts a link out of client navigation or into a download', async () => {
    assert.match(await renderToString(<Keycap href="/auth/oauth/github" document>Connect</Keycap>), /data-rmx-document=""/)
    assert.match(await renderToString(<Keycap href="/settings/export" download>Download</Keycap>), /download=""/)
    assert.doesNotMatch(await renderToString(<Keycap href="/courses">Go</Keycap>), /data-rmx-document|download/)
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

  it('marks itself busy while loading, keeping the caret out of its name', async () => {
    let html = await renderToString(<Keycap loading>Sending</Keycap>)
    assert.match(html, /aria-busy="true"/)
    // The caret is CSS on [aria-busy] (so any busy submitter gets it), not text.
    assert.match(html, /<button[^>]*>Sending<\/button>/)
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

  it('keepPlace leaves focus and scroll alone on every tab (decision 044)', async () => {
    let items = [
      { label: 'Sign in', href: '/login', current: true },
      { label: 'Create account', href: '/login?mode=signup' },
    ]
    let kept = (await renderToString(<SegmentedTabs label="Account" flavour="account" keepPlace items={items} />)).replace(
      /<head>[\s\S]*<\/head>/,
      '',
    )
    let links = kept.match(/<a\b[^>]*>/g) ?? []
    assert.equal(links.length, 2)
    for (let link of links) {
      assert.match(link, /data-rmx-reset-focus="manual"/)
      assert.match(link, /data-rmx-reset-scroll="manual"/)
      // Still a plain, prefetchable page link: without JS it is an ordinary load.
      assert.match(link, /href="\/login/)
      assert.match(link, /data-rmx-prefetch="intent"/)
    }
    assert.match(kept, /<a[^>]*aria-current="page"[^>]*>Sign in</)

    // Without it the runtime's defaults apply (focus and scroll reset per page).
    let plain = await renderToString(<SegmentedTabs label="Account" flavour="account" items={items} />)
    assert.doesNotMatch(plain, /data-rmx-reset-(?:focus|scroll)/)
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

  it('keeps literal fields free of auto-capitalisation and spell-check', async () => {
    let html = await renderToString(<TextField name="email" label="Email" type="email" enterKeyHint="send" />)
    assert.match(html, /autocapitalize="none"/i)
    assert.match(html, /spellcheck="false"/i)
    assert.match(html, /enterkeyhint="send"/)
    let prose = await renderToString(<TextField name="name" label="Name" />)
    assert.doesNotMatch(prose, /autocapitalize|spellcheck/i)
  })
})

describe('SearchField', () => {
  it('keeps focus in the field when Enter re-renders the results', async () => {
    let html = await renderToString(<SearchField action="/courses" shortcut={false} />)
    assert.match(html, /data-rmx-reset-focus="manual"/)
    assert.match(html, /enterkeyhint="search"/)
  })
})

describe('QuizChoice', () => {
  it('keeps a live region mounted and focus in place across checks', async () => {
    let options = [{ value: 'a', label: 'A' }]
    let fresh = await renderToString(<QuizChoice name="q" question="Q?" options={options} />)
    assert.match(fresh, /role="status"/)
    assert.match(fresh, /data-rmx-reset-focus="manual"/)
    let checked = await renderToString(<QuizChoice name="q" question="Q?" options={options} explanation="Because." />)
    assert.match(checked, /role="status"[^>]*><p[^>]*>Because\.<\/p>/)
  })
})

describe('CodeInput (server render)', () => {
  it('describes the field by its error and can take focus', async () => {
    let html = await renderToString(<CodeInput name="code" error="Wrong code." autoFocus />)
    assert.match(html, /aria-describedby="code-code-error"/)
    assert.match(html, /aria-invalid="true"/)
    assert.match(html, /autofocus/)
    assert.match(html, /id="code-code-error"[^>]*>Wrong code\./)
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

  it('keeps the same markup in the grid cell variants (decision 047)', async () => {
    let card = await renderToString(
      <CourseCard
        href="/c"
        title="Cell"
        desc="d"
        track="Tools"
        level="Beginner"
        lessons={1}
        mins={1}
        sigil="fn"
        tone="synapse"
        pattern="rings"
        formats={['text']}
        variant="cell"
      />,
    )
    assert.equal((card.match(/<a /g) ?? []).length, 1)
    assert.match(card, /<h3[^>]*>Cell<\/h3>/)
    let pill = await renderToString(
      <FilterPill href="?track=tools" count={2} selected variant="cell">
        Tools
      </FilterPill>,
    )
    assert.match(pill, /<a[^>]*aria-current="true"/)
    assert.doesNotMatch(pill, /data-rmx-reset-scroll/)
    let kept = await renderToString(<FilterPill href="?track=tools" keepPlace>Tools</FilterPill>)
    assert.match(kept, /data-rmx-reset-focus="manual"/)
    assert.match(kept, /data-rmx-reset-scroll="manual"/)
    let search = await renderToString(<SearchField action="/courses" shortcut={false} variant="cell" />)
    assert.match(search, /role="search"[^>]*data-rmx-reset-focus="manual"|data-rmx-reset-focus="manual"[^>]*role="search"/)
    assert.match(search, /data-rmx-reset-scroll="manual"/)
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

describe('Document', () => {
  const assets = { entry: { href: '/entry.js', preloads: [], importMap: { imports: {} } }, stylesheets: [], fontPreloads: [] }

  it('renders the canonical URL and link-preview meta', async () => {
    let html = await renderToString(
      <Document assets={assets} title="Tokens · Bits" description="Learn tokens." url="https://bits.example/courses/tokens" siteName="Bits" />,
    )
    assert.match(html, /<link data-rmx-key="canonical" rel="canonical" href="https:\/\/bits.example\/courses\/tokens"/)
    assert.match(html, /<meta property="og:title" content="Tokens · Bits"/)
    assert.match(html, /<meta property="og:description" content="Learn tokens."/)
    assert.match(html, /<meta property="og:url" content="https:\/\/bits.example\/courses\/tokens"/)
    assert.match(html, /<meta property="og:site_name" content="Bits"/)
  })

  it('leaves out the canonical URL when there is none', async () => {
    let html = await renderToString(<Document assets={assets} title="Settings · Bits" />)
    assert.doesNotMatch(html, /rel="canonical"|og:url/)
  })
})

const noscript = (html: string) => html.match(/<noscript>(.*?)<\/noscript>/s)?.[1] ?? ''

describe('lesson toys (server render = the interactive first state, plus <noscript>)', () => {
  it('NextTokenPlayer renders step 1 with its controls, and the full reply in <noscript>', async () => {
    let html = await renderToString(
      <NextTokenPlayer
        prompt="The capital of France is"
        steps={[
          { token: ' Paris', p: 0.92, alternatives: [[' the', 0.03]] },
          { token: '.', p: 0.7, alternatives: [[',', 0.2]] },
        ]}
        illustrative
      />,
    )
    assert.match(html, /illustrative/)
    // Interactive first state: step 1's odds and the step controls.
    assert.match(html, /step 1\/2 · candidates for the next token/)
    assert.match(html, /aria-label="Candidates for step 1"/)
    assert.match(html, /<button[^>]*aria-label="Next token"/)
    assert.match(html, /<button[^>]*aria-label="Play"/)
    assert.match(html, /Step 1 of 2: picks “␣Paris” at 92%/)
    // No-JS: the final sentence and every step.
    let fallback = noscript(html)
    assert.match(fallback, /The capital of France is<\/span> Paris\./)
    assert.match(fallback, /<table/)
    assert.match(fallback, /␣Paris.*92%.*␣the 3\.0%/s)
    assert.match(fallback, /<td[^>]*>2<\/td><td[^>]*>\.<\/td>/)
    assert.doesNotMatch(fallback, /<button/)
  })

  it('stepRows sorts the pick in among its runners-up', () => {
    let rows = stepRows({ token: ' a', p: 0.2, alternatives: [[' the', 0.5], [' an', 0.1]] })
    assert.deepEqual(rows.map((row) => [row.token, row.picked ?? false]), [
      [' the', false],
      [' a', true],
      [' an', false],
    ])
  })

  it('TrainingScrubber renders the first snapshot with the slider, and every snapshot in <noscript>', async () => {
    let html = await renderToString(
      <TrainingScrubber
        id="t"
        prompt="Once upon a"
        snapshots={[
          { step: 0, loss: 10.8, text: 'qz#' },
          { step: 5000, loss: 2.1, text: 'time' },
        ]}
      />,
    )
    // Interactive first state: snapshot 1, the sparkline and the slider.
    assert.match(html, /model output at step 0/)
    assert.match(html, /<input[^>]*type="range"/)
    assert.match(html, /<svg[^>]*role="img"/)
    assert.match(html, /<circle/)
    let fallback = noscript(html)
    assert.match(fallback, /<ol aria-label="Training snapshots"/)
    assert.match(fallback, /step 5,000 · loss 2\.10/)
    assert.doesNotMatch(fallback, /type="range"/)
    let points = sparkPoints([10, 5, 0])
    assert.ok(points[0]![1] < points[2]![1], 'higher loss draws higher')
  })

  it('AttentionMap renders the chips with the strongest link picked, and a from → to table in <noscript>', async () => {
    let html = await renderToString(<AttentionMap tokens={['The', ' cat', ' it']} links={[{ from: 2, to: 1, weight: 0.7 }]} />)
    // Interactive first state: chips, "it" picked, "cat" tinted.
    assert.match(html, /role="toolbar"/)
    assert.match(html, /<button[^>]*aria-pressed="true"[^>]*data-state="from"/)
    assert.match(html, /aria-label="cat 70% attention"[^>]*data-state="to"/)
    assert.match(html, /“it” looks most at “cat” \(70%\)/)
    let fallback = noscript(html)
    assert.match(fallback, /<table/)
    assert.match(fallback, /␣it<\/td><td[^>]*>␣cat<\/td><td[^>]*>0\.70/)
  })

  it('ComparePanel renders both sides with their labels, no JS', async () => {
    let html = await renderToString(<ComparePanel left="Base model" right="Assistant" rows={[{ prompt: 'Hi?', left: 'Hi? Hi?', right: 'Hello!' }]} />)
    assert.match(html, /Base model<\/figcaption>/)
    assert.match(html, /Assistant<\/figcaption>/)
    assert.match(html, /Hello!/)
    assert.doesNotMatch(html, /rmx-hydrat|<script/)
  })

  it('RabbitHole links open in a new tab outside client navigation', async () => {
    let html = await renderToString(
      <RabbitHole links={[{ kind: 'video', title: 'But what is a GPT?', by: '3Blue1Brown', mins: 27, url: 'https://example.com/v', deep: true }]} />,
    )
    assert.match(html, /Down the rabbit hole/)
    assert.match(html, /<a href="https:\/\/example.com\/v" target="_blank" rel="noopener noreferrer" data-rmx-document=""/)
    assert.match(html, /3Blue1Brown · video · 27 min · deep dive/)
    assert.match(html, /opens in a new tab/)
  })
})

// Decision 023: what fills in has a reserved size, so nothing below it moves.
describe('layout stability', () => {
  const outsideNoscript = (html: string) => html.replace(/<noscript>.*?<\/noscript>/gs, '')
  /** The markup alone, without the <head> of styles renderToString prepends. */
  const markup = async (node: Parameters<typeof renderToString>[0]) =>
    (await renderToString(node)).replace(/^<head>.*?<\/head>/s, '')

  it('PromptComposer renders its fixed runs window and the hint line before any run', async () => {
    let html = await renderToString(<PromptComposer id="p" task="Say hi" checks={[{ label: 'Says hi', patterns: [{ source: 'hi' }] }]} />)
    assert.match(html, /<section[^>]*aria-label="Your runs"[^>]*tabindex="0"[^>]*data-empty=""/)
    // The runs list is the live region, mounted before any run: replies and
    // the reward toast (inside the run that earned it) are announced from it.
    assert.match(html, /<ol aria-live="polite"/)
    // The no-JS note holds the line the keyboard hint takes once hydrated.
    assert.match(html, /Turn on JavaScript to run prompts\./)
  })

  it('NextTokenPlayer reserves the finished sentence, the tallest odds and the done note', async () => {
    let html = outsideNoscript(
      await renderToString(
        <NextTokenPlayer
          prompt="The capital of France is"
          steps={[
            { token: ' Paris', p: 0.92, alternatives: [[' the', 0.03]] },
            { token: '.', p: 0.7, alternatives: [[',', 0.2], ['!', 0.05]] },
          ]}
        />,
      ),
    )
    assert.match(html, /aria-hidden="true"[^>]*>(?:<[^>]+>)*The capital of France is Paris\.▍/)
    assert.match(html, /aria-hidden="true"[^>]*>(?:<[^>]+>)*step 2\/2 · candidates/)
    assert.match(html, /aria-hidden="true"[^>]*>(?:<[^>]+>)*That’s the whole trick/)
  })

  it('OddsBars reserves every temperature note', async () => {
    let html = await renderToString(<OddsBars context="Tagline:" candidates={[['Moon', 2], ['Star', 1]]} />)
    for (let t of [0, 0.3, 0.8, 1.2]) assert.ok(html.includes(temperatureNote(t)), `note for T=${t}`)
  })

  it('TrainingScrubber reserves every snapshot', async () => {
    let html = await renderToString(
      <TrainingScrubber id="t" prompt="Once" snapshots={[{ step: 0, loss: 9, text: 'qz' }, { step: 9, loss: 2, text: 'upon a time there lived' }]} />,
    )
    assert.match(outsideNoscript(html), /aria-hidden="true"[^>]*>(?:<[^>]+>)*Once<\/span>upon a time there lived/)
  })

  it('PageFrame renders a div by default and a focusable main on request', async () => {
    let html = await markup(<PageFrame>body</PageFrame>)
    assert.match(html, /^<div[^>]*>body<\/div>$/)
    let main = await markup(
      <PageFrame as="main" id="main">
        body
      </PageFrame>,
    )
    assert.match(main, /<main id="main" tabindex="-1"/)
  })

  it('RuledSection labels itself, marks the rails and shows the index strip (decision 047)', async () => {
    let html = await markup(
      <RuledSection id="how" aria-labelledby="how-title" index="02" label="How it works" aside="3 lessons">
        <h2 id="how-title">Hi</h2>
      </RuledSection>,
    )
    assert.match(html, /^<section id="how" aria-labelledby="how-title"/)
    assert.equal(html.match(/<span aria-hidden="true"[^>]*><\/span>/g)?.length, 4, 'a crosshair at each corner (decision 050)')
    assert.match(html, /<span[^>]*>02<\/span><span aria-hidden="true"[^>]*> \/ <\/span>How it works/)
    assert.match(html, /3 lessons/)
    let bare = await markup(
      <RuledSection as="div" rule={false}>
        x
      </RuledSection>,
    )
    assert.equal(bare.match(/<span aria-hidden="true"[^>]*><\/span>/g)?.length, 2, 'only the bottom marks without a top rule')
    assert.doesNotMatch(bare, /<p/, 'no header strip without index, label or aside')
    let unmarked = await markup(
      <RuledSection as="div" marks={false}>
        x
      </RuledSection>,
    )
    assert.doesNotMatch(unmarked, /aria-hidden/, 'no marks when asked')
  })

  it('RuledSection can make its strip label the heading', async () => {
    let html = await markup(
      <RuledSection label="Syllabus" labelAs="h2" labelId="syl">
        x
      </RuledSection>,
    )
    assert.match(html, /^<section aria-labelledby="syl"/)
    assert.match(html, /<h2 id="syl"[^>]*>Syllabus<\/h2>/)
    assert.doesNotMatch(html, /<p/)
  })

  it('Panel is a section labelled by its strip heading', async () => {
    let html = await markup(
      <Panel id="badges" title="Badges" aside="3 of 9">
        body
      </Panel>,
    )
    assert.match(html, /^<section aria-labelledby="badges"/)
    assert.match(html, /<h2 id="badges"[^>]*>Badges<\/h2>/)
    assert.match(html, /3 of 9/)
    assert.match(await markup(<Panel id="a" title="A" level={3} />), /<h3 id="a"/)
  })

  it('CellGrid renders the requested list element with its label', async () => {
    let html = await markup(
      <CellGrid as="ul" cols={4} aria-label="Tracks">
        <li>a</li>
        <li>b</li>
      </CellGrid>,
    )
    assert.match(html, /^<ul aria-label="Tracks"[^>]*><li>a<\/li><li>b<\/li><\/ul>$/)
    assert.match(await markup(<CellGrid>x</CellGrid>), /^<div/)
  })

  it('Crosshair is decorative', async () => {
    assert.match(await markup(<Crosshair placement="top-end" />), /^<span aria-hidden="true"/)
  })

  it('OutputPanel is a scrolling region with the full output on the server', async () => {
    let html = await markup(<OutputPanel command="node run.js" lines={[[['text', 'one']], [['muted', 'two']]]} />)
    assert.match(html, /role="region"[^>]*aria-label="Output of node run\.js"|aria-label="Output of node run\.js"[^>]*role="region"/)
    assert.match(html, /one.*two/s)
    assert.doesNotMatch(html, /<div aria-hidden="true"/, 'no Ghost until a replay starts')
  })

  it('every font stack names its metric-matched fallback, and fonts.css defines it', () => {
    let fonts = fs.readFileSync(new URL('./styles/fonts.css', import.meta.url), 'utf8')
    let tokens = fs.readFileSync(new URL('./styles/tokens.css', import.meta.url), 'utf8')
    for (let family of ['Unbounded', 'Geist', 'Geist Mono']) {
      assert.match(tokens, new RegExp(`'${family}', '${family} Fallback'`))
      let face = fonts.match(new RegExp(`font-family: '${family} Fallback';[^}]*`))?.[0] ?? ''
      assert.match(face, /src: local\(/, `${family} Fallback uses a local font`)
      assert.match(face, /size-adjust: \d/)
      assert.match(face, /ascent-override: \d/)
      assert.match(face, /descent-override: \d/)
    }
  })
})
