import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { BrandMark } from '@bits/ui/brand-mark'
import { CourseCover } from '@bits/ui/course-cover'
import { Document } from '@bits/ui/document'
import { HexBadge } from '@bits/ui/hex-badge'

import { platform } from '#platform'

import { APP_NAME, APP_TAGLINE, APP_TITLE } from '../../config.ts'
import type { CourseDetail } from '../../content/types.ts'

export type CardContent =
  | { kind: 'home' }
  | { kind: 'course'; course: CourseDetail }
  | { kind: 'certificate'; course: CourseDetail; badgeColor: string }

/** The site's host for the card footer, from CANONICAL_ORIGIN. */
function host(): string {
  let origin = platform.env.CANONICAL_ORIGIN
  return origin ? new URL(origin).host : 'localhost'
}

/**
 * One link-preview card at exactly 1200×630 (decision 028), drawn with the
 * design system's own cover, badge and type. `pnpm og` screenshots these;
 * they're also handy to review in a browser.
 */
export function CardPage(handle: Handle<{ card: CardContent; title: string }>) {
  return () => {
    let { card, title } = handle.props
    return (
      <Document
        assets={platform.assets}
        title={title}
        head={
          <>
            <meta name="robots" content="noindex" />
            {/* The card fills the 1200px screenshot exactly: no reserved scrollbar
                gutter here (base.css reserves one on every other page; decision 049). */}
            <style>{'html { scrollbar-gutter: auto; }'}</style>
          </>
        }
      >
        <div mix={cardStyle} data-og-card="">
          <div mix={textCol}>
            <p mix={brandStyle}>
              <BrandMark size={40} />
              <span>{APP_NAME}</span>
            </p>
            {card.kind === 'home' ? <HomeText /> : <CourseText card={card} />}
            <p mix={footStyle}>
              <span>{host()}</span>
              <span aria-hidden="true">·</span>
              <span>free, forever</span>
            </p>
          </div>
          {card.kind === 'home' ? (
            <div mix={homeArt} aria-hidden="true">
              <BrandMark size={300} />
            </div>
          ) : (
            <div mix={artCol}>
              <CourseCover
                pattern={card.course.pattern}
                tone={card.course.tone}
                sigil={card.course.sigil}
                variant="art"
                mix={coverStyle}
              />
              {card.kind === 'certificate' ? (
                <span mix={badgeStyle}>
                  <HexBadge name={card.course.badge.name} glyph={card.course.badge.glyph} color={card.badgeColor} />
                </span>
              ) : null}
            </div>
          )}
        </div>
      </Document>
    )
  }
}

function HomeText() {
  return () => (
    <div mix={middleStyle}>
      <p mix={eyebrowStyle}>Free AI engineering, distilled</p>
      <h1 mix={[titleStyle, homeTitle]}>{APP_TAGLINE}</h1>
      <p mix={leadStyle}>Short lessons, real prompts, a live Claude sandbox. From “what’s a token?” to your first agent.</p>
    </div>
  )
}

function CourseText(handle: Handle<{ card: Exclude<CardContent, { kind: 'home' }> }>) {
  return () => {
    let { card } = handle.props
    let { course } = card
    let certificate = card.kind === 'certificate'
    return (
      <div mix={middleStyle}>
        <p mix={eyebrowStyle}>
          {certificate ? 'Certificate · course complete' : `${course.track} · ${course.level}`}
        </p>
        <h1 mix={titleStyle}>{course.title}</h1>
        <p mix={leadStyle}>
          {certificate
            ? `Every lesson finished on ${APP_TITLE}.`
            : `${course.lessons} lessons · ~${course.mins} min · free on ${APP_TITLE}`}
        </p>
      </div>
    )
  }
}

const cardStyle = css({
  width: 'var(--og-width)',
  height: 'var(--og-height)',
  overflow: 'hidden',
  boxSizing: 'border-box',
  padding: 'var(--space-16)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-12)',
  background: 'radial-gradient(circle at 85% 20%, var(--volt-a08), transparent 55%), var(--ink)',
  color: 'var(--text)',
})
const textCol = css({
  flex: 1,
  minWidth: 0,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
})
const brandStyle = css({
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--fs-32)',
  letterSpacing: 'var(--type-wordmark-tracking)',
})
const middleStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' })
const eyebrowStyle = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-20)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  color: 'var(--volt)',
})
const titleStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--fs-56)',
  lineHeight: 1.08,
  letterSpacing: 'var(--tracking-display)',
  display: '-webkit-box',
  WebkitLineClamp: '3',
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
})
const homeTitle = css({ fontSize: 'var(--fs-64)' })
const leadStyle = css({ margin: 0, fontSize: 'var(--fs-28)', lineHeight: 1.35, color: 'var(--text-lead)' })
const footStyle = css({
  margin: 0,
  display: 'flex',
  gap: 'var(--space-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-20)',
  color: 'var(--muted)',
})
const artCol = css({ position: 'relative', flex: 'none' })
const coverStyle = css({ width: 'var(--og-art)' })
const homeArt = css({ flex: 'none', display: 'grid', placeItems: 'center', width: 'var(--og-art)' })
const badgeStyle = css({
  position: 'absolute',
  right: 'calc(-1 * var(--space-4))',
  bottom: 'calc(-1 * var(--space-4))',
  display: 'grid',
  placeItems: 'center',
  padding: 'var(--space-3)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--ink)',
  border: '1px solid var(--volt-a35)',
  '& svg': { width: 'var(--og-badge)', height: 'var(--og-badge)' },
})
