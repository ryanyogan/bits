import type { Handle } from 'remix/component'
import { css, unsafeHTML } from 'remix/component'
import { Document } from '@bits/ui/document'
import { Keycap } from '@bits/ui/keycap'
import { LessonBar } from '@bits/ui/lesson-bar'
import type { SegmentState } from '@bits/ui/progress-bar'

import { platform } from '#platform'

import { pageTitle } from '../../../config.ts'
import { exercisesOf, hasCode } from './content.ts'
import { lessonAward, type LessonMode, type LessonView } from './lesson-view.ts'
import { LessonComplete } from './public/lesson-complete.tsx'
import { PASSED_ROOT } from './public/lesson-state.ts'
import { LessonXp } from './public/lesson-xp.tsx'
import { OutlineDisclosure, OutlineNav } from './ui/outline.tsx'
import { ReadMode } from './ui/read-mode.tsx'
import { TerminalMode } from './ui/terminal-mode.tsx'
import { WatchMode } from './ui/watch-mode.tsx'

const modeLabels: Record<LessonMode, string> = { read: 'Read', watch: 'Watch', terminal: 'Terminal' }

/**
 * A lesson in Read, Watch or Terminal mode (Lesson + CodeLesson artboards).
 * The author preview renders this same page with a Draft banner. Lesson text
 * is server-rendered; only the islands the lesson's blocks need hydrate.
 */
export function LessonPage(handle: Handle<{ view: LessonView }>) {
  return () => {
    let { view } = handle.props
    let { course, lesson, content, mode, viewer } = view
    let modes: LessonMode[] = content.video ? ['read', 'watch', 'terminal'] : ['read', 'terminal']
    let segments: SegmentState[] = view.lessons.map((l) =>
      l.slug === lesson.slug ? (l.state === 'done' ? 'done' : 'current') : l.state === 'done' ? 'done' : 'upcoming',
    )
    let done = view.lessons.filter((l) => l.state === 'done').length
    let award = lesson.state === 'done' ? 0 : lessonAward(view)
    let gated = exercisesOf(content).length > 0
    let title = pageTitle(`${content.title} · ${course.title}${view.draft ? ' (draft)' : ''}`)

    return (
      <Document
        assets={platform.assets}
        title={title}
        description={`Lesson ${view.index + 1} of ${view.total} in ${course.title}.`}
        head={<style innerHTML={unsafeHTML(pageStyles)} />}
      >
        <a href="#main" mix={skipLinkStyle}>
          Skip to content
        </a>
        <LessonBar
          backHref={view.href.back}
          backLabel={view.draft ? 'Back to the build' : 'Back to course'}
          context={`${course.title} · Lesson ${view.index + 1} of ${view.total}`}
          title={content.title}
          titleAs="h1"
          segments={segments}
          progressLabel={`Lesson ${view.index + 1} of ${view.total}, ${done} complete`}
          modes={modes.map((m) => ({ label: modeLabels[m], href: view.href.mode(m), current: m === mode }))}
          xp={viewer ? <LessonXp lessonKey={view.key} neurons={viewer.xp} award={award} /> : undefined}
        />
        {view.draft ? (
          <p mix={draftStyle}>
            <span>{`DRAFT · ${view.draft.version} preview — not visible to learners`}</span>
            <a href={view.draft.backHref} mix={draftLink}>
              Back to validation →
            </a>
          </p>
        ) : null}
        {mode === 'terminal' ? (
          <main id="main" mix={workspaceMain}>
            <TerminalMode view={view} />
            <div mix={hasCode(content) ? undefined : soloFooter}>
              <LessonFooter view={view} gated={gated} />
            </div>
          </main>
        ) : (
          <div mix={bodyStyle}>
            <OutlineNav view={view} />
            <main id="main" mix={mainStyle}>
              <OutlineDisclosure view={view} />
              {mode === 'watch' ? <WatchMode view={view} /> : <ReadMode view={view} />}
              <div mix={mode === 'watch' ? watchFooter : readFooter}>
                <LessonFooter view={view} gated={gated} />
              </div>
            </main>
          </div>
        )}
      </Document>
    )
  }
}

/** Prev/next lesson navigation and the gated "lesson complete" key. */
function LessonFooter(handle: Handle<{ view: LessonView; gated: boolean }>) {
  return () => {
    let { view, gated } = handle.props
    let { prev, next } = view
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
          lessonKey={view.key}
          gated={gated}
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

const skipLinkStyle = css({
  position: 'absolute',
  left: 'var(--space-4)',
  top: '-100px',
  zIndex: 10,
  padding: 'var(--space-3) var(--space-4)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--volt)',
  color: 'var(--on-volt)',
  '&:focus': { top: 'var(--space-4)' },
})
// Page-level overrides in the `app` layer (decision 007). Each css() mixin
// gets its own `rmx` sublayer, so overrides that reach into another
// component's markup can't win from a mixin. Static, trusted CSS.
const pageStyles = `@layer app {
  /* The open lesson's progress segment fills volt once its checks pass. */
  ${PASSED_ROOT} header [role="img"] > [data-state="current"] { background: var(--volt); }
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
  borderBottom: '1px solid var(--warn-line)',
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
const bodyStyle = css({
  flex: 1,
  display: 'flex',
  alignItems: 'flex-start',
  [MOBILE]: { display: 'block' },
})
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
  borderTop: '1px solid var(--line-hair)',
})
const prevStyle = css({ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
