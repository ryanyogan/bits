import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { CourseCover, type CoverPattern } from './course-cover.tsx'
import { type ForcedState } from './lib/states.ts'
import { toneVars, type Tone } from './lib/tone.ts'
import { ProgressBar } from './progress-bar.tsx'
import { Tag } from './tag.tsx'

export type CourseFormat = 'text' | 'video' | 'code'

export interface CourseCardProps {
  href: string
  title: string
  desc: string
  /** Track name, shown uppercase on the cover. */
  track: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  lessons: number
  mins: number
  sigil: string
  tone: Tone
  pattern: CoverPattern
  formats: CourseFormat[]
  /** 0 = not started (no bar), 100 = done (DoneTag). */
  pct?: number
  /** Heading level of the title inside the card. */
  headingLevel?: 2 | 3
  forceState?: ForcedState
  mix?: MixInput<HTMLElement>
}

/**
 * Catalog course card (components §9.2): the whole card is one link. Hover
 * and focus lift and tilt it and scale the sigil; reduced motion keeps only
 * the border change. Static.
 */
export function CourseCard(handle: Handle<CourseCardProps>) {
  return () => {
    let { href, title, desc, track, level, lessons, mins, sigil, tone, pattern, formats, pct = 0, headingLevel = 3, forceState, mix } =
      handle.props
    let done = pct >= 100
    let started = pct > 0 && !done
    let heading = headingLevel === 2 ? <h2 mix={titleStyle}>{title}</h2> : <h3 mix={titleStyle}>{title}</h3>
    return (
      <a href={href} data-force={forceState} mix={[cardStyle, toneVars[tone], mix]}>
        <CourseCover pattern={pattern} tone={tone} sigil={sigil}>
          <Tag variant="cover" color="var(--tone)" mix={coverTagPos}>
            {track}
          </Tag>
          {done ? (
            <Tag variant="done" mix={doneTagPos}>
              ✓ DONE
            </Tag>
          ) : null}
        </CourseCover>
        <div mix={bodyStyle}>
          {heading}
          <p mix={descStyle}>{desc}</p>
          <p mix={metaStyle}>
            <span>{level}</span>
            <span aria-hidden="true">·</span>
            <span>{`${lessons} lessons`}</span>
            <span aria-hidden="true">·</span>
            <span>{`${mins} min`}</span>
          </p>
          <div mix={formatsStyle}>
            {formats.map((format) => (
              <Tag key={format} variant="format">
                {format}
              </Tag>
            ))}
          </div>
          {started ? (
            <div mix={progressRow}>
              <ProgressBar pct={pct} variant="card" color="var(--tone)" />
              <span mix={pctStyle}>
                {`${Math.round(pct)}%`}
                <span class="sr-only"> complete</span>
              </span>
            </div>
          ) : null}
        </div>
      </a>
    )
  }
}

const LIFT = '&:hover, &:focus-visible, &[data-force="hover"], &[data-force="focus"]'

const cardStyle = css({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  textDecoration: 'none',
  color: 'var(--text)',
  borderRadius: 'var(--radius-20)',
  overflow: 'hidden',
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  transition:
    'transform var(--duration-card) var(--ease), border-color var(--duration-card) var(--ease), box-shadow var(--duration-card) var(--ease)',
  [LIFT]: {
    color: 'var(--text)',
    transform: 'translateY(-6px) rotate(-0.4deg)',
    borderColor: 'var(--volt-a40)',
    boxShadow: 'var(--shadow-card-hover)',
  },
  '&:hover .sigil, &:focus-visible .sigil, &[data-force] .sigil': { transform: 'scale(1.08) translateY(-4px)' },
  '&:focus-visible, &[data-force="focus"]': {
    outline: '2px solid var(--focus-ring-color)',
    outlineOffset: '2px',
    boxShadow: 'var(--shadow-card-hover), var(--focus-ring)',
  },
  '@media (prefers-reduced-motion: reduce)': {
    '&, &:hover, &:focus-visible, &[data-force]': { transform: 'none' },
    '&:hover .sigil, &:focus-visible .sigil, &[data-force] .sigil': { transform: 'none' },
  },
})

const coverTagPos = css({ position: 'absolute', top: 'var(--space-3)', left: 'var(--space-3)' })
const doneTagPos = css({ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)' })

const bodyStyle = css({ flex: 1, padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' })
const titleStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 'var(--fs-19)',
  lineHeight: 1.2,
  letterSpacing: 'var(--tracking-title)',
})
const descStyle = css({ margin: 0, fontSize: 'var(--fs-14)', lineHeight: 1.55, color: 'var(--muted)' })
const metaStyle = css({
  margin: 0,
  marginTop: 'auto',
  paddingTop: 'var(--space-2)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  flexWrap: 'wrap',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
})
const formatsStyle = css({ display: 'flex', gap: 'var(--space-1_5)', flexWrap: 'wrap' })
const progressRow = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-2_5)' })
const pctStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--tone)' })

/** The grid the cards sit in: `auto-fill minmax(min(290px,100%),1fr)`, gap 20. */
export const courseGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(290px, 100%), 1fr))',
  gap: 'var(--space-5)',
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

export interface WriteCourseCardProps {
  href: string
  forceState?: ForcedState
}

/** The dashed "+ .md Write a course" last grid item (components §9.3). Static. */
export function WriteCourseCard(handle: Handle<WriteCourseCardProps>) {
  return () => (
    <a href={handle.props.href} data-force={handle.props.forceState} mix={writeStyle}>
      <span aria-hidden="true" mix={writeMark}>
        + .md
      </span>
      <span mix={titleStyle}>Write a course</span>
      <span mix={descStyle}>Courses are plain markdown files with a few special blocks. Drop a folder, get a course.</span>
    </a>
  )
}

const writeStyle = css({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 'var(--space-3_5)',
  minHeight: '380px',
  padding: 'var(--space-7)',
  textDecoration: 'none',
  color: 'var(--text)',
  borderRadius: 'var(--radius-20)',
  border: '1px dashed var(--line-dashed-strong)',
  transition: 'border-color var(--duration-card) var(--ease)',
  '&:hover, &[data-force="hover"]': { color: 'var(--text)', borderColor: 'var(--volt-a40)' },
  '&:focus-visible, &[data-force="focus"]': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
  '@media (max-width: 480px)': { minHeight: 'auto' },
})
const writeMark = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-28)', color: 'var(--volt)' })
