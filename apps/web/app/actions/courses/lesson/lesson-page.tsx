import type { Handle } from 'remix/component'
import { css, unsafeHTML } from 'remix/component'
import { Crosshair } from '@bits/ui/crosshair'
import { Keycap } from '@bits/ui/keycap'
import { LessonBar, LessonRow } from '@bits/ui/lesson-bar'
import type { SegmentState } from '@bits/ui/progress-bar'
import { prefetchFor } from '@bits/ui/lib/prefetch'
import { PageFrame } from '@bits/ui/page-frame'

import type { RewardNotice } from '../../../progress/reward.ts'
import { APP_TITLE } from '../../../config.ts'
import { routes } from '../../../routes.ts'
import { ogImage } from '../../../ui/og.ts'
import { Layout } from '../../../ui/layout.tsx'
import { exercisesOf } from './content.ts'
import { depthTabs, lessonAward, openAsks, type LessonView } from './lesson-view.ts'
import { LessonComplete } from './public/lesson-complete.tsx'
import { PASSED_ROOT } from './public/lesson-state.ts'
import { LessonXp } from './public/lesson-xp.tsx'
import { OutlineDisclosure, OutlineNav } from './ui/outline.tsx'
import { ReadMode } from './ui/read-mode.tsx'

/**
 * A lesson (Lesson artboard). It has one view, Read (decision 055): a
 * lesson with a video opens with the player, then reads as usual.
 * The author preview renders this same page with a Draft banner. Lesson text
 * is server-rendered; only the islands the lesson's blocks need hydrate.
 *
 * The shell is the app's (decision 022): the sticky AppBar with the lesson
 * sub-bar as its second row, and the reward XP island in the bar's XP slot.
 */
export function LessonPage(handle: Handle<{ view: LessonView; issues?: string[]; reward?: RewardNotice }>) {
  return () => {
    let { view, issues, reward } = handle.props
    let { course, lesson, content, viewer } = view
    let segments: SegmentState[] = view.lessons.map((l) =>
      l.slug === lesson.slug ? (l.state === 'done' ? 'done' : 'current') : l.state === 'done' ? 'done' : 'upcoming',
    )
    let done = view.lessons.filter((l) => l.state === 'done').length
    let award = lesson.state === 'done' ? 0 : lessonAward(view)
    // "Complete lesson" waits for the prompt exercises and the quick checks
    // not yet answered (decision 052; an ask with gate=false never waits).
    let gated = exercisesOf(content).length > 0 || openAsks(view).length > 0
    let progressLabel = `Lesson ${view.index + 1} of ${view.total}, ${done} complete`
    let depths = depthTabs(view)

    return (
      <Layout
        title={`${content.title} · ${course.title}${view.draft ? ' (draft)' : ''}`}
        description={`Lesson ${view.index + 1} of ${view.total} in ${course.title}.`}
        canonicalPath={view.draft ? undefined : view.href.lesson(lesson.slug)}
        image={ogImage(`course-${course.slug}`, `${course.title}: a free ${APP_TITLE} course`)}
        // The title in the sub-bar is Unbounded 500, the lesson's first big
        // text. Geist 600 is the prose's **bold**: swapped in late, it rewrapped
        // lines and shifted the lesson by a line (CLS 0.043, decision 051).
        preloadFonts={['unbounded-latin-500-normal.woff2', 'geist-latin-600-normal.woff2']}
        currentPath={view.draft ? routes.author.index.href() : routes.courses.index.href()}
        head={<style innerHTML={unsafeHTML(pageStyles)} />}
        viewer={viewer}
        reward={reward}
        sub={
          <LessonBar
            position="shell"
            backHref={view.href.back}
            backLabel={view.draft ? 'Back to the build' : 'Back to course'}
            context={`${course.title} · Lesson ${view.index + 1} of ${view.total}`}
            title={content.title}
            titleAs="h1"
            segments={segments}
            progressLabel={progressLabel}
            depths={depths}
            xp={
              viewer ? (
                <span data-rmx-key={view.key} mix={contentsStyle}>
                  <LessonXp neurons={viewer.xp} award={award} />
                </span>
              ) : undefined
            }
          />
        }
        bare
      >
        {view.draft ? (
          <p mix={draftStyle}>
            <span>{`DRAFT · ${view.draft.version} preview — not visible to learners`}</span>
            <a href={view.draft.backHref} data-rmx-prefetch={prefetchFor(view.draft.backHref)} mix={draftLink}>
              Back to validation →
            </a>
          </p>
        ) : null}
        <PageFrame rails>
          <div mix={bodyStyle}>
            <OutlineNav view={view} />
            <main id="main" tabIndex={-1} data-rmx-key={view.key} mix={[skipTargetStyle, mainStyle]}>
              <LessonRow depths={depths} aside={<OutlineDisclosure view={view} />} mix={phoneRow} />
              <div mix={readBody}>
                <ReadMode view={view} />
              </div>
              <LessonFooter view={view} gated={gated} issues={issues} />
            </main>
          </div>
        </PageFrame>
      </Layout>
    )
  }
}

/**
 * Prev/next lesson navigation and the gated "lesson complete" key: the
 * lesson's last band, under a hairline rule with `+` marks where it meets
 * the column's edges. Its content lines up with the column above it.
 */
