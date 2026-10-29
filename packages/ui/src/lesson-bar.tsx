import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { BackButton } from './back-button.tsx'
import { Crosshair } from './crosshair.tsx'
import { FOCUS, FORCED_COLORS } from './lib/states.ts'
import { SegmentedProgress, type SegmentState } from './progress-bar.tsx'
import { SegmentedTabs, type SegmentedTabItem } from './segmented-tabs.tsx'
import { XpPill } from './xp-pill.tsx'

export interface LessonBarProps {
  backHref: string
  backLabel?: string
  /** e.g. "Tokens & temperature · Lesson 6 of 8". */
  context: string
  title: string
  segments: SegmentState[]
  progressLabel: string
  modes: SegmentedTabItem[]
  /** The viewer's neurons, shown as an XpPill at the row's end (hidden at ≤480px). */
  neurons?: number
  /**
   * Replaces the XpPill slot, e.g. an island that re-renders the pill after a
   * reward. The bar wraps it in its slot, which hides at ≤480px.
   */
  xp?: RemixNode
  /** Render the lesson title as the page's `<h1>` (lesson pages) instead of a span. */
  titleAs?: 'span' | 'h1'
  /**
   * `shell`: the lesson sub-bar inside the AppBar's sticky header (pass it as
   * `AppBar`'s `sub`; decision 022). One row, `--lessonbar-h` tall, aligned
   * to the AppBar's column, no glass of its own. Under 760px it keeps back +
   * the title (two lines, never cut mid-word) and draws the segmented
   * progress as a strip along its bottom edge; render `LessonModes` at the
   * top of the page for the tabs (decision 051). `sticky`: a standalone glass
   * bar pinned at the top (no AppBar). `static`: in-page demos.
   */
  position?: 'shell' | 'sticky' | 'static'
  mix?: MixInput<HTMLElement>
}

/**
 * The compact lesson header (components §3.1c; canonical for Read, Watch and
 * Terminal modes): back, course context + lesson title, segmented progress,
 * mode tabs (links) and neurons. Static. On lesson pages it is the AppBar's
 * sub-bar (`position="shell"`) and the only place the header shows neurons:
 * the AppBar carries no XP or streak pill (decision 048).
 */
export function LessonBar(handle: Handle<LessonBarProps>) {
  return () => {
    let {
      backHref,
      backLabel = 'Back to course',
      context,
      title,
      segments,
      progressLabel,
      modes,
      neurons,
      xp,
      titleAs = 'span',
      position = 'sticky',
      mix,
    } = handle.props
    let shell = position === 'shell'
    let children = (
      <>
        <BackButton href={backHref} label={backLabel} />
        <div mix={titleBlock}>
          <span mix={contextStyle}>{context}</span>
          {titleAs === 'h1' ? <h1 mix={titleStyle}>{title}</h1> : <span mix={titleStyle}>{title}</span>}
        </div>
        <div data-lesson-progress mix={[progressStyle, shell ? wideOnly : undefined]}>
          <SegmentedProgress segments={segments} label={progressLabel} />
        </div>
        {shell ? (
          // A wrapper, not `mix`: SegmentedTabs' own display rule would win.
          <div mix={wideOnly}>
            <SegmentedTabs label="Lesson format" items={modes} />
          </div>
        ) : (
          <SegmentedTabs label="Lesson format" items={modes} />
        )}
        {xp !== undefined ? <div mix={[xpSlot, lessonBarXpStyle]}>{xp}</div> : neurons !== undefined ? <XpPill neurons={neurons} mix={lessonBarXpStyle} /> : null}
      </>
    )
    if (shell) {
      // Inside the AppBar's <header> (one banner landmark), so not a <header>.
      // The row is the page's ruled column (decision 047): the rails run
      // through it, back and the mode tabs are cells at either end.
      return (
        <div mix={[shellStyle, mix]}>
          <div mix={shellInner}>
            <Crosshair placement="top-start" mix={shellMark} />
            <Crosshair placement="top-end" mix={shellMark} />
            <div mix={backCell}>
              <BackButton href={backHref} label={backLabel} mix={backFill} />
            </div>
            <div mix={titleBlock}>
              <span mix={contextStyle}>{context}</span>
              {titleAs === 'h1' ? <h1 mix={titleStyle}>{title}</h1> : <span mix={titleStyle}>{title}</span>}
            </div>
            <div data-lesson-progress mix={[progressStyle, wideOnly]}>
              <SegmentedProgress segments={segments} label={progressLabel} />
            </div>
            {/* Phones: the progress rides the bar's bottom edge, so it stays in view and takes no row. */}
            <div data-lesson-progress mix={phoneProgress}>
              <SegmentedProgress segments={segments} label={progressLabel} />
            </div>
            <div mix={[tabsCell, wideOnly]}>
              <SegmentedTabs label="Lesson format" items={modes} />
            </div>
            {xp !== undefined || neurons !== undefined ? (
              // The pill closes the row as its own cell, after the tabs.
              <div mix={[xpCell, lessonBarXpStyle]}>{xp !== undefined ? xp : <XpPill neurons={neurons ?? 0} />}</div>
            ) : null}
          </div>
        </div>
      )
    }
    return <header mix={[barStyle, position === 'sticky' ? stickyStyle : undefined, mix]}>{children}</header>
  }
}

