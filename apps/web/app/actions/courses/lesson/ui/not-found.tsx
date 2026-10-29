import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'
import { PageFrame } from '@bits/ui/page-frame'
import { RuledSection } from '@bits/ui/ruled-section'

import type { Viewer } from '../../../../auth/identity.ts'
import { routes } from '../../../../routes.ts'
import { Layout } from '../../../../ui/layout.tsx'

/** 404 for an unknown course or lesson slug: one band of the ruled column (decision 047). */
export function LessonNotFoundPage(handle: Handle<{ course: string; currentPath: string; viewer: Viewer | null }>) {
  return () => {
    let { course, currentPath, viewer } = handle.props
    return (
      <Layout title="Lesson not found" currentPath={currentPath} viewer={viewer} bleed>
        <PageFrame mix={frameStyle}>
          <RuledSection rule={false} label="404 / lesson not found" aria-labelledby="lesson-404">
            <div mix={bodyStyle}>
              <h1 id="lesson-404" mix={titleStyle}>
                That lesson doesn’t exist.
              </h1>
              <p mix={hintStyle}>It may have moved, or the link has a typo.</p>
              <Keycap href={routes.courses.course.index.href({ course })} size="md">
                Back to the course
              </Keycap>
            </div>
          </RuledSection>
        </PageFrame>
      </Layout>
    )
  }
}

// The rails run to the bottom of the screen, as on every ruled page.
const frameStyle = css({ minHeight: 'calc(100dvh - var(--appbar-h))' })
const bodyStyle = css({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-4)', maxWidth: 'var(--read-width)' })
const titleStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 'var(--fs-24)',
  letterSpacing: 'var(--tracking-title)',
  lineHeight: 'var(--type-heading-leading)',
  color: 'var(--text)',
})
const hintStyle = css({ margin: 0, fontSize: 'var(--fs-16)', color: 'var(--text-body)' })