function LessonFooter(handle: Handle<{ view: LessonView; gated: boolean; issues?: string[] }>) {
  return () => {
    let { view, gated, issues } = handle.props
    let { prev, next } = view
    // Prompts join the save with form=; asks are read from the journal (decision 052).
    let asks = openAsks(view)
    return (
      <nav aria-label="Lesson navigation" mix={footerBand}>
        <Crosshair placement="top-start" mix={phoneHidden} />
        <Crosshair placement="top-end" mix={phoneHidden} />
        <div mix={[footerStyle, footerWidth]}>
          {prev ? (
            <Keycap variant="ghost-mono" size="md" href={view.href.lesson(prev.slug)} mix={prevStyle}>
              <span aria-hidden="true">← </span>
              <span class="sr-only">Previous lesson: </span>
              {prev.title}
            </Keycap>
          ) : null}
          <LessonComplete
            gated={gated}
            prompts={exercisesOf(view.content).length > 0}
            asks={asks}
            form={view.completeForm}
            issues={issues}
            passed={view.lesson.state === 'done'}
            href={next ? view.href.lesson(next.slug) : view.href.back}
            label={next ? `Next: ${next.title} →` : 'Finish the course →'}
            loginHref={view.viewer ? undefined : view.href.login}
          />
        </div>
      </nav>
    )
  }
}

const MOBILE = '@media (max-width: 759px)'

// Client navigation reconciles a new page into the old DOM, and an island in
// a matching spot keeps its setup state (a passed check, a composer's runs).
// `data-rmx-key={view.key}` on <main> and on the XP pill's wrapper makes a
// different lesson replace them, so every island starts fresh per lesson.
// The same lesson (a quiz GET, a 422 re-render) keeps its state.
const contentsStyle = css({ display: 'contents' })

// Page-level overrides in the `app` layer (decision 007). Each css() mixin
// gets its own `rmx` sublayer, so overrides that reach into another
// component's markup can't win from a mixin. Static, trusted CSS.
const pageStyles = `@layer app {
  /* The open lesson's progress segment fills volt once its checks pass. */
  ${PASSED_ROOT} [data-lesson-progress] [data-state="current"] { background: var(--volt); }
  /* The lesson's video (decision 055): the VideoPlayer island's player and
     transcript stack in the read column as one ruled box, sharing a hairline
     (decision 047) instead of floating apart. */
  [data-lesson-video] > div { gap: 0; }
  [data-lesson-video] > div > section { flex-basis: 100%; }
  [data-lesson-video] > div > section + section { border-top: 0; }
}`

const draftStyle = css({
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  columnGap: 'var(--space-4)',
  padding: 'var(--space-2_5) var(--space-6)',
  background: 'var(--warn-tint)',
  borderBottom: 'var(--border-w) solid var(--warn-line)',
  color: 'var(--warn)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  [MOBILE]: { padding: 'var(--space-1) var(--space-4)' },
})
const draftLink = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  marginBlock: 'calc((var(--touch-target) - 1lh) / -2)',
  color: 'var(--warn)',
  '&:hover': { color: 'var(--text)' },
})
// The lesson sits in the ruled column (decision 047): the PageFrame's rails
// line up with the lesson bar's and the AppBar's, and the outline is the
// column's first cell. Phones keep the 12px inset like every other page.
// Outline | lesson, sharing the outline's hairline (decision 022).
const bodyStyle = css({
  display: 'grid',
  gridTemplateColumns: 'clamp(220px, 24%, 288px) minmax(0, 1fr)',
  alignItems: 'start',
  [MOBILE]: { display: 'block' },
})
// The skip link's target takes focus (tabIndex -1) without drawing a ring round the page (decision 031).
const skipTargetStyle = css({ '&:focus': { outline: 'none' } })
const mainStyle = css({ minWidth: 0, display: 'flex', flexDirection: 'column' })
// Phones: the page's one row of chrome under the header (decisions 051, 055):
// the depth tabs, then the outline disclosure as the row's end cell. The
// progress rides the sticky bar's bottom edge.
const phoneRow = css({
  [MOBILE]: {
    minHeight: 'var(--control-lg)',
    paddingLeft: 'var(--section-pad-x)',
    borderBottom: 'var(--border-w) solid var(--line-cell)',
  },
  '@media (max-width: 480px)': { paddingLeft: 'var(--space-4)' },
})
// Prose gets air: a calm column, padded like a section body.
const readBody = css({
  padding: 'var(--space-14) var(--section-pad-x) var(--space-20)',
  [MOBILE]: { padding: 'var(--space-8) var(--section-pad-x) var(--space-14)' },
  '@media (max-width: 480px)': { padding: 'var(--space-6) var(--space-4) var(--space-12)' },
})
const footerBand = css({
  position: 'relative',
  padding: 'var(--space-6) var(--section-pad-x) var(--space-16)',
  borderTop: 'var(--border-w) solid var(--line-section)',
  '@media (max-width: 480px)': { padding: 'var(--space-5) var(--space-4) var(--space-12)' },
})
// Phones: the column has no rails for the marks to sit on.
const phoneHidden = css({ '@media (max-width: 480px)': { display: 'none' } })
const footerWidth = css({ maxWidth: 'var(--read-width)', marginInline: 'auto' })
const footerStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--space-3)',
  // Keycaps don't wrap by default; "Next: <long lesson title> →" must, or it
  // overflows a 360px screen.
  [MOBILE]: {
    '& :is(a, button)': {
      maxWidth: '100%',
      whiteSpace: 'normal',
      lineHeight: 1.3,
      textAlign: 'center',
      paddingBlock: 'var(--space-2)',
    },
  },
})
const prevStyle = css({ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
