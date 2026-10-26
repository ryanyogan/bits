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
  /** `sticky` glass (canonical, resolutions §5) or `static` (in-page demos). */
  position?: 'sticky' | 'static'
  mix?: MixInput<HTMLElement>
}

/**
 * The compact lesson header (components §3.1c; canonical for Read, Watch and
 * Terminal modes): back, course context + lesson title, segmented progress,
 * mode tabs (links) and neurons. Static.
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
    return (
      <header mix={[barStyle, position === 'sticky' ? stickyStyle : undefined, mix]}>
        <BackButton href={backHref} label={backLabel} />
        <div mix={titleBlock}>
          <span mix={contextStyle}>{context}</span>
          {titleAs === 'h1' ? <h1 mix={titleStyle}>{title}</h1> : <span mix={titleStyle}>{title}</span>}
        </div>
        <SegmentedProgress segments={segments} label={progressLabel} mix={progressStyle} />
        <SegmentedTabs label="Lesson format" items={modes} />
        {xp !== undefined ? xp : neurons !== undefined ? <XpPill neurons={neurons} mix={lessonBarXpStyle} /> : null}
      </header>
    )
  }
}

const NARROW = '@media (max-width: 480px)'

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
  maxWidth: '280px',
  margin: '0 auto',
  [NARROW]: { order: 10, flex: '1 1 72px', maxWidth: 'none', margin: 0 },
})
/** The bar hides the pill at ≤480px; reuse on a custom `xp` slot. */
export const lessonBarXpStyle = css({ [NARROW]: { display: 'none' } })
