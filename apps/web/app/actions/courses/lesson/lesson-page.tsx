import type { Handle } from 'remix/component'
import { css, unsafeHTML } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'
import { LessonBar, LessonModes } from '@bits/ui/lesson-bar'
import type { SegmentState } from '@bits/ui/progress-bar'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import type { RewardNotice } from '../../../progress/reward.ts'
import { APP_TITLE } from '../../../config.ts'
import { routes } from '../../../routes.ts'
import { ogImage } from '../../../ui/og.ts'
import { Layout } from '../../../ui/layout.tsx'
import { exercisesOf, hasCode, hasVideo } from './content.ts'
import { lessonAward, type LessonMode, type LessonView } from './lesson-view.ts'
import { LessonComplete } from './public/lesson-complete.tsx'
import { PASSED_ROOT } from './public/lesson-state.ts'
import { LessonXp } from './public/lesson-xp.tsx'
import { fieldNames } from './ui/exercise.ts'
import { OutlineDisclosure, OutlineNav } from './ui/outline.tsx'
import { ReadMode } from './ui/read-mode.tsx'
import { TerminalMode } from './ui/terminal-mode.tsx'
import { WatchMode } from './ui/watch-mode.tsx'

const modeLabels: Record<LessonMode, string> = { read: 'Read', watch: 'Watch', terminal: 'Terminal' }

/**
 * A lesson in Read, Watch or Terminal mode (Lesson + CodeLesson artboards).
 * The author preview renders this same page with a Draft banner. Lesson text
 * is server-rendered; only the islands the lesson's blocks need hydrate.
 *
 * The shell is the app's (decision 022): the sticky AppBar with the lesson
 * sub-bar as its second row, and the reward XP island in the bar's XP slot.
 */
export function LessonPage(handle: Handle<{ view: LessonView; issues?: string[]; reward?: RewardNotice }>) {
  return () => {
    let { view, issues, reward } = handle.props
    let { course, lesson, content, mode, viewer } = view
    let modes: LessonMode[] = hasVideo(content) ? ['read', 'watch', 'terminal'] : ['read', 'terminal']
    let segments: SegmentState[] = view.lessons.map((l) =>
      l.slug === lesson.slug ? (l.state === 'done' ? 'done' : 'current') : l.state === 'done' ? 'done' : 'upcoming',
    )
    let done = view.lessons.filter((l) => l.state === 'done').length
    let award = lesson.state === 'done' ? 0 : lessonAward(view)
    let gated = exercisesOf(content).length > 0
    let modeItems = modes.map((m) => ({ label: modeLabels[m], href: view.href.mode(m), current: m === mode }))
    let progressLabel = `Lesson ${view.index + 1} of ${view.total}, ${done} complete`

    return (
      <Layout
        title={`${content.title} · ${course.title}${view.draft ? ' (draft)' : ''}`}
        description={`Lesson ${view.index + 1} of ${view.total} in ${course.title}.`}
        canonicalPath={view.draft ? undefined : view.href.lesson(lesson.slug)}
        image={ogImage(`course-${course.slug}`, `${course.title}: a free ${APP_TITLE} course`)}
        // The title in the sub-bar is Unbounded 500, the lesson's first big text.
        preloadFonts={['unbounded-latin-500-normal.woff2']}
        currentPath={view.draft ? routes.author.index.href() : routes.courses.index.href()}
        head={<style innerHTML={unsafeHTML(pageStyles)} />}
        viewer={viewer}
        reward={reward}
        xp={
          viewer ? (
            <span data-rmx-key={view.key} mix={contentsStyle}>
              <LessonXp neurons={viewer.xp} award={award} />
            </span>
          ) : undefined
        }
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
            modes={modeItems}
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
        {mode === 'terminal' ? (
          <main id="main" tabIndex={-1} data-rmx-key={view.key} mix={[skipTargetStyle, workspaceMain]}>
            <LessonModes segments={segments} progressLabel={progressLabel} modes={modeItems} />
            <TerminalMode view={view} />
            <div mix={hasCode(content) ? undefined : soloFooter}>
              <LessonFooter view={view} gated={gated} issues={issues} />
            </div>
          </main>
        ) : (
          <div mix={bodyStyle}>
            <OutlineNav view={view} />
            <main id="main" tabIndex={-1} data-rmx-key={view.key} mix={[skipTargetStyle, mainStyle]}>
              <LessonModes segments={segments} progressLabel={progressLabel} modes={modeItems} />
              <OutlineDisclosure view={view} />
              {mode === 'watch' ? <WatchMode view={view} /> : <ReadMode view={view} />}
              <div mix={mode === 'watch' ? watchFooter : readFooter}>
                <LessonFooter view={view} gated={gated} issues={issues} />
              </div>
            </main>
          </div>
        )}
      </Layout>
    )
  }
}

