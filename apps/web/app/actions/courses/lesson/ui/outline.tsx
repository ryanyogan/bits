import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { LessonNode } from '@bits/ui/lesson-node'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import type { LessonView } from '../lesson-view.ts'
import { PASSED_ROOT } from '../public/lesson-state.ts'
import { OutlineScroll } from '../public/outline-scroll.tsx'

const stateText = { done: 'completed', current: 'in progress', next: 'not started' } as const

/** Matches inside a page whose checks just passed (set by the lesson islands). */
const PASSED = `${PASSED_ROOT} &`

/** The course's lessons (components §10.4) as an ordered list of links. Static. */
function OutlineList(handle: Handle<{ view: LessonView }>) {
  return () => {
    let { view } = handle.props
    return (
      <ol mix={listStyle}>
        {view.lessons.map((lesson) => {
          let viewing = lesson.slug === view.lesson.slug
          // The open lesson's node turns into a ✓ once its checks pass.
          let canPass = viewing && lesson.state !== 'done'
          return (
            <li key={lesson.slug}>
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
              </a>
            </li>
          )
        })}
      </ol>
    )
  }
}

/**
 * Desktop sidebar (≥760px). Sticky under the header stack (`--shell-h`) at
 * the screen's height, so it stays put while the lesson scrolls; a long
 * outline scrolls inside it (decision 022).
 */
export function OutlineNav(handle: Handle<{ view: LessonView }>) {
  return () => {
    let { view } = handle.props
    return (
      <nav aria-label="Lessons" mix={navStyle}>
        <h2 mix={headingStyle}>
          <span>In this course</span>
          <span aria-hidden="true" mix={countStyle}>{`${String(view.index + 1).padStart(2, '0')} / ${String(view.total).padStart(2, '0')}`}</span>
        </h2>
        <OutlineList view={view} />
        <span data-rmx-key={view.key} hidden>
          <OutlineScroll />
        </span>
      </nav>
    )
  }
}

/** Mobile (<760px, resolutions §8): a closed-by-default disclosure above the content. No JS. */
export function OutlineDisclosure(handle: Handle<{ view: LessonView }>) {
  return () => {
    let { view } = handle.props
    return (
      <nav aria-label="Lessons" mix={disclosureNav}>
        <details mix={detailsStyle}>
          <summary mix={summaryStyle}>
            <span>{`Lesson ${view.index + 1} of ${view.total} · In this course`}</span>
            <span aria-hidden="true" mix={chevronStyle}>
              ▾
            </span>
          </summary>
          <OutlineList view={view} />
        </details>
      </nav>
    )
  }
}

const MOBILE = '@media (max-width: 759px)'

// The column's first cell: its hairline is the outline's right edge.
const navStyle = css({
  position: 'sticky',
  top: 'var(--shell-h)',
  height: 'calc(100dvh - var(--shell-h))',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  scrollbarWidth: 'thin',
  // Keyboard focus moving through a long outline stays clear of its edges.
  scrollPaddingBlock: 'var(--space-12)',
  display: 'flex',
  flexDirection: 'column',
  borderRight: 'var(--border-w) solid var(--line-cell)',
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
const countStyle = css({ color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' })
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

const disclosureNav = css({ display: 'none', [MOBILE]: { display: 'block' } })
// Phones: a strip of the column, closed by default; open, the rows hang under it.
const detailsStyle = css({
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  '&[open] > summary': { borderBottom: 'var(--border-w) solid var(--line-cell)' },
  '&[open] > summary > span:last-child': { transform: 'rotate(180deg)' },
  '& li:last-child > a': { borderBottom: 0 },
})
const summaryStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--section-pad-x)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
  cursor: 'pointer',
  listStyle: 'none',
  '&::-webkit-details-marker': { display: 'none' },
  '&:hover': { color: 'var(--text)', background: 'var(--fill-hover)' },
  '&:focus-visible': { outlineOffset: 'var(--focus-offset-inset)' },
  '@media (max-width: 480px)': { paddingInline: 'var(--space-4)' },
})
const chevronStyle = css({ transition: 'transform var(--duration-fast)' })
