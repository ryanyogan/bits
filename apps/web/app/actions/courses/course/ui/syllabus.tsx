import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'
import { LessonNode } from '@bits/ui/lesson-node'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import { kindLabels, type SyllabusLesson, type SyllabusModuleView } from '../course-data.ts'
import { stripHeading } from './strip.ts'

const stateText = { done: 'completed', current: 'in progress', next: 'not started' } as const

/**
 * Course.md §3a Syllabus / components §10.2–10.3: one `<ol>` per module, a
 * trace line through the nodes, and the ResumeCallout under the current
 * lesson. On the grid (decision 047) it is one cell: a mono strip heading,
 * then each module as a header row and lesson rows between hairlines, with
 * the trace running down through the square nodes. Static.
 */
export function Syllabus(handle: Handle<{ modules: SyllabusModuleView[] }>) {
  return () => (
    <section aria-labelledby="syllabus-heading" mix={sectionStyle}>
      <h2 id="syllabus-heading" mix={stripHeading}>
        Syllabus
      </h2>
      {handle.props.modules.map((module) => (
        <div key={module.n} mix={moduleStyle}>
          <h3 mix={moduleHeader}>
            <span mix={moduleN}>{module.n}</span>
            <span class="sr-only">: </span>
            <span mix={moduleTitle}>{module.title}</span>
          </h3>
          <ol mix={listStyle}>
            {module.lessons.map((lesson) => (
              <SyllabusRow key={lesson.slug} lesson={lesson} />
            ))}
          </ol>
        </div>
      ))}
    </section>
  )
}

function SyllabusRow(handle: Handle<{ lesson: SyllabusLesson }>) {
  return () => {
    let { lesson } = handle.props
    return (
      <li mix={itemStyle}>
        {lesson.trace !== 'none' ? (
          <span
            aria-hidden="true"
            data-trace={lesson.trace}
            mix={traceStyle}
          />
        ) : null}
        <a
          href={lesson.href}
          aria-current={lesson.state === 'current' ? 'step' : undefined}
          data-rmx-prefetch={prefetchFor(lesson.href)}
          data-state={lesson.state}
          mix={rowStyle}
        >
          <span mix={slotStyle}>
            <LessonNode state={lesson.state} size={30} />
          </span>
          <span mix={bodyStyle}>
            <span data-state={lesson.state} mix={titleStyle}>
              {`${lesson.n}. ${lesson.title}`}
              <span class="sr-only">{` — ${stateText[lesson.state]}`}</span>
            </span>
            <span mix={kindsStyle}>
              {lesson.kinds.map((kind) => (
                <span key={kind} style={{ color: kindLabels[kind].color }}>
                  <span aria-hidden="true">{`${kindLabels[kind].glyph} `}</span>
                  {kindLabels[kind].label}
                </span>
              ))}
            </span>
          </span>
          <span mix={xpStyle}>
            {`${lesson.mins} min · +${lesson.xp}`}
            <span class="sr-only"> neurons</span>
          </span>
        </a>
        {lesson.resume ? (
          <div mix={calloutStyle}>
            <p mix={calloutText}>
              {lesson.resume.exercise ? (
                <>
                  You stopped at the exercise: <span mix={calloutEm}>{lesson.resume.exercise}</span>
                </>
              ) : (
                <>
                  You stopped partway through <span mix={calloutEm}>{lesson.title}</span>.
                </>
              )}
            </p>
            <div mix={calloutRow}>
              <Keycap href={lesson.resume.href} mix={calloutKey}>
                Pick up here →
              </Keycap>
              <span mix={savedStyle}>your draft prompt is saved</span>
            </div>
          </div>
        ) : null}
      </li>
    )
  }
}

const MOBILE = '@media (max-width: 480px)'
// The node slot's left edge, and its centre: the row's inset plus half the 40px slot.
const SLOT_LEFT = 'var(--section-pad-x)'
const NODE_CENTRE_Y = 'calc(var(--space-3) + 20px)'

