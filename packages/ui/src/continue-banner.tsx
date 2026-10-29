import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { CourseCover, type CoverPattern } from './course-cover.tsx'
import { Eyebrow } from './eyebrow.tsx'
import { keycapFace } from './keycap.tsx'
import { prefetchFor, type PrefetchProp } from './lib/prefetch.ts'
import { focusOutline, type ForcedState } from './lib/states.ts'
import { toneVars, type Tone } from './lib/tone.ts'
import { ProgressBar } from './progress-bar.tsx'

export interface ContinueBannerProps {
  href: string
  courseTitle: string
  /** e.g. "Continue · lesson 6 of 8". */
  eyebrow: string
  nextLesson: string
  mins: number
  pct: number
  sigil: string
  tone: Tone
  pattern: CoverPattern
  /**
   * `boxed` (default): its own hairline box. `flush`: fills a ruled band of
   * a `PageFrame` rail to rail (decision 047), on the flat `--cell-fill`,
   * with a hairline between the art and the text.
   */
  edge?: 'boxed' | 'flush'
  /** Prefetch the page on hover/focus (`intent`, the default), on `viewport`, or not (`false`). Decision 042. */
  prefetch?: PrefetchProp
  forceState?: ForcedState
  mix?: MixInput<HTMLElement>
}

/**
 * "Continue where you left off" banner (components §9.4). The whole banner is
 * one link; the "Resume →" keycap inside is visual. Static; the page decides
 * whether to show it (server-side for signed-in users).
 */
export function ContinueBanner(handle: Handle<ContinueBannerProps>) {
  return () => {
    let { href, courseTitle, eyebrow, nextLesson, mins, pct, sigil, tone, pattern, edge = 'boxed', prefetch, forceState, mix } = handle.props
    return (
      <a href={href} data-rmx-prefetch={prefetchFor(href, prefetch)} data-force={forceState} mix={[bannerStyle, edge === 'flush' ? flushStyle : undefined, toneVars[tone], mix]}>
        <CourseCover pattern={pattern} tone={tone} sigil={sigil} variant="banner" mix={artNarrow} />
        <div mix={bodyStyle}>
          <Eyebrow tone="ion" size="sm">
            {eyebrow}
          </Eyebrow>
          <span mix={titleStyle}>{courseTitle}</span>
          <span mix={nextStyle}>
            Up next: <span mix={nextTitle}>{nextLesson}</span> · about {mins} min
          </span>
          <span mix={rowStyle}>
            <ProgressBar pct={pct} variant="banner" color="var(--ion)" mix={barNarrow} />
            <span mix={pctStyle}>
              {`${Math.round(pct)}%`}
              <span class="sr-only"> complete</span>
            </span>
            <span aria-hidden="true" class="key" mix={[...keycapFace, keyNarrow]}>
              Resume →
            </span>
          </span>
        </div>
      </a>
    )
  }
}

const bannerStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)',
  textDecoration: 'none',
  color: 'var(--text)',
  borderRadius: 'var(--radius-2xl)',
  overflow: 'hidden',
  border: 'var(--border-w) solid var(--line-cell)',
  background: 'var(--surface)',
  transition: 'border-color var(--duration-card) var(--ease)',
  '&:hover, &[data-force="hover"]': { color: 'var(--text)', borderColor: 'var(--ion-a50)', background: 'var(--raised)' },
  '&:hover .key, &[data-force="hover"] .key': { background: 'var(--volt-hover)' },
  '&:focus-visible, &[data-force="focus"]': focusOutline,
  // The art and the text are two cells: a hairline between them, on the
  // side or (stacked) underneath.
  '& > .cover': { borderRight: 'var(--border-w) solid var(--line-cell)' },
  '@media (max-width: 759.98px)': {
    gridTemplateColumns: 'minmax(0, 1fr)',
    '& > .cover': { borderRight: 0, borderBottom: 'var(--border-w) solid var(--line-cell)' },
  },
})
const flushStyle = css({
  border: 0,
  background: 'var(--cell-fill)',
  transition: 'background-color var(--duration-fast) var(--ease), box-shadow var(--duration-fast) var(--ease)',
  '&:hover, &[data-force="hover"]': { background: 'var(--cell-fill-hover)', boxShadow: 'inset 0 var(--border-w-strong) 0 var(--ion)' },
  '&:focus-visible, &[data-force="focus"]': { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset-inset)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})
const bodyStyle = css({
  padding: 'var(--space-7) var(--cell-pad)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 'var(--space-3_5)',
  '@media (max-width: 480px)': { padding: 'var(--space-5) var(--cell-pad)' },
})
const titleStyle = css({
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--fs-28)',
  letterSpacing: '-0.03em',
  lineHeight: 1.15,
  '@media (max-width: 480px)': { fontSize: 'var(--fs-22)' },
})
const nextStyle = css({ fontSize: 'var(--fs-16)', color: 'var(--muted)' })
const nextTitle = css({ color: 'var(--text)' })
const rowStyle = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-3_5)', flexWrap: 'wrap' })
const pctStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--ion)' })

// Catalog.md responsive (360px): shorter art with a 64px sigil, and the
// progress row wraps (bar full width, then % and the keycap pushed right).
// The sigil reads its size from --fs-88, so the art overrides that token.
const artNarrow = css({ '@media (max-width: 480px)': { minHeight: '140px', '--fs-88': '64px' } })
const barNarrow = css({ '@media (max-width: 480px)': { flexBasis: '100%' } })
const keyNarrow = css({ '@media (max-width: 480px)': { marginLeft: 'auto' } })