export interface LessonModesProps {
  modes: SegmentedTabItem[]
  /**
   * The row's end, e.g. the lesson outline disclosure ("Lesson 3 of 8 ▾").
   * The row is `position: relative`, so an open disclosure can hang its
   * list under the whole row.
   */
  aside?: RemixNode
  mix?: MixInput<HTMLElement>
}

/**
 * The shell sub-bar's mode tabs for screens under 760px, where the sticky
 * header keeps back + title and draws the progress along its edge (decisions
 * 022 and 051). Put it at the top of the lesson: the page's one row of
 * chrome under the header, with the outline as its `aside`. It scrolls with
 * the page and hides at 760px and up. Static.
 */
export function LessonModes(handle: Handle<LessonModesProps>) {
  return () => {
    let { modes, aside, mix } = handle.props
    return (
      <div mix={[modesRow, mix]}>
        <SegmentedTabs label="Lesson format" items={modes} />
        {aside !== undefined ? <div mix={modesAside}>{aside}</div> : null}
      </div>
    )
  }
}

const NARROW = '@media (max-width: 480px)'
/** The shell's breakpoint: the AppBar menu and the outline disclosure switch here too. */
const SHELL_NARROW = '@media (max-width: 759.98px)'

const barStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-5)',
  flexWrap: 'wrap',
  padding: 'var(--space-3) var(--space-6)',
  background: 'var(--lessonbar-bg)',
  borderBottom: 'var(--border-w) solid var(--line-bar)',
  [NARROW]: { gap: 'var(--space-2) var(--space-3)', padding: 'var(--space-1_5) var(--page-gutter)' },
})
const stickyStyle = css({
  position: 'sticky',
  top: 0,
  zIndex: 5,
  // Flat (decision 047): an opaque ground instead of glass blur.
  background: 'var(--ink)',
})
// A full-bleed hairline separates the AppBar's row from this one.
// Opaque: with no blur, lesson text scrolling under a translucent row reads
// through it.
const shellStyle = css({ borderTop: 'var(--border-w) solid var(--line-section)', background: 'var(--ink)' })
const shellInner = css({
  position: 'relative',
  boxSizing: 'border-box',
  // Fixed height (tokens: --lessonbar-h) so the outline's sticky offset agrees.
  height: 'calc(var(--lessonbar-h) - var(--border-w))',
  // The PageFrame's column: same width, same rails.
  width: 'min(calc(100% - 2 * var(--frame-inset)), var(--frame-max))',
  margin: '0 auto',
  borderInline: 'var(--border-w) solid var(--line-rail)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-5)',
  [SHELL_NARROW]: { gap: 'var(--space-3)' },
  [FORCED_COLORS]: { borderColor: 'GrayText' },
})
// The marks sit on the row's top hairline, which is the shell's border.
const shellMark = css({ top: 'calc((var(--mark-size) + 1px) / -2)' })
// Back is the row's first cell, a square the row's height.
const backCell = css({
  flex: 'none',
  alignSelf: 'stretch',
  display: 'grid',
  placeItems: 'center',
  width: 'calc(var(--lessonbar-h) - var(--border-w))',
  borderRight: 'var(--border-w) solid var(--line-cell)',
})
// The back link is the whole cell: no box of its own, a fill step on hover,
// and the focus outline inside the cell's hairlines.
const backFill = css({
  width: '100%',
  height: '100%',
  border: 0,
  [FOCUS]: { outlineOffset: 'var(--focus-offset-inset)' },
})
// The mode tabs close the row as its last cell.
const tabsCell = css({
  alignSelf: 'stretch',
  display: 'flex',
  alignItems: 'center',
  paddingInline: 'var(--space-4)',
  borderLeft: 'var(--border-w) solid var(--line-cell)',
  '&:last-child': { paddingRight: 'var(--space-3)' },
  // Repeated from wideOnly: this mixin is declared later, so its layer wins.
  [SHELL_NARROW]: { display: 'none' },
})
// The neurons cell: last in the row, pushed to the end when the tabs hide (<760px).
const xpCell = css({
  alignSelf: 'stretch',
  display: 'flex',
  alignItems: 'center',
  paddingInline: 'var(--space-3)',
  [SHELL_NARROW]: { marginLeft: 'auto' },
  borderLeft: 'var(--border-w) solid var(--line-cell)',
})
const xpSlot = css({ display: 'flex', alignItems: 'center' })
const wideOnly = css({ [SHELL_NARROW]: { display: 'none' } })
// ≤480px (Lesson spec, 360px): row 1 back + title (truncated), row 2 mode tabs + progress.
const titleBlock = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-0_5)',
  minWidth: 0,
  flex: '0 1 auto',
  // Fills row 1 beside the back button, pushing tabs + progress to row 2.
  [NARROW]: { flex: '1 1 calc(100% - var(--touch-target) - var(--space-3))', gap: 0 },
})
const contextStyle = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  [SHELL_NARROW]: { fontSize: 'var(--fs-11)', lineHeight: 1.3 },
  // ≤480px the title takes the whole bar; the course is one tap back and
  // the page's chrome row says "Lesson n of N" (decision 051).
  [NARROW]: { display: 'none' },
})
const titleStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 'var(--fs-17)',
  letterSpacing: 'var(--tracking-title)',
  // Two lines before it truncates, never "Attention: how it keeps tr…"
  // (decision 051): context + two lines at 17/1.15 fit the 64px bar.
  lineHeight: 1.15,
  overflow: 'hidden',
  textWrap: 'balance',
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: '2',
  // Phones: context (11/1.3) + two lines at 15/1.15 fit the 56px bar; ≤480px
  // the context hides and the two lines sit alone.
  [SHELL_NARROW]: { fontSize: 'var(--fs-15)' },
})
const progressStyle = css({
  flex: '1 1 160px',
  minWidth: '72px',
  maxWidth: '280px',
  margin: '0 auto',
  [NARROW]: { order: 10, flex: '1 1 72px', maxWidth: 'none', margin: 0 },
})
const modesRow = css({
  display: 'none',
  [SHELL_NARROW]: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    // The tabs' own track aligns to the start of a column; here it centres in the row.
    '& > nav': { alignSelf: 'center' },
  },
})
const modesAside = css({ marginLeft: 'auto', minWidth: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'stretch' })
// The phone progress strip: segments 3px tall on the bar's bottom hairline,
// inside the rails. Hidden from 760px, where the row has its own progress cell.
const phoneProgress = css({
  display: 'none',
  [SHELL_NARROW]: {
    display: 'block',
    position: 'absolute',
    insetInline: 0,
    bottom: 0,
    '& > [role="img"] > span': { height: 'var(--space-0_75)', borderRadius: 0 },
  },
})
/** The bar hides the pill at ≤480px; reuse on a custom `xp` slot. */
export const lessonBarXpStyle = css({ [NARROW]: { display: 'none' } })