const sectionStyle = css({ display: 'flex', flexDirection: 'column', minWidth: 0 })
const moduleStyle = css({
  display: 'flex',
  flexDirection: 'column',
  '& + &': { borderTop: 'var(--border-w) solid var(--line-cell)' },
})
const moduleHeader = css({
  margin: 0,
  display: 'flex',
  alignItems: 'baseline',
  gap: 'var(--space-3_5)',
  padding: 'var(--space-6) var(--section-pad-x) var(--space-3)',
  fontWeight: 'inherit',
  lineHeight: 'normal',
})
const moduleN = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--tone)' })
const moduleTitle = css({
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 'var(--fs-18)',
  letterSpacing: 'var(--tracking-title)',
})
const listStyle = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' })
const itemStyle = css({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  borderTop: 'var(--border-w) solid var(--line-cell)',
})

// The trace: one segment per lesson, from its node centre to the next node's
// centre, so it stays exact even when the resume callout sits between rows.
const traceStyle = css({
  position: 'absolute',
  zIndex: 1,
  left: `calc(${SLOT_LEFT} + 19px)`,
  top: NODE_CENTRE_Y,
  bottom: `calc(${NODE_CENTRE_Y} * -1)`,
  width: 'var(--border-w-strong)',
  background: 'var(--line-strong)',
  pointerEvents: 'none',
  '&[data-trace="done"]': { background: 'var(--volt-a60)' },
  '&[data-trace="tail"]': { bottom: 'var(--space-6)' },
})

const rowStyle = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  padding: `var(--space-3) var(--section-pad-x) var(--space-3) ${SLOT_LEFT}`,
  textDecoration: 'none',
  color: 'var(--text)',
  transition: 'background-color var(--duration-fast)',
  '&:hover': { color: 'var(--text)', background: 'var(--fill-row-hover)' },
  // The current lesson: a faint ion ground and an ion edge inside the cell.
  '&[data-state="current"]': {
    background: 'var(--ion-a06)',
    boxShadow: 'inset var(--border-w-strong) 0 0 var(--ion)',
  },
  '&:focus-visible': { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset-inset)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  [MOBILE]: { flexWrap: 'wrap', rowGap: 'var(--space-1)' },
})
// Above the trace, so the line stops at each node's edge.
const slotStyle = css({ position: 'relative', zIndex: 2, flex: 'none', width: '40px', height: '40px', display: 'grid', placeItems: 'center' })
const bodyStyle = css({ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' })
const titleStyle = css({
  fontSize: 'var(--fs-16)',
  color: 'var(--text)',
  '&[data-state="done"]': { color: 'var(--muted)' },
  '&[data-state="current"]': { fontWeight: 600 },
})
const kindsStyle = css({
  display: 'flex',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
})
const xpStyle = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
  whiteSpace: 'nowrap',
  // Under the title: the 40px node slot plus the row's gap.
  [MOBILE]: { flexBasis: '100%', paddingLeft: 'calc(40px + var(--space-4))' },
})

const calloutStyle = css({
  position: 'relative',
  zIndex: 2,
  margin: `var(--space-1_5) var(--section-pad-x) var(--space-4) calc(${SLOT_LEFT} + 40px + var(--space-4))`,
  padding: 'var(--space-4_5)',
  background: 'var(--surface)',
  border: 'var(--border-w) solid var(--line-cell)',
  boxShadow: 'inset 0 var(--border-w-strong) 0 var(--ion)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3_5)',
  [MOBILE]: { marginLeft: SLOT_LEFT },
})
const calloutText = css({ margin: 0, fontSize: 'var(--fs-15)', lineHeight: 1.55, color: 'var(--text-body)' })
const calloutEm = css({ color: 'var(--text)' })
const calloutRow = css({ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' })
const calloutKey = css({ padding: '0 var(--space-4_5)', [MOBILE]: { flex: '1 1 100%' } })
const savedStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
