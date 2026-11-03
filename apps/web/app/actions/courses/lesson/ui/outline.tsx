import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { LESSON_NARROW } from '@bits/ui/lesson-bar'
import { LessonNode } from '@bits/ui/lesson-node'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import type { LessonView } from '../lesson-view.ts'
import { PASSED_ROOT } from '../public/lesson-state.ts'
import { OutlineScroll } from '../public/outline-scroll.tsx'

const stateText = { done: 'completed', current: 'in progress', next: 'not started' } as const

/** Matches inside a page whose checks just passed (set by the lesson islands). */
const PASSED = `${PASSED_ROOT} &`

/** Reading minutes for a lesson at the depth being read. */
export function lessonMinutes(view: LessonView, lesson: LessonView['lessons'][number]): number {
  return lesson.minsByDepth?.[view.depth] ?? lesson.mins
}

/**
 * The course's lessons (components §10.4) as ordered lists of links, under
 * the course's module headings when it has more than one, each with its
 * reading minutes (decision 067), as LMS outlines show them. Static.
 */
function OutlineList(handle: Handle<{ view: LessonView }>) {
  return () => {
    let { view } = handle.props
    let modules = view.course.modules
    let grouped = modules.length > 1
    return (
      <div mix={groupsStyle}>
        {modules.map((module) => (
          <div key={module.n}>
            {grouped ? <p mix={moduleStyle}>{module.title}</p> : null}
            <ol mix={listStyle}>
              {module.lessons.map((lesson) => (
                <OutlineItem key={lesson.slug} view={view} lesson={lesson} />
              ))}
            </ol>
          </div>
        ))}
      </div>
    )
  }
}

function OutlineItem(handle: Handle<{ view: LessonView; lesson: LessonView['lessons'][number] }>) {
  return () => {
    let { view, lesson } = handle.props
    let viewing = lesson.slug === view.lesson.slug
    // The open lesson's node turns into a ✓ once its checks pass.
    let canPass = viewing && lesson.state !== 'done'
    let mins = lessonMinutes(view, lesson)
    return (
      <li>
        <a
          href={view.href.lesson(lesson.slug)}
          aria-current={viewing ? 'page' : undefined}
          data-rmx-prefetch={prefetchFor(view.href.lesson(lesson.slug))}
          data-state={lesson.state}
          mix={itemStyle}
        >
          {canPass ? (
            <>
              <span mix={pendingOnly}>
                <LessonNode size={20} state={lesson.state} n={lesson.n} />
              </span>
              <span mix={passedOnly}>
                <LessonNode size={20} state="current" passed />
              </span>
            </>
          ) : (
            <LessonNode size={20} state={lesson.state} n={lesson.n} />
          )}
          <span mix={titleStyle}>
            {lesson.title}
            <span mix={canPass ? pendingOnly : undefined}>
              <span class="sr-only">{`, ${stateText[lesson.state]}`}</span>
            </span>
            {canPass ? (
              <span mix={passedOnly}>
                <span class="sr-only">, completed</span>
              </span>
            ) : null}
          </span>
          {mins > 0 ? (
            <span mix={minsStyle}>
              {mins}
              <span aria-hidden="true">m</span>
              <span class="sr-only"> minutes</span>
            </span>
          ) : null}
        </a>
      </li>
    )
  }
}

/**
 * Desktop sidebar (≥1024px). Sticky under the header stack (`--shell-h`),
 * at most the screen's height, so it stays put while the lesson scrolls; a
 * long outline scrolls inside it (decision 022). A max-height, not a height
 * (decision 067): a box as tall as the screen ran out of room at the end of
 * the page and slid up under the header, hiding its first rows.
 */
export function OutlineNav(handle: Handle<{ view: LessonView }>) {
  return () => {
    let { view } = handle.props
    return (
      <nav aria-label="Lessons" mix={navStyle}>
        {/* Position shows once, in the lesson bar (decision 067). */}
        <h2 mix={headingStyle}>In this course</h2>
        <OutlineList view={view} />
        <span data-rmx-key={view.key} hidden>
          <OutlineScroll />
        </span>
      </nav>
    )
  }
}

/**
 * Under 1024px (resolutions §8; decision 067): a closed-by-default disclosure, the end
 * cell of the page's one chrome row (`LessonRow`'s `aside`, decision 051).
 * Open, its list hangs under the whole row, over the lesson. No JS.
 */
export function OutlineDisclosure(handle: Handle<{ view: LessonView }>) {
  return () => {
    let { view } = handle.props
    return (
      <nav aria-label="Lessons" mix={disclosureNav}>
        <details mix={detailsStyle}>
          <summary mix={summaryStyle}>
            <span>
              <span mix={wideWord}>Lesson </span>
              {`${view.index + 1} of ${view.total}`}
            </span>
            <span aria-hidden="true" mix={chevronStyle}>
              ▾
            </span>
          </summary>
          <div mix={panelStyle}>
            <OutlineList view={view} />
          </div>
        </details>
      </nav>
    )
  }
}

