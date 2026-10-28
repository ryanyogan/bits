import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import type { Catalog } from '../../content/catalog.ts'
import { loadCatalog } from '../../content/store.ts'
import type { CourseManifest } from '../../content/types.ts'
import { routes } from '../../routes.ts'
import { completeLesson, fetchAs, runAt, signIn, testDb } from '../../test/auth.ts'
import { catalogHref, filterCourses as filter, parseCatalogQuery, resultLabel } from './catalog.ts'

let cookie: string | null = null
// The published catalog: content/courses/, built and published by the test platform.
let catalog: Catalog
let courses: readonly CourseManifest[] = []
// A passing answer for each gated block of What is an LLM (prompts also need a run at T=1.0).
const LLM_LESSONS: { lesson: string; prompt?: [id: string, text: string]; quiz?: [id: string, key: string] }[] = [
  { lesson: 'say-hi-to-claude', prompt: ['say-hi', 'Hi Claude, what are you? Explain in one sentence.'] },
  { lesson: 'a-very-good-next-word-guesser', prompt: ['finish-the-sentence', 'Finish this sentence with one word: The sky is ...'] },
  { lesson: 'words-become-tokens', quiz: ['strawberry', 'b'] },
  { lesson: 'where-it-learned-pretraining', quiz: ['what-pretraining-practises', 'a'] },
  { lesson: 'from-autocomplete-to-assistant', quiz: ['constitutional-ai', 'b'] },
  { lesson: 'attention-how-it-keeps-track', prompt: ['what-does-it-mean', 'In "The dog chased the cat because it was hungry", what does it refer to?'] },
  { lesson: 'what-it-cant-do', prompt: ['catch-a-guess', 'Who wrote the 1923 novel The Glass Orchard? If you are not sure, say so.'] },
  {
    lesson: 'checkpoint-talk-to-it-well',
    prompt: ['talk-to-it-well', 'Write a welcome message for my running club, for nervous beginners, because we want them back. Keep it under 40 words. Ask me questions if anything is unclear.'],
  },
]

// Tokens & temperature lessons 1–5, answered so every gate passes.
const TOKENS_LESSONS: typeof LLM_LESSONS = [
  { lesson: 'what-is-a-token', quiz: ['common-words', 'a'] },
  { lesson: 'tokenizers-are-weird', quiz: ['weird-splits', 'b'] },
  { lesson: 'counting-tokens', prompt: ['short-answer', 'Explain what a token is in under 20 words.'], quiz: ['cheaper-turn', 'b'] },
  { lesson: 'probabilities-not-answers', prompt: ['one-animal', 'Name one animal. Reply with one word.'], quiz: ['what-odds-mean', 'b'] },
  {
    lesson: 'greedy-vs-sampled',
    prompt: ['sentiment-label', 'Label this review as positive, negative or neutral. Reply with only the label. Review: Arrived late, but it works great.'],
    quiz: ['consistent', 'b'],
  },
]

const filterCourses = (query: Parameters<typeof filter>[0]) => filter(query, catalog.listCourses())

/** Fetches a page signed in (progress shows), or signed out with `{ anonymous: true }`. */
async function page(path: string, options: { anonymous?: boolean } = {}) {
  let response = await fetchAs(options.anonymous ? null : cookie, path)
  return { status: response.status, html: await response.text() }
}

function count(html: string, pattern: RegExp) {
  return html.match(new RegExp(pattern.source, 'g'))?.length ?? 0
}

