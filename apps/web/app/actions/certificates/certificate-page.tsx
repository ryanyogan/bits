import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { BrandMark } from '@bits/ui/brand-mark'
import { Callout } from '@bits/ui/callout'
import { CourseCover } from '@bits/ui/course-cover'
import { Eyebrow } from '@bits/ui/eyebrow'
import { HexBadge } from '@bits/ui/hex-badge'
import { Keycap } from '@bits/ui/keycap'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import type { Viewer } from '../../auth/identity.ts'
import { APP_NAME, APP_TITLE } from '../../config.ts'
import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'
import { ogImage } from '../../ui/og.ts'
import { ShareButton } from '../profile/public/share-button.tsx'
import type { Certificate } from './data.ts'

export interface CertificatePageProps {
  certificate: Certificate
  viewer: Viewer | null
  /** Absolute URL of this page, for Share. */
  shareUrl: string
  currentPath: string
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/**
 * `/u/:handle/certificates/:course` (decision 028): a simple shareable page
 * per finished course (handoff: "no PDF"). The name, handle, course and date;
 * never the email or the prompt journal.
 */
export function CertificatePage(handle: Handle<CertificatePageProps>) {
  return () => {
    let { certificate, viewer, shareUrl, currentPath } = handle.props
    let { course, name, badge } = certificate
    let path = routes.certificates.show.href({ handle: certificate.handle, course: course.slug })
    let finished = dateFormat.format(certificate.finishedAt)
    let lessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
    let title = `${name} finished ${course.title}`

    return (
      <Layout
        title={`${course.title} · Certificate for ${name}`}
        description={`${name} (@${certificate.handle}) finished every lesson of “${course.title}” on ${APP_TITLE}, ${finished}.`}
        viewer={viewer}
        currentPath={currentPath}
        canonicalPath={certificate.isPrivate ? undefined : path}
        image={ogImage(`certificate-${course.slug}`, `Certificate: ${course.title}, finished on ${APP_TITLE}`)}
        head={certificate.isPrivate ? <meta name="robots" content="noindex" /> : undefined}
      >
        <div mix={pageStyle}>
          {certificate.isPrivate ? (
            <Callout tone="info" title="Only you can see this.">
              Your profile is private, so this certificate is too. Make your profile public in{' '}
              <a href={routes.settings.index.href()} data-rmx-prefetch={prefetchFor(routes.settings.index.href())}>Settings</a> to share it.
            </Callout>
          ) : null}
          <article aria-labelledby="certificate-title" mix={certStyle}>
            <div mix={bodyStyle}>
              <p mix={brandStyle}>
                <BrandMark size={26} />
                <span>{APP_NAME}</span>
              </p>
              <Eyebrow tone="volt">Certificate of completion</Eyebrow>
              <h1 id="certificate-title" mix={titleStyle}>
                <span class="sr-only">{`${name} finished `}</span>
                {course.title}
              </h1>
              <p mix={awardStyle}>
                Finished by{' '}
                <a href={routes.profile.index.href({ handle: certificate.handle })} data-rmx-prefetch={prefetchFor(routes.profile.index.href({ handle: certificate.handle }))} mix={nameStyle}>
                  {name}
                </a>{' '}
                <span mix={handleStyle}>@{certificate.handle}</span>
              </p>
              <dl mix={factsStyle}>
                <div>
                  <dt>Finished</dt>
                  <dd>{finished}</dd>
                </div>
                <div>
                  <dt>Lessons</dt>
                  <dd>{`${lessons} of ${lessons}`}</dd>
                </div>
                <div>
                  <dt>Course</dt>
                  <dd>{`${course.level} · ${course.track} · ~${course.mins} min`}</dd>
                </div>
              </dl>
            </div>
            <div mix={artStyle}>
              <CourseCover pattern={course.pattern} tone={course.tone} sigil={course.sigil} variant="art" />
              <span mix={badgeStyle}>
                <HexBadge name={`Badge: ${badge.name}`} glyph={badge.glyph} color={badge.color} />
              </span>
            </div>
          </article>
          <div mix={actionsStyle}>
            {certificate.isPrivate ? null : <ShareButton url={shareUrl} title={title} />}
            <Keycap variant="ghost-mono" href={routes.courses.course.index.href({ course: course.slug })}>
              Take this course →
            </Keycap>
          </div>
          <p mix={noteStyle}>
            Every lesson's checks were passed on {APP_TITLE}, where the server re-runs them on each save. This is a
            record of finishing a free course, not an accredited qualification.
          </p>
        </div>
      </Layout>
    )
  }
}

const pageStyle = css({
  maxWidth: 'var(--watch-width)',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-6)',
})
const certStyle = css({
  display: 'flex',
  flexWrap: 'wrap-reverse',
  alignItems: 'center',
  gap: 'var(--space-8)',
  padding: 'var(--space-10)',
  border: 'var(--border-w) solid var(--volt-a35)',
  borderRadius: 'var(--radius-2xl)',
  background: 'var(--volt-a05)',
  '@media (max-width: 760px)': { padding: 'var(--space-6)', gap: 'var(--space-6)' },
})
const bodyStyle = css({ flex: '999 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' })
const brandStyle = css({
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--type-wordmark-size)',
  letterSpacing: 'var(--type-wordmark-tracking)',
})
const titleStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontSize: 'var(--type-h2-size)',
  lineHeight: 'var(--type-h2-leading)',
  letterSpacing: 'var(--type-h2-tracking)',
  overflowWrap: 'anywhere',
})
const awardStyle = css({ margin: 0, fontSize: 'var(--fs-18)', color: 'var(--text-lead)' })
const nameStyle = css({ color: 'var(--text)', fontWeight: 600 })
const handleStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-14)', color: 'var(--muted)' })
const factsStyle = css({
  margin: 'var(--space-2) 0 0',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-4) var(--space-8)',
  '& div': { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  '& dt': {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--type-eyebrow-size)',
    letterSpacing: 'var(--type-eyebrow-tracking)',
    textTransform: 'uppercase',
    color: 'var(--dim)',
  },
  '& dd': { margin: 0, fontSize: 'var(--fs-15)', color: 'var(--text-body)' },
})
const artStyle = css({ position: 'relative', flex: '1 1 220px', maxWidth: '100%' })
const badgeStyle = css({
  position: 'absolute',
  right: 'var(--space-3)',
  bottom: 'var(--space-3)',
  display: 'grid',
  placeItems: 'center',
  padding: 'var(--space-1_5)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--ink)',
})
const actionsStyle = css({ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' })
const noteStyle = css({ margin: 0, fontSize: 'var(--fs-13)', lineHeight: 1.5, color: 'var(--dim)' })
