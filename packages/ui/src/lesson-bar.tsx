import type { Handle, MixInput } from 'remix/component'
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
      position = 'sticky',
      mix,
    } = handle.props
    return (
      <header mix={[barStyle, position === 'sticky' ? stickyStyle : undefined, mix]}>
        <BackButton href={backHref} label={backLabel} />
        <div mix={titleBlock}>
          <span mix={contextStyle}>{context}</span>
          <span mix={titleStyle}>{title}</span>
        </div>
        <SegmentedProgress segments={segments} label={progressLabel} mix={progressStyle} />
        <SegmentedTabs label="Lesson format" items={modes} />
        {neurons !== undefined ? <XpPill neurons={neurons} mix={xpStyle} /> : null}
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
  [NARROW]: { gap: 'var(--space-3)', padding: 'var(--space-3) var(--page-gutter)' },
})
const stickyStyle = css({
  position: 'sticky',
  top: 0,
  zIndex: 5,
  WebkitBackdropFilter: 'blur(var(--blur-glass))',
  backdropFilter: 'blur(var(--blur-glass))',
})
const titleBlock = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-0_5)', minWidth: 0, flex: '0 1 auto' })
const contextStyle = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})
const titleStyle = css({
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 'var(--fs-17)',
  letterSpacing: 'var(--tracking-title)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})
const progressStyle = css({
  flex: '1 1 160px',
  maxWidth: '280px',
  margin: '0 auto',
  [NARROW]: { order: 10, flexBasis: '100%', maxWidth: 'none' },
})
const xpStyle = css({ [NARROW]: { display: 'none' } })