// One flat suite: remix test runs before/after around every describe, and
// the platform (D1) must stay up until the last test.
describe('catalog and course pages', () => {
  before(async () => {
    catalog = await loadCatalog(testDb, platform.env.CONTENT)
    courses = catalog.courses
    ;({ cookie } = await signIn('catalog@example.com'))
    // The artboards' learner: finished the LLM course (passing each gate),
    // then lessons 1–5 of Tokens & temperature (none of these is gated).
    for (let [course, lessons] of [['what-is-an-llm', LLM_LESSONS], ['tokens-and-temperature', TOKENS_LESSONS]] as const) {
      for (let { lesson, prompt, quiz } of lessons) {
        let fields: Record<string, string> = {}
        if (prompt) {
          cookie = await runAt(cookie, { course, lesson, exercise: prompt[0], prompt: prompt[1] }, [100])
          fields[`prompt.${prompt[0]}`] = prompt[1]
        }
        if (quiz) fields[`quiz.${quiz[0]}`] = quiz[1]
        let response = await completeLesson(cookie, course, lesson, fields)
        assert.equal(response.status, 303, lesson)
      }
    }
  })
  after(() => disposePlatform())

  it('parses track and q from the URL and ignores unknown tracks', () => {
    let query = parseCatalogQuery(new URL('http://x/courses?track=Agents&q=%20rag%20'))
    assert.equal(query.track, 'agents')
    assert.equal(query.q, 'rag')
    assert.equal(parseCatalogQuery(new URL('http://x/courses?track=nope')).track, undefined)
  })

  it('matches title, desc, track and sigil case-insensitively', () => {
    assert.deepEqual(
      filterCourses({ q: 'RAG' }).results.map((c) => c.slug),
      ['retrieval-without-tears'],
    )
    assert.equal(filterCourses({ q: 'agents' }).results.length, 2)
    assert.equal(filterCourses({ q: 'T°' }).results[0]?.slug, 'tokens-and-temperature')
  })

  it('counts each track within the current search', () => {
    let all = filterCourses({ q: '' })
    assert.equal(all.counts.all, courses.length)
    // Counted from the published catalog (which includes the test-only
    // fixture course), so adding a course doesn't break this.
    assert.equal(all.counts.foundations, courses.filter((c) => c.track === 'Foundations').length)
    let agents = filterCourses({ track: 'agents', q: '' })
    assert.equal(agents.results.length, courses.filter((c) => c.track === 'Agents').length)
    assert.ok(agents.results.length > 0)
    assert.equal(agents.counts.all, courses.length)
  })

  it('builds clean filter hrefs and result labels', () => {
    assert.equal(catalogHref({}), routes.courses.index.href())
    assert.match(catalogHref({ track: 'tools', q: 'rag' }), /track=tools&q=rag$/)
    assert.equal(resultLabel(1), '1 course · all free')
    assert.equal(resultLabel(8), '8 courses · all free')
  })

  it('renders the catalog with every course, the write card and the continue banner', async () => {
    let { status, html } = await page(routes.courses.index.href())
    assert.equal(status, 200)
    assert.match(html, /<title>Courses · Bits<\/title>/)
    assert.equal(count(html, /<h1[\s>]/), 1)
    assert.match(html, /Pick your next/)
    assert.match(html, /role="search"/)
    assert.match(html, /<nav aria-label="Filter by track"/)
    assert.match(html, /aria-current="true"[^>]*>(?:(?!<\/a>).)*All/s)
    assert.ok(html.includes(resultLabel(courses.length)), resultLabel(courses.length))
    assert.match(html, /aria-live="polite"/)
    for (let course of courses) assert.ok(html.includes(`href="/courses/${course.slug}"`), course.slug)
    assert.match(html, /Write a course/)
    assert.match(html, /Up next:/)
    assert.match(html, /href="\/courses\/tokens-and-temperature\/temperature"/)
  })

  it('filters by track with the pill marked current', async () => {
    let { html } = await page(`${routes.courses.index.href()}?track=agents`)
    assert.match(html, /2 courses · all free/)
    assert.ok(html.includes('href="/courses/first-agent-loop"'))
    assert.ok(!html.includes('href="/courses/what-is-an-llm"'))
    assert.match(html, /href="\/courses\?track=agents" aria-current="true"/)
  })

  it('searches with q and keeps it in the form and the pill links', async () => {
    let { html } = await page(`${routes.courses.index.href()}?q=rag`)
    assert.match(html, /1 course · all free/)
    assert.match(html, /name="q"[^>]*value="rag"/)
    assert.match(html, /href="\/courses\?track=tools&amp;q=rag"/)
  })

  it('shows the empty state for a query with no matches', async () => {
    let { status, html } = await page(`${routes.courses.index.href()}?q=zzz`)
    assert.equal(status, 200)
    assert.match(html, /0 courses · all free/)
    assert.match(html, /0 results for “zzz”/)
    assert.match(html, /Clear filters/)
    assert.match(html, /Write a course/)
  })

  it('hides the continue banner and progress when signed out', async () => {
    let { html } = await page(routes.courses.index.href(), { anonymous: true })
    assert.doesNotMatch(html, /Up next:/)
    assert.match(html, /Sign in/)
    assert.match(html, /href="\/courses\/tokens-and-temperature"/)
  })

  it('draws the rabbit-hole background as pure CSS, hidden from assistive tech (decision 041)', async () => {
    let { html } = await page(routes.courses.index.href(), { anonymous: true })
    assert.match(html, /@keyframes catalog-bg-drop/)
    assert.match(html, /<main[^>]*>\s*<div[^>]*>\s*<div aria-hidden="true"/)
    assert.match(html, /data-rmx-key="catalog-bg:all"/)
    // Eight rings, five neurons: no script and nothing focusable in the layer.
    assert.equal(count(html, /<span style="--i: ?\d+;?"/), 8)
    assert.equal(count(html, /<i [^>]*style="--i:/), 5)
  })

  let path = routes.courses.course.index.href({ course: 'tokens-and-temperature' })

  it('renders the syllabus with lesson states and the resume callout', async () => {
    let { status, html } = await page(path)
    assert.equal(status, 200)
    assert.match(html, /<title>Tokens &amp; temperature · Bits<\/title>/)
    assert.equal(count(html, /<h1[\s>]/), 1)
    assert.match(html, /<nav aria-label="Breadcrumb"/)
    assert.match(html, /By the end you(?:'|&#39;)ll be able to/)
    assert.equal(count(html, /<h3[\s>]/), 3)
    assert.equal(count(html, /— completed/), 5)
    assert.equal(count(html, /— in progress/), 1)
    assert.equal(count(html, /— not started/), 2)
    assert.match(html, /aria-current="step"/)
    assert.match(html, /Resume lesson 6 →/)
    assert.match(html, /Pick up here →/)
    assert.match(html, /You stopped at the exercise/)
    assert.match(html, /aria-label="62 percent complete"/)
    assert.match(html, /5 of 8 lessons/)
    assert.match(html, /badge \+ 320 neurons on finish/)
    assert.match(html, /How you(?:'|&#39;)ll learn/)
    assert.match(html, /href="\/courses\/tokens-and-temperature\/what-is-a-token"/)
    // Lesson 1's video isn't uploaded, so it is text-only and there is no "watch the intro" key (decision 029).
    assert.doesNotMatch(html, /href="\/courses\/tokens-and-temperature\/what-is-a-token\?mode=watch"/)
  })

  it('renders the signed-out variant with nothing started', async () => {
    let { html } = await page(path, { anonymous: true })
    assert.equal(count(html, /— not started/), 8)
    assert.equal(count(html, /— completed/), 0)
    assert.doesNotMatch(html, /aria-current="step"/)
    assert.doesNotMatch(html, /Pick up here/)
    assert.match(html, /Start lesson 1 →/)
    assert.match(html, /aria-label="0 percent complete"/)
  })

  it('renders every catalog course', async () => {
    for (let course of courses) {
      let { status, html } = await page(routes.courses.course.index.href({ course: course.slug }))
      assert.equal(status, 200, course.slug)
      assert.ok(html.includes(course.desc.slice(0, 20)) || html.includes('<h1'), course.slug)
    }
  })

  it('labels a finished course "Review the course"', async () => {
    let { html } = await page(routes.courses.course.index.href({ course: 'what-is-an-llm' }))
    assert.match(html, /Review the course →/)
  })

  it('returns a styled 404 for an unknown course', async () => {
    let { status, html } = await page(routes.courses.course.index.href({ course: 'no-such-course' }))
    assert.equal(status, 404)
    assert.match(html, /<main id="main"/)
    assert.match(html, /That course isn(?:'|&#39;)t here\./)
    assert.match(html, /Browse courses →/)
  })
})
