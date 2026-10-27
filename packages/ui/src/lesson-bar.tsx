import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { BackButton } from './back-button.tsx'
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
  neurons?: number
  /** Replaces the XpPill slot, e.g. an island that re-renders the pill after a reward. */
  xp?: RemixNode
  /** Render the lesson title as the page's `<h1>` (lesson pages) instead of a span. */
  titleAs?: 'span' | 'h1'
  /**
   * `shell`: the lesson sub-bar inside the AppBar's sticky header (pass it as
   * `AppBar`'s `sub`; decision 022). One row, `--lessonbar-h` tall, aligned
   * to the AppBar's column, no glass of its own. Under 760px it keeps back +
   * title only; render `LessonModes` at the top of the page for the tabs and
   * progress. `sticky`: a standalone glass bar pinned at the top (no
   * AppBar). `static`: in-page demos.
   */
  position?: 'shell' | 'sticky' | 'static'
  mix?: MixInput<HTMLElement>
}

/**
 * The compact lesson header (components §3.1c; canonical for Read, Watch and
 * Terminal modes): back, course context + lesson title, segmented progress,
 * mode tabs (links) and neurons. Static. On lesson pages it is the AppBar's
 * sub-bar (`position="shell"`), and the AppBar carries the neurons.
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
        {xp !== undefined ? xp : neurons !== undefined ? <XpPill neurons={neurons} mix={lessonBarXpStyle} /> : null}
      </>
    )
    if (shell) {
      // Inside the AppBar's <header> (one banner landmark), so not a <header>.
      return (
        <div mix={[shellStyle, mix]}>
          <div mix={shellInner}>{children}</div>
        </div>
      )
    }
    return <header mix={[barStyle, position === 'sticky' ? stickyStyle : undefined, mix]}>{children}</header>
  }
}

export interface LessonModesProps {
  segments: SegmentState[]
  progressLabel: string
  modes: SegmentedTabItem[]
  mix?: MixInput<HTMLElement>
}

/**
 * The shell sub-bar's mode tabs + segmented progress, for screens under
 * 760px, where the sticky header keeps only back + title (decision 022).
 * Put it at the top of the lesson; it scrolls with the page and hides at
 * 760px and up. Static.
 */
export function LessonModes(handle: Handle<LessonModesProps>) {
  return () => {
    let { segments, progressLabel, modes, mix } = handle.props
    return (
      <div mix={[modesRow, mix]}>
        <SegmentedTabs label="Lesson format" items={modes} />
        <div data-lesson-progress mix={modesProgress}>
          <SegmentedProgress segments={segments} label={progressLabel} />
        </div>
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
  borderBottom: '1px solid var(--line-bar)',
  [NARROW]: { gap: 'var(--space-2) var(--space-3)', padding: 'var(--space-1_5) var(--page-gutter)' },
})
const stickyStyle = css({
  position: 'sticky',
  top: 0,
  zIndex: 5,
  WebkitBackdropFilter: 'blur(var(--blur-glass))',
  backdropFilter: 'blur(var(--blur-glass))',
})
// The AppBar's glass shows through; a hairline separates the two rows.
const shellStyle = css({ borderTop: '1px solid var(--line-hair)' })
const shellInner = css({
  // Fixed height (tokens: --lessonbar-h) so the outline's sticky offset agrees.
  height: 'calc(var(--lessonbar-h) - 1px)',
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: '0 var(--page-gutter)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-5)',
  [SHELL_NARROW]: { gap: 'var(--space-3)' },
})
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
})
const titleStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 'var(--fs-17)',
  letterSpacing: 'var(--tracking-title)',
  lineHeight: 1.3,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
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
  [SHELL_NARROW]: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)' },
})
const modesProgress = css({ flex: '1 1 72px', minWidth: 0 })
/** The bar hides the pill at ≤480px; reuse on a custom `xp` slot. */
export const lessonBarXpStyle = css({ [NARROW]: { display: 'none' } })