// Under 1024px the lesson has no sidebar, only the disclosure (decision 067).
const MOBILE = LESSON_NARROW

// The column's first cell. The hairline between it and the lesson is the
// lesson column's left edge (lesson-page.tsx), so it runs the page's height.
const navStyle = css({
  position: 'sticky',
  top: 'var(--shell-h)',
  maxHeight: 'calc(100dvh - var(--shell-h))',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  scrollbarWidth: 'thin',
  // Keyboard focus moving through a long outline stays clear of its edges.
  scrollPaddingBlock: 'var(--space-12)',
  display: 'flex',
  flexDirection: 'column',
  [MOBILE]: { display: 'none' },
})
// A header strip like a RuledSection's: mono label … position.
const headingStyle = css({
  position: 'sticky',
  top: 0,
  zIndex: 1,
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
  minHeight: 'var(--touch-target)',
  boxSizing: 'border-box',
  padding: 'var(--space-2) var(--space-5)',
  background: 'var(--ink)',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  fontWeight: 400,
  lineHeight: 1.4,
  color: 'var(--muted)',
})
const groupsStyle = css({ display: 'flex', flexDirection: 'column' })
// A module heading: a quiet mono strip between the lesson rows.
const moduleStyle = css({
  margin: 0,
  padding: 'var(--space-4) var(--space-5) var(--space-2)',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-11)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--dim)',
})
const minsStyle = css({
  marginLeft: 'auto',
  flex: 'none',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-11)',
  color: 'var(--dim)',
  fontVariantNumeric: 'tabular-nums',
})
// One row per lesson, hairlines between them: the outline is a ruled list.
const listStyle = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' })
const itemStyle = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  minHeight: 'var(--control-lg)',
  boxSizing: 'border-box',
  padding: 'var(--space-2) var(--space-5)',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  textDecoration: 'none',
  fontSize: 'var(--fs-14)',
  lineHeight: 1.35,
  color: 'var(--text-quiet)',
  transition: 'background-color var(--duration-fast)',
  '&[data-state="done"]': { color: 'var(--muted)' },
  '&:hover': { background: 'var(--fill-hover)', color: 'var(--text)' },
  '&:focus-visible': { outlineOffset: 'var(--focus-offset-inset)' },
  // The open lesson: a quiet ion step and a 2px ion bar on the leading edge.
  '&[aria-current="page"], &[aria-current="page"]:hover': {
    background: 'var(--ion-a08)',
    color: 'var(--text)',
    boxShadow: 'inset 2px 0 0 var(--ion)',
  },
  // Forced colours drop the tint, so the lesson you're on needs a frame (decision 025).
  '@media (forced-colors: active)': { '&[aria-current="page"]': { outline: 'var(--focus-outline-w) solid Highlight', outlineOffset: '-2px' } },
})
const titleStyle = css({ minWidth: 0 })
const pendingOnly = css({ display: 'contents', [PASSED]: { display: 'none' } })
const passedOnly = css({ display: 'none', [PASSED]: { display: 'contents' } })

const disclosureNav = css({ display: 'none', [MOBILE]: { display: 'flex' } })
// A cell at the row's end: a hairline on its leading edge, the row's height.
const detailsStyle = css({
  display: 'flex',
  '&[open] > summary': { background: 'var(--fill-hover)', color: 'var(--text)' },
  '&[open] > summary > span:last-child': { transform: 'rotate(180deg)' },
  '& div:last-child > ol > li:last-child > a': { borderBottom: 0 },
})
// The open panel hangs under the whole row (LessonRow is the positioned
// box), over the lesson rather than pushing it down.
const panelStyle = css({
  position: 'absolute',
  zIndex: 3,
  top: '100%',
  insetInline: 0,
  maxHeight: 'calc(100svh - var(--shell-h) - var(--control-lg))',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  background: 'var(--ink)',
  borderBlock: 'var(--border-w) solid var(--line-cell)',
})
const summaryStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-4)',
  borderLeft: 'var(--border-w) solid var(--line-cell)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  whiteSpace: 'nowrap',
  color: 'var(--muted)',
  cursor: 'pointer',
  listStyle: 'none',
  '&::-webkit-details-marker': { display: 'none' },
  '&:hover': { color: 'var(--text)', background: 'var(--fill-hover)' },
  '&:focus-visible': { outlineOffset: 'var(--focus-offset-inset)' },
  '@media (forced-colors: active)': { borderColor: 'GrayText' },
})
// "Lesson 3 of 8" → "3 of 8" where the depth tabs leave no room.
const wideWord = css({ '@media (max-width: 400px)': { display: 'none' } })
const chevronStyle = css({ transition: 'transform var(--duration-fast)', '@media (prefers-reduced-motion: reduce)': { transition: 'none' } })
