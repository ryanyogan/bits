import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Eyebrow } from '@bits/ui/eyebrow'
import { Keycap } from '@bits/ui/keycap'
import { PageFrame } from '@bits/ui/page-frame'
import { RuledSection } from '@bits/ui/ruled-section'

import type { Viewer } from '../../../auth/identity.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'

export interface CourseNotFoundPageProps {
  slug: string
  viewer: Viewer | null
  coursesHref: string
}

/** 404 for an unknown `/courses/:course`: one open band of the ruled frame (decision 047), then a closing rule. */
export function CourseNotFoundPage(handle: Handle<CourseNotFoundPageProps>) {
  return () => {
    let { slug, viewer, coursesHref } = handle.props
    return (
      <Layout title="Course not found" viewer={viewer} currentPath={routes.courses.index.href()} bleed>
        <div mix={pageStyle}>
          <PageFrame>
            <RuledSection as="div" rule={false} pad="none">
              <div mix={boxStyle}>
                <Eyebrow tone="ion">404 · no such course</Eyebrow>
                <h1 mix={h1Style}>That course isn't here.</h1>
                <p mix={hintStyle}>
                  Nothing lives at <code mix={codeStyle}>{`/courses/${slug}`}</code>. It may have been renamed, or the link
                  has a typo.
                </p>
                <div mix={actionsStyle}>
                  <Keycap size="lg" href={coursesHref}>
                    Browse courses →
                  </Keycap>
                </div>
              </div>
            </RuledSection>
            <RuledSection as="div" pad="none">
              <div mix={tailStyle} />
            </RuledSection>
          </PageFrame>
        </div>
      </Layout>
    )
  }
}

// Clips the rules' 100vw overflow (see course-page.tsx).
const pageStyle = css({ overflowX: 'clip' })
const tailStyle = css({ height: 'var(--space-16)' })
const boxStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-4)',
  padding: 'var(--space-24) var(--section-pad-x)',
  textAlign: 'center',
  '@media (max-width: 480px)': { padding: 'var(--space-16) var(--section-pad-x)' },
})
const h1Style = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(32px, 4.4vw, 52px)',
  lineHeight: 1,
  letterSpacing: 'var(--tracking-tight)',
  textWrap: 'balance',
})
const hintStyle = css({ margin: 0, maxWidth: '52ch', fontSize: 'var(--fs-16)', lineHeight: 1.6, color: 'var(--muted)' })
const codeStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-14)', color: 'var(--text-quiet)', overflowWrap: 'anywhere' })
const actionsStyle = css({ paddingTop: 'var(--space-2)' })