/** Prev/next lesson navigation and the gated "lesson complete" key. */
function LessonFooter(handle: Handle<{ view: LessonView; gated: boolean; issues?: string[] }>) {
  return () => {
    let { view, gated, issues } = handle.props
    let { prev, next } = view
    // Quiz answers live in the URL (GET forms); carry them into the save.
    let fields = Object.entries(view.answers).flatMap(([quiz, keys]) =>
      keys.map((key): [string, string] => [fieldNames.quiz(quiz), key]),
    )
    if (view.mode !== 'read') fields.push(['mode', view.mode])
    return (
      <nav aria-label="Lesson navigation" mix={footerStyle}>
        {prev ? (
          <Keycap variant="ghost-mono" size="md" href={view.href.lesson(prev.slug)} mix={prevStyle}>
            <span aria-hidden="true">← </span>
            <span class="sr-only">Previous lesson: </span>
            {prev.title}
          </Keycap>
        ) : null}
        <LessonComplete
          gated={gated}
          form={view.completeForm ? { ...view.completeForm, fields } : undefined}
          issues={issues}
          passed={view.lesson.state === 'done'}
          href={next ? view.href.lesson(next.slug) : view.href.back}
          label={next ? `Next: ${next.title} →` : 'Finish the course →'}
          loginHref={view.viewer ? undefined : view.href.login}
        />
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
  /* Watch: the VideoPlayer island's player + transcript join the watch row,
     so the transcript sits under the video beside the side card (as drawn). */
  [data-watch] > div:first-child { display: contents; }
  [data-watch] > div:first-child > section:first-child { flex: 1 1 100%; }
  [data-watch] > div:first-child > section[aria-label="Transcript"] { flex: 999 1 420px; }
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
// The outline + lesson share the AppBar's column (decision 022).
const bodyStyle = css({
  display: 'flex',
  alignItems: 'flex-start',
  width: '100%',
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  [MOBILE]: { display: 'block' },
})
// The skip link's target takes focus (tabIndex -1) without drawing a ring round the page (decision 031).
const skipTargetStyle = css({ '&:focus': { outline: 'none' } })
const mainStyle = css({
  flex: '999 1 560px',
  minWidth: 0,
  padding: 'var(--space-10) var(--space-6) var(--space-30)',
  [MOBILE]: {
    padding: 'var(--space-6) var(--space-4) var(--space-24)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-5_5)',
  },
})
const workspaceMain = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-6)',
  padding: 'var(--space-4) var(--space-4) var(--space-12)',
})
const readFooter = css({ maxWidth: 'var(--read-width)', margin: 'var(--space-12) auto 0', [MOBILE]: { marginTop: 'var(--space-6)', width: '100%' } })
const watchFooter = css({ maxWidth: 'var(--watch-width)', margin: 'var(--space-12) auto 0', [MOBILE]: { marginTop: 'var(--space-6)', width: '100%' } })
const soloFooter = css({ width: '100%', maxWidth: '900px', margin: '0 auto' })
const footerStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--space-3)',
  paddingTop: 'var(--space-6)',
  borderTop: 'var(--border-w) solid var(--line-hair)',
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
