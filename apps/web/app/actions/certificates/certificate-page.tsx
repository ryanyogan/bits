import type { Handle } from 'remix/component'
import { css, unsafeHTML } from 'remix/component'
import { BrandMark } from '@bits/ui/brand-mark'
import { Callout } from '@bits/ui/callout'
import { CourseCover } from '@bits/ui/course-cover'
import { HexBadge } from '@bits/ui/hex-badge'
import { Keycap } from '@bits/ui/keycap'
import { PageFrame } from '@bits/ui/page-frame'
import { RuledSection } from '@bits/ui/ruled-section'
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
 *
 * On the squared grid (decision 047) the certificate is one band of the
 * ruled frame, rail to rail: a mono strip, the title cell beside the cover,
 * and the facts as a row of cells. Printing drops the app bar and the
 * actions and keeps the colours, so the page prints as it looks.
 */
export function CertificatePage(handle: Handle<CertificatePageProps>) {
  return () => {
    let { certificate, viewer, shareUrl, currentPath } = handle.props
    let { course, name, badge } = certificate
    let path = routes.certificates.show.href({ handle: certificate.handle, course: course.slug })
    let profileHref = routes.profile.index.href({ handle: certificate.handle })
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
        head={
          <>
            {certificate.isPrivate ? <meta name="robots" content="noindex" /> : null}
            <style data-rmx-key="certificate-print" innerHTML={unsafeHTML(printStyles)} />
          </>
        }
        bleed
      >
        <PageFrame>
          {certificate.isPrivate ? (
            <RuledSection as="div" rule={false} pad="tight" mix={noPrint}>
              <Callout tone="info" title="Only you can see this.">
                Your profile is private, so this certificate is too. Make your profile public in{' '}
                <a href={routes.settings.index.href()} data-rmx-prefetch={prefetchFor(routes.settings.index.href())}>
                  Settings
                </a>{' '}
                to share it.
              </Callout>
            </RuledSection>
          ) : null}

          <RuledSection as="div" rule={certificate.isPrivate} pad="none">
            <article aria-labelledby="certificate-title" mix={certStyle}>
              <div mix={stripStyle}>
                <p mix={brandStyle}>
                  <BrandMark size={22} />
                  <span>{APP_NAME}</span>
                </p>
                <p mix={kindStyle}>Certificate of completion</p>
              </div>

              <div mix={splitStyle}>
                <div mix={mainCell}>
                  <p mix={leadStyle}>Every lesson of</p>
                  <h1 id="certificate-title" mix={titleStyle}>
                    <span class="sr-only">{`${name} finished `}</span>
                    {course.title}
                  </h1>
                  <p mix={awardStyle}>
                    Finished by{' '}
                    <a href={profileHref} data-rmx-prefetch={prefetchFor(profileHref)} mix={nameStyle}>
                      {name}
                    </a>{' '}
                    <span mix={handleStyle}>@{certificate.handle}</span>
                  </p>
                </div>
                <div mix={artCell}>
                  <div mix={coverWrap}>
                    <CourseCover pattern={course.pattern} tone={course.tone} sigil={course.sigil} variant="art" mix={coverFill} />
                    <span mix={badgeStyle}>
                      <HexBadge name={`Badge: ${badge.name}`} glyph={badge.glyph} color={badge.color} />
                    </span>
                  </div>
                </div>
              </div>

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
                <div>
                  <dt>Badge</dt>
                  <dd>{badge.name}</dd>
                </div>
              </dl>
            </article>
          </RuledSection>

          <RuledSection as="div" pad="tight" mix={noPrint}>
            <div mix={footStyle}>
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
          </RuledSection>
        </PageFrame>
      </Layout>
    )
  }
}

// Print (static, trusted CSS in the `app` layer, which outranks every
// mixin): keep the dark ground and accents exactly, and drop the app bar;
// the private notice and the actions band hide themselves (`noPrint`).
const printStyles = `@layer app {
  @media print {
    :root { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    body > header { display: none; }
  }
}`

const WIDE = '@media (min-width: 1024px)'
const NARROW = '@media (max-width: 1023.98px)'
const PHONE = '@media (max-width: 759.98px)'
const MOBILE = '@media (max-width: 480px)'
const FORCED = '@media (forced-colors: active)'
const line = 'var(--border-w) solid var(--line-cell)'

const noPrint = css({ '@media print': { display: 'none' } })

const certStyle = css({ position: 'relative', [FORCED]: { '& *': { borderColor: 'GrayText' } } })
// A volt signal along the certificate's top edge.
const stripStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
  flexWrap: 'wrap',
  minHeight: 'var(--touch-target)',
  padding: 'var(--space-2) var(--cell-pad)',
  boxSizing: 'border-box',
  borderBottom: line,
  boxShadow: 'inset 0 var(--border-w-strong) 0 var(--volt)',
})
const brandStyle = css({
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--fs-18)',
  letterSpacing: 'var(--type-wordmark-tracking)',
})
const kindStyle = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--volt)' })

// 3:1, the profile's column line; stacked under 1024px.
const splitStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  [WIDE]: { gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1fr)', '& > :first-child': { borderRight: line } },
  [NARROW]: { '& > * + *': { borderTop: line } },
})
// Graph paper under the title, as under the profile's identity.
const mainCell = css({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 'var(--space-4)',
  minWidth: 0,
  padding: 'var(--space-16) var(--cell-pad)',
  backgroundImage:
    'linear-gradient(var(--field-grid) var(--border-w), transparent var(--border-w)), linear-gradient(90deg, var(--field-grid) var(--border-w), transparent var(--border-w))',
  backgroundSize: 'calc(var(--field-grid-step) / 2) calc(var(--field-grid-step) / 2)',
  backgroundPosition: 'calc(var(--border-w) * -1) calc(var(--border-w) * -1)',
  [MOBILE]: { padding: 'var(--space-10) var(--cell-pad)' },
})
const leadStyle = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--muted)' })
const titleStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'var(--type-display-cert-size)',
  lineHeight: 'var(--type-display-cta-leading)',
  letterSpacing: 'var(--tracking-display)',
  overflowWrap: 'anywhere',
  textWrap: 'balance',
  [MOBILE]: { fontSize: 'var(--fs-30)' },
})
const awardStyle = css({ margin: 0, fontSize: 'var(--fs-18)', lineHeight: 1.5, color: 'var(--text-lead)' })
const nameStyle = css({ color: 'var(--text)', fontWeight: 600 })
const handleStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-14)', color: 'var(--muted)' })

const artCell = css({
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  minWidth: 0,
  padding: 'var(--cell-pad)',
  [PHONE]: { padding: 'var(--space-6) var(--cell-pad)' },
})
const coverWrap = css({ position: 'relative', width: '100%', maxWidth: '340px' })
const coverFill = css({ width: '100%' })
// The badge sits over the cover's bottom-right corner, on an ink square with a hairline.
const badgeStyle = css({
  position: 'absolute',
  right: 'calc(-1 * var(--space-3))',
  bottom: 'calc(-1 * var(--space-3))',
  display: 'grid',
  placeItems: 'center',
  padding: 'var(--space-1_5)',
  background: 'var(--ink)',
  border: line,
})

// Four facts as a flush row of cells (2 × 2 under 760px, stacked on
// phones); each draws its top border and, unless it ends a row, its right.
const factsStyle = css({
  margin: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  '& > div': {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1_5)',
    minWidth: 0,
    padding: 'var(--space-5) var(--cell-pad)',
    borderTop: line,
    borderRight: line,
  },
  '& > div:nth-child(4n)': { borderRight: 0 },
  [PHONE]: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    '& > div:nth-child(2n)': { borderRight: 0 },
  },
  [MOBILE]: {
    gridTemplateColumns: 'minmax(0, 1fr)',
    '& > div': { borderRight: 0, padding: 'var(--space-4) var(--cell-pad)' },
  },
  '& dt': { fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--dim)' },
  '& dd': { margin: 0, fontSize: 'var(--fs-15)', color: 'var(--text-body)' },
})

const footStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4) var(--space-8)',
})
const actionsStyle = css({ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' })
const noteStyle = css({ margin: 0, flex: '1 1 320px', maxWidth: '60ch', fontSize: 'var(--fs-13)', lineHeight: 1.5, color: 'var(--dim)' })
